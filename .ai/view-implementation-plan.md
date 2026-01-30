<analysis>
1. Kluczowe punkty specyfikacji API:
   - Endpoint: POST `/api/ai/generate` uruchamia pipeline AI.
   - Logika: sprawdza limity dzienne w `user_usage_stats`, tworzy rekord `sources`, wywołuje OpenRouter, parsuje odpowiedź, zapisuje `cards` z `quality_status='draft'`, loguje KPI (`ai_generation`) i zwraca `source_id`, listę kart oraz pozostałe limity.
2. Parametry:
   - Wymagane: `content` (string, min 50, max 100000).
   - Opcjonalne: `deck_id` (uuid).
3. Niezbędne typy DTO/Command:
   - `GenerateCardsCommand`, `GenerateCardsResponseDto`, `GeneratedCardDto`, `CardQualityStatus`, `DbSource["id"]`, `DbDeck["id"]`.
4. Ekstrakcja logiki do service:
   - Nowy serwis `src/lib/services/ai-generation.service.ts` (lub istniejący jeśli jest): walidacja limitów, utworzenie `sources`, wywołanie OpenRouter, mapowanie do kart, zapis w `cards`, KPI.
5. Walidacja:
   - Zod schema zgodna z planem API i ograniczeniami DB (`content` długość, `deck_id` UUID, atrybuty kart w zakresach).
6. Rejestrowanie błędów:
   - Brak dedykowanej tabeli błędów w schemacie; użyć logowania serwerowego + opcjonalnie KPI `event_type='ai_generation_failed'` z metadanymi.
7. Zagrożenia bezpieczeństwa:
   - Nadużycia limitów (rate limiting/limit dzienny), wstrzyknięcia/nieprawidłowe dane, wycieki kluczy OpenRouter, dostęp do zasobów innych użytkowników (RLS).
8. Scenariusze błędów i kody:
   - 400: błędne dane wejściowe, walidacja Zod.
   - 401: brak/nieprawidłowy JWT.
   - 404: deck nie istnieje lub nie należy do użytkownika (gdy podano `deck_id`).
   - 429: limit dzienny generacji przekroczony.
   - 500: błąd AI/DB/parsing.
</analysis>

# API Endpoint Implementation Plan: POST /api/ai/generate

## 1. Przegląd punktu końcowego
Endpoint generuje fiszki z podanego tekstu przy użyciu AI. Sprawdza limity użytkownika, zapisuje źródło, generuje i zapisuje karty jako szkice (`quality_status='draft'`), loguje KPI i zwraca wygenerowane karty wraz z pozostałym limitem dziennym.

## 2. Szczegóły żądania
- Metoda HTTP: `POST`
- Struktura URL: `/api/ai/generate`
- Parametry:
  - Wymagane: `content` (string, 50–100000 znaków)
  - Opcjonalne: `deck_id` (uuid)
- Request Body:
  ```json
  {
    "content": "string",
    "deck_id": "uuid (optional)"
  }
  ```

## 3. Wykorzystywane typy
- `GenerateCardsCommand`
- `GenerateCardsResponseDto`
- `GeneratedCardDto`
- `CardQualityStatus`

## 3. Szczegóły odpowiedzi
- Kod sukcesu: `201 Created`
- Response Body:
  ```json
  {
    "source_id": "uuid",
    "cards": [
      {
        "id": "uuid",
        "front": "string",
        "back": "string",
        "context": "string",
        "difficulty": 3,
        "tags": ["string"],
        "quality_status": "draft"
      }
    ],
    "remaining_generations": 3
  }
  ```

## 4. Przepływ danych
1. Middleware uwierzytelnia użytkownika (Supabase Auth, JWT).
2. Handler odczytuje `content` i opcjonalny `deck_id`.
3. Walidacja Zod: długość `content`, UUID `deck_id`.
4. Serwis `ai-generation`:
   - Pobiera profil i rolę (`profiles.account_role`).
   - Weryfikuje limity w `user_usage_stats` dla bieżącej daty (UTC). Jeśli brak rekordu, tworzy go.
   - Jeśli `deck_id` podany, weryfikuje istnienie decka i własność użytkownika.
   - Tworzy rekord `sources` z `content`, `character_count`, `user_id` i tytułem (np. skrót treści).
   - Wywołuje OpenRouter z `content` i mapuje wynik na karty.
   - Wstawia `cards` z `quality_status='draft'` i referencjami do `source_id` i `deck_id`.
   - Aktualizuje `user_usage_stats.generation_count` atomowo.
   - Zapisuje KPI w `kpi_events` (`event_type='ai_generation'`, metadata: liczba kart, koszt).
5. Handler mapuje `question/answer` → `front/back` i zwraca `GenerateCardsResponseDto`.

## 5. Względy bezpieczeństwa
- Wymagane uwierzytelnienie (JWT) i RLS (`auth.uid()`).
- Walidacja `deck_id` pod kątem własności użytkownika.
- Ochrona kluczy OpenRouter po stronie backendu.
- Limit dzienny generacji i potencjalny rate limiting.
- Sanitizacja i limity długości wejścia (DoS/abuse).

## 6. Obsługa błędów
- `400 Bad Request`: niepoprawny format body, `content` zbyt krótki/długi, niepoprawny UUID.
- `401 Unauthorized`: brak/nieprawidłowy JWT.
- `404 Not Found`: deck nie istnieje lub nie należy do użytkownika.
- `429 Too Many Requests`: przekroczony limit dzienny generacji.
- `500 Internal Server Error`: błąd OpenRouter, błąd zapisu w DB, błąd parsowania odpowiedzi.
- Logowanie: error log + opcjonalny KPI `ai_generation_failed` z metadanymi (brak dedykowanej tabeli błędów).

## 7. Wydajność
- Stosować pojedyncze inserty bulk dla kart.
- Unikać nadmiarowych zapytań (pobrać profil i stats w jednej transakcji).
- Indeksy: `cards(user_id)`, `cards(source_id)`, `user_usage_stats(date)` wspierają zapytania.
- Zadbaj o timeout i retry politykę dla OpenRouter.

## 8. Kroki implementacji
1. Utwórz Zod schema dla `GenerateCardsCommand`.
2. Dodaj endpoint `src/pages/api/ai/generate.ts` z `export const prerender = false`.
3. Użyj `context.locals.supabase` do zapytań (zgodnie z regułami backend).
4. Utwórz serwis `src/lib/services/ai-generation.service.ts`:
   - `checkAndIncrementDailyLimit(userId, role)`
   - `createSource(userId, content)`
   - `generateCardsWithAI(content)`
   - `insertGeneratedCards(userId, sourceId, deckId, cards)`
   - `logKpiEvent(userId, 'ai_generation', metadata)`
5. Zaimplementuj walidację decka (jeśli `deck_id`).
6. Zaimplementuj mapowanie AI → `CardCreateCommand` i zapis w `cards`.
7. Zwróć `GenerateCardsResponseDto` z przemapowaniem pól `front/back`.
8. Dodaj obsługę błędów i spójne kody statusu (400/401/404/429/500).
