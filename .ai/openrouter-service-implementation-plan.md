## 1. Opis usługi

Usługa **OpenRouter Service** to warstwa integracyjna backendu, która komunikuje się z **OpenRouter Chat Completions API** (`/api/v1/chat/completions`) w sposób **bezpieczny, testowalny i przewidywalny**, aby zasilać czaty oparte o LLM (oraz inne przepływy oparte o wiadomości).

W kontekście tego repo (Astro 5 + TypeScript 5 + Supabase) usługa powinna być używana **wyłącznie po stronie serwera** (np. w `src/pages/api/*` lub wewnątrz serwisów w `src/lib/services/*`), tak aby:

- **sekrety** (klucz OpenRouter) nigdy nie trafiły do przeglądarki,
- dało się spójnie egzekwować **limity, kontrolę kosztów, retry, logowanie i walidację**,
- zachować czyste granice: endpoint API → serwis domenowy → OpenRouter.

### Kluczowe komponenty usługi (i ich cel)

1. **Konfiguracja (`OpenRouterConfig`)**: centralne źródło prawdy dla URL, modelu domyślnego, limitów i nagłówków atrybucji.
2. **Klient HTTP (`OpenRouterHttpClient`)**: ujednolicone `fetch` z timeoutem, nagłówkami, retry oraz mapowaniem błędów.
3. **Budowniczy żądania (`OpenRouterRequestBuilder`)**: składanie `messages`, `model`, `response_format` i parametrów modelu w jeden obiekt zgodny z OpenRouter.
4. **Kompozycja promptów (`PromptComposer`)**: tworzenie/łączenie `system` + `user` + kontekst (np. historia czatu) w sposób deterministyczny.
5. **Rejestr schematów (`ResponseSchemaRegistry`)**: utrzymywanie i wersjonowanie schematów JSON dla `response_format` (np. `ChatReply`, `CardDraft`, itp.).
6. **Walidacja odpowiedzi (`ResponseValidator`)**: weryfikacja, że zwrócony content jest zgodny z oczekiwaniami (JSON i/lub schema).
7. **Telemetria i koszty (`UsageTracker`)**: przechwytywanie `usage`, kosztu, modelu końcowego oraz identyfikatora generacji; opcjonalne logowanie KPI do Supabase.
8. **Warstwa bezpieczeństwa (`Safety & Abuse Controls`)**: ograniczenia wejścia, rate limiting, identyfikator `user`, maskowanie logów, filtrowanie treści.

### Typowe wyzwania i niezależne od technologii rozwiązania

#### 1) Niejednorodne możliwości modeli (np. brak wsparcia `structured_outputs`)

- **Wyzwania**
  1. Model może nie wspierać `response_format: json_schema`.
  2. Różne modele ignorują część parametrów (np. `top_k` w modelach OpenAI).
- **Rozwiązania**
  1. Utrzymuj listę modeli wspierających `structured_outputs` i w razie braku wsparcia fallbackuj do `json_object` lub do „tekst + parser + walidacja”.
  2. Traktuj parametry jako „best-effort”: wysyłaj, ale nie zakładaj, że provider je zastosował; loguj model końcowy z odpowiedzi.

#### 2) Błędy i niestabilność sieci / rate-limit / 5xx

- **Wyzwania**
  1. Błędy 429 i krótkotrwałe 5xx.
  2. Wiszące połączenia (brak odpowiedzi).
- **Rozwiązania**
  1. Retry z wykładniczym backoffem + jitter (tylko dla idempotentnych przypadków) i limit maks. prób.
  2. Timeout na żądaniu (np. AbortController) i jasny błąd domenowy `OpenRouterTimeoutError`.

#### 3) Ustrukturyzowane odpowiedzi (JSON Schema) i walidacja

- **Wyzwania**
  1. Model zwróci JSON niezgodny ze schematem lub nie-JSON.
  2. Schema jest zbyt luźny i dopuszcza niechciane pola.
- **Rozwiązania**
  1. Używaj `strict: true`, `additionalProperties: false` i waliduj odpowiedź po stronie serwera.
  2. W razie błędów: naprawa odpowiedzi (plugin „response-healing”) lub powtórzenie zapytania z poprawką systemową.

