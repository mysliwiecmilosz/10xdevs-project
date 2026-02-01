# Architektura UI dla AI Flashcards

## 1. Przegląd struktury UI

Aplikacja MVP to webowy interfejs do szybkiego przejścia od wklejenia tekstu do **zaakceptowanych** fiszek (definicja: `quality_status ∈ {ok, good}`), z naciskiem na **review i operacje batch**, czytelne **limity** (demo/full) oraz bezpieczne uwierzytelnienie.

### Założenia IA (Information Architecture)

- Minimalna nawigacja MVP: **5 sekcji**, powiązanych 1:1 z głównymi zasobami API:
  - **Generuj** → `/api/ai/generate`
  - **Fiszki** → `/api/cards`
  - **Decki** → `/api/decks`
  - **Eksport** → `/api/export`
  - **Konto/Status** → `/api/me/status`
- Po udanej generacji (201) aplikacja przenosi użytkownika do **Wyników generacji** filtrowanych po `source_id`, które są głównym miejscem pracy po generacji.
- „Oczekujące” (karty bez `deck_id`) są traktowane jako **preset w widoku Fiszki** („Bez decka”) z kluczową akcją batch „Przypisz do decka”.

### Globalne standardy UX / A11y / Security

- **Server state**: listy i detale z cache, paginacją i invalidacją po mutacjach; szybkie pola z optymistycznymi update’ami (z rollbackiem).
- **Status użytkownika i limity**: `GET /api/me/status` przy starcie sesji; stale widoczny wskaźnik **usage vs limit** + badge **Demo/Full**.
- **Drafty i utrata pracy**: treść wklejona w Generuj przechowywana lokalnie (sessionStorage/localStorage) i odtwarzana po błędach, 401 i nawigacji.
- **Bezpieczeństwo sesji**: tokeny/sesja w bezpiecznych cookie (httpOnly) zgodnie z integracją; UI nie przechowuje sekretów w localStorage.
- **Globalny handler 401**: ciche odświeżenie/logowanie; UI ma zachować lokalne drafty i ponowić akcję, gdy to bezpieczne.
- **Responsywność**: min. 2 breakpointy (mobile/desktop); na mobile filtry w drawer, batch actions jako sticky bottom bar, lista kart jako karty/accordion.
- **Dostępność**:
  - pełna obsługa klawiatury (fokus, selekcja wielokrotna, batch),
  - status jakości nie tylko kolorem (ikona + tekst),
  - poprawne role/ARIA dla toastów i błędów,
  - focus management w modalach i drawerach.

### Główne endpointy API i ich cele (dla zgodności UI)

- `POST /api/ai/generate`: generowanie kart z tekstu, opcjonalnie do `deck_id`; zwraca `source_id`, karty i `remaining_generations`.
- `GET /api/cards`: lista kart z filtrami (`deck_id`, `source_id`, `quality_status`, `tags`, `sort`) + paginacja.
- `POST /api/cards`: tworzenie ręczne (pojedynczo lub w bulk).
- `PATCH /api/cards/:id`: aktualizacja karty (szybkie pola i pełna edycja).
- `PATCH /api/cards/batch`: batch akcje (update status, add tags, delete) + (w UI MVP także „przypisz deck” jako wariant mutacji batch/serii patchy, zależnie od backendu).
- `DELETE /api/cards/:id`: usuwanie karty.
- `GET /api/decks`: lista decków + wyszukiwanie/paginacja.
- `POST /api/decks`: tworzenie decka (limit decków).
- `GET /api/decks/:id`: szczegóły decka.
- `PATCH /api/decks/:id`: edycja decka.
- `DELETE /api/decks/:id`: usunięcie decka (karty przechodzą do `deck_id = null`).
- `GET /api/me/status`: rola, limity i usage.
- `GET /api/export?deck_id=&format=`: eksport danych (json/csv).

## 2. Lista widoków

Poniżej widoki MVP wraz z trasami i elementami. Ścieżki są opisane na poziomie architektury (routing można dostosować do Astro), ale IA pozostaje stała.

### 2.1. Start / Routing wejściowy

- **Nazwa widoku**: Start (Router/Redirect)
- **Ścieżka widoku**: `/`
- **Główny cel**: Szybko skierować użytkownika do właściwego miejsca (Login lub Generuj).
- **Kluczowe informacje do wyświetlenia**:
  - stan sesji (czy zalogowany),
  - skrócone info o produkcie (opcjonalnie).
