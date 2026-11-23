import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from '../src/lib/catalog.ts';
import { loadConfig } from '../src/lib/config.ts';
import { assertSane, fetchRawRepos } from '../src/lib/github.ts';
import type { CatalogFile } from '../src/lib/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const config = loadConfig(resolve(root, 'portfolio.yml'));
const raw = fetchRawRepos();
assertSane(raw);

const catalog = buildCatalog(raw, config);
const file: CatalogFile = { ...catalog, site: config.site };

const out = resolve(root, 'src/data/catalog.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(file, null, 2) + '\n');

// W logach wyłącznie liczby i klucze z (publicznego) portfolio.yml.
console.log(`catalog: public=${catalog.counts.public} private=${catalog.counts.private} hidden=${catalog.counts.hidden}`);
if (catalog.unmatched.length > 0) {
  console.warn(`UWAGA: wpisy w portfolio.yml bez pasującego repozytorium: ${catalog.unmatched.join(', ')}`);
}
