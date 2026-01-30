# Schemat Bazy Danych PostgreSQL (Supabase)

Ten dokument zawiera kompleksowy schemat bazy danych dla projektu AI Flashcards, zaprojektowany zgodnie z wymaganiami PRD, notatkami z sesji planowania oraz wybranym stackiem technologicznym.

## 1. Lista tabel

### `profiles`
Przechowuje rozszerzone dane użytkowników powiązane z systemem auth Supabase.
This table is managed by Supabase Auth.
- `id`: `uuid` (PRIMARY KEY, REFERENCES auth.users)
- `email`: `text` (NOT NULL)
- `account_role`: `text` (CHECK: role IN ('demo', 'full'), DEFAULT 'demo')
- `last_active_at`: `timestamp with time zone` (DEFAULT now())
- `created_at`: `timestamp with time zone` (DEFAULT now())

### `sources`
Przechowuje oryginalne teksty źródłowe wklejone przez użytkowników.
- `id`: `uuid` (PRIMARY KEY, DEFAULT gen_random_uuid())
- `user_id`: `uuid` (NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `title`: `text` (NOT NULL)
- `content`: `text` (NOT NULL) - *Zalecany limit techniczny: 100k znaków*
- `character_count`: `integer` (NOT NULL)
- `created_at`: `timestamp with time zone` (DEFAULT now())

### `decks`
Kontenery na fiszki (talie).
- `id`: `uuid` (PRIMARY KEY, DEFAULT gen_random_uuid())
- `user_id`: `uuid` (NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `name`: `text` (NOT NULL)
- `description`: `text`
- `created_at`: `timestamp with time zone` (DEFAULT now())
- *Constraint: UNIQUE (user_id, name)*

### `cards`
Główna tabela przechowująca fiszki.
- `id`: `uuid` (PRIMARY KEY, DEFAULT gen_random_uuid())
- `user_id`: `uuid` (NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `deck_id`: `uuid` (NULLABLE, REFERENCES decks(id) ON DELETE SET NULL)
- `source_id`: `uuid` (NULLABLE, REFERENCES sources(id) ON DELETE SET NULL)
- `question`: `text` (NOT NULL)
- `answer`: `text` (NOT NULL)
- `context`: `text`
- `tags`: `text[]` (DEFAULT '{}')
- `difficulty`: `smallint` (CHECK: difficulty BETWEEN 1 AND 5, DEFAULT 3)
- `quality_status`: `text` (CHECK: quality_status IN ('draft', 'ok', 'good'), DEFAULT 'draft')
- `is_manual_override`: `boolean` (DEFAULT false)
- `external_metadata`: `jsonb` (DEFAULT '{}') - *Dla integracji SRS*
- `last_synced_at`: `timestamp with time zone`
- `created_at`: `timestamp with time zone` (DEFAULT now())
- `updated_at`: `timestamp with time zone` (DEFAULT now())

### `user_usage_stats`
Tabela do śledzenia dziennych limitów generacji AI.
- `user_id`: `uuid` (NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `date`: `date` (NOT NULL, DEFAULT CURRENT_DATE)
- `generation_count`: `integer` (DEFAULT 0)
- `PRIMARY KEY (user_id, date)`

### `kpi_events`
Rejestr zdarzeń analitycznych.
- `id`: `bigint` (PRIMARY KEY GENERATED ALWAYS AS IDENTITY)
- `user_id`: `uuid` (NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE)
- `event_type`: `text` (NOT NULL) - *np. 'session_start', 'ai_generation', 'card_edit', 'card_accept', 'card_delete'*
- `metadata`: `jsonb` (DEFAULT '{}') - *Dodatkowe dane o zdarzeniu*
- `created_at`: `timestamp with time zone` (DEFAULT now())

## 2. Relacje między tabelami

1.  **profiles -> sources**: Jeden użytkownik może mieć wiele źródeł (1:N).
2.  **profiles -> decks**: Jeden użytkownik może mieć wiele decków (1:N).
3.  **profiles -> cards**: Jeden użytkownik może mieć wiele fiszek (1:N).
4.  **decks -> cards**: Jeden deck zawiera wiele fiszek (1:N). Fiszka może nie należeć do żadnego decku (deck_id IS NULL).
5.  **sources -> cards**: Jedno źródło może wygenerować wiele fiszek (1:N). Usunięcie źródła ustawia source_id w fiszkach na NULL.
6.  **profiles -> user_usage_stats**: Statystyki użycia per użytkownik per dzień (1:N).
7.  **profiles -> kpi_events**: Logi zdarzeń użytkownika (1:N).

## 3. Indeksy

- `idx_cards_user_id`: B-tree na `cards(user_id)` - szybkie filtrowanie fiszek użytkownika.
- `idx_cards_deck_id`: B-tree na `cards(deck_id)` - szybkie pobieranie fiszek z decku.
- `idx_cards_tags`: GIN na `cards(tags)` - wydajne przeszukiwanie po tagach.
- `idx_cards_quality_status`: B-tree na `cards(quality_status)` - filtrowanie po statusie.
- `idx_decks_user_id_name`: UNIQUE INDEX na `decks(user_id, name)` - unikalność nazw decków per użytkownik.
- `idx_kpi_events_user_id`: B-tree na `kpi_events(user_id)` - analityka per użytkownik.
- `idx_user_usage_stats_date`: B-tree na `user_usage_stats(date)` - optymalizacja zapytań o statystyki dzienne.

## 4. Zasady PostgreSQL (RLS)

Wszystkie tabele mają włączone Row Level Security (RLS).

- **profiles**:
  - SELECT: `auth.uid() = id`
  - UPDATE: `auth.uid() = id`
- **sources / decks / cards**:
  - ALL: `auth.uid() = user_id`
- **user_usage_stats**:
  - SELECT: `auth.uid() = user_id`
  - *Modyfikacja tylko przez funkcje serwerowe (RPC) lub triggery.*
- **kpi_events**:
  - INSERT: `auth.uid() = user_id`
  - SELECT: Brak dostępu dla użytkownika (tylko dla adminów/analityki).

## 5. Dodatkowe uwagi projektowe

1.  **Typy danych**:
    - Użycie `smallint` dla `difficulty` (1-5) oszczędza miejsce.
    - `text[]` dla tagów z indeksem GIN jest optymalne dla przewidywanej skali (2000 fiszek/użytkownik).
    - `jsonb` w `external_metadata` zapewnia elastyczność dla przyszłych integracji SRS bez zmian w schemacie.
2.  **Strategia usuwania**:
    - `ON DELETE CASCADE` dla relacji z `profiles` zapewnia czystość danych przy usunięciu konta.
    - `ON DELETE SET NULL` dla `source_id` i `deck_id` w tabeli `cards` chroni owoce pracy użytkownika.
3.  **Limity i wydajność**:
    - Tabela `user_usage_stats` z kluczem złożonym `(user_id, date)` pozwala na atomowe inkrementowanie liczników bez skomplikowanych zadań cron.
    - Limity (np. 50 decków, 2000 fiszek) powinny być sprawdzane w funkcjach bazy danych (RPC) przed wykonaniem operacji zapisu.
4.  **Strefa czasowa**:
    - Wszystkie limity dzienne w `user_usage_stats` są resetowane zgodnie z czasem UTC (standard Supabase), co upraszcza logikę backendu.
