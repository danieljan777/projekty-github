import { describe, expect, test } from 'vitest';
import { assertSane, fetchRawRepos } from './github.ts';

const a = { name: 'a', private: true, pushed_at: '2026-01-01T00:00:00Z' };
const b = { name: 'b', private: false, pushed_at: '2026-02-01T00:00:00Z' };

describe('fetchRawRepos', () => {
  test('parsuje wyjście wielu stron jako JSON-per-linia', () => {
    const run = () => `${JSON.stringify(a)}\n${JSON.stringify(b)}\n\n`;
    const repos = fetchRawRepos(run);
    expect(repos.map((r) => r.name)).toEqual(['a', 'b']);
  });

  test('wywołuje gh api z paginacją i affiliation=owner', () => {
    let seen: string[] = [];
    fetchRawRepos((args) => {
      seen = args;
      return '';
    });
    expect(seen.slice(0, 2)).toEqual(['api', '--paginate']);
    expect(seen.join(' ')).toContain('affiliation=owner');
  });

  test('błąd polecenia gh propaguje wyjątek', () => {
    const run = () => {
      throw new Error('gh: HTTP 401');
    };
    expect(() => fetchRawRepos(run)).toThrow(/401/);
  });
});

describe('assertSane', () => {
  test('rzuca dla pustej listy', () => {
    expect(() => assertSane([])).toThrow(/0 repozytori/);
  });

  test('przepuszcza niepustą listę', () => {
    expect(() => assertSane([a as never])).not.toThrow();
  });
});
