# Plan testów (QA) — AI Flashcards (Astro + React + Supabase + OpenRouter)

## 1. Wprowadzenie i cele testowania

### 1.1. Cel dokumentu

Celem planu jest zdefiniowanie strategii oraz zakresu testów dla aplikacji **AI Flashcards**, która umożliwia generowanie fiszek z tekstu (AI), zarządzanie deckami i fiszkami, uwierzytelnianie (demo vs full), egzekwowanie limitów, eksport oraz zbieranie KPI.

### 1.2. Cele testów

- Zapewnienie poprawności kluczowych flow: **auth → generacja → edycja/zarządzanie → eksport**.
- Weryfikacja zgodności z wymaganiami PRD (US-001..US-009) oraz kontraktami API.
- Minimalizacja ryzyk: **limity**, **RLS/bezpieczeństwo**, stabilność integracji z AI (OpenRouter), poprawność danych w Supabase.
- Zapewnienie jakości UX: czytelne błędy, brak „martwych” stanów (loading/error), dostępność podstawowa (a11y).

### 1.3. Kryteria sukcesu (high-level)

- Brak defektów krytycznych w ścieżkach: logowanie/demo, generacja, CRUD decków/fiszek.
- Poprawna egzekucja limitów (karty/decki/generacje) i spójna obsługa błędów (400/401/403/429/5xx).
- Brak możliwości eskalacji uprawnień (np. zmiana `profiles.account_role` przez użytkownika).

---

## 2. Zakres testów

### 2.1. Elementy w zakresie (MVP)

- **UI (Astro/React)**:
  - Strony: `/`, `/generate`, `/generate/results`, strony auth (`/login`, `/register`, `/forgot-password`, `/update-password`, `/auth/callback`).
  - Komponenty React: generowanie, wybór decka, tworzenie decka (modal), edycja/usuwanie fiszek z wyników, banery limitów i błędów.
- **API (Astro server endpoints)**:
  - `POST /api/ai/generate`
  - `GET/POST /api/decks`
  - `PATCH/DELETE /api/cards/:card_id`
  - `GET /api/sources/:source_id/cards`
  - Auth: `/api/auth/*` (login/register/logout/demo) oraz SSR callback (jeśli występuje jako endpoint).
- **Supabase**:
  - Migracje, triggery, RPC (np. `public.increment_daily_generation`)
  - RLS i izolacja danych per-user
  - Spójność kluczy obcych (profile/decks/sources/cards/usage/kpi).
- **Limity i KPI**:
  - Limity: generacje dzienne, limit decków, limit fiszek.
  - KPI: tworzenie wpisów w `kpi_events` (min. generacja, edycje/akcje, sesje/logowania – zgodnie z PRD/spec).
- **Integracja z AI**:
  - Poprawność kontraktu, retry/timeout, obsługa błędów upstream.

### 2.2. Poza zakresem (na tym etapie)

- Własny algorytm SRS (MVP integruje się przez eksport/API).
- Import plików (PDF/DOCX) i tabele.
- Funkcje społecznościowe, współdzielenie decków.

---

## 3. Typy testów do przeprowadzenia

### 3.1. Testy statyczne (quality gates)

- ESLint + Prettier (już obecne) jako bramka jakości.
- TypeScript (strict) — wykrywanie błędów typów.

### 3.2. Testy jednostkowe (unit)

Cel: szybka walidacja logiki deterministycznej.

- Walidatory (Zod) dla komend (auth/generacja/deck/karta).
- Mapowanie błędów (np. mapowanie statusów na komunikaty).
- Funkcje pomocnicze (np. parsowanie parametru `source_id`, budowanie requestów).

### 3.3. Testy integracyjne (backend/service)

Cel: test „endpoint + Supabase + logika limitów”, bez przeglądarki.

- API endpoints z uruchomionym lokalnym Supabase (kontenery).
- RLS/izolacja danych per-user oraz konsekwencje uprawnień.
- RPC `increment_daily_generation` (atomiczność i poprawność licznika).

### 3.4. Testy kontraktowe API (request/response)

Cel: zgodność z API planem i `src/types.ts`.

- Kształt DTO (`GenerateCardsResponseDto`, `DeckDto`, `CardDto`, `UserStatusDto`).
- Statusy i kody błędów (400/401/403/429/5xx) oraz zgodny format błędu.

### 3.5. Testy E2E (przeglądarka)

