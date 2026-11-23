import type {
  Catalog,
  PortfolioConfig,
  PrivateProject,
  ProjectOverride,
  PublicProject,
  RawRepo,
} from './types.ts';

function byRecency(a: { pushedAt: string }, b: { pushedAt: string }): number {
  return b.pushedAt.localeCompare(a.pushedAt);
}

/** Repo publiczne: jawna allowlista pól (nigdy spread `...repo`). */
function toPublicProject(repo: RawRepo): PublicProject {
  return {
    visibility: 'public',
    name: repo.name,
    description: repo.description,
    language: repo.language,
    topics: repo.topics ?? [],
    homepage: repo.homepage,
    htmlUrl: repo.html_url,
    pushedAt: repo.pushed_at,
    archived: repo.archived,
  };
}

/**
 * Repo prywatne: to jedyne miejsce, w którym decydujemy, co z prywatnego
 * repozytorium trafia na publiczną stronę.
 */
function toPrivateProject(repo: RawRepo, override: ProjectOverride | undefined): PrivateProject {
  // Jawne przypisania (nigdy `...repo`): nowe pola API nie wyciekną domyślnie.
  // title/description/url pochodzą WYŁĄCZNIE z portfolio.yml, nie z GitHuba.
  return {
    visibility: 'private',
    name: repo.name,
    language: repo.language,
    pushedAt: repo.pushed_at,
    archived: repo.archived,
    title: override?.title,
    description: override?.description,
    url: override?.url,
  };
}

export function buildCatalog(raw: RawRepo[], config: PortfolioConfig): Catalog {
  const overrides = new Map<string, ProjectOverride>(
    Object.entries(config.projects).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const matched = new Set<string>();
  const publicProjects: PublicProject[] = [];
  const privateProjects: PrivateProject[] = [];
  let hidden = 0;

  for (const repo of raw) {
    const key = repo.name.toLowerCase();
    if (overrides.has(key)) matched.add(key);
    if (repo.fork) continue;

    const override = overrides.get(key);
    if (override?.hidden) {
      hidden += 1;
      continue;
    }

    if (repo.private) {
      privateProjects.push(toPrivateProject(repo, override));
    } else {
      publicProjects.push(toPublicProject(repo));
    }
  }

  publicProjects.sort(byRecency);
  privateProjects.sort(byRecency);

  return {
    public: publicProjects,
    private: privateProjects,
    counts: { public: publicProjects.length, private: privateProjects.length, hidden },
    unmatched: Object.keys(config.projects).filter((key) => !matched.has(key.toLowerCase())),
  };
}
