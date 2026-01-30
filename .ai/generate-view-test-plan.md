# Test plan: widok Generuj

## Walidacja treści
- Tekst < 50 znaków: blokada submitu, komunikat walidacji po blur/submit.
- Tekst > 100000 znaków: blokada submitu, komunikat walidacji.
- Poprawny tekst: przycisk aktywny.

## Integracja generacji
- 201: przekierowanie do `/generate/results?source_id=...`, remaining_generations aktualizuje limit.
- 400: komunikat o niepoprawnych danych, brak utraty draftu.
- 429: `LimitBanner` + blokada generacji, brak retry.
- 500 / network: komunikat ogólny + możliwość retry.

## Draft
- Wpisz tekst, odśwież stronę: treść zostaje.
- Wyczyść treść: draft znika z localStorage.

## Decki
- Ładowanie listy: helper "Ładuję decki...".
- Pusta lista: helper "Brak decków...".
- Tworzenie decka: modal, po sukcesie nowy deck wybrany.
- 429 przy tworzeniu: błąd w modalu + zablokowany przycisk "Utwórz deck".
