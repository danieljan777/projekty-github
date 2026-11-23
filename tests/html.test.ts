import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildCatalog } from '../src/lib/catalog.ts';
import type { CatalogFile, PortfolioConfig, RawRepo } from '../src/lib/types.ts';

const root = join(import.meta.dirname, '..');
const config: PortfolioConfig = { site: { title: 'Test portfolio' }, projects: {} };

function repo(over: Partial<RawRepo>): RawRepo {
  return {
    name: 'secret-app',
    private: true,
    fork: false,
    archived: false,
    description: 'SECRET-DESC klient Acme',
    language: 'TypeScript',
    topics: ['secret-topic'],
    homepage: 'https://secret.example',
    html_url: 'https://github.com/danieljan777/secret-app',
    pushed_at: '2026-11-01T10:00:00Z',
    ...over,
  };
}

/** Pełna ścieżka: surowe repo -> buildCatalog -> katalog -> build Astro -> HTML. */
function render(raw: RawRepo[]): string {
  const catalog = buildCatalog(raw, config);
  const file: CatalogFile = { ...catalog, site: config.site };
  const path = join(mkdtempSync(join(tmpdir(), 'portfolio-')), 'catalog.json');
  writeFileSync(path, JSON.stringify(file));
  execSync('npx astro build', { cwd: root, env: { ...process.env, CATALOG_PATH: path }, stdio: 'pipe' });
  return readFileSync(join(root, 'dist/index.html'), 'utf8');
}

describe('wygenerowana strona', () => {
  test('HTML nie zawiera sentinela opisu prywatnego repo ani linku do repo', () => {
    const html = render([repo({})]);
    expect(html).toContain('secret-app');
    expect(html).toContain('Prywatne');
    for (const secret of ['SECRET-DESC', 'secret-topic', 'secret.example', 'github.com/danieljan777']) {
      expect(html).not.toContain(secret);
    }
  }, 60_000);

  test('opis ze znacznikiem script jest escapowany, a null nie trafia na stronę', () => {
    const html = render([
      repo({ name: 'open', private: false, description: '<script>alert(1)</script>' }),
      repo({ name: 'bare', private: false, description: null, language: null }),
    ]);
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;alert(1)');
    expect(html).toContain('github.com/danieljan777/secret-app');
    expect(html).not.toMatch(/>\s*null\s*</);
  }, 60_000);

  test('pusta sekcja zawiera komunikat zamiast pustego bloku', () => {
    const html = render([repo({})]);
    expect(html).toContain('Publiczne (0)');
    expect(html).toContain('Brak publicznych projektów');
    expect(html).toContain('lang="pl"');
  }, 60_000);
});
