# Plan implementacji widoku Generuj

## 1. Przegląd

Widok **Generuj** (`/generate`) służy do wklejenia tekstu źródłowego, opcjonalnego wyboru/utworzenia decka, uruchomienia generacji fiszek przez AI (`POST /api/ai/generate`) oraz przejścia do widoku wyników generacji (filtrowanych po `source_id`). Widok musi jasno komunikować limity (w szczególności dzienny limit generacji), zachowywać draft tekstu przy błędach/nawigacji i nie ujawniać szczegółów błędów serwera.

## 2. Routing widoku

- **Ścieżka**: `/generate`
- **Plik routingu (Astro)**: `src/pages/generate.astro`
  - Renderuje layout aplikacji (jeśli istnieje) i montuje komponent React widoku (np. `GenerateView`) jako island (`client:load` lub `client:visible`).
- **Nawigacja po sukcesie**: przekierowanie do `/generate/results?source_id=<uuid>` (zgodnie z UI planem).

## 3. Struktura komponentów

Główne komponenty widoku (React):

- `GenerateView` (kontener, orkiestracja stanu i API)
- `LimitBanner` (komunikaty limitów/429 + prewencyjne blokady)
- `GenerateTextInput` (textarea + licznik znaków + autosave)
- `DeckPicker` (wybór decka + opcja “Bez decka (Oczekujące)”)
  - `CreateDeckModal` (tworzenie decka “w locie”)
- `GenerateSubmitButton` (submit + disabled/loading)
- `GenerateProgressPanel` (progres generacji + statusy)

Wysokopoziomowy diagram drzewa komponentów:

```
GeneratePage (Astro)
└─ GenerateView (React)
   ├─ LimitBanner
   ├─ GenerateTextInput
   ├─ DeckPicker
   │  └─ CreateDeckModal
   ├─ GenerateSubmitButton
   └─ GenerateProgressPanel
```

## 4. Szczegóły komponentów

### GenerateView

- **Opis komponentu**: Kontener widoku. Składa UI, trzyma stan formularza i integruje API: pobranie decków (jeśli dostępne), pobranie statusu/limitów użytkownika (jeśli dostępne) oraz wywołanie generacji.
- **Główne elementy**:
  - `main` / `section` jako wrapper treści
  - nagłówek widoku (`h1`: “Generuj fiszki”)
  - obszar formularza (`form`) oraz panel statusu
- **Obsługiwane zdarzenia**:
  - `onChangeContent(content: string)` z `GenerateTextInput`
  - `onSelectDeck(deckId: string | null)` z `DeckPicker`
  - `onCreateDeckRequested()` -> otwarcie modala
  - `onDeckCreated(deck: DeckDto)` -> aktualizacja listy decków + ustawienie wybranego decka
  - `onSubmit()` -> wywołanie `POST /api/ai/generate`
  - `onRetry()` (opcjonalnie) -> ponowienie submitu po błędzie sieci/500
- **Warunki walidacji (szczegółowe)**:
  - `content`:
    - wymagane
    - min `50` znaków
    - max `100000` znaków
  - `deck_id`:
    - opcjonalne (może być `null`/`undefined`)
    - jeśli podane: ma być UUID (format weryfikowany client-side jako “guardrail”, backend i tak waliduje)
  - prewencyjne blokady:
    - gdy trwa request generacji -> blokada ponownego submitu
    - gdy znany jest limit i `remaining_generations <= 0` -> blokada submitu (i pokazanie `LimitBanner`)
- **Typy (DTO i ViewModel)**:
  - DTO: `GenerateCardsCommand`, `GenerateCardsResponseDto`, `DeckDto`, `UserStatusDto`
  - VM: `GenerateFormVm`, `GenerateLimitsVm`, `GenerateApiErrorVm`, `DeckOptionVm`
- **Props (interfejs komponentu)**:
  - Docelowo brak (widok routowany), ewentualnie:
    - `initialContent?: string` (np. z query / SSR)
    - `initialDeckId?: string | null`

### LimitBanner

- **Opis komponentu**: Spójny banner/alert do komunikacji limitów i błędów limitowych (szczególnie `429 Too Many Requests`). Powinien wspierać tryb prewencyjny (“nie możesz teraz generować”) i tryb reaktywny (odpowiedź 429 z API).
- **Główne elementy**:
  - `div`/`section` z rolą `alert` (dla krytycznych blokad)
  - treść: nagłówek + opis + ewentualne “co dalej”
  - opcjonalny przycisk “Pokaż szczegóły” (dev/debug) – bez ujawniania wrażliwych danych