- **Kluczowe komponenty widoku**:
  - `AuthGate` (sprawdza sesję),
  - `LoadingState` (skeleton/spinner).
- **UX, dostępność i względy bezpieczeństwa**:
  - brak wrażliwych danych,
  - czytelny stan ładowania,
  - nie zapisywać tokenów w storage.

---

### 2.2. Logowanie / Demo

- **Nazwa widoku**: Zaloguj / Kontynuuj jako demo
- **Ścieżka widoku**: `/login`
- **Główny cel**: Uwierzytelnić użytkownika lub uruchomić tryb demo.
- **Kluczowe informacje do wyświetlenia**:
  - wyjaśnienie różnic Demo vs Full (limity i trwałość danych),
  - link do polityki prywatności/zakresu danych (minimalnie informacyjnie).
- **Kluczowe komponenty widoku**:
  - `LoginForm`,
  - `ContinueAsDemoButton`,
  - `AuthErrorBanner`.
- **UX, dostępność i względy bezpieczeństwa**:
  - a11y formularza (label, error summary, fokus na pierwszym błędzie),
  - ochrona przed podwójnym submit (disabled + spinner),
  - brak ujawniania szczegółów błędów auth, które pomagają atakującemu,
  - po sukcesie: przekierowanie do `/generate` i pobranie `GET /api/me/status`.

---

### 2.3. Shell aplikacji (globalny layout)

- **Nazwa widoku**: App Shell (Layout)
- **Ścieżka widoku**: (wspólny layout dla tras chronionych)
- **Główny cel**: Zapewnić spójną nawigację, stały wgląd w status konta/limity i obsługę globalnych stanów.
- **Kluczowe informacje do wyświetlenia**:
  - badge **Demo/Full**,
  - wskaźniki limitów: karty, decki, generacje dzienne,
  - globalne komunikaty (toasty/alerty).
- **Kluczowe komponenty widoku**:
  - `TopBar` / `SideNav` (desktop) i `BottomNav` (mobile),
  - `UsageStatusWidget` (usage vs limit),
  - `GlobalToasts`,
  - `GlobalErrorBoundary`,
  - `ConfirmDialogProvider`.
- **UX, dostępność i względy bezpieczeństwa**:
  - nawigacja klawiaturą (tab order, aria-current),
  - globalna obsługa 401 (z zachowaniem draftów),
  - nie pokazywać danych innych użytkowników (w UI zawsze zakładać, że backend egzekwuje RLS).

---

### 2.4. Generuj (flow krokowy na jednym ekranie)

- **Nazwa widoku**: Generuj
- **Ścieżka widoku**: `/generate`
- **Główny cel**: Wkleić tekst, wybrać/utworzyć deck (opcjonalnie), uruchomić generację i przejść do wyników.
- **Kluczowe informacje do wyświetlenia**:
  - textarea z `content` + licznik znaków (min 50, max 100k),
  - wybór decka lub „Bez decka (Oczekujące)”,
  - bieżące `remaining_generations` i komunikaty limitów,
  - progres generacji i stany (idle/loading/success/error).
- **Kluczowe komponenty widoku**:
  - `GenerateTextInput` (z autosave do storage),
  - `DeckPicker` (z opcją “Bez decka”),
  - `CreateDeckModal` (tworzenie „w locie”),
  - `GenerateSubmitButton`,
  - `GenerateProgressPanel` (loader + copy),
  - `LimitBanner` (dla 429 i prewencyjnych blokad).
- **UX, dostępność i względy bezpieczeństwa**:
  - zachowanie treści draftu przy nawigacji i błędach,
  - przy 429: jasny komunikat, ile pozostało i kiedy odblokuje (jeśli dostępne),
  - walidacja client-side + niezależna walidacja backend,
  - nie ujawniać pełnej treści błędów serwera; zapewnić „pokaż szczegóły” dla debug (opcjonalnie).

---

### 2.5. Wyniki generacji (główna praca po generacji)

- **Nazwa widoku**: Wyniki generacji
- **Ścieżka widoku**: `/generate/results?source_id=:sourceId` (lub `/sources/:sourceId/results`)
- **Główny cel**: Przejrzeć i zaakceptować/ulepszyć wygenerowane fiszki dla danego `source_id`.
- **Kluczowe informacje do wyświetlenia**:
  - lista kart z `source_id` (domyślnie `quality_status='draft'`, ale z możliwością filtrowania),
  - panel „Źródło” z oryginalnym tekstem (readonly) lub wycinkiem,
  - licznik zaakceptowanych vs cel (cel per `source_id`),
  - szybkie akcje inline i batch: status/tagi/usuwanie,
  - CTA „Zobacz wszystkie fiszki”.
