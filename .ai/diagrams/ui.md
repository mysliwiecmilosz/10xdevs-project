<architecture_analysis>

## 1) Komponenty wymienione w dokumentacji (PRD + auth-spec)

Poniżej lista elementów UI/architektury, które wprost wynikają z `.ai/prd.md` oraz `.ai/auth-spec.md`.

### Elementy wynikające z PRD (w kontekście autentykacji)

- System kont użytkowników: **tryb demo vs pełne konto** (US-001)
- Bezpieczne logowanie oraz “dwuskładnikowa walidacja” (US-001)
- Widoczny status konta (demo/full) i limity w interfejsie (US-001, US-007)
- Backendowe egzekwowanie limitów zależnych od roli (US-001, US-007)
- Rejestrowanie KPI dla sesji/logowania (US-001, US-009)

### Strony Astro (z auth-spec)

- `src/pages/login.astro`
- `src/pages/register.astro`
- `src/pages/forgot-password.astro`
- `src/pages/update-password.astro`
- `src/pages/auth/callback.(astro|ts)` (jako punkt powrotu po weryfikacji maila / recovery)
- `src/pages/logout.astro` (opcjonalnie)
- `src/pages/index.astro` (start) oraz wejście do aplikacji (redirect wg sesji)

### Layouty Astro (z auth-spec)

- `src/layouts/PublicLayout.astro` (opcjonalny alias istniejącego layoutu)
- `src/layouts/AuthLayout.astro` (ekrany logowania/rejestracji/resetu)
- `src/layouts/AppLayout.astro` (shell aplikacji dla tras “po zalogowaniu”, z badge i limitami)

### Komponenty React (z auth-spec)

- `LoginForm`
- `RegisterForm`
- `ForgotPasswordForm`
- `UpdatePasswordForm`
- `ContinueAsDemoButton`
- `AuthErrorBanner`
- `AuthGate` (opcjonalnie, wsparcie UX po stronie klienta)
- `UserMenu` (wylogowanie)
- `UsageStatusWidget` (status demo/full + limity; wykorzystywany w App Shell)

### Moduły backendowe / serwisy (z auth-spec)

- Middleware Astro: rozszerzenie `src/middleware/index.ts` o weryfikację sesji i przygotowanie kontekstu
- Warstwa usług:
  - `auth.service.ts` (login/register/logout/demo/callback)
  - `user-status.service.ts` (budowa `UserStatusDto`)
  - `http-error.ts` (mapowanie błędów na kody)
- Integracja SSR z Supabase przez `@supabase/ssr` (cookie `getAll/setAll`)

### Kontrakty API (z auth-spec; bez nazywania endpointów w węzłach diagramu)

- Operacje: login, rejestracja, utworzenie sesji demo, wylogowanie, status użytkownika (role + limity)

## 2) Elementy znalezione w codebase (obecny stan repo)

### Istniejące strony Astro

- `src/pages/index.astro` (Welcome)
- `src/pages/generate.astro` (osadza React `GenerateView`)
- `src/pages/generate/results.astro`

### Istniejące layouty i middleware

- `src/layouts/Layout.astro` (minimalny layout – będzie bazą do rozbudowy)
- `src/middleware/index.ts` (obecnie tylko wstrzykuje `locals.supabase`)

### Istniejące komponenty React (istotne dla flow po auth)

- `src/components/generate/GenerateView.tsx`
- `src/components/generate/LimitBanner.tsx` (istotny dla limitów i komunikatów)

### Istniejące API (dzisiaj na skrócie `DEFAULT_USER_ID`)

- Generowanie: `src/pages/api/ai/generate.ts` oraz alias `src/pages/api/generate.ts`
- Decki: `src/pages/api/decks.ts`
- Karty: `src/pages/api/cards/[card_id].ts`
- Karty dla źródła: `src/pages/api/sources/[source_id]/cards.ts`
- Dev helpery: `src/pages/api/dev/default-user.ts`, `src/pages/api/dev/reset-usage.ts`

