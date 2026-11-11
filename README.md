# Zarządzanie jakością systemu VChess


**Autor:** Adrian Nowowiejski

## 1. Opis systemu lub funkcji

### 1.1. Przedmiot projektu

Przedmiotem projektu jest ocena i zaplanowanie jakości systemu VChess - aplikacji umożliwiającej rozgrywanie partii szachowych w przeglądarce, w tym wydawanie poleceń głosowych w języku polskim. System składa się z interfejsu webowego oraz współpracujących usług backendowych uruchamianych w kontenerach Docker.

Zakres niniejszego opracowania obejmuje przede wszystkim jakość obsługi partii i głosowego wykonywania ruchów: od nagrania polecenia, przez rozpoznanie i interpretację, do zatwierdzenia oraz wykonania legalnego ruchu. Dodatkowe funkcje objęte opisem to gra z komputerowym przeciwnikiem, analiza pozycji i przechowywanie danych partii.

**Środowisko oceny:**
- Windows 11
- Przeglądarka Brave
- Aplikacja uruchamiana jest w kontenerach Docker

### 1.2. Cel systemu

Celem VChess jest umożliwienie użytkownikowi rozgrywania partii szachowej z użyciem interfejsu przeglądarkowego oraz poleceń głosowych. System ma rozpoznać wypowiedziane polecenie, powiązać je z ruchem możliwym w aktualnej pozycji i pozwolić użytkownikowi potwierdzić albo odrzucić proponowany ruch. Dzięki temu użytkownik może obsługiwać rozgrywkę bez konieczności ręcznego wybierania pól na planszy.

Aplikacja udostępnia ponadto tryb freeplay, tryb gry z AI, historię partii oraz analizę pozycji za pomocą silnika Stockfish.

**Cel jakościowy projektu:** 
- Ocena jakości logiki jednostek systemu
- Ocena jakości integracji systemu
- Ocena jakości doświadczeń użytkownika aplikacji 
- Zdiagnozowanie potencjalnych problemów i defektów projektu
- Ocena jakości dostępności dla osób ze wskazanymi niepełnosprawnościami motorycznymi

### 1.3. Główni użytkownicy i interesariusze

| Użytkownik / interesariusz | Potrzeby i oczekiwania |
|---|---|
| Gracz | Czytelna plansza, poprawne wykonywanie ruchów, informacja o stanie partii, intuicyjne sterowanie i kontrola nad aplikacją, możliwość wygodnego korzystania wyłącznie przy użyciu interfejsu głosowego, dobra jakość rozpoznawania poleceń w różnych warunkach otoczenia |
| Osoba oceniająca projekt | Jasno zdefiniowane wymagania jakościowe, kryteria akceptacji, ryzyka i dowody z testów. |
| Autor / osoba utrzymująca system | Możliwość modularnego uruchomienia usług, diagnozowania błędów i rozwijania aplikacji, możliwość 'prostego' wdrożenia produkcyjnego aplikacji |

### 1.4. Podstawowy sposób działania

1. Użytkownik uruchamia aplikację webową, loguje się na swoje konto i rozpoczyna nową partię lub wybiera dostępną nieukończoną partię.
![alt text](image-1.png)

2. Wybiera tryb gry: swobodną rozgrywkę między ludźmi albo rozgrywkę z AI. W trybie AI może grać białymi lub czarnymi.
3. Użytkownik zezwala przeglądarce na dostęp do mikrofonu i wypowiada ruch. Frontend przesyła nagranie do usługi rozpoznawania mowy Vosk.
![alt text](image-2.png)

4. Rozpoznany tekst trafia do usługi gry. Parser interpretuje polecenie w kontekście bieżącej pozycji i sprawdza możliwe ruchy.
5. Jeśli system dopasuje jeden ruch, pokazuje go do potwierdzenia. Jeśli polecenie jest niejednoznaczne lub nie pasuje do legalnego ruchu, informuje o tym użytkownika i nie wykonuje ruchu.
6. Po potwierdzeniu backend wykonuje ruch, aktualizuje pozycję i historię partii. Zakończenie partii jest sygnalizowane w interfejsie.
7. W trybie AI ruch przeciwnika wyznacza silnik Stockfish. W trybie swobodnym dostępna jest analiza pozycji.