- **Kluczowe komponenty widoku**:
  - `SourcePanel` (readonly, collapsible),
  - `SessionGoalWidget` (ustaw cel i licz postęp),
  - `CardsList` (filtrowana po `source_id`),
  - `CardRow` / `CardCard` (mobile) z szybkim edytowaniem: tagi, trudność, status,
  - `BatchSelectionToolbar` (desktop) / `StickyBatchBar` (mobile),
  - `BatchUpdateStatusAction` (primary: „Oznacz jako OK/Dobre”),
  - `BatchAddTagsAction`,
  - `BatchDeleteAction` + potwierdzenie,
  - `OpenCardDetails` (pełna edycja: panel boczny lub osobny widok – patrz 2.7),
  - `GoToCardsCTA`.
- **UX, dostępność i względy bezpieczeństwa**:
  - batch selection dostępny klawiaturą (checkboxy + skróty, np. Shift+Click / Shift+Arrow),
  - status jakości zawsze jako tekst + ikona,
  - context domyślnie zwinięty, z kontrolą „Pokaż kontekst”,
  - ostrożne komunikaty przy usuwaniu (undo tylko jeśli backend wspiera; w MVP potwierdzenie),
  - obsługa 401/403/404 dla `source_id` (bez wycieku informacji).

---

### 2.6. Fiszki (globalna lista + presety, filtry i batch)

- **Nazwa widoku**: Fiszki
- **Ścieżka widoku**: `/cards`
- **Główny cel**: Przeglądać wszystkie fiszki, filtrować/sortować, wykonywać szybkie zmiany inline i operacje batch.
- **Kluczowe informacje do wyświetlenia**:
  - lista kart z paginacją,
  - filtry 1:1 z API: `deck_id`, `source_id`, `quality_status`, `tags`, `sort`,
  - preset „Bez decka (Oczekujące)” = `deck_id = null`,
  - źródło (AI/manual), data utworzenia/edycji (jeśli dostępne),
  - wskaźnik limitu kart (ile pozostało do 2000).
- **Kluczowe komponenty widoku**:
  - `CardsFiltersPanel` (desktop) / `FiltersDrawer` (mobile),
  - `SavedPresets` (np. „Oczekujące”, „Drafty”, „Zaakceptowane”),
  - `CardsTable` (desktop) / `CardsAccordion` (mobile),
  - inline edit dla: `tags`, `difficulty`, `quality_status`,
  - `BatchSelectionToolbar` / `StickyBatchBar`,
  - batch akcje:
    - `BatchUpdateStatusAction` (primary),
    - `BatchAddTagsAction`,
    - `BatchDeleteAction`,
    - `BatchAssignToDeckAction` (kluczowe dla „Oczekujące”),
  - `CreateCardModal` (manualne tworzenie) lub CTA do tworzenia w osobnym kroku (MVP: modal).
- **UX, dostępność i względy bezpieczeństwa**:
  - filtry odzwierciedlone w URL (query string) dla share/bookmark,
  - tryb „Oczekujące” wyraźnie komunikuje brak decka i oferuje „Przypisz do decka” jako primary,
  - potwierdzenie przed usunięciem (i czytelne skutki),
  - a11y: drawer filtrów i sticky bar z poprawnym fokusowaniem,
  - odporność na duże listy (paginacja, skeletony, empty states).

---

### 2.7. Szczegóły / Pełna edycja fiszki (rozwiązanie otwarte)

- **Nazwa widoku**: Szczegóły fiszki (pełna edycja)
- **Ścieżka widoku**:
  - wariant A (deep-linking): `/cards/:id`
  - wariant B (panel boczny): jako overlay w `/cards` i `/generate/results` z parametrem `?card_id=:id`
- **Główny cel**: Pełna edycja pól: pytanie/odpowiedź/kontekst + metadane.
- **Kluczowe informacje do wyświetlenia**:
  - pełne pola: `question`, `answer`, `context`,
  - `deck_id`, `tags`, `difficulty`, `quality_status`,
  - info o źródle: `source_id` i link do wyników generacji (jeśli dotyczy).