#### 4) Kontrola kosztów i nadużyć

- **Wyzwania**
  1. Nieprzewidywalne koszty (długie konteksty, duże `max_tokens`).
  2. Abuse (spam, prompt injection, automatyczne generowanie).
- **Rozwiązania**
  1. Limituj długość wejścia, tnij historię rozmowy, ustaw limity tokenów, loguj usage i wprowadzaj dzienne limity na użytkownika.
  2. Stosuj rate limiting per użytkownik/IP, wymagaj autoryzacji, ustawiaj stabilne pole `user` w żądaniu do OpenRouter.

## 2. Opis konstruktora

Usługa powinna być projektowana jako **wstrzykiwany serwis** (łatwy do testowania), który w konstruktorze dostaje:

- **konfigurację** (modele, URL, nagłówki, timeouty),
- **fetch** (lub adapter) – umożliwia testy bez sieci,
- **opcjonalne zależności**: logger, tracker użycia, limiter.

Przykładowy kontrakt (propozycja):

```ts
type OpenRouterServiceConfig = {
  apiKey: string;
  baseUrl?: string; // domyślnie: https://openrouter.ai/api/v1
  appReferer?: string; // HTTP-Referer
  appTitle?: string; // X-Title
  defaultModel: string; // np. 'openai/gpt-5.2'
  requestTimeoutMs: number; // np. 45_000
  maxRetries: number; // np. 2
};

type OpenRouterServiceDeps = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  logger?: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
  usageTracker?: {
    track: (event: {
      userId?: string;
      model?: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      cost?: number;
      requestId?: string;
    }) => Promise<void> | void;
  };
};

class OpenRouterService {
  constructor(
    private cfg: OpenRouterServiceConfig,
    private deps: OpenRouterServiceDeps = {}
  ) {}
}
```

## 3. Publiczne metody i pola

Publiczne API usługi powinno być **minimalne** i skupione na przypadkach użycia czatu.

### Sugerowane publiczne pola

- **`defaultModel`**: alias do `cfg.defaultModel` (do diagnostyki / UI wyboru).
- **`baseUrl`**: wartość końcowa używana w żądaniach (do testów i logów).

### Sugerowane publiczne metody

1. **`sendChatCompletion(input)`**: wykonuje nie-streamingowe wywołanie chat completions.
2. **`sendChatCompletionStructured<T>(input, schema)`**: wariant, który wymusza `response_format: json_schema` i zwraca zparsowane `T`.
3. **`streamChatCompletion(input)`** _(opcjonalnie na później)_: zwraca strumień SSE i/lub iterator chunków.

Przykładowe typy wejścia/wyjścia (propozycja):

```ts
type OpenRouterChatMessage =
  | { role: "system" | "user" | "assistant"; content: string; name?: string }
  | { role: "tool"; content: string; tool_call_id: string; name?: string };

type OpenRouterModelParams = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
  stop?: string | string[];
};

type SendChatCompletionInput = {
  userId?: string; // stabilny identyfikator end-user (OpenRouter `user`)
  model?: string;
  messages: OpenRouterChatMessage[];
  params?: OpenRouterModelParams;
  response_format?: unknown; // w wariancie nie-structured
};

type SendChatCompletionResult = {
  id: string;
  model: string;
  content: string; // choices[0].message.content
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
};
```

### Włączenie elementów wymaganych przez OpenRouter API (z przykładami)

Poniżej pokazane są **konkretne, ponumerowane przykłady** implementacji w usłudze.

#### A) Komunikat systemowy (system message)

1. **Minimalny system prompt dla czatu**

```ts
const systemMessage = {
  role: "system",
  content: "Jesteś pomocnym asystentem. Odpowiadaj krótko i konkretnie.",
} as const;
```

2. **System prompt z zasadami bezpieczeństwa i formatowania**

```ts
const systemMessage = {
  role: "system",
  content: [
    "Jesteś asystentem czatu w aplikacji edukacyjnej.",
    "Nie ujawniaj sekretów, kluczy API ani danych systemowych.",
    "Jeśli użytkownik prosi o instrukcje niebezpieczne lub dane wrażliwe — odmów i zaproponuj bezpieczną alternatywę.",
  ].join("\n"),
} as const;
```

