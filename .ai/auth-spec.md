# Specyfikacja architektury: rejestracja, logowanie i odzyskiwanie hasła (Astro + React + Supabase Auth)

## 0. Cel i zakres

Celem jest zaprojektowanie modułu **rejestracji, logowania, wylogowywania i odzyskiwania hasła** dla aplikacji AI Flashcards, zgodnie z wymaganiami PRD (`.ai/prd.md`) i stackiem (`.ai/tech-stack.md`), w sposób który:

- integruje się z istniejącą hybrydą **Astro 5 (SSR)** + **React 19 (komponenty interaktywne)**,
- wykorzystuje **Supabase Auth** jako system tożsamości i sesji,
- jest spójny z istniejącym schematem danych w Supabase (`profiles`, `user_usage_stats`, RLS, triggery),
- **nie narusza obecnego działania aplikacji** (obecne API i UI działają dziś na skrócie `DEFAULT_USER_ID`), umożliwiając bezpieczne wdrożenie etapami,
- przygotowuje pod przyszłe wymagania PRD: rozróżnienie **demo vs full**, limity, KPI.

To jest specyfikacja techniczna (architektura + kontrakty), **bez docelowej implementacji**.

### 0.1. Mapowanie na User Stories (wymagania PRD)

Ten dokument jest bezpośrednio powiązany z:

- **US-001**: bezpieczne logowanie + demo/full + widoczne limity + KPI sesji
- **US-007**: egzekwowanie limitów zależnych od demo/full (wymaga wiarygodnego `account_role`)

Pozostałe User Stories (US-002..US-009) wymagają jedynie, aby:
- istniał stabilny `user_id` (dla danych per-user),
- backend mógł rozróżnić demo/full (dla limitów),
- UI miało endpoint “status/limity” (np. `/api/me/status`).

---

## 1) ARCHITEKTURA INTERFEJSU UŻYTKOWNIKA

### 1.1. Mapa routów i stron (Astro)

Aktualnie istnieją m.in.:
- `src/pages/index.astro` (Welcome),
- `src/pages/generate.astro` (osadza React `GenerateView`),
- `src/pages/generate/results.astro` (wyniki generacji),
- API routes w `src/pages/api/**` (obecnie oparte o `DEFAULT_USER_ID`).

Dodajemy (nowe strony Astro):

- `src/pages/login.astro`  
  Ekran logowania z opcją **kontynuuj jako demo**.

- `src/pages/register.astro`  
  Rejestracja pełnego konta (email + hasło).

- `src/pages/forgot-password.astro`  
  Formularz wysłania maila resetującego hasło.

- `src/pages/auth/callback.astro` lub `src/pages/auth/callback.ts` (rekomendowane jako endpoint)  
  Odbiór redirectu Supabase (confirm signup / recovery / magic link) i ustanowienie sesji w cookie, potem redirect do aplikacji.

- `src/pages/update-password.astro`  
  Ustawienie nowego hasła w kontekście flow “recovery”.

- `src/pages/logout.astro` (opcjonalnie)  
  Prosta strona/akcja do wylogowania i przekierowania na `/login`.

Zasada IA z `.ai/ui-plan.md` pozostaje:  
`/` rozstrzyga, czy iść do `/login` czy `/generate`.

### 1.2. Layouty: tryb auth i non-auth

Obecnie jest `src/layouts/Layout.astro` (bardzo prosty).

Proponowany podział:

- `src/layouts/PublicLayout.astro` (opcjonalnie, może być aliasem istniejącego `Layout.astro`)  
  Dla stron publicznych/informacyjnych (np. Welcome).

- `src/layouts/AuthLayout.astro`  
  Dla stron `/login`, `/register`, `/forgot-password`, `/update-password`.
  - centrowany kontener,
  - nagłówek z nazwą produktu,
  - linki kontekstowe (np. “Masz konto? Zaloguj się”, “Nie pamiętasz hasła?”),
  - brak nawigacji aplikacyjnej.