- **Obsługiwane zdarzenia**:
  - `onDismiss()` (opcjonalnie)
  - `onShowDetails()` (opcjonalnie)
- **Warunki walidacji**:
  - Brak (prezentacja), ale musi umieć obsłużyć brak danych “kiedy odblokuje” (API może nie zwracać daty resetu).
- **Typy**:
  - VM: `GenerateLimitsVm`, `GenerateApiErrorVm`
- **Props**:
  - `limits: GenerateLimitsVm`
  - `error?: GenerateApiErrorVm | null`
  - `onDismiss?: () => void`

### GenerateTextInput

- **Opis komponentu**: Tekst wejściowy do wklejenia materiału. Pokazuje licznik znaków i walidację. Musi autosave’ować draft do storage i odtwarzać po odświeżeniu/nawigacji.
- **Główne elementy**:
  - `label` + `textarea` (z opisem “min 50, max 100k”)
  - licznik znaków (np. `p`/`span`)
  - komunikat błędu walidacji (np. `p role="alert"`)
- **Obsługiwane zdarzenia**:
  - `onChange` -> `onContentChange(value)`
  - `onBlur` (opcjonalnie) -> wymuszenie zapisu do storage
  - `onClear` (opcjonalnie) -> wyczyszczenie treści + storage
- **Warunki walidacji**:
  - `content.length < 50` -> błąd “Za krótki tekst”
  - `content.length > 100000` -> błąd “Za długi tekst”
  - UX: nie pokazuj błędu “min 50” natychmiast po wejściu; pokaż po `touched` lub po submit.
- **Typy**:
  - VM: `GenerateFormVm` (pole `content`, `contentCount`, `validation`)
- **Props**:
  - `value: string`
  - `minLength: number` (50)
  - `maxLength: number` (100000)
  - `disabled?: boolean`
  - `validation?: { state: "idle" | "error"; message?: string }`
  - `onContentChange: (next: string) => void`
  - `onClear?: () => void`

### DeckPicker

- **Opis komponentu**: Wybór decka dla generowanych fiszek lub opcja “Bez decka (Oczekujące)”. Powinien umożliwiać otwarcie modala tworzenia nowego decka.
- **Główne elementy**:
  - `label`
  - selektor (np. `Select` z shadcn/ui) z listą decków
  - pozycja “Bez decka (Oczekujące)” mapowana na `deck_id = null`
  - przycisk “Utwórz deck” otwierający modal
- **Obsługiwane zdarzenia**:
  - `onValueChange(deckId | null)`
  - `onCreateDeckClick()`
- **Warunki walidacji**:
  - Brak wymogu wybrania decka; `null` jest poprawne.
  - Jeśli widok zna limit decków i jest osiągnięty -> wyłącz “Utwórz deck” i pokaż informację (opcjonalnie).
- **Typy**:
  - DTO: `DeckDto`
  - VM: `DeckOptionVm`
- **Props**:
  - `value: string | null`
  - `options: DeckOptionVm[]`
  - `disabled?: boolean`
  - `onChange: (deckId: string | null) => void`
  - `onCreateDeck: () => void`

### CreateDeckModal

- **Opis komponentu**: Modal do tworzenia decka “w locie” bez opuszczania widoku i bez utraty draftu tekstu.
- **Główne elementy**:
  - `Dialog` (shadcn/ui) z zarządzaniem fokusem
  - formularz: `name` (required), `description` (opcjonalnie)
  - przyciski: “Anuluj”, “Utwórz”
- **Obsługiwane zdarzenia**:
  - `onOpenChange(isOpen)`
  - `onSubmit({ name, description })`
  - `onSuccess(deck)` -> przekazanie do rodzica
- **Warunki walidacji**:
  - `name`:
    - wymagane
    - max długość: `100` (zgodnie z API planem)
  - ochrona przed double submit (disabled + spinner)
- **Typy**:
  - DTO: `DeckCreateCommand`, `DeckDto`
  - VM: `CreateDeckFormVm`, `CreateDeckErrorVm`
- **Props**:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `onCreated: (deck: DeckDto) => void`

### GenerateSubmitButton

- **Opis komponentu**: Przycisk submitu generacji, uwzględniający walidację i limity.
- **Główne elementy**:
  - `button type="submit"` (shadcn `Button`)
  - loader/spinner w stanie `loading`
