# Dokument wymagań produktu (PRD) - AI Flashcards
## 1. Przegląd produktu
- Empatyczna aplikacja webowa, która automatycznie przekształca dowolny tekst w gotowe fiszki edukacyjne wspierane podpowiedziami AI (pytanie, odpowiedź, kontekst, tagi, poziom trudności) i prostym trybem manualnej edycji. Projekt obejmuje backend utrzymujący model sesji, statystyki i limity (fiszki, decki, generacje) oraz synchronizację z istniejącym algorytmem spaced repetition przez eksport danych. MVP realizowane jest przez interdyscyplinarny zespół (AI, frontend, backend, produkt/UX) w 10-tygodniowym planie: faza danych, implementacja głównej funkcjonalności, integracja SRS i testy KPI.
## 2. Problem użytkownika
- Wysokiej jakości fiszki wymagają ręcznego dzielenia materiału, formułowania pytań i odpowiedzi oraz uporządkowania treści. Proces ten jest zbyt czasochłonny i zniechęca do stosowania spaced repetition, mimo że metoda ta przynosi mierzalne korzyści w nauce. Użytkownik potrzebuje szybkiego narzędzia, które przy minimalnym wysiłku wygeneruje sensowne fiszki z dowolnego tekstu, jasno pokaże, co jeszcze do zrobienia i pozwoli dopracować gotowe propozycje AI.
## 3. Wymagania funkcjonalne
1. Generowanie fiszek z ciągłego tekstu (kopiuj-wklej) z uwzględnieniem nagłówków, list i akapitów, gdzie model AI proponuje pytanie, odpowiedź, kontekst, tagi i poziom trudności oraz status jakości (Szkic/OK/Dobre).
2. Manualny edytor do korygowania i uzupełniania propozycji AI w trybie inline z szybkim dostępem do akcji batchowych (zatwierdź, odrzuć, zmień tagi/trudność) oraz możliwość tworzenia zupełnie nowych fiszek.
3. Przeglądanie, filtrowanie (tagi, poziom trudności, status), edycja i usuwanie fiszek z widoku listy, przy zachowaniu informacji o źródle (AI/manualne) i możliwością nadpisania tagów/trudności bezpośrednio z listy.
4. Prosty system kont użytkowników z bezpiecznym logowaniem i rozróżnieniem demo vs pełne konto, umożliwiającym przechowywanie sesji, limitów (maks. 2 000 fiszek, 50 decków, 5 generacji dziennie dla zalogowanych, mniejszy limit dla demo) i personalizowanymi sugestiami kolejnych kroków.
5. Mechanizmy progresu: celem sesji vs licznik zaakceptowanych fiszek, propozycje dodania kolejnych jako funkcja długości tekstu i limity sesji.
6. Widoczne limity i komunikaty o wyczerpaniu (interfejs + backendowa walidacja) oraz logika odmowy tworzenia nowych fiszek poza limitem.
7. Eksport całego modelu fiszki (JSON/CSV) ze wszystkimi polami (pytanie, odpowiedź, kontekst, tagi, poziom trudności, status) oraz metadanymi o decku i źródle.
8. Integracja (wysyłka eksportu + proste API) z istniejącym algorytmem powtórek, umożliwiająca synchronizację statusów SRS.
9. Zbieranie KPI za pomocą backendowych eventów (sesja, generacja, edycja, akceptacja), aby mierzyć time-to-value, retencję i odsetek akceptowanych fiszek.
10. System sugerowania tagów i poziomu trudności przez AI z możliwością natychmiastowej edycji przez użytkownika (dropdown/chips) oraz informacją o sugerowanych wartościach.
## 4. Granice produktu
- MVP nie zawiera własnego zaawansowanego algorytmu powtórek typu SuperMemo czy Anki; integracja rozpoczyna się od eksportu danych i prostego API synchronizacji, bez wbudowanego SRS.
- Nie będzie importu wielu formatów (PDF, DOCX, itp.), ograniczamy się do tekstu kopiowanego przez użytkownika.
- Brak współdzielenia zestawów między użytkownikami oraz integracji z zewnętrznymi platformami edukacyjnymi.
- Brak aplikacji mobilnej w MVP (tylko wersja webowa). Limity kontowe rozróżniają demo i pełne konto, ale wszystkie działania odbywają się w jednej aplikacji bez natywnych klient&oacute;w.
- Backend egzekwuje limity (2 000 fiszek, 50 decków, liczba generacji) i KPI, bez konieczności budowy osobnych narzędzi do zarządzania tymi limitami.
## 5. Historyjki użytkowników
- ID: US-001
- Tytuł: Bezpieczne logowanie i rozróżnienie demo vs pełne konto
- Opis: Jako użytkownik chcę się bezpiecznie uwierzytelnić i zobaczyć, czy działam w trybie demo, czy mam pełny dostęp, żeby wiedzieć jakie limity mnie obowiązują i zapewnić poufność moich fiszek.
- Kryteria akceptacji:
  1. Użytkownik może zalogować się lub zalogować jako demo z dwuskładnikową walidacją (np. hasło + token w demo trybie uproszczone).
  2. Po zalogowaniu interfejs wyraźnie pokazuje status konta (demo/pełne) i przypisane limity (fiszki, decki, generacje).
  3. Backend odrzuca żądania przekraczające limity i zwraca opisowy komunikat z informacją o pozostałych zasobach.
  4. Sesje są śledzone jako eventy KPI (data, rodzaj konta, liczba fiszek wygenerowanych podczas sesji).
