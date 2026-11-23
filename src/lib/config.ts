import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { PortfolioConfig, ProjectOverride } from './types.ts';

const ALLOWED_KEYS = new Set(['hidden', 'title', 'description', 'url']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOverride(name: string, value: unknown): ProjectOverride {
  if (!isRecord(value)) throw new Error(`projects.${name}: oczekiwano obiektu`);
  for (const key of Object.keys(value)) {
    if (!ALLOWED_KEYS.has(key)) throw new Error(`projects.${name}: nieznane pole "${key}"`);
  }
  const override: ProjectOverride = {};
  if (value.hidden !== undefined) {
    if (typeof value.hidden !== 'boolean') throw new Error(`projects.${name}.hidden: oczekiwano true/false`);
    override.hidden = value.hidden;
  }
  for (const key of ['title', 'description'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string') throw new Error(`projects.${name}.${key}: oczekiwano tekstu`);
      override[key] = value[key];
    }
  }
  if (value.url !== undefined) {
    if (typeof value.url !== 'string' || !/^https?:\/\//i.test(value.url)) {
      throw new Error(`projects.${name}.url: dozwolone tylko adresy http:// lub https://`);
    }
    override.url = value.url;
  }
  return override;
}

export function parseConfig(yamlText: string): PortfolioConfig {
  const doc: unknown = parse(yamlText);
  if (!isRecord(doc)) throw new Error('portfolio.yml: oczekiwano obiektu najwyższego poziomu');

  const site = doc.site;
  if (!isRecord(site) || typeof site.title !== 'string' || site.title.trim() === '') {
    throw new Error('portfolio.yml: wymagane pole site.title (niepusty tekst)');
  }
  if (site.tagline !== undefined && typeof site.tagline !== 'string') {
    throw new Error('portfolio.yml: site.tagline musi być tekstem');
  }

  const rawProjects = doc.projects ?? {};
  if (!isRecord(rawProjects)) throw new Error('portfolio.yml: projects musi być obiektem');
  const projects: Record<string, ProjectOverride> = {};
  for (const [name, value] of Object.entries(rawProjects)) {
    projects[name] = parseOverride(name, value ?? {});
  }

  return { site: { title: site.title, ...(site.tagline ? { tagline: site.tagline } : {}) }, projects };
}

export function loadConfig(path: string): PortfolioConfig {
  return parseConfig(readFileSync(path, 'utf8'));
}
