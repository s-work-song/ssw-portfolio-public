/**
 * logViewContract.mjs의 타입 선언이다.
 *
 * 구현을 .mjs로 두어 브라우저와 도구 쪽에서 그대로 불러 쓰되, 타입은 이 파일이
 * 채워 준다. 두 파일이 어긋나면 컴파일러가 잡아 주지 못하니 함께 고쳐야 한다.
 */
import type { LogSearchResponse } from '@/lib/logApi';

/**
 * 원본 검색 결과에 화면용 view를 덧붙인 형태다.
 *
 * 도구 호출자는 원본 필드를, 목록 화면은 view만 본다. route는 이동 대상이
 * 고정이라 리터럴 타입으로 못 박아 다른 경로가 섞여 들어오지 못하게 했다.
 */
export type LogListViewResult = LogSearchResponse & {
  view: {
    route: '/about-me/log#log-entries-heading';
    query: string;
    tag: string | null;
    matchedSlugs: string[];
  };
};

/** 검색 결과를 목록 화면 상태로 좁힌다. 구현과 자세한 규칙은 logViewContract.mjs에 있다. */
export declare function createLogListView(result: LogSearchResponse): LogListViewResult;