Cel: weryfikacja krytycznych scenariuszy użytkownika w UI.

- Auth gating i nawigacja.
- Generacja i przejście do wyników.
- CRUD decków i edycja/usuwanie fiszek.
- Stany: loading/error/limit reached.

### 3.6. Testy bezpieczeństwa (aplikacja + DB)

- RLS: brak dostępu do cudzych zasobów (decki/fiszki/źródła).
- Próby eskalacji: zmiana `profiles.account_role` przez użytkownika.
- Ochrona sekretów (brak wycieku kluczy w UI; OpenRouter tylko po stronie serwera).
- Podstawowa odporność na CSRF dla endpointów mutujących (jeśli używane cookies httpOnly).

### 3.7. Testy wydajnościowe i niezawodności

- Smoke/perf dla `POST /api/ai/generate` (timeouty, retry, degradacja).
- Wydajność listowania (decki/fiszki) przy rosnącej liczbie rekordów.
- Stabilność UI: brak blokad, poprawne stany ładowania.

### 3.8. Testy dostępności (a11y) i użyteczności

- Nawigacja klawiaturą w formularzach i modalach.
- Poprawne `aria-*` dla błędów formularzy i dialogów.
- Czytelność komunikatów limitów i błędów.

---

## 4. Scenariusze testowe dla kluczowych funkcjonalności

### 4.1. Uwierzytelnianie (US-001) — demo vs full

**UI/SSR**

- Wejście na `/`:
  - niezalogowany → redirect do `/login` (lub zgodnie z aktualną logiką).
  - zalogowany → redirect do `/generate`.
- `/login`:
  - poprawny login → przejście do `/generate` lub `returnTo`.
  - błędne dane → czytelny komunikat (bez ujawniania szczegółów).
  - rate limit (jeśli występuje) → komunikat i brak pętli retry.
- „Kontynuuj jako demo”:
  - utworzenie sesji demo i dostęp do `/generate`.
  - status/limity pokazują rolę demo.
- `/register`:
  - poprawna rejestracja → flow potwierdzenia (jeśli włączone) lub wejście do aplikacji.
  - istniejący email → komunikat konfliktu.
- `/forgot-password` i `/update-password`:
  - zawsze neutralna odpowiedź dla „forgot”.
  - wygasły link recovery → komunikat i możliwość ponowienia.
- `/api/auth/logout`:
  - po wylogowaniu brak dostępu do tras aplikacyjnych (401/redirect).

**API/Supabase**

- Brak sesji przy endpointach wymagających auth → 401.
- Dla demo vs full:
  - poprawne `profiles.account_role`.
  - brak możliwości zmiany `account_role` przez użytkownika (test negatywny).

### 4.2. Generowanie fiszek AI (US-002) + limity generacji (US-007)

**UI**

- Formularz generacji:
  - walidacja długości treści: < 50 znaków → blokada i komunikat.
  - treść 50..100000 → możliwość wysłania.
  - zachowanie draftu treści (persist) i czyszczenie.
- Wynik:
  - sukces → redirect do `/generate/results?source_id=...`.
  - błąd 5xx/transport → panel z możliwością retry.
  - 429 (limit) → banner limitu, brak retry, blokada generowania.
  - 401 → komunikat „Zaloguj się…” i przekierowanie (jeśli takie zachowanie jest wymagane).

**API**

- `POST /api/ai/generate`:
  - 201: poprawny kształt odpowiedzi (`source_id`, `cards[]`, `remaining_generations`).
  - 400: invalid payload (np. brak `content`, za krótki/za długi).
  - 429: przekroczenie dziennego limitu generacji (demo vs full).
  - Poprawne utworzenie:
    - rekordu `sources` (wraz z `character_count`, `content`, `title` jeśli dotyczy),
    - rekordów `cards` z `quality_status='draft'` i poprawnymi FK (`user_id`, `source_id`, opcjonalnie `deck_id`).
  - KPI: wpis `kpi_events` dla `ai_generation` (minimum).

**Integracja OpenRouter**

- Timeout → mapowanie na 408/5xx zgodnie z obsługą błędów.
- Rate limit upstream → mapowanie na 429 z komunikatem przyjaznym.
- Niepoprawna odpowiedź modelu → błąd parsowania i brak inserta błędnych danych (transakcyjność/kompensacja).

### 4.3. Decki (US-007 częściowo: limit decków)

