import { execFileSync } from 'node:child_process';
import type { RawRepo } from './types.ts';

export type GhRunner = (args: string[]) => string;

const defaultRun: GhRunner = (args) =>
  execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * Pobiera repozytoria właściciela. gh 2.46 nie ma `--slurp`, więc `--jq '.[]'`
 * daje po jednym obiekcie JSON w linii niezależnie od liczby stron.
 */
export function fetchRawRepos(run: GhRunner = defaultRun): RawRepo[] {
  const output = run(['api', '--paginate', '--jq', '.[]', '/user/repos?affiliation=owner&per_page=100']);
  return output
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as RawRepo);
}

export function assertSane(raw: RawRepo[]): void {
  if (raw.length === 0) {
    throw new Error('GitHub API zwróciło 0 repozytoriów — sprawdź token (PORTFOLIO_TOKEN) i uprawnienia. Nie publikuję pustej strony.');
  }
}