![alt text](image.png)

### 1.5. Granice systemu i założenia

**W zakresie projektu:** interfejs przeglądarkowy, obsługa partii, rozpoznawanie i interpretowanie poleceń głosowych, walidacja legalności ruchu, potwierdzanie ruchu, tryb AI, konta i logowanie, analiza Stockfish oraz zapis i odczyt danych partii w bazie Firebase, dostępność dla osób z określonymi niepełnosprawnościami motorycznymi.

**Poza zakresem / ograniczenia do potwierdzenia:** gra przez Internet między zdalnymi użytkownikami, działanie w chmurze, porównanie silników szachowych.

System wymaga uruchomionych usług backendowych i frontendu. Rozpoznawanie mowy korzysta z lokalnego modelu Vosk; jakość wyniku może zależeć od mikrofonu, hałasu, akcentu, wymowy oraz treści polecenia. Dostęp do mikrofonu wymaga zgody użytkownika w przeglądarce.

## 2. Wymagania jakościowe

W tabeli poniżej umieszczono propozycje wymagań jakościowych dla aplikacji. W kolumnie „Weryfikacja” wskazano, jak zebrać dowód spełnienia wymagania.

| ID | Cecha jakościowa | Wymaganie jakościowe | Weryfikacja |
|---|---|---|---|
| JAK-01 | Poprawność funkcjonalna | System wykonuje wyłącznie ruchy legalne w bieżącej pozycji i aktualizuje planszę oraz historię zgodnie z wykonanym ruchem. | Testy funkcjonalne backendu i scenariusze gry; kontrola odpowiedzi API, FEN i historii. |
| JAK-02 | Poprawność rozpoznawania poleceń | W ustalonym zbiorze polskich nagrań system poprawnie rozpoznaje polecenie i proponuje zamierzony legalny ruch. | Test na przygotowanym zbiorze nagrań; porównanie wyniku z oczekiwanym ruchem. Należy opisać warunki nagrania. |
| JAK-03 | Bezpieczeństwo wykonania ruchu | Ruch rozpoznany z mowy nie jest wykonywany bez potwierdzenia użytkownika. Polecenie niejednoznaczne lub nielegalne nie zmienia stanu partii. | Testy scenariuszy potwierdzenia, odrzucenia, niejednoznaczności i ruchu nielegalnego; kontrola stanu partii przed i po. |
| JAK-04 | Użyteczność | Użytkownik otrzymuje zrozumiałą informację o rozpoznanym poleceniu, proponowanym ruchu, błędzie lub zakończeniu partii; co najmniej 80% osób testujących wykonuje podstawowy scenariusz bez pomocy osoby z zewnątrz. | Test użyteczności z udziałem co najmniej 5 użytkowników; ankieta lub lista obserwacji oraz sprawdzenie liczby wykonanych zadań bez pomocy. |
| JAK-05 | Wydajność | Rozpoznanie i przedstawienie propozycji ruchu następuje w czasie nie dłuższym niż 5 sekund dla co najmniej 90% prób z zestawu 30 komend w środowisku lokalnym z wykorzystaniem modelu Vosk i przeglądarki Brave. | Pomiar czasu od wysłania nagrania do wyświetlenia propozycji; podanie środowiska i statystyk. |
| JAK-06 | Niezawodność | Błąd mikrofonu, niepoprawny format nagrania lub niedostępność usługi nie powodują cichego wykonania ruchu ani utraty poprawnego stanu partii. | Testy błędów i niedostępności usług; sprawdzenie komunikatu oraz stanu gry po błędzie. |
| JAK-07 | Trwałość danych | Po ponownym pobraniu stanu zapisanej partii system odtwarza jej pozycję i historię zgodną z wykonanymi ruchami. | Test Integracyjny utworzenia partii, wykonania ruchów, ponownego odczytu oraz restartu usług. |
| JAK-08 | Kompatybilność i wdrażalność | Aplikację można uruchomić zgodnie z instrukcją w obsługiwanym środowisku Docker, a interfejs działa w uzgodnionej przeglądarce Brave na Windows 11. | Próba uruchomienia według README oraz test w przeglądarce Brave. |
| JAK-09 | Bezpieczeństwo dostępu | Model wdrożenia jest lokalny/prototypowy: usługi działają na komputerze deweloperskim w sieci lokalnej, a dostęp do API i danych dotyczy wyłącznie użytkownika i usług aplikacji. Należy ocenić CORS, uwierzytelnianie Firebase, dostęp do baz danych oraz komunikację między kontenerami. | Przegląd konfiguracji, analiza zabezpieczeń i testy zgodne z przyjętym zakresem bezpieczeństwa. |