**UI**

- Pobranie listy decków:
  - loading → success → error (czytelne stany).
  - pusta lista: komunikat zachęcający do utworzenia.
- Tworzenie decka (modal):
  - nazwa wymagana, max 100 znaków.
  - opcjonalny opis.
  - błąd 429 (limit decków) → komunikat + blokada przycisku „Utwórz deck”.

**API**

- `GET /api/decks`:
  - paginacja (meta: total/page/limit).
  - filtrowanie `search` (jeśli zaimplementowane).
- `POST /api/decks`:
  - 201/200: utworzenie decka, poprawny DTO.
  - 400: walidacja (np. brak nazwy, za długa).
  - 429: limit 50 decków.
  - RLS: brak dostępu do decków innych użytkowników.

### 4.4. Fiszki: odczyt wyników, edycja i usuwanie (US-003, US-004, US-006)

**UI**

- Widok wyników generacji:
  - brak `source_id` w URL → błąd.
  - `source_id` nieistniejące lub cudze → błąd/401/403 (spójnie z API).
  - lista fiszek renderuje front/back; wsparcie dla edycji inline.
- Edycja fiszki:
  - zmiana question/answer → zapis → aktualizacja listy.
  - błąd zapisu → komunikat, brak utraty danych w formularzu (jeśli możliwe).
- Usuwanie:
  - potwierdzenie; po usunięciu znika z listy.
  - błąd usuwania → komunikat, brak niespójnego stanu.

**API**

- `GET /api/sources/:source_id/cards`:
  - tylko fiszki z danego źródła i użytkownika.
- `PATCH /api/cards/:id`:
  - walidacja pól, brak możliwości edycji cudzych rekordów.
  - KPI: `card_edit` (jeśli wymagane).
- `DELETE /api/cards/:id`:
  - 204/200: usuwa fiszkę; brak dostępu do cudzej.

### 4.5. Limity fiszek i spójność danych (US-007)

- Próba utworzenia fiszek ponad limit (np. `POST /api/cards` lub w generacji) → 429.
- Spójność liczników:
  - po usunięciu fiszki: czy licznik „cards_created” ma odzwierciedlać stan aktualny czy historyczny (ustalić i testować zgodnie z implementacją).

### 4.6. KPI (US-009)

- Generacja AI → `kpi_events` (event_type: `ai_generation`) z sensownym `metadata` (np. liczba kart, model, koszt jeśli dostępny).
- Edycja/usunięcie/akceptacja (jeśli istnieje w UI) → odpowiednie eventy.
- Auth: login/logout/signup/password reset (jeśli zaimplementowane) → eventy.

### 4.7. Eksport (US-008) — jeśli endpoint istnieje

- `GET /api/export?format=json|csv&deck_id=...`:
  - poprawny format danych, kodowanie CSV, komplet pól.
  - dostęp tylko do własnych danych.
  - puste wyniki: poprawny plik/odpowiedź.

---

## 5. Środowisko testowe

### 5.1. Środowiska

- **Local dev**:
  - Node `22.14.0`
  - `npm install`
  - `npx supabase start` oraz `npx supabase db reset` (migracje)
  - `npm run dev`
- **CI**:
  - uruchomienie lint + testy unit/integration + e2e (docelowo)
- **Staging/Preview** (opcjonalnie):
  - środowisko wdrożeniowe do testów smoke po deployu.

### 5.2. Dane testowe

- Użytkownicy:
  - demo (anonymous) oraz full (email+hasło).
  - użytkownik A i B do testów RLS/izolacji.
- Skrypty:
  - `scripts/create-dev-user.mjs` do tworzenia użytkownika i profilu w local Supabase.
- Decki/fiszki:
  - zestawy minimalne (0–2 decki) i masowe (np. 100+ kart) do testów wydajności UI/API.

### 5.3. Konfiguracja `.env`

- Upewnić się, że:
  - `OPENROUTER_API_KEY` jest ustawione tylko dla środowisk, które testują realną integrację.
  - Dla testów integracyjnych preferować tryb mock/stub OpenRouter (aby uniknąć kosztów i flakiness).

---

## 6. Narzędzia do testowania

### 6.1. Proponowane narzędzia (rekomendacja)