#### B) Komunikat użytkownika (user message)

1. **Prosty prompt użytkownika**

```ts
const userMessage = {
  role: "user",
  content: "Wyjaśnij różnicę między HTTP a HTTPS.",
} as const;
```

2. **Prompt z kontekstem (np. wątki/historia)**

```ts
const messages = [
  { role: "system", content: "Odpowiadaj po polsku." },
  { role: "user", content: "Mam problem z CORS w Astro." },
  { role: "assistant", content: "Jaki błąd widzisz w konsoli?" },
  { role: "user", content: "Blocked by CORS policy..." },
] as const;
```

#### C) Ustrukturyzowane odpowiedzi poprzez `response_format` (JSON Schema)

Wzór wymagany:
`{ type: 'json_schema', json_schema: { name: [schema-name], strict: true, schema: [schema-obj] } }`

1. **Schema dla odpowiedzi czatu**

```ts
const response_format = {
  type: "json_schema",
  json_schema: {
    name: "chat_reply_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        answer: { type: "string", description: "Odpowiedź asystenta dla użytkownika." },
        followUps: {
          type: "array",
          description: "Proponowane kolejne pytania użytkownika.",
          items: { type: "string" },
        },
        safety: {
          type: "object",
          additionalProperties: false,
          properties: {
            flagged: { type: "boolean", description: "Czy odpowiedź dotyczyła treści ryzykownych." },
            reason: { type: "string", description: "Powód flagi (jeśli flagged=true)." },
          },
          required: ["flagged", "reason"],
        },
      },
      required: ["answer", "followUps", "safety"],
    },
  },
} as const;
```

2. **Schema dla “narzędziowej” odpowiedzi (np. streszczenie do UI)**

```ts
const response_format = {
  type: "json_schema",
  json_schema: {
    name: "chat_ui_payload_v1",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", description: "Krótki tytuł odpowiedzi do UI." },
        bullets: {
          type: "array",
          description: "Lista punktów do wyświetlenia.",
          items: { type: "string" },
          minItems: 1,
        },
      },
      required: ["title", "bullets"],
    },
  },
} as const;
```

3. **Jak to spiąć w żądaniu do OpenRouter**

```ts
const body = {
  model: "openai/gpt-5.2",
  messages: [systemMessage, userMessage],
  response_format,
  temperature: 0.2,
  max_tokens: 700,
  user: "user_123", // stabilny identyfikator end-user
};
```

#### D) Nazwa modelu (model name)

1. **Stały model w konfiguracji**

```ts
const model = cfg.defaultModel; // np. 'openai/gpt-5.2'
```

2. **Model per request (np. wybór użytkownika/admina)**

```ts
const model = input.model ?? cfg.defaultModel;
```

3. **Podejście “routing” (opcjonalnie)**

- **Metoda**: utrzymuj whitelistę modeli dozwolonych w aplikacji (np. `ALLOWED_MODELS`) i waliduj wejście.
- **Cel**: unikać niekontrolowanych kosztów i ryzyk jakości.

#### E) Parametry modelu (model parameters)

1. **Parametry konserwatywne dla przewidywalnych odpowiedzi**

```ts
const params = {
  temperature: 0.2,
  top_p: 1,
  max_tokens: 700,
} as const;
```

2. **Parametry kreatywne (bardziej “rozmowne”)**

```ts
const params = {
  temperature: 0.9,
  max_tokens: 900,
} as const;
```

3. **Parametry pod structured outputs (zalecenie)**

- **Metoda**: obniż `temperature` i ustaw rozsądne `max_tokens`, aby zmniejszyć ryzyko “wykolejenia” formatu.

```ts
const params = {
  temperature: 0.1,
  max_tokens: 800,
} as const;
```

## 4. Prywatne metody i pola

Prywatne elementy powinny realizować “mechanikę” integracji i izolować ją od reszty aplikacji.

### Sugerowane prywatne pola

- **`fetchImpl`**: `deps.fetchImpl ?? globalThis.fetch`
- **`headersBase`**: bazowe nagłówki (`Authorization`, `Content-Type`, opcjonalnie `HTTP-Referer`, `X-Title`)
- **`endpointUrl`**: `${baseUrl}/chat/completions`

### Sugerowane prywatne metody