- `src/layouts/AppLayout.astro` (lub rozszerzenie obecnego `Layout.astro`)  
  Dla tras aplikacyjnych: `/generate`, `/generate/results`, `/cards`, `/decks`, `/export`, `/account`.
  - App Shell z elementami z `.ai/ui-plan.md`:
    - `UsageStatusWidget` (badge demo/full + usage/limit),
    - nawigacja,
    - `UserMenu` z akcją “Wyloguj”.

**Wymóg kompatybilności**: w pierwszym etapie `AppLayout` musi działać również bez “prawdziwego auth” (np. dev skrót `DEFAULT_USER_ID`) – UI może pokazywać status “Demo (dev)” i nie blokować istniejących flow.

### 1.3. Rozdzielenie odpowiedzialności: Astro vs React (client-side)

#### Astro (strony i SSR)
Astro odpowiada za:

- routing i metadane (title, opisy),
- **SSR-gating** (redirecty) na podstawie stanu sesji użytkownika:
  - jeśli zalogowany → ukryj `/login`, `/register` (redirect do `/generate`),
  - jeśli niezalogowany → przy wejściu na trasę aplikacyjną redirect do `/login` (z `returnTo`),
  - wyjątek: jeśli produkt wymaga szybkiego wejścia w demo, można pozwolić na wejście na `/generate`, ale UI i tak musi wymusić “utworzenie sesji demo” przed pierwszym zapisem/wywołaniem API.
- dostarczenie “initial state” do React (np. `initialSession`, `initialStatus`) jako propsy/JSON w HTML (bez tokenów!).

#### React (formularze i interakcje)
React odpowiada za:

- UX formularzy auth:
  - walidacja pól,
  - obsługa submit/loading,
  - czytelne komunikaty błędów,
  - nawigacja po sukcesie (redirect),
- integrację z backendem autentykacji przez **wywołania API** (rekomendowane) lub bezpośrednio przez Supabase client (dopuszczalne, ale gorsze dla SSR i bezpieczeństwa).

Rekomendacja architektoniczna dla tego projektu (zgodnie z `.ai/ui-plan.md`: cookie httpOnly, bez localStorage):

- React **nie trzyma tokenów** w localStorage/sessionStorage.
- React woła nasze endpointy `/api/auth/*`, a serwer:
  - rozmawia z Supabase Auth,
  - zapisuje/odświeża sesję w **cookie httpOnly**,
  - zwraca JSON i/lub redirect.

### 1.4. Nowe komponenty UI (React) i moduły

Proponowana struktura:

- `src/components/auth/LoginForm.tsx`
  - pola: email, hasło
  - linki: `/forgot-password`, `/register`

- `src/components/auth/RegisterForm.tsx`
  - pola: email, hasło, powtórz hasło
  - komunikat o potwierdzeniu emaila (jeśli wymagane)

- `src/components/auth/ForgotPasswordForm.tsx`
  - pole: email
  - sukces: “Jeśli konto istnieje, wysłaliśmy link…”

- `src/components/auth/UpdatePasswordForm.tsx`
  - pola: nowe hasło, powtórz hasło

- `src/components/auth/ContinueAsDemoButton.tsx`
  - tworzy sesję demo i przekierowuje do `/generate`

- `src/components/auth/AuthErrorBanner.tsx`
  - ujednolicony rendering błędów (kody + przyjazne copy)

- `src/components/auth/AuthGate.tsx` (opcjonalny, poza SSR)
  - wspiera UX: obsługa 401 w fetchach, zachowanie draftów, redirect na `/login?returnTo=...`

- `src/components/app/UserMenu.tsx`
  - akcja: wyloguj

**Uwaga**: istniejące komponenty takie jak `LimitBanner` zostają i są rozszerzane o scenariusze 401/403 oraz “upgrade to full” (gdy limity demo blokują).