- ID: US-002
- Tytuł: Generowanie fiszek AI z ciągłego tekstu
- Opis: Jako uczący się chcę wkleić fragment tekstu i otrzymać zestaw fiszek z pytaniami, odpowiedziami, kontekstem, tagami i poziomem trudności oraz heurystycznym statusem jakości, aby szybko rozpocząć sesję nauki.
- Kryteria akceptacji:
  1. Użytkownik wkleja tekst (nagłówki, listy, akapity) i otrzymuje propozycję n fiszek, zorganizowanych według struktury tekstu, bez obsługi tabel.
  2. Każda fiszka zawiera pola: pytanie, odpowiedź, kontekst, tagi, poziom trudności, status (Szkic/OK/Dobre) wygenerowany przez heurystyki.
  3. AI sugeruje tagi/trudność, ale użytkownik może je zmienić bez opuszczania listy (dropdown/chips).
  4. Generacja jest ograniczona do 5 na dzień dla pełnych kont (mniej dla demo) i backend przekazuje komunikat o limicie oraz liczniku pozostałych).
- ID: US-003
- Tytuł: Manualne tworzenie i batchowe edytowanie fiszek
- Opis: Jako użytkownik chcę móc ręcznie stworzyć fiszkę lub dopracować grupę fiszek (akcji batchowych), żeby dostosować treść do swoich potrzeb.
- Kryteria akceptacji:
  1. Użytkownik może wprowadzić nowe pytanie/odpowiedź/kontekst/tagi/trudność oraz zapisać je jako fiszkę ręcznie.
  2. W widoku listy dostępne są akcje batchowe (zatwierdź, oznacz jako OK/Dobre, usuń) i można nimi wybrać wiele fiszek.
  3. Każda edycja zapisuje event KPI, a użytkownik widzi natychmiastowo zmieniony status jakości i liczbę akceptowanych fiszek w postępie sesji.
- ID: US-004
- Tytuł: Przegląd, filtrowanie i usuwanie fiszek
- Opis: Jako użytkownik chcę przeglądać wszystkie fiszki, filtrować po tagach/trudności/statusach oraz usuwać niepotrzebne, żeby utrzymywać porządek i szybko odnaleźć materiał do nauki.
- Kryteria akceptacji:
  1. Lista fiszek pokazuje tagi, poziom trudności, status jakości i Źródło (AI/manualne) oraz umożliwia filtrowanie po tych polach.
  2. Użytkownik może edytować tagi/trudność bez przeładowania (np. dropdown z opcją „dodaj nowy tag”).
  3. Usunięcie fiszki wymaga potwierdzenia i aktualizuje licznik zaakceptowanych fiszek w ramach celu sesji.
