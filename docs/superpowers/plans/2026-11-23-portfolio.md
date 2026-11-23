# Portfolio projektów — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publiczna, statyczna witryna-portfolio, która co dobę sama pobiera repozytoria `danieljan777` z GitHuba i pokazuje je w sekcjach Publiczne / Prywatne bez ujawniania danych z prywatnych repozytoriów.

**Architecture:** Skrypt `scripts/build-data.ts` pobiera repozytoria przez `gh api`, przepuszcza je przez czystą funkcję `buildCatalog` (allowlista pól + `portfolio.yml`) i zapisuje tylko przefiltrowany `src/data/catalog.json`. Astro generuje z niego statyczny HTML; GitHub Actions (cron + dispatch + push) publikuje na GitHub Pages.

**Tech Stack:** Node 22.22 / npm 10.9, Astro 7.4.13, TypeScript 7.0.2, Vitest 5.1.1, yaml 2.9.1, `gh` 2.46.0 (bez `--slurp`), GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-23-portfolio-design.md`

## Global Constraints

- Repozytorium strony jest **publiczne**: `danieljan777/projekty-github`; `site: 'https://danieljan777.github.io'`, `base: '/projekty-github'`.
- Surowe dane z API **nigdy nie są zapisywane na dysk** — na dysk trafia wyłącznie wynik `buildCatalog` (`src/data/catalog.json`, w `.gitignore`).
- Filtr to **allowlista pól**. Prywatne: `name`, `language`, `pushedAt`, `archived`; plus `title`/`description`/`url` wyłącznie z `portfolio.yml`. Link `html_url` prywatnego repo nigdy nie trafia na stronę. Publiczne: `name`, `description`, `language`, `topics`, `homepage`, `htmlUrl`, `pushedAt`, `archived`.
- Forki pomijane; archiwalne pokazywane z oznaczeniem; sortowanie `pushedAt` malejąco; `hidden: true` w `portfolio.yml` działa na każde repo; `title`/`description`/`url` z YAML dotyczą tylko prywatnych.
- Błąd API, brak uprawnień lub 0 repozytoriów → proces kończy się kodem ≠ 0 (nic nie jest publikowane). Logi zawierają wyłącznie liczby, nigdy nazw/opisów prywatnych repo.
- Token: secret `PORTFOLIO_TOKEN` (fine-grained PAT, tylko odczyt metadanych) tworzy i dodaje użytkownik; nikt inny go nie odczytuje ani nie wpisuje. Lokalnie `gh` używa istniejącego logowania.
- Język strony: polski. Czysty CSS, bez frameworka UI. Przed dodaniem biblioteki sprawdzić `package.json`; żadnego `sudo npm`; ścieżki bezwzględne lub weryfikowany `pwd`.
- Lokalne commity są dozwolone po zatwierdzeniu planu; **`git push`, `gh repo create` i zmiany ustawień GitHuba wymagają osobnej zgody użytkownika w chwili wykonania.**

## Review Focus

1. Repo publiczne z `description: null` / `language: null` — brak tekstu „null" na stronie.
2. `url` w `portfolio.yml` inne niż `http(s)://` (np. `javascript:`) — odrzucone przy wczytaniu konfiguracji.
3. Klucz w `portfolio.yml` bez pasującego repo (literówka / zmieniona nazwa; `hidden` przestaje chronić) — wykryty i zgłoszony w wyniku i w logu.
4. Nazwy repo różniące się wielkością liter od klucza w YAML — dopasowanie bez rozróżniania wielkości liter.
5. Znaki HTML w opisie (`<script>`) i pusta sekcja — opis escapowany, pusta sekcja pokazuje komunikat zamiast pustego miejsca.

---

### Task 1: Szkielet projektu (Astro + Vitest + git)

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/pages/index.astro` (tymczasowy „Hello"), `src/lib/.gitkeep`
- Test: `npm run build` i `npm test`

**Interfaces:**
- Produces: skrypty npm `dev`, `build` (`astro build`), `test` (`vitest run`), `build:data` (`node scripts/build-data.ts`, dodany w Task 4); `astro.config.mjs` z `site`/`base` jak w Global Constraints.

- [ ] **Step 1:** W `/home/dj/AI/Projekty/projekty-github` wykonać `git init -b main`, utworzyć `package.json` (`"type": "module"`, `"private": true`), zainstalować `astro@7.4.13`, `typescript@7.0.2`, `vitest@5.1.1`, `yaml@2.9.1` (dev: vitest, typescript). Bez `sudo`.
- [ ] **Step 2:** `.gitignore`: `node_modules/`, `dist/`, `.astro/`, `src/data/catalog.json`. Konfiguracja Astro: `site`, `base`, `output: 'static'`.
- [ ] **Step 3:** Run: `npm test -- --passWithNoTests && npm run build` → Expected: build kończy się sukcesem, powstaje `dist/index.html`.
- [ ] **Step 4:** Commit `chore: scaffold astro + vitest`. **Rollback:** `git reset --hard HEAD~1` (przed pierwszym commitem: usunąć `.git`).

### Task 2: Filtr katalogu `buildCatalog` (rdzeń bezpieczeństwa)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/catalog.ts`
- Test: `src/lib/catalog.test.ts`