### Baza danych i auth w Supabase

- `public.profiles` z `account_role` = `demo|full` + trigger tworzący profil po `auth.users`
- RLS dla `anon` i `authenticated`
- `user_usage_stats` (limity dzienne generacji)
- `kpi_events` (zdarzenia)

## 3) Główne strony i odpowiadające komponenty

- `/` (Start, Astro): decyzja “zalogowany?” i redirect
- Strony auth (Astro): renderują formularze React i pokazują błędy
- Strony aplikacji (Astro + React islands): `GenerateView` i kolejne widoki wymagają:
  - odczytu statusu (demo/full + limity)
  - spójnej obsługi 401/limitów

## 4) Przepływ danych (high-level)

- Przeglądarka → Strony Astro (SSR) → Layouty (shell) → Komponenty React (formularze i interakcje)
- React → Warstwa API (operacje auth/status oraz istniejące API domenowe) → Supabase (Auth + DB)
- Middleware Astro jest “bramą” do sesji i wnosi kontekst użytkownika dla SSR i API

## 5) Krótki opis funkcjonalności komponentów (najważniejsze)

- `LoginForm`: logowanie pełnego konta; obsługa błędów i redirect `returnTo`
- `RegisterForm`: rejestracja; obsługa potwierdzenia email (token) jako “drugi krok” weryfikacji
- `ContinueAsDemoButton`: szybkie utworzenie anon sesji demo
- `ForgotPasswordForm` + `UpdatePasswordForm`: odzyskanie hasła w oparciu o redirect/callback
- `AppLayout` + `UsageStatusWidget`: stały widok roli i limitów (US-001/US-007)
- `LimitBanner`: komunikaty o limitach (np. brak generacji) i spójny UX błędów
- Middleware: weryfikacja sesji i przygotowanie `locals` dla SSR/API
  </architecture_analysis>

<mermaid_diagram>