### 1.5. Walidacja po stronie UI i komunikaty błędów

Walidacja client-side ma skrócić feedback, ale **źródłem prawdy jest backend**.

#### Wymóg PRD: “dwuskładnikowa walidacja”

PRD (US-001) mówi o “dwuskładnikowej walidacji (np. hasło + token w demo trybie uproszczone)”. Ponieważ w MVP nie ma osobnego modułu MFA w wymaganiach, przyjmujemy interpretację zgodną z Supabase Auth:

- **Full**: **hasło + token** w praktyce oznacza **email+password + potwierdzenie emaila** (link/token w wiadomości). To daje drugi krok weryfikacji i spełnia intencję “hasło + token”.
- **Demo (uprościć)**: brak hasła, tylko “token sesji” = **Supabase anonymous session** (anon user). To jest “token-only” tryb demo.

Opcjonalnie (po MVP), jeśli wymagamy stricte 2FA:
- można włączyć **Supabase MFA (TOTP)** dla kont full, jako dodatkowy krok po loginie.

#### Login
- email:
  - required, poprawny format
- hasło:
  - required, min 8 (lub zgodnie z polityką Supabase)

Komunikaty:
- `invalid_credentials`: “Nieprawidłowy email lub hasło.”
- `email_not_confirmed`: “Potwierdź adres email w wiadomości, którą wysłaliśmy.”
- `rate_limited`: “Zbyt wiele prób. Spróbuj ponownie za chwilę.”

#### Rejestracja
- email:
  - required, format email
- hasło:
  - required, min 8,
  - rekomendowane: wymagania złożoności (min. 1 litera + 1 cyfra) – jeśli polityka produktu to przewiduje
- powtórz hasło:
  - musi się zgadzać

Komunikaty:
- `user_already_exists`: “Konto dla tego emaila już istnieje.”
- `weak_password`: “Hasło jest zbyt słabe. Użyj co najmniej 8 znaków…”
- `signup_requires_confirmation`: “Sprawdź pocztę i potwierdź adres email.”

#### Forgot password
- email required, format email
- zawsze komunikat neutralny po submit:
  - “Jeśli konto istnieje, wyślemy link resetujący.”

#### Update password
- nowe hasło + potwierdzenie
- błędy:
  - `recovery_link_expired`: “Link wygasł. Poproś o nowy.”

### 1.6. Najważniejsze scenariusze użytkownika

#### S1: “Continue as demo” (szybkie wejście)
1. Użytkownik wchodzi na `/login`.
2. Klik “Kontynuuj jako demo”.
3. Tworzymy **anonimową sesję Supabase** (demo).
4. Redirect do `/generate`.
5. UI pobiera `GET /api/me/status` i pokazuje badge “Demo” + limity.

#### S2: Rejestracja pełna
1. `/register` → submit
2. Jeśli wymagamy confirm email:
   - pokaż ekran “Sprawdź pocztę”
   - po kliknięciu w link Supabase przekieruje na `/auth/callback`, a potem na `/generate`
3. Profil w `public.profiles` tworzy trigger `handle_new_user`.

#### S3: Logowanie
1. `/login` → submit
2. Sukces → redirect do `returnTo` albo `/generate`

#### S4: Odzyskiwanie hasła
1. `/forgot-password` → submit (zawsze neutralny komunikat)
2. Link z maila → `/auth/callback` (ustanawia sesję recovery)
3. Redirect do `/update-password`
4. Zapis nowego hasła → redirect do `/login` lub od razu do `/generate` (preferowane: do `/generate` jeśli sesja jest aktywna)

#### S5: Wylogowanie
1. Klik “Wyloguj” w `UserMenu`
2. Backend czyści sesję cookie
3. Redirect do `/login`

#### S6: Sesja wygasła w trakcie pracy
- Globalny handler 401:
  - zachowuje drafty Generuj (`sessionStorage/localStorage` tylko dla draftu treści, nie tokenów),
  - przenosi na `/login?returnTo=...`,
  - po zalogowaniu wraca.