- ID: US-005
- Tytuł: Monitorowanie postępu sesji i sugerowane następne kroki
- Opis: Jako uczeń chcę widzieć cel sesji vs licznik zaakceptowanych fiszek oraz sugestie, ile jeszcze stworzyć bazując na długości tekstu, żebym wiedział, jak blisko jestem celu.
- Kryteria akceptacji:
  1. UI pokazuje cel i aktualny licznik dla danej sesji (np. cel 20 fiszek vs 12 zaakceptowanych) oraz czas od początku sesji.
  2. System wylicza docelową liczbę fiszek w funkcji długości tekstu (np. 500 znaków = 1 fiszka) i pokazuje komunikat „dodaj X więcej”.
  3. Po zatwierdzeniu nowej fiszki progress uaktualnia się i event KPI rejestruje zmianę.
- ID: US-006
- Tytuł: Informowanie o statusie jakości fiszki
- Opis: Jako użytkownik chcę widzieć status jakości (Szkic/OK/Dobre) każdego zestawu, żeby wiedzieć, które karty wymagają weryfikacji.
- Kryteria akceptacji:
  1. Heurystyczne algorytmy oceniają długość odpowiedzi, obecność kontekstu i spójność, by przypisać status, a wynik jest widoczny obok fiszki.
  2. Użytkownik może ręcznie zmienić status jakości (np. z Szkic na Dobre) i event KPI odnotowuje zmianę.
  3. System informuje, kiedy status jest Szkic, sugerując dalsze kroki (np. „zweryfikuj odpowiedź”).
- ID: US-007
- Tytuł: Komunikacja i egzekwowanie limitów fiszek i generacji
- Opis: Jako użytkownik chcę wiedzieć ile fiszek/generacji jeszcze mogę wykonać i otrzymywać informację, kiedy limit został osiągnięty, by nie przekroczyć dozwolonej liczby.
- Kryteria akceptacji:
  1. UI pokazuje licznik fiszek i decków w porównaniu do limitów konta oraz ile generacji zostało na dzisiaj.
  2. Próba przekroczenia limitu powoduje blokadę operacji z opisowym komunikatem i zapisem eventu KPI.
  3. Limity są egzekwowane przez backend, który również uwzględnia różnice między kontem demo i pełnym.
- ID: US-008
- Tytuł: Eksport danych fiszek i synchronizacja z algorytmem powtórek
- Opis: Jako użytkownik chcę wyeksportować fiszki w formacie zawierającym cały model (pytanie, odpowiedź, kontekst, tagi, poziom trudności, status), żeby wgrać dane do zewnętrznego algorytmu powtórek.
- Kryteria akceptacji:
  1. Eksport generuje plik JSON lub CSV zawierający wszystkie pola fiszki i identyfikator decku.
  2. Dane eksportu mogą być wysyłane przez proste API do istniejącego SRS i backend potwierdza synchronizację.
  3. Użytkownik otrzymuje potwierdzenie eksportu z informacją, ile fiszek zostało uwzględnionych i kiedy ostatnio synchronizowano.
- ID: US-009
- Tytuł: Sledzenie KPI przez backend
- Opis: Jako zespół produktowy chcemy rejestrować eventy (sesja, generacja AI, edycja, akceptacja), aby mierzyć time-to-value, retencję i poziom akceptacji fiszek AI.
- Kryteria akceptacji:
  1. Każdy event zawiera typ akcji, ID użytkownika lub sesji, źródło fiszki oraz znacznik czasu.
  2. Dane są dostępne do analiz i można obliczyć KPIs (np. % AI-zaakceptowanych fiszek vs liczba generacji).
  3. Backend przesyła eventy także dla zmian limitów oraz wyświetla je jako część raportów dla zespołu produktowego.
## 6. Metryki sukcesu
- 75% fiszek wygenerowanych przez AI jest akceptowanych przez użytkowników (status OK lub Dobre).
- 75% wszystkich fiszek tworzą użytkownicy, wykorzystując AI jako punkt startowy (ilość akcji „zaakceptuj AI propozycję” vs liczba manualnych fiszek bez AI).
- Time-to-value: użytkownik widzi pierwszą zaakceptowaną fiszkę w ramach sesji w mniej niż 5 minut.
- Licznik generacji dziennych: użytkownicy nie przekraczają limitów (5/dzień dla kont pełnych, mniej dla demo) i otrzymują czytelne komunikaty o dostępnych generacjach.
- Retencja tygodniowa: przynajmniej 40% zarejestrowanych użytkowników wraca w ciągu tygodnia do tworzenia lub edycji fiszek.
