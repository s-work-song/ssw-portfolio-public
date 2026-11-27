/**
 * SSE로 도착한 답변 조각을 모아 두었다가 일정한 속도로 화면에 흘려보내는 큐다.
 *
 * 네트워크는 한 번에 큰 덩어리를 던지거나 한참 쉬는 등 도착 간격이 들쭉날쭉하다.
 * 받은 즉시 그리면 글자가 뭉텅이로 튀어 읽기 어려우므로, 수신 속도와 렌더
 * 속도를 분리해 "타자 치듯" 일정하게 보여 준다. 밀린 양이 많으면 속도를 올려
 * 지연이 쌓이지 않게 한다.
 */
/** 평상시 한 번에 내보내는 글자 수다. */
const BASE_CHUNK_CHARACTERS = 8;
/** 평상시 렌더 간격(ms)이다. 사람이 읽기 편한 타자 속도에 맞춘 값이다. */
const BASE_INTERVAL_MS = 48;
/** 한 글자(자소 묶음)가 차지할 수 있는 UTF-16 코드 유닛 여유분이다. */
const MAX_CODE_UNITS_PER_GRAPHEME = 8;
/** 창 끝에 걸친 자소 하나를 온전히 담기 위한 추가 여유분이다. */
const GRAPHEME_WINDOW_SLACK = 16;
/** 이미 그린 앞부분을 잘라내 버퍼가 무한히 길어지지 않게 하는 기준이다. */
const COMPACT_THRESHOLD = 4_096;

/** 자소 분리기다. Intl.Segmenter가 없는 환경에서는 null이 되고 코드 포인트 단위로 물러선다. */
const graphemeSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("ko", { granularity: "grapheme" })
    : null;

/**
 * 결합 문자·ZWJ 이모지가 청크 경계에서 갈라지지 않도록 자소 단위로 나눈다.
 *
 * Segmenter를 못 쓰는 환경에서는 Array.from으로 코드 포인트 단위까지만
 * 보장한다. 서로게이트 쌍은 지켜지지만 결합 문자는 갈라질 수 있는, 의도한 절충이다.
 */
function splitGraphemes(text: string): string[] {
  if (!graphemeSegmenter) return Array.from(text);
  const graphemes: string[] = [];
  for (const { segment } of graphemeSegmenter.segment(text)) {
    graphemes.push(segment);
  }
  return graphemes;
}

/** 한 번에 몇 글자를 얼마 간격으로 내보낼지 정한 렌더 속도다. */
interface RenderPace {
  chunkCharacters: number;
  intervalMs: number;
}

/**
 * 아직 그리지 않은 잔량에 맞춰 렌더 속도를 고른다.
 *
 * 잔량이 쌓일수록 청크를 키우고 간격을 줄여 밀린 글자를 빨리 따라잡는다.
 * 긴 답변이 도착하는 도중 화면이 한참 뒤처지는 것을 막기 위한 3단 계단이며,
 * 잔량이 적을 때는 읽기 좋은 기본 속도로 돌아온다.
 */
export function streamRenderPace(backlogCharacters: number): RenderPace {
  if (backlogCharacters > 1_024) {
    return { chunkCharacters: 96, intervalMs: 12 };
  }
  if (backlogCharacters > 256) {
    return { chunkCharacters: 32, intervalMs: 24 };
  }
  return {
    chunkCharacters: BASE_CHUNK_CHARACTERS,
    intervalMs: BASE_INTERVAL_MS,
  };
}

/**
 * 네트워크 수신과 화면 갱신 속도를 분리하는 단일 소비자 큐다.
 *
 * 버퍼를 잘라 내며 소비하는 대신 cursor로 읽은 위치만 옮기고, 앞부분이 일정
 * 이상 쌓였을 때만 실제로 잘라 낸다. delta가 도착할 때마다 문자열을 새로
 * 만들면 긴 답변에서 비용이 크기 때문이다.
 *
 * 답변 하나에 인스턴스 하나를 쓰며, 재사용하지 않는다. cancel 이후에는
 * 어떤 입력도 받지 않는다.
 */
export class StreamRenderQueue {
  /** 도착했지만 아직 다 그리지 못한 텍스트다. cursor 앞부분은 이미 그린 구간이다. */
  private buffer = "";
  private cursor = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** drain을 기다리는 쪽에 알릴 resolve 함수들이다. 여러 번 기다려도 한 번에 모두 깨운다. */
  private drainResolvers = new Set<() => void>();
  private cancelled = false;
  private readonly render: (text: string) => void;

  /** render는 잘라 낸 조각을 화면에 이어 붙이는 콜백이다. 조각 단위로만 호출되고 전체 텍스트를 다시 받지 않는다. */
  constructor(render: (text: string) => void) {
    this.render = render;
  }