### 2.1. Priorytety wymagań

| Priorytet | Znaczenie | Wymagania |
|---|---|---|
| Wysoki | Niezbędne dla poprawnego i bezpiecznego przebiegu partii. | JAK-01, JAK-03, JAK-09 |
| Średni | Istotne dla wygody, akceptacji użytkownika i stabilności działania. | JAK-02, JAK-04, JAK-06 |
| Niski / dodatkowy | Rozszerza jakość, wydajność i gotowość wdrożeniową poza podstawowy przepływ. | JAK-05, JAK-07, JAK-08 |

**Uzasadnienie priorytetów:**

Wymagania JAK-01 i JAK-03 mają najwyższy priorytet, ponieważ w systemie szachowym każda decyzja o wykonaniu ruchu musi być zgodna z aktualną pozycją, a ruch nie może zostać wykonany bez świadomej akcji użytkownika. To bezpośrednio wpływa na poprawność partii i bezpieczeństwo użytkowania. JAK-09 otrzymuje wysoki priorytet, ponieważ aplikacja wykorzystuje uwierzytelnianie Firebase oraz interakcję usług backendowych; w modelu lokalnym/ prototypowym ważne jest ograniczenie dostępu do API i danych.

Wymagania JAK-02, JAK-04 i JAK-06 mają priorytet średni, bo decydują o jakości interakcji użytkownika z systemem głosowym, czytelności komunikatów i odporności na błędy mikrofonu lub niedostępność usługi. Są istotne dla sprawności użytkowania, choć nie zastępują podstawowej poprawności logiki gry.

Wymagania JAK-05, JAK-07 i JAK-08 mają priorytet niski, jako że wspierają wygodę użytkowania, trwałość danych i łatwość uruchomienia, ale nie blokują podstawowego działania aplikacji. W praktyce ich spełnienie poprawia wiarygodność systemu, lecz nie zastępuje testów funkcjonalnych i bezpieczeństwa głównego przepływu rozgrywki.

### 2.2. Zakres i ograniczenia oceny jakości

**Zakres oceny:**

Ocena obejmuje główne funkcje systemu VChess: interfejs webowy, logikę partii szachowej, walidację legalności ruchów, rozpoznawanie poleceń głosowych w języku polskim, mechanizm potwierdzania ruchu, zapis i odczyt historii partii, tryb gry z komputerowym przeciwnikiem oraz analizę pozycji z wykorzystaniem Stockfish. W ocenie uwzględniono również zgodność działania aplikacji z instrukcją uruchomienia w środowisku Docker oraz poprawność obsługi błędów związanych z mikrofonem, usługą Vosk i stanem gry.

**Ograniczenia:**

Ocena nie ma charakteru pełnej certyfikacji jakości dla wszystkich środowisk użytkownika, ponieważ testy będą przeprowadzane w określonym środowisku lokalnym (Windows 11 + Brave + Docker). Nie da się rzetelnie uogólnić wyników rozpoznawania mowy na wszystkie mikrofony, akcenty, poziomy hałasu i typy sprzętu; podobnie wydajność i czas odpowiedzi należy traktować jako wynik dla konkretnej konfiguracji. Nie oceniano również bezpieczeństwa infrastruktury chmurowej ani porównania silników szachowych poza zastosowanym w projekcie zestawem funkcjonalnym, ponieważ projekt jest prototypem lokalnym i nie zakłada publicznego wdrożenia produkcyjnego.

## 3. Kryteria akceptacji