### 1.7. Nawigacja i parametr `returnTo` (kontrakt UX)

Aby nie gubić kontekstu użytkownika:

- każdy redirect na `/login` powinien ustawiać `returnTo` (np. `/login?returnTo=%2Fgenerate%2Fresults%3Fsource_id%3D...`)
- po udanym loginie/demo/rejestracji frontend przekierowuje do `returnTo` (jeśli jest bezpieczne i należy do “allowed routes”), w przeciwnym razie do `/generate`

Zasada bezpieczeństwa: `returnTo` musi być **relative path** w obrębie aplikacji (brak otwartych przekierowań).

---

## 2) LOGIKA BACKENDOWA

### 2.1. Zasada nadrzędna: kompatybilność z obecnym API

Aktualnie API routes używają:
- `context.locals.supabase` = globalny klient z kluczem `SUPABASE_SERVICE_ROLE_KEY`,
- `DEFAULT_USER_ID` jako tymczasowego “userId”.

Nowy auth **nie może zepsuć** istniejących endpointów w trakcie wdrożenia. Dlatego plan zakłada tryb przejściowy:

- **Tryb A (docelowy)**: userId pochodzi z sesji Supabase (`auth.uid()`), a zapytania są wykonywane klientem “user-scoped” (anon/auth) i egzekwowane przez RLS.
- **Tryb B (kompatybilny / dev)**: jeśli brak sesji, endpointy mogą nadal używać `DEFAULT_USER_ID` (tylko w DEV lub kontrolowanym “feature flag”), aby zachować możliwość pracy zespołu zanim UI auth będzie gotowe.

### 2.2. Middleware i kontekst requestu (Astro)

Aktualnie: `src/middleware/index.ts` tylko wstrzykuje klienta Supabase.

Docelowo middleware powinno przygotować:

- `context.locals.supabase`  
  Klient Supabase związany z sesją requestu (cookie) i **anon key**.

- `context.locals.supabaseAdmin`  
  Klient z `service_role` do operacji backend-only (np. jeśli potrzebujemy obejść RLS dla admin zadań lub migracji logiki).

- `context.locals.auth` (lub osobne pola):
  - `user` (z `supabase.auth.getUser()`),
  - `profile` (z `public.profiles`),
  - `role` (`demo` | `full`),
  - `isAuthenticated` / `isDemo`.

Middleware powinno też:
- odświeżać sesję (jeśli Supabase to wspiera w SSR),
- ustawiać/zachowywać cookies w odpowiedzi.

**Uwaga dot. SSR**: w `.cursor/rules/astro.mdc` wskazane jest używanie `Astro.cookies` do zarządzania cookies po stronie serwera.

#### 2.2.1. Proponowane moduły / pliki do wprowadzenia (kontrakty wewnętrzne)

Żeby utrzymać czytelny podział (i nie mieszać service role z klientem user-scoped) proponowany jest zestaw modułów:

- `src/db/supabase.admin.ts`
  - tworzy klienta z `SUPABASE_SERVICE_ROLE_KEY` (backend-only)

- `src/db/supabase.server.ts`
  - tworzy klienta “request-scoped” (anon/auth) oparty o cookies (SSR)

- `src/db/supabase.browser.ts`
  - minimalny klient do wywołań stricte przeglądarkowych (opcjonalnie), bez przechowywania tokenów w localStorage

- `src/lib/services/auth.service.ts`
  - logika: login, register, logout, demo, callback exchange

- `src/lib/services/user-status.service.ts`
  - logika: budowanie `UserStatusDto` (role, usage, limity, liczniki)

- `src/lib/utils/http-error.ts`
  - wspólny typ/mapper błędów (spójne `error.code`)

- `src/env.d.ts`
  - rozszerzenie typów `App.Locals` o `supabaseAdmin` oraz pola auth (`user`, `profile`, `role`)