**Interfaces:**
- Produces (`types.ts`): `RawRepo` (pola API: `name`, `private`, `fork`, `archived`, `description`, `language`, `topics?`, `homepage`, `html_url`, `pushed_at` + `[k: string]: unknown`), `ProjectOverride { hidden?: boolean; title?: string; description?: string; url?: string }`, `PortfolioConfig { site: { title: string; tagline?: string }; projects: Record<string, ProjectOverride> }`, `PublicProject`, `PrivateProject` (pola jak w Global Constraints, `visibility: 'public' | 'private'`), `Catalog { public: PublicProject[]; private: PrivateProject[]; counts: { public: number; private: number; hidden: number }; unmatched: string[] }`.
- Produces (`catalog.ts`): `buildCatalog(raw: RawRepo[], config: PortfolioConfig): Catalog`.

> **Learn by Doing (output style):** funkcję mapującą repo prywatne → `PrivateProject` (ok. 8 linii, miejsce z `TODO(human)`) wykonawca zostawia użytkownikowi do napisania; to decyzja o tym, co jest ujawniane.

- [ ] **Step 1: Testy (przed kodem)** w `catalog.test.ts`, fixture z „sentinelami" (`SECRET-DESC`, `secret-topic`, `https://secret.example`):
  - `prywatne repo bez wpisu w YAML: wynik nie zawiera description, topics, homepage ani html_url` (serializacja `JSON.stringify(catalog)` nie zawiera żadnego sentinela);
  - `prywatne repo z wpisem: title/description/url pochodzą z YAML, nie z GitHuba`;
  - `hidden: true usuwa projekt (publiczny i prywatny) i zwiększa counts.hidden`;
  - `publiczne repo ignoruje title/description/url z YAML`;
  - `forki pomijane, archiwalne mają archived: true, sortowanie pushedAt malejąco`;
  - `klucze YAML dopasowywane bez rozróżniania wielkości liter` (Review Focus 4);
  - `klucz YAML bez repo trafia do unmatched` (Review Focus 3);
  - `publiczne repo z description: null i language: null przechodzi bez błędu`, pola `null` (Review Focus 1).
