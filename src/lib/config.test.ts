import { describe, expect, test } from 'vitest';
import { parseConfig } from './config.ts';

const valid = `
site:
  title: "Moje projekty"
  tagline: "Opis"
projects:
  locky-web:
    title: "Locky"
    description: "Strona"
    url: "https://locky-web.vercel.app"
  test1:
    hidden: true
`;

describe('parseConfig', () => {
  test('poprawny YAML zwraca site i projects', () => {
    const config = parseConfig(valid);
    expect(config.site).toEqual({ title: 'Moje projekty', tagline: 'Opis' });
    expect(config.projects['locky-web']).toEqual({
      title: 'Locky',
      description: 'Strona',
      url: 'https://locky-web.vercel.app',
    });
    expect(config.projects.test1).toEqual({ hidden: true });
  });

  test('brak site.title rzuca błąd', () => {
    expect(() => parseConfig('site: {}\nprojects: {}')).toThrow(/site\.title/);
  });

  test('url z javascript: lub ftp: rzuca błąd, https:// przechodzi', () => {
    const withUrl = (url: string) => `site:\n  title: T\nprojects:\n  a:\n    url: "${url}"`;
    expect(() => parseConfig(withUrl('javascript:alert(1)'))).toThrow(/url/);
    expect(() => parseConfig(withUrl('ftp://x.example'))).toThrow(/url/);
    expect(parseConfig(withUrl('https://ok.example')).projects.a.url).toBe('https://ok.example');
  });

  test('puste "projects" daje {}', () => {
    expect(parseConfig('site:\n  title: T\nprojects:\n').projects).toEqual({});
    expect(parseConfig('site:\n  title: T\n').projects).toEqual({});
  });

  test('nieznane pole w projekcie rzuca błąd', () => {
    expect(() => parseConfig('site:\n  title: T\nprojects:\n  a:\n    hiden: true')).toThrow(/hiden/);
  });
});
