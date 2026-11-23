import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { buildCatalog } from '../src/lib/catalog.ts';
import type { CatalogFile, PortfolioConfig, RawRepo } from '../src/lib/types.ts';

const root = join(import.meta.dirname, '..');
const PASSWORD = 'test-haslo-do-sprawdzenia-1234567890';
const config: PortfolioConfig = { site: { title: 'Unikalny tytul strony' }, projects: {} };

const repo: RawRepo = {
  name: 'unique-proj-name',
  private: true,
  fork: false,
  archived: false,
  description: 'SECRET-DESC',
  language: 'TypeScript',
  topics: [],
  homepage: null,
  html_url: 'https://github.com/danieljan777/unique-proj-name',
  pushed_at: '2026-11-01T10:00:00Z',
};

function runEncrypt(env: Record<string, string>) {
  return spawnSync('node', ['scripts/encrypt-dist.ts'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PORTFOLIO_ENV_FILE: '/nonexistent/.env', ...env },
  });
}

describe('szyfrowanie dist', () => {
  beforeAll(() => {
    const catalog = buildCatalog([repo], config);
    const file: CatalogFile = { ...catalog, site: config.site };
    const path = join(mkdtempSync(join(tmpdir(), 'portfolio-enc-')), 'catalog.json');
    writeFileSync(path, JSON.stringify(file));
    execSync('npx astro build', { cwd: root, env: { ...process.env, CATALOG_PATH: path }, stdio: 'pipe' });
  }, 60_000);

  test('brak PORTFOLIO_PASSWORD przerywa skrypt', () => {
    const result = runEncrypt({ PORTFOLIO_PASSWORD: '' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('PORTFOLIO_PASSWORD');
  });

  test('hasło krótsze niż 20 znaków jest odrzucone', () => {
    const result = runEncrypt({ PORTFOLIO_PASSWORD: 'krotkie-haslo' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('20');
  });

  test('po szyfrowaniu dist/index.html nie zawiera nazw projektów ani tytułu, ma formularz hasła', () => {
    const result = runEncrypt({ PORTFOLIO_PASSWORD: PASSWORD });
    expect(result.status, result.stderr).toBe(0);
    const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
    for (const secret of ['unique-proj-name', 'Unikalny tytul strony', 'Prywatne', 'SECRET-DESC']) {
      expect(html).not.toContain(secret);
    }
    expect(html).toContain('type="password"');
    expect(html).toContain('lang="pl"');
  }, 60_000);

  test('poprawne hasło odszyfrowuje stronę z powrotem', () => {
    const out = mkdtempSync(join(tmpdir(), 'portfolio-dec-'));
    const html = readFileSync(join(root, 'dist/index.html'), 'utf8');
    const salt = html.match(/"staticryptSaltUniqueVariableName":"([0-9a-f]{32})"/)?.[1];
    expect(salt).toBeDefined();
    execSync(`npx staticrypt dist/index.html --decrypt -p '${PASSWORD}' -s '${salt}' -d '${out}' -c false`, {
      cwd: root,
      stdio: 'pipe',
    });
    const decrypted = readFileSync(join(out, 'index.html'), 'utf8');
    expect(decrypted).toContain('unique-proj-name');
    expect(decrypted).toContain('Unikalny tytul strony');
  }, 60_000);
});