Kryterium akceptacji określa mierzalny warunek, na podstawie którego można stwierdzić, czy wymaganie jest spełnione.

| ID kryterium | Powiązane wymaganie | Warunek akceptacji | Sposób pomiaru / dowód |
|---|---|---|---|
| AK-01 | JAK-01 | We wszystkich przygotowanych przypadkach poprawny legalny ruch zostaje wykonany, a ruch nielegalny zostaje odrzucony bez zmiany pozycji. | Co najmniej 100 przypadków; zapis wejścia, odpowiedzi i stanu planszy przed/po. Cel: 100% zgodności dla przygotowanego zestawu. |
| AK-02 | JAK-02 | System poprawnie rozpoznaje zamierzony ruch w co najmniej 9 z 10 nagrań testowych z poleceniami zdefiniowanymi w zakresie projektu. | Zestaw nagrań z oczekiwanym tekstem/ruchami; raport skuteczności i opis warunków nagrania. |
| AK-03 | JAK-03 | W każdym przypadku wymagającym potwierdzenia ruch pozostaje niewykonany do chwili zatwierdzenia; odrzucenie anuluje propozycję. | Testy jednostkowe osobno dla potwierdzenia, odrzucenia i braku decyzji; porównanie historii partii. Cel: 100% poprawnych wyników. |
| AK-04 | JAK-03 | Dla polecenia niejednoznacznego albo bez legalnego dopasowania system wyświetla komunikat i nie zmienia pozycji ani historii. | Co najmniej 100 przypadków niejednoznacznych oraz błędnych; kontrola stanu przed/po. |
| AK-05 | JAK-04 | Co najmniej 4 z 5 osób testujących wykonuje scenariusz rozpoczęcia partii i zatwierdzenia ruchu bez pomocy prowadzącego. | Obserwacja testu z udziałem 5 osób; lista zadań i wyniki poszczególnych osób. |
| AK-06 | JAK-05 | Czas obsługi polecenia od wysłania nagrania do pokazania propozycji nie przekracza 2 sekund w co najmniej 90% prób. | 50 pomiarów w tym samym środowisku; podać mediane, warunki i wyniki procentowe. |
| AK-07 | JAK-06 | Po odmowie dostępu do mikrofonu, błędzie nagrania lub niedostępności usługi użytkownik otrzymuje komunikat, a partia pozostaje w poprawnym stanie. | Testy systemowe, Scenariusze błędów; zrzuty/odpowiedzi i kontrola stanu gry. |
| AK-08 | JAK-07 | Po ponownym odczycie zapisanej partii liczba i kolejność ruchów oraz pozycja końcowa są zgodne ze stanem sprzed odczytu. | Wykonać 5 ruchów, ponownie pobrać partię i porównać historię oraz FEN. |
| AK-09 | JAK-08 | Wszystkie wymagane kontenery uruchamiają się poleceniem podanym w instrukcji, a interfejs jest osiągalny pod wskazanym adresem. | Czyste uruchomienie środowiska testowego; zrzut statusu kontenerów i wynik otwarcia aplikacji. |

### 3.1. Reguły uznania projektu za zaakceptowany

Projekt można uznać za spełniający przyjęte kryteria, jeżeli:

- kryteria o priorytecie wysokim uzyskają wynik pozytywny;
- dla każdego kryterium zostanie zachowany dowód: wynik testu, pomiar, zrzut lub opis obserwacji;
- niespełnione kryteria zostaną jawnie wskazane wraz z wpływem na jakość i propozycją dalszego działania;
- testy zostaną wykonane w opisanym środowisku, a ograniczenia wyników zostaną odnotowane.

**Ostateczne progi i wyjątki:** [uzupełnij po zaplanowaniu testów]

## 4. Rejestr ryzyk

W projekcie najważniejsze ryzyka dotyczą rozpoznawania mowy, poprawności logiki ruchów oraz niezawodności usług wspierających grę. Poniższa tabela uwzględnia główne zagrożenia dla jakości działania systemu VChess w środowisku lokalnym.

