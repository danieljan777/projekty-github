# Portfolio projektów — projekt (design)

Data: 2026-11-23 · Status: do akceptacji

## Cel i „dlaczego"

Daniel chce **jednej publicznej witryny-portfolio**, która pokazuje wszystkie jego projekty
z GitHuba (konto `danieljan777`), podzielone na **Publiczne** i **Prywatne**, i która **sama
uwzględnia nowe repozytoria** — bez ręcznego dopisywania.

Obecny stan (2026-11-23): 8 repozytoriów, wszystkie prywatne. Opisy części z nich zawierają dane
klientów (nazwy firm, domeny, informacje o infrastrukturze) — dlatego ten dokument ich nie cytuje.

## Cele

- Lista projektów generuje się automatycznie z GitHub API; nowe repozytorium pojawi się
  w najbliższym przebiegu bez żadnej edycji.
- Dwie sekcje: **Publiczne** (pełne dane z GitHuba + link do kodu) i **Prywatne**.
- Prywatne projekty są **domyślnie ujawniane minimalnie**: nazwa, główny język, data ostatniej
  aktywności. Tytuł, opis i link do dema pojawiają się tylko po świadomym opt-in.
- Strona statyczna, szybka, darmowa w utrzymaniu, po polsku.

## Nie-cele

- Brak CMS, logowania, komentarzy, analityki.
- Brak podstron per projekt (tylko kafelki z linkami zewnętrznymi).
- Brak skanowania lokalnych katalogów — źródłem prawdy jest wyłącznie GitHub.
- Brak natychmiastowego odświeżania po `git push` w innych repozytoriach (rebuild co noc + ręcznie).

## Anty-cele (porażka, nawet jeśli „działa")

- **Wyciek danych z prywatnego repozytorium** (opis, topics, homepage, URL repo) do wygenerowanego HTML.
- Opublikowanie pustej lub okrojonej strony po błędzie API/tokenu zamiast zatrzymania buildu.
- Konieczność ręcznej edycji, żeby nowe repozytorium w ogóle się pojawiło.

## Ograniczenia

- GitHub Pages dla repozytorium prywatnego wymaga płatnego planu → **repozytorium strony jest
  publiczne** (więc `portfolio.yml` i kod generatora są publiczne; nie wolno w nich trzymać nic wrażliwego).
- Odczyt prywatnych repozytoriów wymaga tokena. Daniel sam tworzy **fine-grained PAT**
  (tylko odczyt metadanych repozytoriów) i sam dodaje go jako secret `PORTFOLIO_TOKEN` w Actions.
  Asystent nie odczytuje ani nie wpisuje tokenów.
- Środowisko: Node 22, npm 10; Debian/Ubuntu. Przed dodaniem biblioteki sprawdzać `package.json`.

## Podejścia rozważone

| | Podejście | Wynik |
|---|---|---|
| **A** | Generator statyczny (Astro) + GitHub Actions (cron + ręczny trigger) → GitHub Pages | **Wybrane** |
| B | Next.js na Vercel z ISR, fetch z tokenem po stronie serwera | Odrzucone: serwer i token runtime to przerost dla listy kafelków |
| C | JavaScript w przeglądarce odpytujący GitHub API | Odrzucone: prywatnych repozytoriów nie da się odczytać bez publicznego tokena |

Uzasadnienie wyboru A: strona to lista kafelków; statyczny build daje szybkość, zero kosztów
i brak sekretów w runtime. Cena: nowy projekt widać po najbliższym przebiegu (max. ok. doby).

## Decyzje Daniela

- Strona publiczna, sekcje Publiczne/Prywatne.
- Prywatne: **wariant 2** — bezpieczny domyślny wygląd + ręczne odblokowanie przez `portfolio.yml`.
- Podejście **A**.
- `portfolio.yml` w repozytorium strony: publiczny tytuł, opis i link dema per projekt prywatny;
  opcja `hidden: true` ukrywa projekt całkowicie. Opisy z GitHuba dla prywatnych **nie są używane**.
- Projekty lokalne nie będące na GitHubie (`Claude-Desktop-Instrukcja`, `Ollama-Open-WebUI`)
  pojawią się dopiero po wypchnięciu ich jako repozytoria.

## Architektura

```
GitHub API ──(gh api, PORTFOLIO_TOKEN)──> scripts/fetch-repos  ──> src/data/repos.json
                                                │ allowlist: usuwa pola prywatnych repo
portfolio.yml ──────────────────────────────────┘ nakłada opt-in / hidden
                                                         │
                                          Astro (build statyczny)
                                                         │
                          GitHub Actions: cron 1×/dobę + workflow_dispatch + push do main
                                                         │
                                                   GitHub Pages
```

### Model danych (po filtrze — to jedyne, co widzi szablon)