### 2.3. Endpointy API (nowe i rozszerzane)

#### 2.3.1. Auth API (nowe)

Rekomendowane endpointy (Astro server endpoints, `export const prerender=false`):

- `POST /api/auth/login`
  - body: `{ email, password }`
  - efekt: ustanowienie sesji w cookie
  - response:
    - `200` + `{ ok: true }` (frontend robi redirect), lub
    - `303` redirect (serwer przekierowuje)

- `POST /api/auth/register`
  - body: `{ email, password }`
  - efekt: rozpoczęcie sign-up; jeśli email confirmation włączone, response zawiera informację “pending confirmation”
  - dodatkowy efekt domenowy (wymóg PRD demo vs full): konto email+password jest traktowane jako “pełne konto”:
    - po utworzeniu użytkownika backend (service role) ustawia `profiles.account_role = 'full'`
    - (lub alternatywnie: trigger w DB rozpoznaje typ konta i ustawia rolę)

- `POST /api/auth/logout`
  - efekt: wyczyszczenie sesji cookie

- `POST /api/auth/demo`
  - efekt: `signInAnonymously()` (konto demo) i ustawienie sesji cookie
  - dodatkowy efekt domenowy: profil pozostaje `account_role='demo'` (domyślna wartość ze schematu)

- `GET /api/auth/session` (opcjonalnie)
  - zwraca lekkie info: `{ authenticated: boolean, user_id, role }` (bez tokenów)

- `GET /auth/callback` (endpoint lub strona SSR)
  - obsługa kodu z Supabase (confirm/recovery)
  - ustanowienie sesji cookie
  - redirect do `/update-password` (recovery) lub `/generate`

#### 2.3.2. Status użytkownika (zgodnie z API plan)

- `GET /api/me/status` (już zaplanowany w `src/types.ts` jako `UserStatusDto`)
  - źródła danych:
    - `profiles.account_role`,
    - `user_usage_stats` dla bieżącej daty,
    - liczniki zasobów (`count(*)` cards, decks) albo inny agregat.
  - response: `UserStatusDto`

To endpoint krytyczny dla UI: App Shell i `LimitBanner` mają od niego zależeć.

#### 2.3.3. Aktualizacja istniejących endpointów zasobów

Wszystkie endpointy, które dziś robią:
- `const userId = DEFAULT_USER_ID; ...`

Docelowo przechodzą na:
- `const userId = context.locals.user?.id` (albo `auth.uid()` przez RLS),
- jeśli `userId` brak:
  - **401** (w produkcji),
  - lub fallback do `DEFAULT_USER_ID` (tylko dev/feature flag).

Ważne: logika limitów (demo vs full) powinna brać rolę z `profiles.account_role` (nie z UI).

### 2.4. Mechanizm walidacji danych wejściowych

Standard:
- Zod na wejściu endpointów (`400 validation_error` + `details`),
- osobne schemy dla:
  - `LoginCommandSchema`,
  - `RegisterCommandSchema`,
  - `ForgotPasswordCommandSchema`,
  - `UpdatePasswordCommandSchema`,
  - oraz istniejące (np. `generateCardsCommandSchema`).

Zasady walidacji:
- normalizacja: `trim()`, `toLowerCase()` dla email,
- nie zwracamy w errorach danych wrażliwych,
- błędy Supabase mapujemy na stałe `error.code`.

### 2.5. Obsługa wyjątków i standard błędów

Ujednolicony kształt błędu (już występuje w API):

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

Zasady:
- `401 unauthorized`: brak sesji / brak użytkownika,
- `403 forbidden`: brak dostępu (zwykle RLS),
- `400 validation_error`: Zod,
- `429 rate_limited` / `daily_limit_exceeded`: limity (np. generacje),
- `500 internal_error`: nieoczekiwane.

