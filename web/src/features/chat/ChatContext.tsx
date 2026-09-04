"use client";

/**
 * 챗봇 상태와 조작 함수를 화면 전체에 흘려보내는 컨텍스트 정의다.
 *
 * 값을 실제로 만들어 넣는 쪽은 ChatProvider이고 이 파일은 계약과 접근 훅만
 * 갖는다. 카드 버튼 하나가 챗봇을 열려면 위젯 구현까지 끌고 들어와야 하는
 * 상황을 피하려고 정의를 따로 떼어 두었다.
 */
import { createContext, useContext } from "react";
import type {
  ActionId,
  AudienceChoice,
  ChatAnimation,
  ChatAvailability,
  ChatMessage,
  ChatStreamAnimation,
  Tone,
} from "./types";
import type {
  GuidedTourState,
  GuidedTourStep,
  GuidedTourTargetId,
} from "./guidedTour";
import type { PortfolioUiToolExecutor } from "../portfolio-tools/portfolioUiToolExecutor";

/**
 * 컨텍스트가 실어 나르는 값 전체다.
 *
 * 앞쪽은 화면이 그대로 그리면 되는 상태이고 뒤쪽은 조작 함수다. 사용자가 고른
 * 설정 값과 실제 재생 값을 따로 두는 항목이 몇 개 있는데, 접근성 설정으로 모션을
 * 줄인 경우 설정 화면에는 고른 값을 그대로 보여 주면서 재생만 낮추기 위해서다.
 */
export interface ChatContextValue {
  isOpen: boolean;
  /** 닫힘 연출이 재생되는 중이다. 연출이 끝나기 전에 패널을 지우지 않으려고 isOpen과 따로 둔다. */
  isClosing: boolean;
  /** 답변을 기다리는 중이다. 입력과 질문 버튼을 잠그는 데 쓴다. */
  isLoading: boolean;
  availability: ChatAvailability;
  /** 마지막 요청이 실패한 사유다. 성공하면 null로 돌아간다. */
  error: string | null;
  /** 서버가 요청한 재시도 대기 시간 중 남은 초다. 0이면 바로 재시도할 수 있다. */
  retryWaitSeconds: number;
  messages: ChatMessage[];
  audience: AudienceChoice | null;
  tone: Tone;
  streamingEnabled: boolean;
  reasoningEnabled: boolean;
  /** 사용자가 설정 화면에서 고른 값 그대로다. 설정 UI가 이 값을 표시한다. */
  chatAnimation: ChatAnimation;
  /** 모션 정책까지 반영한 실제 재생 값이다. 위젯은 이 값으로 연출을 고른다. */
  effectiveChatAnimation: ChatAnimation;
  /** 사용자가 설정 화면에서 고른 응답 텍스트 연출이다. */
  streamAnimation: ChatStreamAnimation;
  /** 모션 정책까지 반영한 실제 재생 값이다. */
  effectiveStreamAnimation: ChatStreamAnimation;
  guidedTour: GuidedTourState;
  guidedTourStep: GuidedTourStep | null;
  guidedTourInviteVisible: boolean;
  /** 패널이 열릴 때 입력창에 초점을 줄지다. 카드 버튼으로 열 때는 답변을 가리지 않도록 false로 연다. */
  focusInputOnOpen: boolean;
  open: (options?: { focusInput?: boolean }) => void;
  close: () => void;
  /** 닫힘 연출이 끝났음을 알린다. 이 호출로 isClosing이 풀리고 패널이 화면에서 빠진다. */
  completeCloseAnimation: () => void;
  toggle: () => void;
  selectAudience: (audience: AudienceChoice) => void;
  selectTone: (tone: Tone) => void;
  setStreamingEnabled: (enabled: boolean) => void;
  setReasoningEnabled: (enabled: boolean) => void;
  setChatAnimation: (animation: ChatAnimation) => void;
  setStreamAnimation: (animation: ChatStreamAnimation) => void;
  /** `silent`를 주면 확인 중 표시 없이 배경에서만 상태를 갱신한다. */
  refreshAvailability: (options?: { silent?: boolean }) => Promise<void>;
  /** 대화를 첫 인사말 상태로 되돌린다. 진행 중인 요청도 함께 정리된다. */
  resetConversation: () => void;
  /** 설정 화면의 WebMCP 안내를 펼친 채로 이동시킨다. 투어 마무리에서 부른다. */
  showSettingsWebMcpGuide: () => void;
  /** 질문을 보낸다. audienceOverride는 온보딩에서 관점을 고르며 바로 질문할 때처럼 상태 반영을 기다릴 수 없을 때 쓴다. */
  sendMessage: (
    message: string,
    audienceOverride?: AudienceChoice,
    responseMode?: "default" | "explanation",
  ) => Promise<void>;
  /** 생성 중인 답변을 중단한다. 그 시점까지 받은 내용은 그대로 남는다. */
  stopGenerating: () => void;
  /** 마지막 질문을 다시 보낸다. 실패한 답변 말풍선의 재시도 버튼이 쓴다. */
  retry: () => Promise<void>;
  /** 포트폴리오 내부의 탭·세부 앵커 이동 연출을 공통으로 실행한다. */
  navigateRoute: (route: string) => void;
  /** 챗봇 명령과 WebMCP가 함께 사용하는 포트폴리오 UI 도구 실행기다. */
  executePortfolioUiTool: PortfolioUiToolExecutor;
  /** 답변에 붙은 이동 버튼과 안내 투어가 함께 쓰는 액션 단위 이동이다. 식별자를 실제 경로로 푸는 일은 Provider가 맡는다. */
  navigateAction: (id: ActionId) => void;
  startGuidedTour: () => void;
  advanceGuidedTour: () => void;
  previousGuidedTourStep: () => void;
  skipGuidedTourInteraction: () => void;
  stopGuidedTour: () => void;
  dismissGuidedTourInvite: () => void;
  returnToGuidedTourStep: () => void;
  beginGuidedTourQuestion: (targetId: GuidedTourTargetId) => boolean;
  completeGuidedTourQuestion: (targetId: GuidedTourTargetId) => void;
}

/** Provider 바깥에서 읽었는지 구분하려고 기본값을 null로 둔다. useChat이 이 값을 보고 오류를 낸다. */
export const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * 챗봇 컨텍스트를 읽는다.
 *
 * ChatProvider 밖에서 부르면 값이 null이라 조용히 동작이 어긋나는 대신
 * 곧바로 예외를 던진다. 반환 타입에 null이 없으므로 호출부는 매번 확인하지 않아도 된다.
 */
export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) {
    throw new Error("useChat은 ChatProvider 안에서 사용해야 합니다.");
  }
  return value;
}
