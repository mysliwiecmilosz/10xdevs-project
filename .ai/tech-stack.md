Tech stack dobrze pokrywa podstawowe wymagania PRD, ale warto wtrącić kilka uwag na poziomie ryzyk i uproszczeń.

## Ocena technologii

- **Szybkość MVP:** Astro + React + TypeScript + Tailwind + shadcn/ui to lekki zestaw umożliwiający szybką budowę interfejsu (punkty 1‑7, 24‑82 PRD). Astro sprzyja prostym stronem, React ograniczamy do interaktywnych komponentów, więc prędkość developmentu jest wysoka. Supabase jako BaaS + Openrouter dla AI + GitHub Actions + DO umożliwiają szybkie wdrożenie MVP w 10 tygodni bez stawiania infrastruktury od zera.

- **Skalowalność:** Supabase (PostgreSQL) i DigitalOcean pozwalają skalować bazę i serwisy (eventy KPI, limity, eksporty). Openrouter umożliwia łatwą zmianę modelu, ale trzeba pilnować limitów i kosztów generacji (US-002, US-009). Przy wzroście użytkowników trzeba monitorować wydajność zapytań (filtry/tagi/statusy) i ewentualnie dodać caching lub kolejkowanie eventów.

- **Koszt utrzymania:** Supabase + Openrouter + DO + GitHub Actions to umiarkowane koszty, ale największy czynnik kosztowy to zapytania do modeli AI. Trzeba ustalić limity, watki użycia i potencjalnie agregować generacje (np. batchowe requesty) by utrzymać koszt w ryzach (US-002, US-007, US-009). Hosting i CI są standardowe i przewidywalne.

- **Złożoność rozwiązania:** Stos jest umiarkowanie złożony – Astro + React to hybryda statyczno‑dynamiczna, więc trzeba pilnować integracji. Możliwe uproszczenie to np. czyste Next.js lub Remix, ale te mogą być cięższe w utrzymaniu na MVP. Supabase dodaje świetną obsługę auth/limits/eventów, więc w praktyce redukuje złożoność backendu. Trzeba tylko dopilnować, że modele KPI, limity, eventy, eksporty i synchronizacja SRS mieszczą się w schemacie danych Supabase.

- **Czy prostsze podejście wystarczy?:** Alternatywa to np. czysto statyczny frontend z Netlify Functions + prosty BaaS (Firebase) oraz bezpośrednie API OpenAI zamiast Openrouter. Zaletą obecnego stacka jest większa kontrola nad eventami, limity użytkowników i SQL‑owe zapytania (filtry/tagi/status) wymagane w PRD, więc prostsze rozwiązanie mogłoby nie dać tych możliwości bez dużego dopisku.

- **Bezpieczeństwo:** Supabase zapewnia auth, demo/pełne role i limity (US-001, US-007). Trzeba zadbać o bezpieczne przechowywanie kluczy (Supabase + Openrouter) i walidację limitów po stronie backendu (backendowy enforcement w PRD). Warto dodać monitoring i alerty dla eventów KPI oraz zabezpieczyć eksport JSON/CSV (US-008). Dla danych użytkowników kluczowe jest szyfrowanie w tranzycie i ograniczenie dostępu do API (rate limiting).

## Podsumowanie
Stack jest zgodny z potrzebami PRD, przy czym należy:
- dokłądnie określić polityki kosztowe dla Openrouter i ewentualnie używać cache lub heurystyk by zredukować liczbę wywołań,
- zaplanować strukturę eventów KPI i limitów w Supabase tak, by spełnić wymagania produktów bez nadmiarowej logiki po stronie serwera,
- zapewnić monitoring i audyty bezpieczeństwa danych i eksportów.

Jeśli potrzebujesz, mogę pomóc zaprojektować konkretną architekturę danych/limitów w Supabase albo schemat integracji z Openrouter. Czy chcesz, żebym rozwinął któryś z tych obszarów?
## Stos technologiczny

### Frontend
- **Astro 5** pozwala tworzyć szybkie strony koncentrujące się na treści, a wbudowane renderowanie po stronie serwera minimalizuje ilość JavaScript.
- **React 19** wykorzystywany jest tylko tam, gdzie potrzebna jest interaktywność (np. edytor fiszek, listy, filtrowanie).
- **TypeScript 5** zwiększa pewność typów i poprawia doświadczenie programistyczne w całym projekcie.
- **Tailwind 4** zapewnia szybkie budowanie spójnego interfejsu przy użyciu klas narzędziowych.
- **Shadcn/ui** dostarcza gotowe komponenty React (dropdowny, chipsy, listy), które skracają wdrożenie złożonych widoków.

### Backend
- **Supabase** udostępnia bazę PostgreSQL, uwierzytelnianie, przechowywanie sesji i logikę limitów bez konieczności budowania własnego serwera.
- Można w nim zakładać RLS, limity kont demo vs pełnych oraz walidować API dla limitów fiszek, decków i generacji.
- Statystyki sesji, KPI i eksport JSON/CSV mogą być trzymane w bazie, a logiczne funkcje (np. licznik generacji) wystarczy napisać raz.

### AI
- **Openrouter.ai** integruje się z wieloma modelami (OpenAI, Anthropic, Google itp.), co pozwala eksperymentować z kosztami i jakością generowanych fiszek.
- Obsługuje centralne zarządzanie kluczami, limity finansowe oraz monitorowanie zużycia, co ułatwia kontrolę kosztów.
- Wszystkie wywołania modeli powinny przebiegać po stronie backendu, aby nie wystawiać kluczy.

### CI/CD i hosting
- **GitHub Actions** automatyzuje testy, budowanie stron Astro i wdrożenie.
- **DigitalOcean + Docker** to środowisko hostujące aplikację, którym można łatwo zarządzać przez obraz kontenera.

### Testy
- **Vitest**: testy jednostkowe i integracyjne (TypeScript).
- **Testing Library**: testy komponentów React (`@testing-library/react`, `@testing-library/user-event`).
- **MSW (Mock Service Worker)**: mockowanie HTTP w testach frontendu.
- **Playwright**: testy end-to-end (E2E) w przeglądarce.

Stos łączy szybkie prototypowanie UI z wydajnym backendem i zewnętrznym AI, co pozwala zrealizować MVP zgodnie z PRD w 10-tygodniowym harmonogramie.