- **Kluczowe komponenty widoku**:
  - `CardEditorForm`,
  - `CardPreview` (front/back),
  - `ContextEditor` (z podpowiedzią formatowania),
  - `TagInputAutocomplete` (normalizacja trim + opcjonalny lowercase, limit tagów/kartę),
  - `SaveBar` (sticky) + `Cancel`.
- **UX, dostępność i względy bezpieczeństwa**:
  - zarządzanie fokusem (otwarcie/zamknięcie overlay, powrót fokusu),
  - ostrzeżenie o niezapisanych zmianach,
  - brak ujawniania danych przy 404/403,
  - decyzja produktowa: panel boczny lepszy dla „ciągłości pracy”, osobna strona lepsza dla deep-linking i mobile a11y.

---

### 2.8. Decki (lista)

- **Nazwa widoku**: Decki
- **Ścieżka widoku**: `/decks`
- **Główny cel**: Zarządzać kolekcjami: tworzyć/edytować/usuwać decki oraz wejść do szczegółów.
- **Kluczowe informacje do wyświetlenia**:
  - lista decków + wyszukiwanie,
  - licznik decków vs limit,
  - podstawowe metadane (nazwa, opis, data).
- **Kluczowe komponenty widoku**:
  - `DecksList` (paginacja),
  - `CreateDeckButton` + `CreateDeckModal`,
  - `DeckRowActions` (edytuj/usuń),
  - `LimitBanner` (gdy limit decków osiągnięty).
- **UX, dostępność i względy bezpieczeństwa**:
  - potwierdzenie przed usunięciem decka z jasnym skutkiem: karty przechodzą do „Bez decka”,
  - blokada tworzenia przy limicie (prewencyjna + backend),
  - a11y dla modalów i menu akcji.

---

### 2.9. Deck – szczegóły

- **Nazwa widoku**: Szczegóły decka
- **Ścieżka widoku**: `/decks/:id`
- **Główny cel**: Przeglądać deck oraz przejść do fiszek w tym decku i eksportu.
- **Kluczowe informacje do wyświetlenia**:
  - nazwa i opis,
  - CTA „Pokaż fiszki” (link do `/cards?deck_id=:id`),
  - CTA „Eksportuj ten deck”.
- **Kluczowe komponenty widoku**:
  - `DeckHeader`,
  - `DeckActions` (edytuj/usuń),
  - `DeckShortcuts` (fiszki, eksport).
- **UX, dostępność i względy bezpieczeństwa**:
  - obsługa 404/403 (deck nie istnieje lub nie należy do usera),
  - jasne komunikaty o skutkach usunięcia decka.

---

### 2.10. Eksport

- **Nazwa widoku**: Eksport
- **Ścieżka widoku**: `/export`
- **Główny cel**: Wybrać zakres i format eksportu, potwierdzić i pobrać plik.
- **Kluczowe informacje do wyświetlenia**:
  - zakres: „Wszystkie fiszki” albo „Wybrany deck”,
  - format: `json` / `csv`,
  - potwierdzenie zakresu danych,
  - wynik: ile kart i kiedy wykonano eksport (jeśli dostępne).
- **Kluczowe komponenty widoku**:
  - `ExportScopeSelector`,
  - `DeckSelect` (dla zakresu deck),
  - `FormatSelector`,
  - `ExportConfirmDialog`,
  - `DownloadButton`,
  - `ExportResultSummary`.
- **UX, dostępność i względy bezpieczeństwa**:
  - wyraźne potwierdzenie (eksport danych prywatnych),
  - ograniczenie wielokrotnych kliknięć i pokazanie postępu,
  - obsługa błędów sieci / 401 / 429 (jeśli dotyczy).

---

### 2.11. Konto / Status

- **Nazwa widoku**: Konto / Status
- **Ścieżka widoku**: `/account`
- **Główny cel**: Pokazać status konta, limity i stan wykorzystania; zapewnić podstawowe akcje konta.
- **Kluczowe informacje do wyświetlenia**:
  - rola: demo/full,
  - usage vs limit (karty, decki, generacje),
  - wskazówki „co dalej” (np. „Wyczerpałeś generacje – wróć jutro”).
- **Kluczowe komponenty widoku**:
  - `AccountBadge`,
  - `LimitsPanel`,
  - `UsageHistoryHint` (opcjonalnie, bez rozbudowanej analityki w MVP),
  - `LogoutButton`.
