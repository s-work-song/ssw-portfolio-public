"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "./page.module.css";

const SESSION_TOKEN_KEY = "ssw-portfolio:admin-usage-token";

type RangeDays = 7 | 30;
type ViewState =
  | "restoring"
  | "locked"
  | "loading"
  | "ready"
  | "empty"
  | "unauthorized"
  | "configuration-error"
  | "storage-error"
  | "error";

interface DailyUsage {
  day: string;
  requests: number;
  jsonRequests: number;
  streamRequests: number;
  approximateUniqueIps: number;
}

interface IpUsage {
  id: string;
  requests: number;
  jsonRequests: number;
  streamRequests: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

interface UsageResponse {
  rangeDays: RangeDays;
  totalRequests: number;
  jsonRequests: number;
  streamRequests: number;
  approximateUniqueIps: number;
  daily: DailyUsage[];
  byIp: IpUsage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseUsageResponse(value: unknown): UsageResponse | null {
  if (
    !isRecord(value) ||
    (value.rangeDays !== 7 && value.rangeDays !== 30) ||
    !isNonNegativeInteger(value.totalRequests) ||
    !isNonNegativeInteger(value.jsonRequests) ||
    !isNonNegativeInteger(value.streamRequests) ||
    !isNonNegativeInteger(value.approximateUniqueIps) ||
    !Array.isArray(value.daily) ||
    !Array.isArray(value.byIp)
  ) {
    return null;
  }

  const daily = value.daily.filter(
    (item): item is DailyUsage =>
      isRecord(item) &&
      typeof item.day === "string" &&
      /^\d{4}-\d{2}-\d{2}$/u.test(item.day) &&
      isNonNegativeInteger(item.requests) &&
      isNonNegativeInteger(item.jsonRequests) &&
      isNonNegativeInteger(item.streamRequests) &&
      isNonNegativeInteger(item.approximateUniqueIps),
  );
  const byIp = value.byIp.filter(
    (item): item is IpUsage =>
      isRecord(item) &&
      typeof item.id === "string" &&
      item.id.length > 0 &&
      typeof item.firstSeenAt === "string" &&
      typeof item.lastSeenAt === "string" &&
      isNonNegativeInteger(item.requests) &&
      isNonNegativeInteger(item.jsonRequests) &&
      isNonNegativeInteger(item.streamRequests),
  );

  if (daily.length !== value.daily.length || byIp.length !== value.byIp.length) {
    return null;
  }

  return {
    rangeDays: value.rangeDays,
    totalRequests: value.totalRequests,
    jsonRequests: value.jsonRequests,
    streamRequests: value.streamRequests,
    approximateUniqueIps: value.approximateUniqueIps,
    daily,
    byIp,
  };
}

function apiUrl(days: RangeDays): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_RAG_API_BASE_URL?.trim();
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/u, "")}/api/admin/chat-usage?days=${days}`;
}

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(parsed);
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function UsagePage() {
  const [days, setDays] = useState<RangeDays>(7);
  const [tokenInput, setTokenInput] = useState("");
  const [activeToken, setActiveToken] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [viewState, setViewState] = useState<ViewState>("restoring");
  const [data, setData] = useState<UsageResponse | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY)?.trim();
        if (storedToken) {
          setTokenInput(storedToken);
          setActiveToken(storedToken);
        } else {
          setViewState("locked");
        }
      } catch {
        setViewState("storage-error");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!activeToken) return;

    const controller = new AbortController();

    const load = async () => {
      const endpoint = apiUrl(days);
      if (!endpoint) {
        setData(null);
        setViewState("configuration-error");
        return;
      }

      setData(null);
      setViewState("loading");

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${activeToken}`,
          },
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setViewState("error");
        return;
      }

      if (response.status === 401 || response.status === 403) {
        try {
          window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
        } catch {
          // 이미 화면 데이터가 제거되므로 저장소 정리 실패를 별도로 노출하지 않는다.
        }
        setData(null);
        setTokenInput("");
        setActiveToken("");
        setViewState("unauthorized");
        return;
      }

      if (!response.ok) {
        setViewState("error");
        return;
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setViewState("error");
        return;
      }

      const parsed = parseUsageResponse(payload);
      if (!parsed || parsed.rangeDays !== days) {
        setViewState("error");
        return;
      }

      setData(parsed);
      setViewState(parsed.totalRequests === 0 ? "empty" : "ready");
    };

    void load();
    return () => controller.abort();
  }, [activeToken, days, reloadKey]);

  const maxDailyRequests = useMemo(
    () => Math.max(1, ...(data?.daily.map((item) => item.requests) ?? [])),
    [data],
  );

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    if (!nextToken) {
      setViewState("locked");
      return;
    }

    try {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, nextToken);
    } catch {
      setData(null);
      setViewState("storage-error");
      return;
    }

    setActiveToken(nextToken);
    setReloadKey((current) => current + 1);
  };

  const handleLock = () => {
    try {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      // 메모리의 토큰과 화면 데이터는 아래에서 즉시 제거한다.
    }
    setActiveToken("");
    setTokenInput("");
    setData(null);
    setViewState("locked");
  };

  const hasActiveSession = activeToken.length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/settings" className={styles.backLink}>
            <span className={styles.backIcon} aria-hidden="true">←</span>
            사이트 설정
          </Link>
          <span className={styles.eyebrow}>USAGE</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.kicker}>PRIVATE OPERATIONS</p>
            <h1>챗봇 운영 통계</h1>
            <p className={styles.intro}>
              원본 IP 대신 익명화한 키로 요청량과 대략적인 접속 원천을 확인합니다.
              관리자 토큰은 현재 탭 세션에만 저장합니다.
            </p>
          </div>
          {hasActiveSession && (
            <button type="button" className={styles.lockButton} onClick={handleLock}>
              잠그기
            </button>
          )}
        </div>

        {!hasActiveSession && viewState !== "restoring" && (
          <section className={styles.unlockCard} aria-labelledby="unlock-title">
            <div className={styles.lockMark} aria-hidden="true">⌁</div>
            <div className={styles.unlockCopy}>
              <h2 id="unlock-title">관리자 인증</h2>
              <p>
                토큰은 이 탭의 세션 저장소(sessionStorage)에만 보관되며,
                주소나 영구 저장소에는 남기지 않습니다.
              </p>
            </div>
            <form className={styles.tokenForm} onSubmit={handleUnlock}>
              <label htmlFor="usage-admin-token">관리자 토큰</label>
              <div className={styles.tokenRow}>
                <input
                  id="usage-admin-token"
                  name="usage-admin-token"
                  type="password"
                  autoComplete="off"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder="Bearer 토큰 입력"
                  aria-describedby="token-help"
                  required
                />
                <button type="submit">통계 열기</button>
              </div>
              <p id="token-help" className={styles.formHelp}>
                토큰 값만 입력하세요. <span aria-hidden="true">Bearer</span> 접두사는 자동으로 붙습니다.
              </p>
            </form>
          </section>
        )}

        <div className={styles.statusRegion} aria-live="polite" aria-atomic="true">
          {viewState === "restoring" && (
            <div className={styles.stateCard}>현재 탭의 인증 상태를 확인하고 있습니다.</div>
          )}
          {viewState === "loading" && (
            <div className={styles.stateCard}>
              <span className={styles.spinner} aria-hidden="true" />
              운영 통계를 불러오고 있습니다.
            </div>
          )}
          {viewState === "unauthorized" && (
            <div className={`${styles.stateCard} ${styles.errorCard}`} role="alert">
              인증이 만료되었거나 올바르지 않습니다. 관리자 토큰을 다시 입력해 주세요.
            </div>
          )}
          {viewState === "configuration-error" && (
            <div className={`${styles.stateCard} ${styles.errorCard}`} role="alert">
              운영 API 주소가 설정되지 않았습니다. 사이트 관리자에게 확인해 주세요.
            </div>
          )}
          {viewState === "storage-error" && (
            <div className={`${styles.stateCard} ${styles.errorCard}`} role="alert">
              현재 브라우저에서 세션 저장소를 사용할 수 없어 토큰을 안전하게 보관할 수 없습니다.
            </div>
          )}
          {viewState === "error" && hasActiveSession && (
            <div className={`${styles.stateCard} ${styles.errorCard}`} role="alert">
              <span>운영 통계를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.</span>
              <button type="button" onClick={() => setReloadKey((current) => current + 1)}>
                다시 시도
              </button>
            </div>
          )}
        </div>

        {hasActiveSession && viewState !== "configuration-error" && (
          <section className={styles.rangeBar} aria-labelledby="range-title">
            <div>
              <h2 id="range-title">조회 기간</h2>
              <p>기간을 바꾸면 최신 통계를 다시 요청합니다.</p>
            </div>
            <div className={styles.rangeButtons} role="group" aria-label="조회 기간 선택">
              {([7, 30] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={days === option}
                  className={days === option ? styles.activeRange : undefined}
                  onClick={() => setDays(option)}
                  disabled={viewState === "loading"}
                >
                  {option}일
                </button>
              ))}
            </div>
          </section>
        )}

        {data && (viewState === "ready" || viewState === "empty") && (
          <div className={styles.dashboard}>
            <section className={styles.summaryGrid} aria-label={`${data.rangeDays}일 사용량 요약`}>
              <article className={styles.summaryCard}>
                <span>전체 요청</span>
                <strong>{data.totalRequests.toLocaleString("ko-KR")}</strong>
                <small>최근 {data.rangeDays}일</small>
              </article>
              <article className={styles.summaryCard}>
                <span>스트리밍 요청</span>
                <strong>{data.streamRequests.toLocaleString("ko-KR")}</strong>
                <small>SSE 경로</small>
              </article>
              <article className={styles.summaryCard}>
                <span>일반 요청</span>
                <strong>{data.jsonRequests.toLocaleString("ko-KR")}</strong>
                <small>JSON 경로</small>
              </article>
              <article className={styles.summaryCard}>
                <span>대략적인 접속 원천</span>
                <strong>{data.approximateUniqueIps.toLocaleString("ko-KR")}</strong>
                <small>IP 기준</small>
              </article>
            </section>

            {viewState === "empty" ? (
              <section className={styles.emptyCard}>
                <span aria-hidden="true">—</span>
                <h2>아직 집계된 요청이 없습니다</h2>
                <p>선택한 {data.rangeDays}일 동안 기록된 챗봇 요청이 없습니다.</p>
              </section>
            ) : (
              <>
                <section className={styles.panel} aria-labelledby="daily-title">
                  <div className={styles.panelHeading}>
                    <div>
                      <h2 id="daily-title">일별 요청</h2>
                      <p>막대에 포커스하면 날짜별 요청과 IP 기준 접속 원천 수를 확인할 수 있습니다.</p>
                    </div>
                    <span>{data.rangeDays} DAYS</span>
                  </div>
                  <figure className={styles.chart} aria-labelledby="daily-title">
                    <ul className={styles.bars}>
                      {data.daily.map((item, index) => {
                        const height = `${Math.max(4, (item.requests / maxDailyRequests) * 100)}%`;
                        const showLabel = data.rangeDays === 7 || index % 5 === 0 || index === data.daily.length - 1;
                        return (
                          <li key={item.day} className={styles.barItem}>
                            <span
                              className={styles.barValue}
                              tabIndex={0}
                              aria-label={`${item.day}, 요청 ${item.requests}건, IP 기준 접속 원천 ${item.approximateUniqueIps}개`}
                              style={{ height }}
                            >
                              <span>{item.requests}</span>
                            </span>
                            <time
                              dateTime={item.day}
                              aria-hidden="true"
                              className={showLabel ? undefined : styles.hiddenDate}
                            >
                              {formatDay(item.day)}
                            </time>
                          </li>
                        );
                      })}
                    </ul>
                  </figure>
                </section>

                <section className={styles.panel} aria-labelledby="visitor-title">
                  <div className={styles.panelHeading}>
                    <div>
                      <h2 id="visitor-title">익명 IP별 요청</h2>
                      <p>사용자 수가 아닌, 서버가 익명화한 IP 기준의 대략적인 접속 원천입니다.</p>
                    </div>
                    <span>{data.byIp.length.toLocaleString("ko-KR")} KEYS</span>
                  </div>
                  {data.byIp.length === 0 ? (
                    <p className={styles.tableEmpty}>표시할 방문자 집계가 없습니다.</p>
                  ) : (
                    <div className={styles.tableScroll} tabIndex={0} aria-label="익명 IP별 요청 표, 가로로 스크롤 가능">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">익명 IP 키</th>
                            <th scope="col">전체</th>
                            <th scope="col">SSE</th>
                            <th scope="col">JSON</th>
                            <th scope="col">처음 확인</th>
                            <th scope="col">최근 확인</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.byIp.map((item) => (
                            <tr key={item.id}>
                              <th scope="row"><code>{item.id}</code></th>
                              <td>{item.requests.toLocaleString("ko-KR")}</td>
                              <td>{item.streamRequests.toLocaleString("ko-KR")}</td>
                              <td>{item.jsonRequests.toLocaleString("ko-KR")}</td>
                              <td><time dateTime={item.firstSeenAt}>{formatTimestamp(item.firstSeenAt)}</time></td>
                              <td><time dateTime={item.lastSeenAt}>{formatTimestamp(item.lastSeenAt)}</time></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
