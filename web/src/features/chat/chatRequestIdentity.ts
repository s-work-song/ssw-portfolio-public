type IdCrypto = Pick<Crypto, "getRandomValues"> & Partial<Pick<Crypto, "randomUUID">>;

export interface ChatRequestIds {
  conversationId: string;
  turnId: string;
}

/** 질문·프롬프트와 무관한 UUID다. HTTP LAN의 Web Crypto도 지원한다. */
export function createChatRequestId(cryptoSource: IdCrypto | undefined = globalThis.crypto): string {
  if (typeof cryptoSource?.randomUUID === "function") return cryptoSource.randomUUID();
  if (!cryptoSource?.getRandomValues) throw new Error("대화 식별자를 생성할 수 없습니다.");
  const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

/** 메시지와 같이 메모리에서만 살아 있는 대화 ID 수명이다. */
export class ChatConversationIdentity {
  private conversationId: string;
  private readonly createId: () => string;

  constructor(createId: () => string = createChatRequestId) {
    this.createId = createId;
    this.conversationId = createId();
  }

  /** 새 사용자 입력만 새 턴이다. 재시도·도구 후속 확인은 이 스냅숏을 재사용한다. */
  nextTurnIds(): ChatRequestIds {
    return { conversationId: this.conversationId, turnId: this.createId() };
  }

  reset(): void {
    this.conversationId = this.createId();
  }
}
