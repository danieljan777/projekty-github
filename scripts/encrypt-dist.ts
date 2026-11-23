import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_PASSWORD_LENGTH = 20;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Lokalnie hasło leży w .env.local (gitignored); w CI pochodzi z secretu Actions.
const envFile = process.env.PORTFOLIO_ENV_FILE ?? join(root, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const password = process.env.PORTFOLIO_PASSWORD ?? '';
if (password === '') {
  console.error('Brak PORTFOLIO_PASSWORD: ustaw zmienną środowiskową albo plik .env.local. Nie publikuję strony bez hasła.');
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`PORTFOLIO_PASSWORD jest za krótkie: wymagane co najmniej ${MIN_PASSWORD_LENGTH} znaków.`);
  process.exit(1);
}

const page = join(root, 'dist/index.html');
if (!existsSync(page)) {
  console.error('Brak dist/index.html — najpierw uruchom `npm run build`.');
  process.exit(1);
}

const out = mkdtempSync(join(tmpdir(), 'portfolio-encrypted-'));
const bin = join(root, 'node_modules/.bin/staticrypt');

// Hasło przekazujemy przez środowisko (STATICRYPT_PASSWORD), nie przez argv, żeby nie wyciekło do listy procesów.
execFileSync(
  bin,
  [
    page,
    '-c', 'false',
    '-s', randomBytes(16).toString('hex'),
    '-d', out,
    '--remember', 'false',
    '--template-title', 'Dostęp prywatny',
    '--template-instructions', 'Ta lista jest tylko dla właściciela. Podaj hasło, aby ją odblokować.',
    '--template-placeholder', 'Hasło',
    '--template-button', 'Odblokuj',
    '--template-error', 'Nieprawidłowe hasło.',
    '--template-toggle-show', 'Pokaż hasło',
    '--template-toggle-hide', 'Ukryj hasło',
    '--template-color-primary', '#1D6FA5',
    '--template-color-secondary', '#E9EEF2',
  ],
  { env: { ...process.env, STATICRYPT_PASSWORD: password }, stdio: ['ignore', 'pipe', 'inherit'] },
);

// Szablon staticrypt nie ustawia języka dokumentu — dopisujemy go (czytniki ekranu, poprawna wymowa).
const encrypted = readFileSync(join(out, 'index.html'), 'utf8').replace('<html class=', '<html lang="pl" class=');
writeFileSync(page, encrypted);
console.log('dist/index.html zaszyfrowany (AES-256, PBKDF2) — publiczny jest tylko formularz hasła.');
