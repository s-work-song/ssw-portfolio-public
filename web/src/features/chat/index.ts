/**
 * 챗봇 기능의 공개 진입점이다.
 *
 * 바깥 화면이 쓰는 것만 골라 다시 내보내고, ChatWidget이나 파서처럼 기능 안에서만
 * 쓰는 구현은 감춘다. 페이지 쪽 import 경로를 이 파일 하나로 묶어 두면 내부 파일
 * 구조를 바꿔도 사용하는 쪽을 건드리지 않는다.
 */
export { ChatProvider } from "./ChatProvider";
export { AskAiButton } from "./AskAiButton";
export { StreamingText } from "./StreamingText";
export { useChat } from "./ChatContext";
export {
  CHAT_ANIMATION_OPTIONS,
  CHAT_STREAM_ANIMATION_OPTIONS,
  DEFAULT_CHAT_ANIMATION,
  DEFAULT_CHAT_STREAM_ANIMATION,
  DEFAULT_REASONING_ENABLED,
  REASONING_QUICK_TOGGLE_ENABLED,
} from "./constants";
export type {
  ActionId,
  ApiAudience,
  AudienceChoice,
  ChatAction,
  ChatAnimation,
  ChatStreamAnimation,
  ChatMessage,
  ChatSegment,
  PageContext,
  Tone,
} from "./types";