  /**
   * 도착한 조각을 버퍼에 붙이고 아직 돌지 않았다면 소비를 시작한다.
   *
   * 취소된 큐이거나 빈 문자열이면 무시한다. 이미 타이머가 돌고 있으면
   * flushNext가 스스로 빠지므로 몇 번을 불러도 소비 주기가 겹치지 않는다.
   */
  enqueue(text: string): void {
    if (this.cancelled || !text) return;
    this.buffer += text;
    this.flushNext();
  }

  /**
   * 버퍼에 남은 글자를 모두 그릴 때까지 기다린다.
   *
   * 응답이 끝난 뒤 완성 메시지로 갈아 끼우기 전에 화면이 뒤처지지 않도록
   * 호출한다. 잔량이 없고 대기 중인 타이머도 없으면 곧바로 resolve하고,
   * cancel로 큐를 접을 때도 기다리던 쪽을 함께 깨워 영영 매달리지 않게 한다.
   */
  drain(): Promise<void> {
    if (this.backlog === 0 && this.timer === null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.drainResolvers.add(resolve));
  }

  /**
   * 남은 글자를 버리고 큐를 영구히 닫는다. 생성 중단·언마운트 때 쓴다.
   *
   * 예약된 타이머를 해제하고 취소 표시를 남겨 이후 enqueue도 받지 않는다.
   * 기다리던 drain은 잔량이 남아 있어도 함께 깨운다.
   */
  cancel(): void {
    this.cancelled = true;
    this.buffer = "";
    this.cursor = 0;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.resolveDrain();
  }

  /** 아직 그리지 않고 남은 글자 수(UTF-16 코드 유닛 기준)다. */
  private get backlog(): number {
    return this.buffer.length - this.cursor;
  }

  /**
   * 아직 그리지 않은 구간의 앞에서 최대 limit개의 자소를 떼어낸다.
   * 잔량 전체를 매번 다시 분할하면 O(잔량)이 되므로 청크 크기에 비례하는
   * 창만 살펴보고, 창 끝에 걸친 조각은 다음 글자와 결합될 수 있어 남긴다.
   */
  private takeChunk(limit: number): string {
    if (this.backlog <= 0) return "";
    const windowEnd = Math.min(
      this.buffer.length,
      this.cursor + limit * MAX_CODE_UNITS_PER_GRAPHEME + GRAPHEME_WINDOW_SLACK,
    );
    const window = this.buffer.slice(this.cursor, windowEnd);
    const reachedEnd = windowEnd === this.buffer.length;

    let taken = 0;
    let length = 0;
    for (const grapheme of splitGraphemes(window)) {
      if (taken >= limit) break;
      if (!reachedEnd && length + grapheme.length >= window.length) break;
      length += grapheme.length;
      taken += 1;
    }
    // 창 안에서 안전한 절단 지점을 찾지 못하면 창 전체를 한 번에 내보낸다.
    if (length === 0) length = window.length;

    const text = window.slice(0, length);
    this.cursor += length;
    this.compact();
    return text;
  }

  /**
   * 이미 그린 앞부분을 잘라 버퍼가 무한히 자라지 않게 한다.
   *
   * 다 소비했으면 통째로 비우고, 아직 남았으면 읽은 양이 기준을 넘었을 때만
   * 잘라 낸다. 매번 자르면 조각마다 문자열을 새로 만들게 되므로 기준을 두고 미룬다.
   */
  private compact(): void {
    if (this.cursor >= this.buffer.length) {
      this.buffer = "";
      this.cursor = 0;
      return;
    }
    if (this.cursor >= COMPACT_THRESHOLD) {
      this.buffer = this.buffer.slice(this.cursor);
      this.cursor = 0;
    }
  }

  /**
   * 조각 하나를 그리고 다음 렌더를 예약한다. 큐의 유일한 소비 지점이다.
   *
   * 타이머가 이미 예약돼 있으면 곧바로 빠져 소비 주기가 둘로 갈라지지 않는다.
   * 잔량이 없으면 타이머를 새로 걸지 않고 멈춘 뒤 기다리던 drain을 깨우며,
   * 다음 enqueue가 들어오면 그때 다시 돈다. 속도는 매 조각마다 현재 잔량으로
   * 다시 계산해 도착량 변화에 따라붙는다.
   *
   * 화살표 함수로 둔 이유는 setTimeout 콜백으로 그대로 넘기기 위해서다.
   */
  private flushNext = (): void => {
    if (this.cancelled || this.timer !== null) return;
    if (this.backlog === 0) {
      this.resolveDrain();
      return;
    }

    const pace = streamRenderPace(this.backlog);
    this.render(this.takeChunk(pace.chunkCharacters));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushNext();
    }, pace.intervalMs);
  };

  /** 기다리던 drain을 모두 깨우고 목록을 비운다. 같은 대기자를 두 번 깨우지 않기 위해 즉시 비운다. */
  private resolveDrain(): void {
    for (const resolve of this.drainResolvers) resolve();
    this.drainResolvers.clear();
  }
}