- **UX, dostępność i względy bezpieczeństwa**:
  - brak wrażliwych danych poza limitami,
  - obsługa 401 jako przekierowanie do `/login`,
  - jasne komunikaty limitów (szczególnie 429).

## 3. Mapa podróży użytkownika

### 3.1. Główny przypadek użycia (Time-to-value): Generuj → Wyniki → Akceptacja

1. **Wejście**
   - Użytkownik wchodzi na `/`.
   - Jeśli brak sesji → `/login`; jeśli jest sesja → `/generate`.
2. **Login/Demo**
   - Użytkownik loguje się lub wybiera demo.
   - Aplikacja pobiera `GET /api/me/status` i zapisuje w server state.
3. **Generuj**
   - Wkleja tekst, widzi liczniki i walidację (min 50, max 100k).
   - Wybiera deck z listy (z `GET /api/decks`) albo wybiera „Bez decka (Oczekujące)”.
   - Opcjonalnie: tworzy deck w modalu (`POST /api/decks`) bez utraty wklejonego tekstu.
4. **Uruchom generację**
   - Klik „Generuj” → `POST /api/ai/generate`.
   - UI pokazuje progres i blokuje wielokrotne wysłania.
   - Jeśli 201 → nawigacja do `/generate/results?source_id=...`.
   - Jeśli 429 → pozostaje na `/generate`, pokazuje komunikat limitu i zachowuje draft.
5. **Wyniki generacji**
   - UI pobiera listę kart dla `source_id` przez `GET /api/cards?source_id=...`.
   - Użytkownik ustawia cel sesji dla `source_id` (lokalnie w UI, per source).
   - Użytkownik selekcjonuje wiele kart i wykonuje batch update statusu przez `PATCH /api/cards/batch` (primary).
   - Postęp (zaakceptowane vs cel) aktualizuje się w UI natychmiast.
   - Użytkownik może dodać tagi batch, zmienić trudność inline (patch per karta) i usunąć niechciane karty (batch lub delete).
6. **Kontynuacja**
   - CTA „Zobacz wszystkie fiszki” prowadzi do `/cards?source_id=...` (lub do `/cards` z presetem).
   - Użytkownik może przejść do organizacji „Oczekujących” (jeśli generował bez decka) i przypisać je do decka.

### 3.2. Alternatywne ścieżki

- **Organizacja po generacji**: Wyniki → /cards (preset „Bez decka”) → batch „Przypisz do decka” → /decks/:id.
- **Manualne tworzenie**: /cards → „Dodaj fiszkę” → `POST /api/cards` → odświeżenie listy i liczników limitów.
- **Eksport**: /decks/:id → skrót „Eksportuj” → /export z wstępnie wybranym deckiem → `GET /api/export?...`.

## 4. Układ i struktura nawigacji

### 4.1. Struktura

- **Nawigacja główna (5 sekcji)**:
  - `/generate` (Generuj)
  - `/cards` (Fiszki)
  - `/decks` (Decki)
  - `/export` (Eksport)
  - `/account` (Konto/Status)
- **Nawigacja kontekstowa**:
  - z Wyników: CTA do `/cards` (globalna lista) + powrót do `/generate`,
  - z Decka: CTA do `/cards?deck_id=:id` i do `/export?deck_id=:id` (jako prefill).

### 4.2. Wzorce responsywne

- **Desktop**: topbar + side nav; filtry jako panel boczny.
- **Mobile**: bottom nav; filtry jako drawer; batch actions jako sticky bottom bar.

### 4.3. Zasady ochrony tras

- Trasy aplikacji (poza `/login` i ewentualnymi publicznymi stronami informacyjnymi) są chronione przez `AuthGate`.
- Przy 401: automatyczna próba odświeżenia sesji; jeśli nieudana → `/login` z zachowaniem draftów Generuj.

## 5. Kluczowe komponenty

