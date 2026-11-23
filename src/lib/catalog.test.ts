import { describe, expect, test } from 'vitest';
import { buildCatalog } from './catalog.ts';
import type { PortfolioConfig, RawRepo } from './types.ts';

const SECRET_DESC = 'SECRET-DESC klient Acme sp. z o.o.';

function repo(over: Partial<RawRepo> = {}): RawRepo {
  return {
    name: 'secret-app',
    private: true,
    fork: false,
    archived: false,
    description: SECRET_DESC,
    language: 'TypeScript',
    topics: ['secret-topic'],
    homepage: 'https://secret.example',
    html_url: 'https://github.com/danieljan777/secret-app',
    pushed_at: '2026-11-01T10:00:00Z',
    ...over,
  };
}

function config(projects: PortfolioConfig['projects'] = {}): PortfolioConfig {
  return { site: { title: 'T' }, projects };
}

describe('buildCatalog', () => {
  test('prywatne repo bez wpisu w YAML: wynik nie zawiera description, topics, homepage ani html_url', () => {
    const catalog = buildCatalog([repo()], config());
    const json = JSON.stringify(catalog);
    for (const secret of ['SECRET-DESC', 'secret-topic', 'secret.example', 'github.com']) {
      expect(json).not.toContain(secret);
    }
    expect(catalog.private[0]).toEqual({
      visibility: 'private',
      name: 'secret-app',
      language: 'TypeScript',
      pushedAt: '2026-11-01T10:00:00Z',
      archived: false,
    });
  });

  test('prywatne repo z wpisem: title/description/url pochodzą z YAML, nie z GitHuba', () => {
    const catalog = buildCatalog(
      [repo()],
      config({
        'secret-app': { title: 'Publiczny tytuł', description: 'Publiczny opis', url: 'https://demo.example' },
      }),
    );
    expect(catalog.private[0]).toMatchObject({
      title: 'Publiczny tytuł',
      description: 'Publiczny opis',
      url: 'https://demo.example',
    });
    expect(JSON.stringify(catalog)).not.toContain('SECRET-DESC');
  });

  test('hidden: true usuwa projekt (publiczny i prywatny) i zwiększa counts.hidden', () => {
    const catalog = buildCatalog(
      [repo({ name: 'a' }), repo({ name: 'b', private: false })],
      config({ a: { hidden: true }, b: { hidden: true } }),
    );
    expect(catalog.private).toHaveLength(0);
    expect(catalog.public).toHaveLength(0);
    expect(catalog.counts).toEqual({ public: 0, private: 0, hidden: 2 });
  });

  test('publiczne repo ignoruje title/description/url z YAML', () => {
    const catalog = buildCatalog(
      [repo({ name: 'open', private: false, description: 'Z GitHuba' })],
      config({ open: { title: 'Inny', description: 'Z YAML', url: 'https://x.example' } }),
    );
    expect(catalog.public[0]).toEqual({
      visibility: 'public',
      name: 'open',
      description: 'Z GitHuba',
      language: 'TypeScript',
      topics: ['secret-topic'],
      homepage: 'https://secret.example',
      htmlUrl: 'https://github.com/danieljan777/secret-app',
      pushedAt: '2026-11-01T10:00:00Z',
      archived: false,
    });
  });

  test('forki pomijane, archiwalne mają archived: true, sortowanie pushedAt malejąco', () => {
    const catalog = buildCatalog(
      [
        repo({ name: 'old', pushed_at: '2025-01-01T00:00:00Z', archived: true }),
        repo({ name: 'forked', fork: true }),
        repo({ name: 'new', pushed_at: '2026-06-01T00:00:00Z' }),
      ],
      config(),
    );
    expect(catalog.private.map((p) => p.name)).toEqual(['new', 'old']);
    expect(catalog.private[1].archived).toBe(true);
    expect(catalog.counts.private).toBe(2);
  });

  test('klucze YAML dopasowywane bez rozróżniania wielkości liter', () => {
    const catalog = buildCatalog([repo({ name: 'Secret-App' })], config({ 'secret-app': { hidden: true } }));
    expect(catalog.private).toHaveLength(0);
    expect(catalog.unmatched).toEqual([]);
  });

  test('klucz YAML bez repo trafia do unmatched', () => {
    const catalog = buildCatalog([repo()], config({ 'secret-app': { hidden: true }, 'stara-nazwa': { hidden: true } }));
    expect(catalog.unmatched).toEqual(['stara-nazwa']);
  });

  test('publiczne repo z description: null i language: null przechodzi bez błędu', () => {
    const catalog = buildCatalog(
      [repo({ private: false, description: null, language: null, topics: undefined, homepage: null })],
      config(),
    );
    expect(catalog.public[0]).toMatchObject({ description: null, language: null, topics: [], homepage: null });
  });
});
