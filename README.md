# Projekty — prywatne portfolio

Strona z listą wszystkich moich repozytoriów z GitHuba (`danieljan777`), podzieloną na **Publiczne** i **Prywatne**.
Nowe repozytoria pojawiają się same. Strona jest **zaszyfrowana hasłem**: publicznie widać tylko formularz.

## Jak to działa

1. `npm run build:data` pobiera repozytoria przez `gh api` i zapisuje tylko przefiltrowany `src/data/catalog.json`.
2. `npm run build` buduje statyczną stronę (Astro).
3. `npm run build:secure` buduje i szyfruje `dist/index.html` (AES-256, PBKDF2; `staticrypt`).
4. GitHub Actions robi to co dobę (03:17 UTC), po każdym pushu do `main` i na żądanie (Run workflow).

Prywatne repozytoria pokazują tylko nazwę, język i datę ostatniej zmiany. Opis, tytuł i link do dema pojawiają się
wyłącznie, jeśli dopiszesz wpis w `portfolio.yml`. Opisów z GitHuba dla prywatnych repozytoriów strona nie używa.

## Zarządzanie projektami (`portfolio.yml`)

Plik jest publiczny (repozytorium strony jest publiczne) — nie wpisuj tam nic wrażliwego.

```yaml
projects:
  nazwa-repozytorium:       # klucz = nazwa repo (wielkość liter bez znaczenia)
    title: "Publiczny tytuł"
    description: "Krótki, bezpieczny opis."
    url: "https://demo.example"   # tylko http(s)
  inne-repo:
    hidden: true            # ukrywa projekt całkowicie
```

Build ostrzega o kluczach bez pasującego repozytorium (np. po zmianie nazwy repo — wtedy `hidden` przestaje działać).

## Konfiguracja jednorazowa

1. **Token (odczyt repozytoriów).** Na GitHubie utwórz *fine-grained personal access token*: dostęp do *All repositories*,
   uprawnienie *Metadata: Read-only*. Dodaj go jako secret (wartość wpiszesz w ukrytym polu):

   ```bash
   gh secret set PORTFOLIO_TOKEN --repo danieljan777/projekty-github
   ```

2. **Hasło strony.** Lokalnie leży w `.env.local` (gitignored, `chmod 600`). Przekaż je do Actions bez wypisywania:

   ```bash
   grep '^PORTFOLIO_PASSWORD=' .env.local | cut -d= -f2- | tr -d '\n' | gh secret set PORTFOLIO_PASSWORD --repo danieljan777/projekty-github
   ```

3. W ustawieniach repozytorium: **Settings → Pages → Source: GitHub Actions**.

## Lokalnie

```bash
npm run build:data && npm run build:secure && npx astro preview
```

Hasło do odblokowania to zawartość `PORTFOLIO_PASSWORD` w `.env.local`. Testy: `npm test`.

## Ograniczenia

- Strona jest statyczna, więc nie ma limitu prób logowania — ochronę zapewnia wyłącznie siła hasła (32 losowe znaki).
- GitHub wyłącza zaplanowane workflowy w publicznym repozytorium po 60 dniach bez aktywności. Wtedy uruchom
  ręcznie „Run workflow" albo zrób dowolny commit.
- Token PAT wygasa (maks. 1 rok) — odnów go i zaktualizuj secret.
- Astro jest przypięte do 7.4.1 (nowsze wymagają Node ≥ 22.23.4); po aktualizacji Node podbij wersję.