Dodatkowa rekomendacja (cookie-based auth): minimalna ochrona przed CSRF dla endpointów mutujących:
- sprawdzanie `Origin`/`Host` (jeśli obecne) i odrzucanie żądań spoza domeny,
- `sameSite=lax` na cookies,
- w przyszłości (jeśli zajdzie potrzeba): token CSRF (double submit) dla wrażliwych akcji.

DEV-mode może zwracać dodatkowe `details` (jak `/api/ai/generate` robi teraz), ale produkcja nie.

### 2.6. Aktualizacja renderowania SSR wybranych stron (Astro + `astro.config.mjs`)

`astro.config.mjs` ma `output: "server"` i adapter Node, więc:
- strony `.astro` mogą być SSR,
- middleware działa na każde żądanie,
- API routes mają `prerender=false`.

Zmiany SSR, które są wymagane przez auth:

- `/`:
  - SSR sprawdza sesję:
    - jeśli jest → redirect `/generate`
    - jeśli nie → redirect `/login`

- `/login`, `/register`, `/forgot-password`, `/update-password`:
  - SSR jeśli user zalogowany → redirect `/generate`

- trasy aplikacji (min. `/generate` i `/generate/results`):
  - SSR może wstępnie dołączyć “status” (np. `UserStatusDto`) do pierwszego renderu layoutu (bez tokenów).
  - jeśli brak sesji i produkt wymaga auth: redirect `/login`.
  - jeśli dopuszczamy “enter then demo”: SSR renderuje stronę, ale komponent React wymusza `POST /api/auth/demo` przed pierwszym zapisem/AI call.

---

## 3) SYSTEM AUTENTYKACJI (Supabase Auth + Astro)

### 3.1. Model kont i role (demo vs full)

W schemacie DB istnieje:
- `public.profiles.account_role` z check: `('demo','full')`,
- RLS dla `anon` i `authenticated`,
- trigger `public.handle_new_user` tworzący profile dla każdego `auth.users`.

Interpretacja wymagań PRD:
- **demo**: użytkownik może korzystać z aplikacji z ograniczeniami (niższe limity),
- **full**: konto z pełnymi limitami i trwałością.

Rekomendacja implementacyjna (na potrzeby architektury), zgodna z PRD:

- **Demo** = **Supabase anonymous session** (`signInAnonymously()`), z `profiles.account_role='demo'`.
- **Full** = email+password (`signUp`, `signInWithPassword`), z `profiles.account_role='full'` ustawianym przez backend (service role) w ramach procesu rejestracji.
- **Upgrade demo→full** (opcjonalnie, ale spójne z UX “demo→konto”):
  - demo user “podpina” email+hasło (link identity / conversion),
  - backend przenosi użytkownika na `account_role='full'` (service role),
  - dane (cards/decks/sources) pozostają przypisane do tego samego `user_id`.

Uwaga: RLS w obecnym schemacie dopuszcza zarówno `anon` jak i `authenticated`. W praktyce Supabase “anonymous user” ma własne `auth.uid()`, więc dane per-user i RLS działają również dla demo.

### 3.2. Krytyczna uwaga bezpieczeństwa dot. `profiles.account_role`

Obecne RLS dopuszcza `UPDATE` profilu przez użytkownika bez ograniczeń kolumn.
To oznacza ryzyko: użytkownik może sam ustawić `account_role='full'`.

W architekturze auth **trzeba to domknąć** (na poziomie DB), bo inaczej US-001/US-007 (limity demo/full) są niewiarygodne.

Rekomendowane rozwiązanie (konkretne, w duchu Postgres/Supabase):

- **Ograniczenie uprawnień kolumnowych**:
  - `REVOKE UPDATE (account_role) ON public.profiles FROM anon, authenticated;`
  - `GRANT UPDATE (last_active_at) ON public.profiles TO anon, authenticated;`
  - (analogicznie dla innych pól, które user ma móc zmieniać)