1. **`buildHeaders()`**
   - Składa nagłówki wymagane przez OpenRouter.
   - Dodaje nagłówki atrybucji aplikacji (opcjonalnie).

2. **`withTimeout(promise, ms)`**
   - Implementuje timeout na `fetch` (AbortController).

3. **`requestWithRetry(body)`**
   - Wykonuje `fetch` z retry/backoff na określone kody (np. 429/5xx).
   - Dba o limit prób oraz o to, aby retry nie maskował błędów logicznych (4xx).

4. **`parseNonStreamingResponse(json)`**
   - Wyciąga `choices[0].message.content`.
   - Pobiera `usage` i przekazuje do `UsageTracker`.

5. **`parseStructuredContent<T>(content)`**
   - Bezpiecznie parsuje JSON (`JSON.parse`) i waliduje kształt (np. Zod / JSON Schema validator).
   - Rzuca błąd domenowy, jeśli format nie jest zgodny.

6. **`toDomainError(err)`**
   - Mapuje błędy transportowe i odpowiedzi OpenRouter na stabilny zestaw wyjątków domenowych.

## 5. Obsługa błędów

Obsługa błędów powinna być spójna w całej usłudze i oparta o **jawne typy błędów** (lub kody), aby endpoint API mógł łatwo przełożyć je na HTTP.

### Potencjalne scenariusze błędów (ponumerowane)

1. **Brak konfiguracji / brak klucza API** (np. `OPENROUTER_API_KEY` undefined).
2. **Błąd autoryzacji** (401/403) – niepoprawny klucz, brak uprawnień, BYOK.
3. **Rate limit / throttling** (429) – per key, per provider, per user.
4. **Błędy dostawcy / upstream** (5xx) – chwilowa awaria lub przeciążenie.
5. **Timeout** – brak odpowiedzi w czasie.
6. **Błąd walidacji wejścia** – za długi prompt, brak `messages`, niedozwolony model.
7. **Model nie wspiera `response_format`** – błąd API lub brak `structured_outputs`.
8. **Niepoprawny JSON / niezgodność ze schematem** – structured outputs nie spełniły wymagań.
9. **Brak/nieoczekiwany kształt odpowiedzi** – np. puste `choices`, `finish_reason: error`.
10. **Błędy po stronie aplikacji** – np. nieobsłużona wyjątek w parserze.

### Zalecana strategia mapowania na HTTP (dla endpointów Astro)

- **400**: błędy walidacji wejścia (6), niedozwolony model (6)
- **401/403**: autoryzacja (2)
- **408**: timeout (5)
- **429**: rate limit (3)
- **502/503**: upstream (4), model nieobsługiwany (7) _(zależnie od sytuacji)_
- **500**: pozostałe / niespodziewane (9–10)

### Minimalny zestaw błędów domenowych (propozycja)

- `OpenRouterConfigError`
- `OpenRouterAuthError`
- `OpenRouterRateLimitError`
- `OpenRouterUpstreamError`
- `OpenRouterTimeoutError`
- `OpenRouterUnsupportedFeatureError` (np. brak structured outputs)
- `OpenRouterResponseParseError`
- `OpenRouterSchemaValidationError`

## 6. Kwestie bezpieczeństwa

- **Sekrety tylko po stronie serwera**: klucz OpenRouter musi być w zmiennych środowiskowych na serwerze (nigdy w kodzie klienta React).
- **Minimalizacja logów**:
  - nie loguj pełnych promptów/wiadomości,
  - maskuj dane użytkownika,
  - loguj tylko metadane (model, czasy, usage, statusy).
- **Stabilny identyfikator `user` w żądaniu**: ustawiaj pole `user` (np. `userId` z Supabase) – pomaga w wykrywaniu abuse i analizie.
- **Ograniczenia wejścia**:
  - limit długości `messages`,
  - limit znaków w pojedynczej wiadomości,
  - trimming historii (np. ostatnie N wiadomości).
- **Rate limiting**:
  - per użytkownik (gdy zalogowany),
  - per IP (dla niezalogowanych),
  - osobno dla kosztownych operacji (structured outputs + duże `max_tokens`).
