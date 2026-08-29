export type LogSectionIndex = {
  id: string;
  title: string;
  level: number;
  text: string;
};

export type LogSearchIndex = {
  version: 1;
  posts: Array<{
    slug: string;
    title: string;
    tags: string[];
    summary: string;
    sections: LogSectionIndex[];
  }>;
};

export type LogSearchMatch = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  matchedTokens: string[];
  route: string;
  matchingSections: Array<{
    id: string;
    title: string;
    excerpt: string;
    route: string;
  }>;
};

export type LogSearchResult = {
  query: string;
  tags: string[];
  total: number;
  matches: LogSearchMatch[];
};

export type LogListViewResult = LogSearchResult & {
  view: {
    route: string;
    query: string;
    tag: string | null;
    matchedSlugs: string[];
  };
};

export declare function searchPortfolioLogs(
  index: LogSearchIndex,
  input?: { query?: unknown; tags?: unknown; limit?: unknown },
): LogSearchResult;

export declare function createPortfolioLogListView(
  index: LogSearchIndex,
  input?: { query?: unknown; tags?: unknown; limit?: unknown },
): LogListViewResult;

export declare function getPortfolioLogOutline(
  index: LogSearchIndex,
  slug: unknown,
): Record<string, unknown>;

export declare function resolvePortfolioLogTarget(
  index: LogSearchIndex,
  slug: unknown,
  sectionId?: unknown,
): { slug: string; title: string; route: string; section: { id: string; title: string } | null };

export declare function findRelatedPortfolioLogs(
  index: LogSearchIndex,
  slug: unknown,
  input?: { limit?: unknown },
): Record<string, unknown>;