| ID | Ryzyko | Prawdopodobieństwo (1–5) | Skutek (1–5) | Priorytet | Postępowanie / działanie zapobiegawcze |
|---|---|---:|---:|---:|---|
| R-01 | Błędne rozpoznanie polecenia głosowego lub zniekształcenie tekstu po transkrypcji | 4 | 4 | 16 | Przygotować zestaw testowych nagrań, sprawdzać komunikaty o błędnym dopasowaniu i wymuszać potwierdzenie ruchu; dodać walidację niejednoznacznych komend oraz dodatkowe testy dla hałasu i akcentu. |
| R-02 | Niejednoznaczne polecenie lub brak legalnego ruchu dla danej pozycji | 3 | 5 | 15 | Wykorzystywać parser z kontekstem szachowym, odrzucać ruchy bez jednoznacznego dopasowania i wyświetlać czytelne komunikaty; doprecyzować słownik komend i słów kluczowych. |
| R-03 | Niedostępność lub awaria usługi Vosk / Stockfish / Firebase | 2 | 5 | 10 | Zaimplementować obsługę błędów po stronie frontendu i backendu, blokować wykonanie ruchu bez potwierdzenia oraz rejestrować status usługi; w razie awarii wyświetlać komunikat użytkownikowi i nie zmieniać stanu partii. |
| R-04 | Utrata lub niespójność danych partii w bazie Firestore | 2 | 5 | 10 | Zapisować kompletne FEN i historię ruchów, kontrolować kolejność i poprawność danych przy odczycie, wdrażać testy trwałości danych oraz monitorować logi usługi. |
| R-05 | Problemy z uruchomieniem kontenerów Docker lub różnice środowiskowe | 3 | 3 | 9 | Utrzymać instrukcję uruchomienia, walidować środowisko testowe i wersje obrazów, wykorzystywać skrypt uruchamiający i testy wdrożeniowe. |
| R-06 | Słaby mikrofon, szum otoczenia lub różnice akustyczne | 4 | 3 | 12 | Testować w warunkach zbliżonych do użytkowania, rekomendować korzystanie z mikrofonu o dobrej jakości i dodawać informację o jakości nagrania przed przetwarzaniem. |

**Przyjęta skala ocen i progi priorytetu:**

- Prawdopodobieństwo (P): 1 – bardzo małe, 5 – bardzo wysokie.
- Skutek (S): 1 – mały wpływ na działanie, 5 – poważne zagrożenie dla poprawności partii lub bezpieczeństwa użytkowania.
- Priorytet: obliczany jako P × S. Wartości 15 i wyżej uznaje się za ryzyka wysokie, wymagające działań profilaktycznych przed wdrożeniem lub w kolejnej iteracji rozwoju. Ryzyka o priorytecie 10–14 traktowane są jako istotne i wymagają kontroli, a poniżej 10 jako niskie, lecz nadal monitorowane.

## 5. Plan testów


|---|---|---|---|---|
| T-01 | Funkcjonalny | Wypowiedzenie jednoznacznego legalnego ruchu i jego potwierdzenie. | Ruch zostaje wykonany i widoczny na planszy oraz w historii partii. | AK-01, AK-03 |
| T-02 | Funkcjonalny / negatywny | Odrzucenie zaproponowanego ruchu. | Pozycja i historia partii nie zmieniają się; użytkownik otrzymuje informację o odrzuceniu. | AK-03 |
| T-03 | Funkcjonalny / negatywny | Polecenie niejednoznaczne lub nielegalne. | Użytkownik otrzymuje komunikat o braku dopasowania; ruch nie zostaje wykonany. | AK-04 |
| T-04 | Integracyjny | Rozpoznanie nagrania i przekazanie tekstu do analizy ruchu. | Usługi zwracają wynik zgodny z oczekiwaniem dla przygotowanego zestawu nagrań i legalnych ruchów. | AK-02 |
| T-05 | Integracyjny | Ruch AI oraz analiza pozycji Stockfish. | Aplikacja wykonuje ruch komputera zgodnie z logiką rubryki gry i prezentuje poprawną analizę pozycji. | AK-01, JAK-08 |
| T-06 | Niezawodnościowy | Odmowa dostępu do mikrofonu, błąd nagrania lub niedostępność usługi Vosk. | Błąd jest obsłużony komunikatem, a stan partii pozostaje niezmieniony. | AK-07 |
| T-07 | Trwałość danych | Odczyt zapisanej partii po wykonaniu kilku ruchów. | Odtworzona historia i pozycja są zgodne z zapisanym stanem. | AK-08 |
| T-08 | Wdrożeniowy | Uruchomienie aplikacji według instrukcji Docker. | Kontenery startują poprawnie, a interfejs jest dostępny pod wskazanym adresem. | AK-09 |
| T-09 | Test użyteczności | Podstawowy scenariusz: rozpoczęcie partii, rozpoznanie ruchu, potwierdzenie oraz sprawdzenie komunikatów. | Co najmniej 80% testujących wykonuje zadania bez pomocy prowadzącego i ocenia komunikaty jako zrozumiałe. | JAK-04 |
| T-10 | Wydajnościowy | Pomiar czasu od wysłania nagrania do wyświetlenia proponowanego ruchu. | Co najmniej 90% prób kończy się w czasie <= 5 s w warunkach lokalnych. | JAK-05 |

