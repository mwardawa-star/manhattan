# Program Manhattan – kasa, wspólnicy, umowy

Program Spółki Kupieckiej „Manhattan”: **Raport kasowy (RapKas)** i **Księga udziałów** w jednym.

- Strona programu: https://mwardawa-star.github.io/manhattan/
- **Dane są tylko na Dysku Google właściciela**, w folderze „Manhattan – dane programu”. W tym repozytorium jest wyłącznie kod programu, bez żadnych danych wspólników ani kasy.

## Jak to działa

1. Otwierasz stronę programu (na laptopie w Edge/Chrome albo na iPhonie: Safari → Udostępnij → „Do ekranu początkowego”).
2. **Zaloguj kontem Google.** Program dostaje uprawnienie `drive.file`, czyli widzi wyłącznie pliki, które sam utworzył. Reszta Twojego Dysku jest dla niego niewidoczna.
3. Potem program pyta o **hasło do programu** (użytkownicy z Ustawień, tak jak w wersji na MEGA).

Bazy to te same pliki SQLite co wcześniej: `Księga udziałów/ksiega.sqlite` i `RapKas/rapkas.sqlite`. Na Dysku leżą też:
- `kopie`: kopie zapasowe przy każdym otwarciu,
- `RapKas/Faktury`: PDF-y faktur dodane przyciskiem „Dodaj pliki PDF…”,
- `Archiwum/RRRR-MM-DD`: archiwum tygodniowe (Excel, CSV, kopie baz).

**Archiwum na laptopie:** w nagłówku kliknij „📁 ustaw archiwum na laptopie” i wskaż folder `D:\Archiwum\Manhattan`. Od tej pory przy każdym otwarciu programu na laptopie (Edge/Chrome) brakujące archiwa z Dysku Google dokopiowują się do tego folderu. Dotyczy to też archiwów zrobionych na telefonie. Gdy przeglądarka poprosi o ponowną zgodę, w nagłówku pojawi się „📁 zapisz archiwum na laptopie”: wystarczy kliknąć.

**Ochrona przed nadpisaniem:** jeśli w czasie pracy dane zmieni inne urządzenie, program wstrzyma zapis i poprosi o odświeżenie (F5). Nic nie zostanie nadpisane.

## Pierwsze uruchomienie (przeniesienie danych z MEGA)

Na laptopie, w Edge albo Chrome: zaloguj się kontem Google, kliknij **„Przenieś dane z laptopa na Dysk Google”** i wskaż folder `D:\MegaSync\Manhattan\Dokumenty`. Program skopiuje obie bazy, plik dla Worda i faktury PDF. W folderze `Program Manhattan` na MEGA zostawi plik „DANE PRZENIESIONE NA DYSK GOOGLE.txt”. Od tej chwili nie używaj już starej wersji z MEGA.

## Zapomniane hasło do programu

Inny użytkownik może nadać nowe hasło w Ustawieniach. Jeśli nikt nie pamięta hasła, trzeba usunąć wpis `uzytkownicy` z tabeli `ustawienia` w pliku `ksiega.sqlite` na Dysku Google, np. z pomocą Claude. Program otworzy się wtedy bez hasła (logowanie Google zostaje).

## Budowa techniczna

- `index.html` powstaje z lokalnego `Manhattan.html` skryptem `narzedzia/zbuduj.py`, który robi kilka dokładnych podmian: nagłówek, ekran startowy, logowanie Google, faktury PDF.
- `dysk.js` zawiera logowanie Google (Google Identity Services) i obsługę plików przez Google Drive API v3. Udaje „folder” w tym samym stylu co File System Access API, więc logika programu jest bez zmian.
- `config.js` zawiera identyfikator logowania Google (OAuth Client ID). Dozwolone źródło JavaScript: `https://mwardawa-star.github.io`.
- Biblioteki w `lib/`: sql.js 1.11.0, SheetJS 0.18.5, pdf.js 3.11.174.