- **Publiczne:** `name`, `description`, `language`, `topics`, `homepage`, `html_url`, `pushed_at`, `archived`.
- **Prywatne (domyślnie):** `name`, `language`, `pushed_at`, `archived`.
- **Prywatne z wpisem w `portfolio.yml`:** dodatkowo `title`, `description`, `url` (demo) — wyłącznie
  z pliku YAML, nigdy z GitHuba. Link `html_url` prywatnego repo nigdy nie trafia na stronę.
- Pole `private` z API decyduje o ścieżce. Filtr działa jako **allowlista pól** (nie denylista),
  żeby nowe pola API nie wyciekały domyślnie.

### Szkic `portfolio.yml`

```yaml
site:
  title: "Daniel Jankowski — projekty"
  tagline: "…"
projects:
  przyklad-repo:
    title: "Publiczny tytuł"
    description: "Krótki, bezpieczny opis."
    url: "https://demo.example"
  stare-repo:
    hidden: true
```

### Zachowanie

- Fork-i: pomijane. Archiwalne: pokazywane z oznaczeniem. Sortowanie: `pushed_at` malejąco.
- Błąd API / brak uprawnień / 0 repozytoriów mimo tokena → build **kończy się błędem** (nic nie jest publikowane).
  Logować tylko liczby (ile publicznych / prywatnych / ukrytych), nigdy nazwy ani opisy prywatnych.
- Workflow: cron raz na dobę (godzina do wyboru wykonawcy), `workflow_dispatch`, push do `main`;
  `actions/deploy-pages`; uprawnienia minimalne (`contents: read`, `pages: write`, `id-token: write`).
- Lokalnie ten sam skrypt używa `gh api`, korzystając z istniejącego logowania `gh` (bez ręcznej obsługi tokena).

## Testy (wymagane)

- Test jednostkowy filtra: dla repozytorium prywatnego z opisem, topics, homepage i `html_url`
  **żadne z tych pól nie występuje** w wyniku bez wpisu w `portfolio.yml`; `hidden: true` usuwa projekt.
- Test, że wygenerowany HTML nie zawiera opisu prywatnego repozytorium (fixture z „sentinelem").
- Test, że 0 repozytoriów / błąd API przerywa build.

## Decyzje zostawione wykonawcy (propozycje asystenta, do poprawienia)

- Nazwa repo strony: `projekty-github`; adres `https://danieljan777.github.io/projekty-github/`
  (`base` w konfiguracji Astro). Własna domena — później, poza zakresem.
- Wygląd: czysty CSS bez frameworka UI, jasny/ciemny motyw wg systemu, responsywnie, po polsku;
  szczegóły wizualne ustalane przy implementacji.
- Godzina crona, framework testowy (np. `vitest`), układ katalogów.

## Zmiana 2026-11-24: dostęp tylko dla właściciela (do akceptacji)

Daniel: witryna ma być tylko dla niego; wejście przez login i stałe hasło wymyślone przez asystenta.

**Problem:** GitHub Pages jest statyczny — nie ma serwera, który mógłby sprawdzić hasło. Login sprawdzany
w JavaScript ze stałym hasłem w kodzie nie chroni niczego: hasło i wszystkie dane są widoczne w źródle strony,
a repozytorium (z kodem generatora) jest publiczne.

**Decyzja asystenta:** wygenerowany HTML jest **szyfrowany przed publikacją** (wzorzec StatiCrypt:
AES-256-GCM, klucz z PBKDF2 wyprowadzony z loginu i hasła, odszyfrowanie w przeglądarce). Publiczny jest
tylko formularz logowania i zaszyfrowany blob. Bez hasła treści nie da się odczytać.

- **Jedno pole „Hasło", bez osobnego loginu** (decyzja wykonawcy: `staticrypt` nie ma pola loginu, a przy
  szyfrowaniu osobny login niczego nie chroni — liczy się siła hasła). Hasło: losowe, 32 znaki,
  generowane lokalnie, zapisane w `.env.local`
  (gitignored, `chmod 600`) i jako secret Actions `PORTFOLIO_PASSWORD` — nigdy w repozytorium ani w logach.
  Asystent nie wypisuje hasła w czacie; Daniel odczytuje je z `.env.local`.
- Filtr minimalnego ujawniania z Task 2 **zostaje** (obrona warstwowa): blob jest publiczny, więc hasło
  można zgadywać offline; długie losowe hasło to uniemożliwia, a filtr ogranicza szkody przy wycieku hasła.
- Dodatkowa biblioteka: `staticrypt` (dev dependency) zamiast własnej kryptografii; wersja sprawdzana przy Task 5b.
- Ograniczenie: nie ma limitu prób ani wylogowania po stronie serwera; bezpieczeństwo opiera się
  wyłącznie na sile hasła (PBKDF2 spowalnia zgadywanie).
- Alternatywa bez publikacji: tylko lokalnie (`npm run build:data && npx astro preview`), bez Pages i bez hasła.