- **Obsługiwane zdarzenia**:
  - `onClick` (ale finalnie submit ma iść z `form onSubmit`)
- **Warunki walidacji**:
  - disabled jeśli:
    - `isSubmitting === true`
    - `content.length < 50 || content.length > 100000`
    - `remaining_generations` znane i `<= 0`
- **Typy**:
  - VM: `GenerateFormVm`, `GenerateLimitsVm`
- **Props**:
  - `disabled: boolean`
  - `loading: boolean`
  - `label?: string` (domyślnie “Generuj”)

### GenerateProgressPanel

- **Opis komponentu**: Prezentuje stan procesu: idle/loading/success/error. W praktyce, przy sukcesie widok nawiguję do wyników; panel może pokazać krótki stan przejściowy (“Gotowe, przekierowuję…”).
- **Główne elementy**:
  - loader + komunikat w trakcie
  - success message
  - error summary (bez szczegółów serwera) + opcja retry
- **Obsługiwane zdarzenia**:
  - `onRetry()` (opcjonalnie)
- **Warunki walidacji**:
  - Brak (prezentacja)
- **Typy**:
  - VM: `GenerateRequestStateVm`, `GenerateApiErrorVm`
- **Props**:
  - `state: GenerateRequestStateVm`
  - `error?: GenerateApiErrorVm | null`
  - `onRetry?: () => void`

## 5. Typy

Widok powinien opierać się o istniejące DTO z `src/types.ts` oraz zdefiniować lekkie ViewModel’e (VM) dla UI.

### DTO (z istniejących typów)

- `GenerateCardsCommand`
  - `content: string`
  - `deck_id?: string` (uuid) — w UI reprezentowane jako `string | null` i mapowane do `undefined` gdy `null`
- `GenerateCardsResponseDto`
  - `source_id: string` (uuid)
  - `cards: GeneratedCardDto[]`
  - `remaining_generations: number`
- `GeneratedCardDto`
  - `id: string`
  - `front: string`
  - `back: string`
  - `context: string | null`
  - `difficulty: number`
  - `tags: string[]`
  - `quality_status: "draft" | "ok" | "good"` (dla generacji spodziewane `"draft"`)
- `DeckDto` (dla listy decków)
- `DeckCreateCommand` (dla modala tworzenia decka)
- `UserStatusDto` (dla limitów; jeśli endpoint jest dostępny globalnie)

### Nowe typy ViewModel (do dodania w frontendzie)

Zalecane miejsce: `src/lib/viewmodels/generate.vm.ts` (lub analogicznie).

- `type GenerateRequestStatus = "idle" | "loading" | "success" | "error"`

- `type GenerateApiErrorVm = {
  status?: number;
  code?: string;
  message: string;            // tekst przyjazny dla użytkownika
  debugDetails?: unknown;     // opcjonalnie tylko w dev (np. pełne body)
}`

- `type GenerateValidationVm = {
  content?: { code: "too_short" | "too_long"; message: string } | null;
}`

- `type GenerateLimitsVm = {
  remainingGenerations?: number;  // undefined gdy nieznane
  isGenerationBlocked: boolean;   // wynikowa flaga do UI
  reason?: "limit_reached" | "unknown";
}`

- `type DeckOptionVm = {
  value: string | null;       // null = Bez decka
  label: string;
  description?: string;
}`

- `type GenerateFormVm = {
  content: string;
  contentCount: number;
  deckId: string | null;
  touched: { content: boolean };
  validation: GenerateValidationVm;
}`

- `type GenerateRequestStateVm = {
  status: GenerateRequestStatus;
  lastResponse?: { sourceId: string; remainingGenerations: number };
}`

## 6. Zarządzanie stanem

Stan lokalny w `GenerateView` + 1–2 custom hooki dla porządku i testowalności.

### Zmienne stanu (minimalny zestaw)

- `content: string`
- `deckId: string | null`
- `touchedContent: boolean` (czy pokazać walidację)
- `requestStatus: "idle" | "loading" | "success" | "error"`
- `error: GenerateApiErrorVm | null`
- `remainingGenerations: number | undefined`:
  - źródła: `GET /api/me/status` (jeśli dostępne) i/lub odpowiedź z `POST /api/ai/generate`
- `decksState`:
  - `decks: DeckDto[]`
  - `isDecksLoading: boolean`
  - `decksError: GenerateApiErrorVm | null`
