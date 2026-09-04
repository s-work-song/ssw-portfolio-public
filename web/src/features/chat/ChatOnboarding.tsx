"use client";

/**
 * 대화가 이어져도 인사말 아래에 남는 시작 안내다.
 *
 * 빈 입력창만 두면 방문자가 무엇을 물어야 할지 모른다. 그래서 둘러보기,
 * 설정·WebMCP 안내, 바로 갈 수 있는 목적지, 관점 선택을 한 화면에 모아
 * 첫 질문의 문턱을 낮춘다. 상태는 전혀 갖지 않고 선택 결과만 위로 올린다.
 */
import {
  AUDIENCE_OPTIONS,
  CHAT_QUICK_START_OPTIONS,
} from "./constants";
import type { ActionId, AudienceChoice } from "./types";
import styles from "./ChatWidget.module.css";

/**
 * 관점을 고르면 바로 보내는 질문 문구다.
 * 선택 자체로 첫 답변이 시작돼야 방문자가 입력 없이도 대화에 들어온다.
 */
const AUDIENCE_PROMPTS: Readonly<Record<AudienceChoice, string>> = {
  recruiter:
    "채용·평가 관점에서 경력, 역할과 강점을 중심으로 포트폴리오를 소개해 주세요.",
  developer:
    "개발·기술 검토 관점에서 기술 스택, 구조와 검증 방식을 중심으로 소개해 주세요.",
  collaboration:
    "협업·의뢰 관점에서 맡길 수 있는 업무, 작업 방식과 결과물을 중심으로 소개해 주세요.",
  personality: "성격과 취미, 평소 관심사를 소개해 주세요.",
  values: "일과 협업, 삶에서 중요하게 생각하는 가치관을 알려 주세요.",
  casual: "처음 방문한 사람에게 포트폴리오의 핵심만 짧게 소개해 주세요.",
  default: "포트폴리오를 간단히 소개해 주세요.",
};

interface ChatOnboardingProps {
  /** 이미 고른 관점이다. 선택 표시(aria-pressed)에만 쓴다. */
  audience: AudienceChoice | null;
  disabled?: boolean;
  onStartGuidedTour: () => void;
  onShowSettingsGuide: () => void;
  /** 질문 전송과 콘텐츠 이동을 함께 시작한다. */
  onStartQuickAction: (
    prompt: string,
    actionId: ActionId,
    audience: AudienceChoice,
  ) => void;
  /** 관점을 저장하고 그 관점의 첫 질문을 보낸다. */
  onSelectAudience: (audience: AudienceChoice, prompt: string) => void;
}

/**
 * 온보딩 선택지를 그린다.
 *
 * 표시 조건(온라인인지, 투어 중인지 등)은 판단하지 않는다. 그 판정은 대화
 * 상태를 쥔 위젯 본체가 하고, 이 컴포넌트는 "보여 달라고 하면 그린다".
 */
export function ChatOnboarding({
  audience,
  disabled = false,
  onStartGuidedTour,
  onShowSettingsGuide,
  onStartQuickAction,
  onSelectAudience,
}: Readonly<ChatOnboardingProps>) {
  return (
    <fieldset className={styles.onboarding} disabled={disabled}>
      <legend>
        어떤 내용이 궁금한가요? 선택하면 맞춤 소개를 시작해요.
      </legend>
      <div className={styles.onboardingFeatureActions}>
        <button
          type="button"
          className={styles.guidedTourStart}
          onClick={onStartGuidedTour}
        >
          <span>
            <strong>AI와 처음부터 둘러보기</strong>
            <small>주요 페이지와 질문 기능을 약 5분 동안 안내해요.</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className={`${styles.guidedTourStart} ${styles.webMcpGuideStart}`}
          onClick={onShowSettingsGuide}
        >
          <span>
            <strong>설정·WebMCP 도구 알아보기</strong>
            <small>설정 변경과 화면 이동 도구를 살펴봐요.</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className={styles.quickStartGroup}>
        <span className={styles.onboardingGroupLabel}>바로 보기</span>
        <div className={styles.quickStartOptions}>
          {CHAT_QUICK_START_OPTIONS.map((option) => (
            <button
              key={option.actionId}
              type="button"
              onClick={() =>
                onStartQuickAction(
                  option.prompt,
                  option.actionId,
                  option.audience,
                )
              }
            >
              <span>{option.label}</span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </div>
      <span className={styles.onboardingGroupLabel}>관점 선택</span>
      <div className={styles.audienceOptions}>
        {AUDIENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={audience === option.value}
            className={
              audience === option.value ? styles.selectedOption : ""
            }
            onClick={() =>
              onSelectAudience(option.value, AUDIENCE_PROMPTS[option.value])
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
