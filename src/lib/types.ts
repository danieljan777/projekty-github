/** Pola odpowiedzi GitHub API `/user/repos`, których używamy. */
export interface RawRepo {
  name: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  description: string | null;
  language: string | null;
  topics?: string[];
  homepage: string | null;
  html_url: string;
  pushed_at: string;
  [key: string]: unknown;
}

export interface ProjectOverride {
  hidden?: boolean;
  title?: string;
  description?: string;
  url?: string;
}

export interface PortfolioConfig {
  site: { title: string; tagline?: string };
  projects: Record<string, ProjectOverride>;
}

export interface PublicProject {
  visibility: 'public';
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  homepage: string | null;
  htmlUrl: string;
  pushedAt: string;
  archived: boolean;
}

export interface PrivateProject {
  visibility: 'private';
  name: string;
  language: string | null;
  pushedAt: string;
  archived: boolean;
  title?: string;
  description?: string;
  url?: string;
}

export interface Catalog {
  public: PublicProject[];
  private: PrivateProject[];
  counts: { public: number; private: number; hidden: number };
  unmatched: string[];
}

/** Zawartość src/data/catalog.json: katalog + dane strony z portfolio.yml. */
export interface CatalogFile extends Catalog {
  site: PortfolioConfig['site'];
}