- `isCreateDeckOpen: boolean`

### Custom hooki (zalecane)

- `useGenerateDraft(storageKey: string)`
  - **Cel**: autosave `content` do `localStorage`/`sessionStorage` i odtwarzanie przy mount.
  - **API**: `{ value, setValue, clear }`
  - **Uwagi**: nie zapisuj nic wrażliwego poza draftem tekstu; draft jest wymaganiem UX.

- `useGenerateCards()`
  - **Cel**: enkapsulacja wywołania `POST /api/ai/generate` i mapowania błędów na `GenerateApiErrorVm`.
  - **API**: `{ mutate(command), status, error, data }`

- (opcjonalnie) `useDecks()` i `useUserStatus()`
  - **Cel**: pobranie danych do `DeckPicker` i limitów.
  - **Uwaga**: jeśli aplikacja ma już “server state” (np. TanStack Query), wdrażaj jako query + cache. Jeśli nie – proste `useEffect` + `fetch`.

## 7. Integracja API

### POST `/api/ai/generate`

- **Request DTO**: `GenerateCardsCommand`
  - `content`: string (min 50, max 100k)
  - `deck_id?`: uuid (opcjonalnie)
- **Response DTO**: `GenerateCardsResponseDto`
  - `source_id`: uuid
  - `cards`: `GeneratedCardDto[]`
  - `remaining_generations`: number
- **Akcje frontendowe**:
  - przed requestem:
    - walidacja `content`
    - ustaw `requestStatus="loading"`, wyczyść `error`
  - po sukcesie 201:
    - zaktualizuj `remainingGenerations` z odpowiedzi
    - nawiguj do `/generate/results?source_id=<source_id>`
    - (opcjonalnie) zachowaj draft lub wyczyść go po udanym przejściu; rekomendacja: **nie czyścić natychmiast**, bo użytkownik może wrócić “wstecz” i oczekiwać treści
  - po błędzie:
    - mapuj błędy na przyjazny komunikat
    - nie gub draftu (`content` zostaje)

### GET `/api/decks` (dla `DeckPicker`)

- **Cel**: lista decków do wyboru.
- **Akcje frontendowe**: pobierz przy mount, pokaż loading/empty state, umożliw “Utwórz deck”.

### POST `/api/decks` (dla `CreateDeckModal`)

- **Request DTO**: `DeckCreateCommand` (`name`, `description?`)
- **Akcje frontendowe**:
  - po sukcesie: dodaj deck do listy i ustaw go jako wybrany
  - po błędzie limitu decków: pokaż `LimitBanner` lub inline błąd w modalu

### GET `/api/me/status` (opcjonalne, jeśli istnieje globalnie)

- **Cel**: uzyskać rolę demo/full i limity; wyświetlić `remaining_generations` (z `daily_generations_limit - daily_generations_used`).
- **Akcje frontendowe**: pobierz w App Shell i przekaż przez kontekst/store; w widoku Generuj korzystaj z tej wartości do prewencyjnej blokady.

## 8. Interakcje użytkownika

- **Wklejenie/edycja tekstu**:
  - licznik znaków aktualizuje się na bieżąco
  - autosave draftu do storage
  - po przekroczeniu limitów: pokazanie komunikatu walidacji i blokada submitu
- **Wybór decka**:
  - zmiana wyboru aktualizuje `deckId`
  - wybór “Bez decka (Oczekujące)” ustawia `deckId = null`
- **Utworzenie decka w locie**:
  - klik “Utwórz deck” -> otwarcie modala
  - po utworzeniu: modal się zamyka, nowy deck jest wybrany
- **Uruchomienie generacji**:
  - klik “Generuj”/submit formularza
  - pokazanie `GenerateProgressPanel` w stanie loading
  - blokada ponownego submitu i edycji (co najmniej przycisk; opcjonalnie cały formularz)
- **Po sukcesie**:
  - krótki komunikat + automatyczna nawigacja do wyników
- **Po błędzie**:
  - czytelny komunikat (bez szczegółów serwera)
  - możliwość ponowienia (dla sieci/500)
  - dla 429: wyraźny banner limitu + blokada generacji

## 9. Warunki i walidacja

Warunki wynikające z API planu i implementacji endpointu:

- **Body musi być JSON**: UI zawsze wysyła JSON (`Content-Type: application/json`).
- **`content`**:
  - min 50 znaków
  - max 100k znaków
  - weryfikacja:
    - w `GenerateTextInput` (inline, po `touched` lub submit)
    - w `GenerateView` przed wywołaniem API (twarda blokada submitu)
- **`deck_id`**:
  - opcjonalne
  - weryfikacja:
    - `DeckPicker` zawsze dostarcza `string | null`
    - przy budowie requestu: jeśli `null` -> pomiń pole (`undefined`)
    - opcjonalny “UUID guardrail” w `GenerateView` (np. regex) aby nie wysłać śmieci
- **Limity generacji**:
  - backend egzekwuje limit i zwraca `429` przy przekroczeniu
  - UI:
    - prewencyjnie blokuje submit, jeśli zna `remainingGenerations <= 0`
    - reaktywnie obsługuje `429` i pokazuje `LimitBanner`
- **Nie ujawniać szczegółów serwera**:
  - UI prezentuje `error.message` ogólny
  - opcja “Pokaż szczegóły” wyłącznie w dev (lub za flagą) i bez wrażliwych danych

## 10. Obsługa błędów

Scenariusze i sugerowana obsługa:

- **400 validation_error** (Zod):
  - UI: pokaż “Niepoprawne dane formularza” + wskaż pole `content` jeśli dotyczy
  - zachowaj draft i fokus na polu z błędem
- **400 invalid_json**:
  - praktycznie nie powinno wystąpić z UI; pokaż komunikat ogólny + retry
- **401 Unauthorized** (przyszłościowo, gdy auth będzie włączony):
  - zachowaj draft
  - przekieruj do `/login` i po powrocie odtwórz treść
- **429 Too Many Requests**:
  - pokaż `LimitBanner` jako blokujący
  - zablokuj submit do czasu kolejnej doby (UI nie musi znać exact time)
- **500+ / błąd sieci**:
  - pokaż komunikat “Coś poszło nie tak. Spróbuj ponownie.”
  - umożliw retry
  - nie gub draftu
- **Nieoczekiwane shape odpowiedzi**:
  - zabezpiecz parsing (try/catch + fallback error)
  - loguj w konsoli tylko w dev

## 11. Kroki implementacji

1. Utwórz routing widoku:
   - dodaj `src/pages/generate.astro`, osadź `GenerateView` jako komponent React.
2. Dodaj komponenty widoku w `src/components/generate/`:
   - `GenerateView.tsx`, `GenerateTextInput.tsx`, `DeckPicker.tsx`, `CreateDeckModal.tsx`, `GenerateSubmitButton.tsx`, `GenerateProgressPanel.tsx`, `LimitBanner.tsx`.
3. Zaimplementuj typy ViewModel:
   - dodaj plik np. `src/lib/viewmodels/generate.vm.ts` z typami VM (bez duplikowania DTO).
4. Zaimplementuj `useGenerateDraft`:
   - zapis `content` do storage (debounce ~300–500ms), odczyt przy mount, opcja clear.
5. Zaimplementuj klienta API dla generacji:
   - funkcja `postGenerateCards(command: GenerateCardsCommand): Promise<GenerateCardsResponseDto>`
   - mapowanie błędów `{ error: { code, message } }` na `GenerateApiErrorVm`.
6. Podłącz submit w `GenerateView`:
   - walidacja `content` (50–100k)
   - budowa requestu (deckId `null` -> pomiń `deck_id`)
   - stany `loading/error`
   - po 201: nawigacja do `/generate/results?source_id=...`.
7. Dodaj integrację decków (jeśli endpointy są gotowe):
   - `GET /api/decks` do `DeckPicker`
   - `POST /api/decks` w `CreateDeckModal`, po sukcesie ustaw nowy deck.
8. Dodaj obsługę limitów:
   - jeśli istnieje `GET /api/me/status`: pobieraj globalnie i w `GenerateView` licz `remainingGenerations`
   - obsłuż 429: `LimitBanner` + blokada submitu.
9. Dopnij A11y i UX:
   - `label` dla textarea/select
   - `role="alert"` dla krytycznych błędów
   - focus na pierwszym błędzie po submit
   - blokada double submit.
10. Dodaj stany UI:

- skeleton/loading dla decków
- empty state gdy brak decków
- loading state dla generacji.

11. (Opcjonalnie) Dodaj test plan manualny:

- przypadki: <50, >100k, 201, 400, 429, network error, create deck, draft persistence.
