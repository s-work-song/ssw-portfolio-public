import type { LogSearchResponse } from '@/lib/logApi';

export type LogListViewResult = LogSearchResponse & {
  view: {
    route: '/about-me/log#log-entries-heading';
    query: string;
    tag: string | null;
    matchedSlugs: string[];
  };
};

export declare function createLogListView(result: LogSearchResponse): LogListViewResult;