```mermaid
flowchart TD
  %% ===== Style =====
  classDef updated fill:#fff3cd,stroke:#b38b00,stroke-width:2px;
  classDef shared fill:#e7f1ff,stroke:#245bdb,stroke-width:1px;
  classDef auth fill:#e9fbe7,stroke:#1b7f2a,stroke-width:1px;
  classDef backend fill:#f3e8ff,stroke:#6d28d9,stroke-width:1px;
  classDef db fill:#ffe4e6,stroke:#be123c,stroke-width:1px;

  %% ===== Wejście / Routing =====
  subgraph SGEntry["Wejście do aplikacji (Astro)"]
    B1((Przeglądarka))
    PHome["Strona Start"]
    DAuth{Sesja istnieje?}
    PLogin["Strona Logowania"]:::auth
    PGenerate["Strona Generowania"]:::shared
  end

  B1 --> PHome
  PHome --> DAuth
  DAuth -- "Nie" --> PLogin
  DAuth -- "Tak" --> PGenerate

  %% ===== Layouty =====
  subgraph SGLayouts["Layouty (Astro)"]
    LPublic["PublicLayout"]:::shared
    LAuth["AuthLayout"]:::auth
    LApp["AppLayout"]:::shared
    LBase["Layout Bazowy"]:::updated
  end

  PHome --> LPublic
  PLogin --> LAuth
  PGenerate --> LApp
  LPublic --- LBase
  LAuth --- LBase
  LApp --- LBase

  %% ===== Strony Auth =====
  subgraph SGAuthPages["Strony Autentykacji (Astro)"]
    PRegister["Strona Rejestracji"]:::auth
    PForgot["Strona Resetu Hasła"]:::auth
    PUpdatePw["Strona Ustawienia Hasła"]:::auth
    PCallback["Strona Callback"]:::auth
    PLogout["Strona Wylogowania"]:::auth
  end

  PLogin --> PRegister
  PLogin --> PForgot
  PForgot --> PCallback
  PCallback --> PUpdatePw
  PLogout --> PLogin

  %% ===== Komponenty React (Auth) =====
  subgraph SGAuthReact["Komponenty React (Auth)"]
    CLogin["LoginForm"]:::auth
    CRegister["RegisterForm"]:::auth
    CForgot["ForgotPasswordForm"]:::auth
    CUpdatePw["UpdatePasswordForm"]:::auth
    CDemo["ContinueAsDemoButton"]:::auth
    CAuthErr["AuthErrorBanner"]:::auth
    CGate["AuthGate"]:::auth
  end

  PLogin --> CLogin
  PLogin --> CDemo
  PLogin --> CAuthErr
  PRegister --> CRegister
  PRegister --> CAuthErr
  PForgot --> CForgot
  PForgot --> CAuthErr
  PUpdatePw --> CUpdatePw
  PUpdatePw --> CAuthErr

  %% ===== Aplikacja (po zalogowaniu) =====
  subgraph SGApp["Aplikacja (Astro + React)"]
    PResults["Strona Wyników Generacji"]:::shared
    CGenerate["GenerateView"]:::updated
    CLimit["LimitBanner"]:::updated
    CUserMenu["UserMenu"]:::updated
    CUsage["UsageStatusWidget"]:::updated
    CAppState["Stan Użytkownika"]:::shared
  end

  PGenerate --> CGenerate
  PGenerate --> CUsage
  PGenerate --> CUserMenu
  CGenerate --> CLimit
  CUsage --> CAppState
  CGenerate --> CAppState
  PResults --> CAppState

  %% ===== Middleware + Integracja SSR =====
  subgraph SGMw["Middleware i SSR (Astro)"]
    MW["Middleware"]:::updated
    SESS{Sesja w cookie?}
    SrvSb["Supabase Server Client"]:::updated
  end

  LApp --> MW
  LAuth --> MW
  MW --> SrvSb
  SrvSb --> SESS
  SESS -- "Brak" --> PLogin
  SESS -- "Jest" --> PGenerate

  %% ===== Backend API =====
  subgraph SGBackend["Warstwa API (Astro server endpoints)"]
    APIAuth["Operacje Autentykacji"]:::backend
    APIStatus["Operacja Statusu Użytkownika"]:::backend
    APIDomain["Operacje Domenowe"]:::backend
    SAuth["AuthService"]:::backend
    SStatus["UserStatusService"]:::backend
    SErr["HttpErrorMapper"]:::backend
  end

  CLogin -- "logowanie" --> APIAuth
  CRegister -- "rejestracja" --> APIAuth
  CDemo -- "sesja demo" --> APIAuth
  PLogout -- "wylogowanie" --> APIAuth
  CAppState -- "pobierz status" --> APIStatus

  CGenerate -- "akcje aplikacji" --> APIDomain
  PResults -- "pobierz karty" --> APIDomain

  APIAuth --> SAuth
  APIStatus --> SStatus
  APIDomain --> SErr
  APIAuth --> SErr
  APIStatus --> SErr

  %% ===== Supabase =====
  subgraph SGSupabase["Supabase"]
    SBA["Supabase Auth"]:::db
    SDB["Supabase DB"]:::db
    TProfiles["Tabela Profiles"]:::db
    TUsage["Tabela Usage"]:::db
    TKpi["Tabela KPI"]:::db
  end

  SAuth --> SBA
  SAuth --> SDB
  SStatus --> SDB
  APIDomain --> SDB

  SDB --> TProfiles
  SDB --> TUsage
  SDB --> TKpi

  %% ===== Wyróżnienia zmian (komponenty istniejące, które wymagają aktualizacji) =====
  class MW updated;
  class LBase updated;
  class CGenerate updated;
  class CLimit updated;
  class CUserMenu updated;
  class CUsage updated;
  class SrvSb updated;
```

</mermaid_diagram>
