const BASE_CHUNK_CHARACTERS = 8;
const BASE_INTERVAL_MS = 48;

interface RenderPace {
  chunkCharacters: number;
  intervalMs: number;
}

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

/** 네트워크 수신과 화면 갱신 속도를 분리하는 단일 소비자 큐다. */
export class StreamRenderQueue {
  private characters: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private drainResolvers = new Set<() => void>();
  private cancelled = false;
  private readonly render: (text: string) => void;

  constructor(render: (text: string) => void) {
    this.render = render;
  }

  enqueue(text: string): void {
    if (this.cancelled || !text) return;
    this.characters.push(...Array.from(text));
    this.flushNext();
  }

  drain(): Promise<void> {
    if (this.characters.length === 0 && this.timer === null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.drainResolvers.add(resolve));
  }

  cancel(): void {
    this.cancelled = true;
    this.characters = [];
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.resolveDrain();
  }

  private flushNext = (): void => {
    if (this.cancelled || this.timer !== null) return;
    if (this.characters.length === 0) {
      this.resolveDrain();
      return;
    }

    const pace = streamRenderPace(this.characters.length);
    this.render(this.characters.splice(0, pace.chunkCharacters).join(""));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushNext();
    }, pace.intervalMs);
  };

  private resolveDrain(): void {
    for (const resolve of this.drainResolvers) resolve();
    this.drainResolvers.clear();
  }
}