Alternatywa:
- trigger `BEFORE UPDATE` na `public.profiles`, który odrzuca zmianę `account_role` jeśli `auth.role()` ∈ {`anon`,`authenticated`} i zmiana nie pochodzi z service role.

Bez tego rozróżnienie demo/full nie jest wiarygodne.

### 3.3. Sesja i przechowywanie tokenów

Wymóg z UI planu: **cookie httpOnly**, brak tokenów w localStorage.

Docelowy mechanizm:
- sesja Supabase jest utrzymywana w cookie (`httpOnly`, `secure` w prod, `sameSite=lax`),
- middleware Astro tworzy klienta Supabase na request i potrafi odświeżać sesję,
- React nie ma dostępu do tokenów, ale może:
  - pytać `/api/auth/session` lub `/api/me/status`,
  - wykonywać mutacje przez nasze API routes.

Rekomendacja techniczna dla SSR: użyć oficjalnego mechanizmu “server client + cookies” (np. pakiet `@supabase/ssr`), ponieważ `@supabase/supabase-js` sam w sobie nie rozwiązuje automatycznego odświeżania sesji w SSR i bezpiecznego zapisu cookies na odpowiedzi.

### 3.4. Kontrakty i redirect URLs w Supabase

Konfiguracja Supabase Auth (w panelu projektu):

- **Site URL**: domena aplikacji.
- **Redirect URLs**: muszą zawierać co najmniej:
  - `/auth/callback` (confirm signup),
  - `/auth/callback` (recovery),
  - (opcjonalnie) `/login` (magic link, jeśli kiedyś dodamy).

Wysyłka recovery maila musi wskazywać redirect do `/auth/callback`, a nie bezpośrednio do strony React.

### 3.5. Kontrakty (DTO) dla auth endpoints

Proponowane kontrakty (spójne ze stylem obecnych API):

- `POST /api/auth/login`
  - req:
    - `{ "email": "string", "password": "string" }`
  - 200:
    - `{ "ok": true }`
  - 400/401:
    - `{ "error": { "code": "invalid_credentials" | "validation_error" | "rate_limited", "message": "..." } }`

- `POST /api/auth/register`
  - req:
    - `{ "email": "string", "password": "string" }`
  - 201:
    - `{ "ok": true, "pending_confirmation": true }` (gdy confirm email włączone)
  - 409:
    - `user_already_exists`

- `POST /api/auth/demo`
  - 201:
    - `{ "ok": true, "role": "demo" }`

- `POST /api/auth/logout`
  - 200:
    - `{ "ok": true }`

- `GET /api/me/status`
  - 200:
    - `UserStatusDto` (z `src/types.ts`)
  - 401:
    - `unauthorized`

### 3.6. KPI i audyt zdarzeń auth

Zgodnie z PRD (US-009) warto logować zdarzenia (przynajmniej):
- `session_start` (pierwsze wejście po ustanowieniu sesji),
- `login`,
- `logout`,
- `signup`,
- `password_reset_requested`,
- `password_reset_completed`.

W `kpi_events.metadata` można trzymać:
- `account_role`,
- `method` (demo/password),
- `returnTo`,
- informacje o błędach (bez danych wrażliwych).

---

## 4. Podsumowanie kluczowych decyzji architektonicznych

- **UI**: strony auth w Astro + formularze w React; layout rozdzielony na `AuthLayout` i `AppLayout`.
- **Backend**: dodajemy warstwę `/api/auth/*`, a istniejące endpointy przechodzą z `DEFAULT_USER_ID` na userId z sesji (z trybem kompatybilnym w DEV).
- **Auth**: Supabase Auth; demo jako anonymous session; full jako email+password; sesja w cookie httpOnly + SSR integration w middleware.
- **Bezpieczeństwo**: konieczne zablokowanie samodzielnej zmiany `profiles.account_role` przez użytkownika (inaczej demo/full jest podatne na eskalację).