- **Whitelista modeli**: dopuszczaj tylko modele zatwierdzone (kontrola kosztów i jakości).
- **Wymuszanie structured outputs**:
  - dla endpointów wymagających maszynowego parsowania zawsze używaj `strict: true` i `additionalProperties: false`.
- **Nagłówki atrybucji aplikacji**:
  - `HTTP-Referer` oraz `X-Title` (opcjonalnie) – nie są sekretami, ale warto trzymać je w configu środowiskowym.

## 7. Plan wdrożenia krok po kroku

### Krok 1: Konfiguracja środowiska (Astro + TypeScript)

- **Dodaj zmienne środowiskowe** (przykład nazewnictwa):
  - `OPENROUTER_API_KEY`
  - `OPENROUTER_DEFAULT_MODEL` (np. `openai/gpt-5.2`)
  - `OPENROUTER_HTTP_REFERER` (opcjonalnie)
  - `OPENROUTER_X_TITLE` (opcjonalnie)
  - `OPENROUTER_TIMEOUT_MS` (np. `45000`)
- **Uzupełnij typowanie env** w `src/env.d.ts` (server-only tam, gdzie to właściwe).

### Krok 2: Dodaj serwis OpenRouter w `src/lib/services/`

- **Utwórz plik**: `src/lib/services/openrouter.service.ts`
- **Zaimplementuj**:
  - konstruktor z `OpenRouterServiceConfig` i dependency injection (`fetchImpl`, logger),
  - `sendChatCompletion(...)`,
  - `sendChatCompletionStructured<T>(...)`.

W implementacji:

- użyj `fetch` do `https://openrouter.ai/api/v1/chat/completions`,
- ustaw nagłówki:
  - `Authorization: Bearer ${apiKey}`
  - `Content-Type: application/json`
  - opcjonalnie `HTTP-Referer`, `X-Title`.

### Krok 3: Warstwa schematów (`response_format`) i walidacja

- **Utwórz rejestr schematów** (propozycja lokalizacji):
  - `src/lib/validators/openrouter-schemas.ts`
- **Dodaj schemat(y)** dla typów odpowiedzi czatu (np. `chat_reply_v1`).
- **Waliduj** zwrócony JSON:
  - szybkie minimum: `JSON.parse` + ręczna walidacja pól,
  - rekomendowane: Zod (lub inny validator) dla twardej walidacji runtime.

### Krok 4: Integracja z endpointem API (Astro)

- **Dodaj endpoint** (lub rozszerz istniejący) w `src/pages/api/...`:
  - przykład: `src/pages/api/ai/chat.ts`
- Endpoint powinien:
  - uwierzytelnić użytkownika (Supabase),
  - sprawdzić limity / quota,
  - zbudować `messages` (system + user + ewentualna historia),
  - wywołać `OpenRouterService`,
  - zmapować błędy domenowe na HTTP.

### Krok 5: Observability i koszty

- Po każdej odpowiedzi zapisuj:
  - `model`, `usage.total_tokens`, `usage.cost`, `requestId`,
  - powiązanie z `userId`.
- Jeśli w projekcie istnieje tabela eventów/KPI w Supabase, dodaj event typu:
  - `openrouter_chat_completion` / `openrouter_structured_completion`.

### Krok 6: Bezpieczeństwo i guardrails

- Dodaj:
  - ograniczenia długości wejścia,
  - whitelistę modeli,
  - rate limiting (na poziomie endpointu lub middleware).
- Upewnij się, że logi nie zawierają treści rozmów (lub mają tryb debug wyłączony w prod).

### Krok 7: Test plan (minimum)

- **Testy jednostkowe** serwisu:
  - mapowanie błędów (401/429/5xx),
  - timeout,
  - parsing `choices[0].message.content`,
  - parsing + walidacja `json_schema`.
- **Testy integracyjne** endpointu API:
  - autoryzacja, limity, poprawne statusy HTTP.

### Krok 8: Rollout i utrzymanie

- Uruchom w środowisku testowym z niskimi limitami.
- Dodaj dashboard/alerty:
  - wzrost 429/5xx,
  - skoki kosztów,
  - wzrost średniego `total_tokens`.
- Wprowadź wersjonowanie schematów `json_schema.name` (np. `chat_reply_v1`, `chat_reply_v2`) i plan migracji.