- **Unit/Integration (TS)**: Vitest
- **UI komponenty (React)**: Testing Library (`@testing-library/react`, `@testing-library/user-event`)
- **Mockowanie HTTP (frontend)**: MSW
- **E2E**: Playwright
- **API manual/regresja**: Postman / Insomnia (z kolekcją dla `/api/*`)
- **Testy DB/RLS**:
  - SQL test scripts (Supabase local) + scenariusze użytkowników A/B
  - opcjonalnie: pgTAP (jeśli zdecydujemy się na testy stricte w DB)

### 6.2. Raportowanie

- Raport JUnit/HTML z testów (CI).
- Artefakty E2E: screenshoty/wideo przy failach.

---

## 7. Harmonogram testów

### 7.1. Podejście iteracyjne (zgodne z roadmapą)

- **Sprint/etap: Core AI Generation & Editor**
  - testy kontraktowe `POST /api/ai/generate`
  - E2E: generacja → wyniki → edycja/usuwanie
  - regresja limitów generacji
- **Sprint/etap: Auth**
  - E2E: demo/login/register/forgot/update/logout
  - security: RLS + blokada zmiany `account_role`
- **Sprint/etap: SRS export + KPI**
  - testy eksportu (json/csv)
  - testy eventów KPI i spójności danych

### 7.2. Minimalny zestaw „smoke” na każde wdrożenie

- Wejście na `/` → poprawny redirect.
- Generacja z krótkim tekstem (walidacja) + generacja z poprawnym tekstem.
- Wejście w wyniki + edycja 1 fiszki + usunięcie 1 fiszki.
- Utworzenie decka (jeśli funkcja dostępna).

---

## 8. Kryteria akceptacji testów

### 8.1. Kryteria wejścia (start testów)

- Lokalny Supabase działa i migracje przechodzą.
- Kluczowe endpointy odpowiadają (health przez proste smoke).
- Dostępne konta testowe (demo/full) oraz dane przykładowe.

### 8.2. Kryteria wyjścia (done)

- 100% przejścia scenariuszy krytycznych (smoke) bez błędów.
- Brak błędów krytycznych (Severity 1) i wysokich (Severity 2) otwartych dla MVP.
- Pokryte testami (min. manualnie/E2E):
  - generacja i limity,
  - decki (min. create/list),
  - edycja/usuwanie kart,
  - auth/demo + podstawowe zabezpieczenia.

---

## 9. Role i odpowiedzialności

- **QA/Tester**:
  - projekt planu testów, utrzymanie checklist smoke, testy regresji, raportowanie defektów.
  - współtworzenie przypadków E2E (z dev).
- **Frontend**:
  - testy komponentów React, poprawki UX/a11y, obsługa stanów błędów.
- **Backend**:
  - testy integracyjne endpointów, walidacja, limity, KPI, integracja OpenRouter.
- **DevOps/CI** (jeśli rola występuje):
  - uruchamianie Supabase w CI, artefakty E2E, stabilność pipeline.

---

## 10. Procedury raportowania błędów

### 10.1. Kanał i format

- GitHub Issues (lub inny tracker projektu), szablon:
  - **Tytuł**: krótki opis + obszar (AUTH/GEN/DECKS/CARDS/API/DB)
  - **Środowisko**: local/CI/staging, commit SHA
  - **Kroki** do odtworzenia
  - **Oczekiwany rezultat**
  - **Rzeczywisty rezultat**
  - **Załączniki**: logi, screenshot, response body (bez sekretów)

### 10.2. Priorytety i severity

- **S1 (blocker)**: brak możliwości logowania/demo, brak generacji, utrata danych, naruszenie bezpieczeństwa.
- **S2 (high)**: błędne limity, błędne przypisania danych userom, częste crashe UI.
- **S3 (medium)**: problemy UX, nieczytelne komunikaty, edge-case’y.
- **S4 (low)**: kosmetyka, copy, drobne a11y.

---

## Załącznik A — Mapowanie na wymagania (traceability)

- **US-001**: sekcja 4.1 + 3.6
- **US-002**: sekcja 4.2
- **US-003**: sekcja 4.4 (edycja) + batch (gdy wdrożone)
- **US-004**: sekcja 4.4 (listowanie/filtrowanie gdy wdrożone)
- **US-005**: testy progress/sesji (gdy wdrożone w UI)
- **US-006**: testy statusu jakości (gdy wdrożone end-to-end)
- **US-007**: sekcja 4.2/4.3/4.5
- **US-008**: sekcja 4.7
- **US-009**: sekcja 4.6