- **`AuthGate` / `AuthBoundary`**: ochrona tras, obsługa 401, przywracanie użytkownika po loginie.
- **`UsageStatusWidget`**: stały komponent pokazujący role (demo/full) i limity/usage (źródło prawdy: `GET /api/me/status`).
- **`LimitBanner`**: spójne komunikaty o limitach (w tym 429) i prewencyjne blokady UI.
- **`DeckPicker` + `CreateDeckModal`**: wybór decka i tworzenie „w locie” bez utraty draftu.
- **`CardsList` / `CardsTable` / `CardsAccordion`**: wspólny silnik listowania kart z paginacją i stanami (loading/empty/error).
- **`CardsFiltersPanel` / `FiltersDrawer`**: filtry 1:1 z query paramami `/api/cards`.
- **`BatchSelectionToolbar` / `StickyBatchBar`**: operacje batch (status/tagi/usuwanie/przypisanie do decka) z pełnym wsparciem klawiatury.
- **`QualityStatusBadge`**: jednolite mapowanie statusów jakości i „akceptacji” (ok/good = zaakceptowane).
- **`TagInputAutocomplete`**: autocomplete tagów per-user, normalizacja (trim + opcjonalny lowercase), limit tagów/kartę.
- **`CardQuickEdit`**: szybkie pola inline (tagi/trudność/status) z optymistycznym update.
- **`CardDetailsEditor`**: pełna edycja (drawer lub strona) z ostrzeżeniem o niezapisanych zmianach.
- **`ConfirmDialog`**: wymagany dla delete oraz eksportu (zakres danych).
- **`GlobalToasts` + `InlineError`**: spójna komunikacja błędów (network, walidacja, 429).

---

## Mapowanie historyjek użytkownika (PRD) do architektury UI

- **US-001 (Login + demo/full + limity)**:
  - Widoki: `/login`, `/account`, App Shell.
  - UI: badge Demo/Full, `UsageStatusWidget`, komunikaty limitów.
- **US-002 (Generowanie AI z tekstu)**:
  - Widok: `/generate` → `/generate/results`.
  - UI: textarea z walidacją, deck picker, progres generacji, obsługa 429.
- **US-003 (Manualne tworzenie + batch edycje)**:
  - Widok: `/cards`, `/generate/results`, (szczegóły `/cards/:id`).
  - UI: selekcja, batch toolbar, inline edit, modal „Dodaj fiszkę”.
- **US-004 (Przegląd/filtrowanie/usuwanie)**:
  - Widok: `/cards`.
  - UI: filtry (tagi/trudność/status), potwierdzenie usunięcia, inline edit.
- **US-005 (Progres i sugestie kolejnych kroków)**:
  - Widok: `/generate/results`.
  - UI: `SessionGoalWidget`, licznik zaakceptowanych vs cel, komunikaty „dodaj X więcej”.
- **US-006 (Status jakości fiszki)**:
  - Widoki: `/generate/results`, `/cards`, `/cards/:id`.
  - UI: `QualityStatusBadge`, możliwość ręcznej zmiany statusu (inline i batch).
- **US-007 (Limity fiszek i generacji)**:
  - Widoki: globalnie w App Shell + krytycznie `/generate`, `/decks`, `/cards`.
  - UI: prewencyjne blokady (disable CTA), `LimitBanner`, komunikaty backendowe (429/400).
- **US-008 (Eksport + potwierdzenie)**:
  - Widok: `/export` (+ skróty w `/decks/:id`).
  - UI: wybór zakresu/formatu, potwierdzenie, podsumowanie eksportu.
- **US-009 (KPI tracking)**:
  - UI: brak osobnych ekranów; architektura uwzględnia spójne momenty akcji (login/generacja/edycja/akceptacja/eksport) oraz definicję „akceptacji” opartą o `quality_status`.

---

## Przypadki brzegowe i stany błędów (wspólne standardy)

- **401 Unauthorized**: globalny handler; zachowanie draftu Generuj; po ponownym logowaniu powrót do poprzedniego widoku.
- **403 Forbidden / 404 Not Found**: jednolite ekrany „Brak dostępu” / „Nie znaleziono”; bez wycieku informacji o cudzych zasobach.
- **429 Too Many Requests**:
  - Generacje: blokada „Generuj”, komunikat z pozostałym limitem (`remaining_generations`) i sugestią.
  - Limity kart/decków: blokady CTA + link do /account z wyjaśnieniem.
- **Walidacja 400**: błędy per pole + summary; nie gubić danych formularzy.
- **Błąd sieci / 500**: retry, komunikat, zachowanie stanu selekcji/batch (o ile możliwe), brak utraty draftów.
- **Usunięcie decka**: karty przechodzą do „Bez decka”; UI pokazuje toast i link do presetu „Oczekujące”.
- **Duże listy (wydajność)**: paginacja, skeletony, ograniczenie odświeżeń, brak fetch na każde wpisanie (debounce dla filtrów).