**Środowisko testowe:**

Środowisko testowe odpowiada założeniom projektu: Windows 11, przeglądarka Brave, aplikacja uruchomiona w kontenerach Docker na lokalnym komputerze deweloperskim. Testy funkcjonalne i integracyjne wykonywane są w tej samej konfiguracji sprzętowo-programowej, aby wyniki były porównywalne.

**Dane testowe / nagrania:**

Dane testowe obejmują przygotowany zestaw komend głosowych w języku polskim, obejmujący legalne i nielegalne ruchy, polecenia niejednoznaczne, oraz scenariusze błędów z mikrofonem i usługą rozpoznawania mowy. Nagrania powinny zostać przygotowane w warunkach kontrolowanych z wykorzystaniem tego samego mikrofonu i podobnego poziomu hałasu, a ich liczbę i wynik należy zarejestrować w raporcie testowym.

**Narzędzia:**

- pytest do testów backendowych i jednostkowych,
- przeglądarka Brave do testów interfejsu i scenariuszy użytkownika,
- logi usług Vosk / Stockfish / Firebase do kontroli błędów i stanu aplikacji,
- stoper lub prosty skrypt pomiarowy do pomiaru czasu odpowiedzi,
- zrzuty ekranu i zapis stanu partii (FEN, historia ruchów) jako dowody testów.

## 6. Realizacja i wyniki testów

> Tę sekcję uzupełnij dopiero po wykonaniu testów. W repozytorium znajduje się przykładowy test `test_sample.py`, który sprawdza wyłącznie prostą funkcję demonstracyjną; sam w sobie nie potwierdza jakości funkcji szachowych ani rozpoznawania mowy.

| ID testu | Data / środowisko | Wynik: zaliczony / niezaliczony | Dowód / obserwacje | Odchylenia i problemy |
|---|---|---|---|---|
| T-01 | [uzupełnij] | [ ] | [uzupełnij] | [uzupełnij] |
| T-02 | [uzupełnij] | [ ] | [uzupełnij] | [uzupełnij] |
| T-03 | [uzupełnij] | [ ] | [uzupełnij] | [uzupełnij] |

**Podsumowanie wyników:** [liczba testów zaliczonych / wszystkich, najważniejsze niezgodności, ograniczenia pomiarów]

## 7. Wnioski

### 7.1. Ocena spełnienia wymagań

[Oceń wymagania jakościowe na podstawie dowodów z testów. Wskaż, które zostały spełnione, częściowo spełnione lub niespełnione. Nie formułuj wniosków o jakości bez odniesienia do wyników.]

### 7.2. Najważniejsze ryzyka i ograniczenia

[Wskaż ryzyka o najwyższym priorytecie oraz ich wpływ na użytkownika lub wiarygodność wyników.]

### 7.3. Proponowane ulepszenia

[Wymień działania, które najbardziej poprawiłyby jakość systemu, np. rozszerzenie testów parsera, większy zbiór nagrań, poprawa komunikatów błędów lub dodatkowe zabezpieczenie usług. Uzasadnij kolejność.] 