- [ ] **Step 2:** Run: `npx vitest run src/lib/catalog.test.ts` → Expected: FAIL („buildCatalog is not a function").
- [ ] **Step 3:** Zaimplementować `buildCatalog` jako funkcję czystą; mapowanie pól wyłącznie przez jawne przypisania (nigdy spread `...repo`).
- [ ] **Step 4:** Run: to samo polecenie → Expected: PASS (8 testów).
- [ ] **Step 5:** Commit `feat: catalog filter with field allowlist`. **Rollback:** `git revert HEAD`.

### Task 3: Wczytywanie `portfolio.yml` (`loadConfig`)

**Files:**
- Create: `src/lib/config.ts`, `portfolio.yml`
- Test: `src/lib/config.test.ts`

**Interfaces:**
- Consumes: `PortfolioConfig`, `ProjectOverride` z `types.ts`.
- Produces: `parseConfig(yamlText: string): PortfolioConfig` (czysta, testowalna) i `loadConfig(path: string): PortfolioConfig` (czyta plik + `parseConfig`); oba rzucają `Error` z czytelnym komunikatem przy niepoprawnym schemacie.

- [ ] **Step 1: Testy:** `poprawny YAML zwraca site i projects`; `brak site.title rzuca błąd`; `url z javascript: lub ftp: rzuca błąd, https:// przechodzi` (Review Focus 2); `puste "projects" daje {}`; `nieznane pole w projekcie rzuca błąd` (literówka typu `hiden`).
- [ ] **Step 2:** Run: `npx vitest run src/lib/config.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Implementacja przez bibliotekę `yaml` + ręczna walidacja (bez dodawania biblioteki schematów — YAGNI). Początkowy `portfolio.yml`: `site.title: "Daniel Jankowski — projekty"`, `tagline` wg uznania, `projects` z wpisami `hidden: true` / `title` / `url` wybranymi przez użytkownika — **opisy i ukrycia ustala użytkownik; wykonawca pyta, nie zgaduje.**
- [ ] **Step 4:** Run: `npx vitest run` → Expected: PASS (wszystkie testy).
- [ ] **Step 5:** Commit `feat: portfolio.yml loader with validation`. **Rollback:** `git revert HEAD`.

### Task 4: Skrypt pobierania `scripts/build-data.ts`

**Files:**
- Create: `scripts/build-data.ts`, `src/lib/github.ts`
- Modify: `package.json` (skrypt `build:data`)
- Test: `src/lib/github.test.ts`

**Interfaces:**
- Consumes: `buildCatalog`, `loadConfig`, `RawRepo`.
- Produces (`github.ts`): `fetchRawRepos(run?: (args: string[]) => string): RawRepo[]` — domyślnie woła `gh api --paginate --jq '.[]' '/user/repos?affiliation=owner&per_page=100'` (gh 2.46 nie ma `--slurp`; wyjście to JSON-per-linia); `assertSane(raw: RawRepo[]): void` — rzuca przy 0 repozytoriów.
- Produces: `npm run build:data` zapisuje `src/data/catalog.json` (kształt `Catalog` + `site` z konfiguracji) i drukuje w logu tylko `counts` oraz `unmatched` (klucze YAML są publiczne).

- [ ] **Step 1: Testy** z wstrzykniętym `run`: `parsuje wyjście wielu stron jako JSON-per-linia`; `assertSane rzuca dla pustej listy`; `błąd polecenia gh propaguje wyjątek` (nie połyka go).
- [ ] **Step 2:** Run: `npx vitest run src/lib/github.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Zaimplementować `fetchRawRepos`/`assertSane` oraz `build-data.ts` (kolejność: fetch → `assertSane` → `buildCatalog` → zapis; surowe dane tylko w pamięci). Uruchamianie bez `tsx` — Node 22.22 uruchamia `.ts` natywnie; importy z jawnym rozszerzeniem `.ts`.
- [ ] **Step 4:** Run: `npx vitest run` → Expected: PASS. Następnie ręcznie: `npm run build:data` → Expected: log `public: 0, private: 8 (…hidden…)`, plik `src/data/catalog.json` istnieje i **nie zawiera** żadnego z opisów prywatnych repo (sprawdzić: grep po lokalnej liście nazw klientów w `src/data/catalog.json` → `0` (lista nie jest commitowana)).
- [ ] **Step 5:** Commit `feat: fetch github repos into filtered catalog`. **Rollback:** `git revert HEAD` + `rm src/data/catalog.json`.

### Task 5: Strona (Astro) i test wycieku w HTML

**Files:**
- Create: `src/pages/index.astro` (zastępuje tymczasowy), `src/components/ProjectCard.astro`, `src/styles/global.css`, `src/data/catalog.fixture.json`
- Modify: `package.json` (skrypt `build:fixture`: `CATALOG_PATH=src/data/catalog.fixture.json astro build`)
- Test: `tests/html.test.ts`

**Interfaces:**
- Consumes: `Catalog` (+ `site`) z `src/data/catalog.json`; ścieżka nadpisywana zmienną `CATALOG_PATH`.
- Produces: `dist/index.html` z dwiema sekcjami „Publiczne (n)" i „Prywatne (n)"; pusta sekcja pokazuje komunikat PL (Review Focus 5); kafelek publiczny linkuje do `htmlUrl`; kafelek prywatny nigdy nie ma linku do repo, a link dema tylko gdy jest `url`; archiwalne z oznaczeniem.

- [ ] **Step 1:** Fixture: 1 publiczne repo z opisem `<script>alert(1)</script>`, 1 prywatne bez wpisu, 1 prywatne z wpisem, puste „public" w drugim wariancie fixture.
- [ ] **Step 2: Testy** (`tests/html.test.ts`, uruchamiają `npm run build:fixture`, czytają `dist/index.html`): `HTML nie zawiera sentinela opisu prywatnego repo`; `opis ze znacznikiem script jest escapowany (brak <script>alert)`; `kafelek prywatny nie zawiera linku github.com/danieljan777/`; `pusta sekcja zawiera komunikat zamiast pustego bloku`.
- [ ] **Step 3:** Run: `npx vitest run tests/html.test.ts` → Expected: FAIL.
- [ ] **Step 4:** Zaimplementować stronę. Wygląd: przed stylowaniem wywołać skill `frontend-design` (alternatywnie `ui-ux-pro-max`), jasny/ciemny motyw wg `prefers-color-scheme`, responsywnie, `<html lang="pl">`.
- [ ] **Step 5:** Run: `npx vitest run` → Expected: PASS. Ręcznie: `npm run build:data && npm run build && npx astro preview` i obejrzeć stronę (desktop + 375 px).
- [ ] **Step 6:** Commit `feat: portfolio page with public/private sections`. **Rollback:** `git revert HEAD`.

### Task 6: Workflow GitHub Actions + README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: skrypty `test`, `build:data`, `build`; secret `PORTFOLIO_TOKEN`.
- Produces: workflow z wyzwalaczami `schedule` (`17 3 * * *`), `workflow_dispatch`, `push` na `main`; uprawnienia `contents: read`, `pages: write`, `id-token: write`; kroki: `actions/checkout@v4`, `actions/setup-node@v4` (node 22, cache npm), `npm ci`, `npm test`, `npm run build:data` z `env: GH_TOKEN: ${{ secrets.PORTFOLIO_TOKEN }}`, `npm run build`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`; `concurrency: pages`.

- [ ] **Step 1:** Napisać workflow wg powyższego; `README.md` (PL): jak dodać projekt do `portfolio.yml`, jak ukryć, jak utworzyć PAT (fine-grained, tylko odczyt metadanych), jak włączyć Pages (Source: GitHub Actions), **uwaga:** GitHub wyłącza zaplanowane workflowy w repo publicznym po 60 dniach bez aktywności — wtedy ręczny „Run workflow" lub dowolny commit.
- [ ] **Step 2:** Walidacja składni: `npx --yes @action-validator/cli .github/workflows/deploy.yml` lub, gdy niedostępne, `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/deploy.yml'))"` → Expected: brak błędu.
- [ ] **Step 3:** Commit `ci: scheduled deploy to github pages`. **Rollback:** `git revert HEAD`.

### Task 7: Publikacja i weryfikacja end-to-end (kroki wymagające zgody użytkownika)

**Files:** brak zmian w kodzie.

- [ ] **Step 1 (pyta użytkownika):** zgoda na `gh repo create danieljan777/projekty-github --public --source . --push`. Przed wykonaniem pokazać `git ls-files` i `git log --oneline`; sprawdzić, że nic wrażliwego (`.env`, tokeny, `catalog.json`) nie jest śledzone.
- [ ] **Step 2 (robi użytkownik):** utworzyć fine-grained PAT i dodać secret `PORTFOLIO_TOKEN`; w ustawieniach Pages wybrać Source: GitHub Actions. Asystent nie dotyka tokena.
- [ ] **Step 3:** Run: `gh workflow run deploy.yml && gh run watch` → Expected: wszystkie kroki zielone.
- [ ] **Step 4:** Weryfikacja wycieku na żywej stronie: `curl -s https://danieljan777.github.io/projekty-github/ | grep -ci "<fragment z opisu prywatnego repo>"` → Expected: `0` (chyba że użytkownik świadomie wpisał to w `portfolio.yml`); strona pokazuje sekcję Prywatne z 8 − ukryte kafelkami.
- [ ] **Step 5:** Test „samo się dodaje": utworzyć tymczasowe prywatne repo, uruchomić workflow, sprawdzić kafelek, usunąć repo (usunięcie — za zgodą). **Rollback całości:** wyłączyć Pages w ustawieniach repo lub `gh repo delete` (tylko na wyraźne polecenie).

---

## Zmiana 2026-11-24: Task 5b (dodany po Task 5, zależny od akceptacji zmiany w specyfikacji)

### Task 5b: Szyfrowanie wygenerowanej strony hasłem

**Files:**
- Create: `scripts/encrypt-dist.ts`, `tests/encrypt.test.ts`
- Modify: `package.json` (dev dependency `staticrypt`, skrypt `build:secure`), `.gitignore` (`.env.local`)

**Interfaces:**
- Consumes: `dist/index.html` z `npm run build`; zmienne `PORTFOLIO_LOGIN` (domyślnie `daniel`) i `PORTFOLIO_PASSWORD` (wymagana; brak → błąd).
- Produces: `npm run build:secure` = `build` + zaszyfrowanie; `dist/index.html` zawiera tylko formularz logowania i blob.

- [ ] **Step 1: Testy:** `dist/index.html po szyfrowaniu nie zawiera sentinela ani nazw projektów`; `brak PORTFOLIO_PASSWORD przerywa skrypt`; `hasło krótsze niż 20 znaków jest odrzucone`.
- [ ] **Step 2:** Run: `npx vitest run tests/encrypt.test.ts` → Expected: FAIL.
- [ ] **Step 3:** Zaimplementować skrypt (wywołanie `staticrypt`, klucz z `login:hasło`, język formularza PL); wygenerować hasło lokalnie (`openssl rand -base64 24`) do `.env.local` z `chmod 600` — nie wypisywać go w terminalu ani w czacie.
- [ ] **Step 4:** Run: `npx vitest run` → Expected: PASS; ręcznie: otworzyć `dist/index.html` i potwierdzić, że bez hasła widać tylko formularz.
- [ ] **Step 5:** Commit `feat: password-protect built page`. **Rollback:** `git revert HEAD`.

Task 6 (workflow) po zmianie: krok budowania to `npm run build:secure`, z `PORTFOLIO_PASSWORD` z secretów.
