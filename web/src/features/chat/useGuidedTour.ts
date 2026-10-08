"use client";

/**
 * 안내 투어의 진행 상태를 관리하고 화면 요소 강조까지 맡는 훅이다.
 *
 * 단계 정의는 guidedTour 모듈이 갖고, 여기서는 "지금 몇 번째 단계인지"와
 * 그 단계에 딸린 부작용(경로 이동, DOM 강조, 저장소 기록)만 다룬다.
 * 투어 중에는 페이지가 실제로 이동하면서 훅이 다시 마운트되므로 진행 상태를
 * sessionStorage에 남겨 두고, 저장소 접근은 모두 try/catch로 감싼다.
 * 사생활 보호 모드처럼 저장소가 막힌 브라우저에서도 현재 탭에서는 투어가
 * 정상 동작해야 하기 때문이다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GUIDED_TOUR_SESSION_KEY,
  GUIDED_TOUR_STEPS,
  GUIDED_TOUR_VISIT_KEY,
  IDLE_GUIDED_TOUR_STATE,
  currentGuidedTourStep,
  guidedTourInteractionForStep,
  type GuidedTourState,
  type GuidedTourTargetId,
} from "./guidedTour";
import type { ActionId, ChatAvailability } from "./types";

/**
 * 훅에 넘기는 바깥 문맥이다.
 *
 * pathname은 첫 방문 안내를 띄울지 판단하고 페이지가 바뀔 때 강조 대상을 다시
 * 찾는 데 쓰이며, availability가 `online`이 아니면 질문 체험용 강조를 걸지 않는다.
 * navigateAction은 단계마다 콘텐츠 위치로 이동시키는 ChatProvider의 라우팅 함수다.
 */
interface UseGuidedTourOptions {
  pathname: string;
  availability: ChatAvailability;
  navigateAction: (id: ActionId) => void;
}

/**
 * 투어 상태와 조작 함수 묶음을 돌려준다.
 *
 * 반환값의 state·step·inviteVisible은 화면이 그대로 그리면 되는 표시용 값이고,
 * 나머지는 카드 버튼과 AskAiButton이 부르는 조작 함수다. `skip`은 질문 체험을
 * 건너뛰는 동작이지만 결과가 "다음 단계로 이동"과 같으므로 advance를 그대로 쓴다.
 */
export function useGuidedTour({
  pathname,
  availability,
  navigateAction,
}: UseGuidedTourOptions) {
  const [state, setState] = useState<GuidedTourState>(IDLE_GUIDED_TOUR_STATE);
  const [inviteVisible, setInviteVisible] = useState(false);
  /** 지금 강조 표시를 걸어 둔 요소다. 강조를 거둘 때 같은 요소인지 확인하는 용도로도 쓴다. */
  const targetRef = useRef<HTMLElement | null>(null);
  const step = useMemo(() => currentGuidedTourStep(state) ?? null, [state]);

  /**
   * 마운트 시점에 이전 진행 상태를 복원하거나, 첫 방문자에게 투어를 권한다.
   *
   * 저장된 세션이 있으면 상태 복원이 우선이라 안내 배너는 예약하지 않는다.
   * 복원은 setTimeout 0으로 한 틱 미뤄, 하이드레이션이 끝나기 전에 상태가
   * 바뀌어 서버 렌더 결과와 어긋나는 일을 피한다. 저장값은 남의 손을 탈 수
   * 있으므로 status와 stepIndex 범위를 직접 확인하고, 답변을 받던 중
   * (`answering`) 새로고침한 경우는 스트림을 이어받을 수 없어 `answered`로
   * 낮춰 투어가 그 단계에 갇히지 않게 한다.
   *
   * 저장소 접근이 통째로 막히면 복원도 안내도 하지 않고 그냥 넘어간다.
   */
  useEffect(() => {
    let inviteTimer: number | undefined;
    let restoreTimer: number | undefined;
    try {
      const storedSession = window.sessionStorage.getItem(
        GUIDED_TOUR_SESSION_KEY,
      );
      if (storedSession) {
        const parsed = JSON.parse(storedSession) as Partial<GuidedTourState>;
        if (
          parsed.status === "active" &&
          Number.isInteger(parsed.stepIndex) &&
          Number(parsed.stepIndex) >= 0 &&
          Number(parsed.stepIndex) < GUIDED_TOUR_STEPS.length
        ) {
          const stepIndex = Number(parsed.stepIndex);
          restoreTimer = window.setTimeout(
            () =>
              setState({
                status: "active",
                stepIndex,
                interaction:
                  parsed.interaction === "answering" ||
                  parsed.interaction === "answered"
                    ? "answered"
                    : guidedTourInteractionForStep(
                        GUIDED_TOUR_STEPS[stepIndex],
                      ),
              }),
            0,
          );
          return () => {
            if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
          };
        }
      }

      // 한 번이라도 안내를 받았거나 About 영역 밖이면 배너를 띄우지 않는다.
      // 900ms를 두는 이유는 진입 직후 화면이 자리를 잡기 전에 끼어들지 않기 위해서다.
      const visit = window.localStorage.getItem(GUIDED_TOUR_VISIT_KEY);
      if (!visit && pathname.includes("/about-me")) {
        inviteTimer = window.setTimeout(() => setInviteVisible(true), 900);
      }
    } catch {
      // 저장소가 차단되어도 현재 탭에서 투어를 직접 시작할 수 있다.
    }
    return () => {
      if (inviteTimer !== undefined) window.clearTimeout(inviteTimer);
      if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
    };
  }, [pathname]);

  /**
   * 상태가 바뀔 때마다 저장소에 반영한다.
   *
   * 진행 중일 때만 세션에 남기고 끝나거나 중단하면 지워, 다음 마운트가 끝난
   * 투어를 되살리지 않게 한다. 완주 기록은 탭을 닫아도 남아야 하므로
   * localStorage에 따로 둔다. 저장 실패는 삼키고 진행만 계속한다.
   */
  useEffect(() => {
    try {
      if (state.status === "active") {
        window.sessionStorage.setItem(
          GUIDED_TOUR_SESSION_KEY,
          JSON.stringify(state),
        );
      } else {
        window.sessionStorage.removeItem(GUIDED_TOUR_SESSION_KEY);
      }
      if (state.status === "completed") {
        window.localStorage.setItem(GUIDED_TOUR_VISIT_KEY, "completed");
      }
    } catch {
      // 저장 실패가 투어 진행 자체를 막지는 않는다.
    }
  }, [state]);

  /**
   * 첫 단계부터 투어를 시작한다.
   *
   * 안내 배너를 닫고 방문 기록을 `started`로 남겨, 중간에 이탈하더라도 다음
   * 방문에 배너가 다시 뜨지 않게 한다. 상태를 세운 뒤 첫 단계의 위치로
   * 곧바로 이동시킨다.
   */
  const start = useCallback(() => {
    setInviteVisible(false);
    setState({
      status: "active",
      stepIndex: 0,
      interaction: guidedTourInteractionForStep(GUIDED_TOUR_STEPS[0]),
    });
    try {
      window.localStorage.setItem(GUIDED_TOUR_VISIT_KEY, "started");
    } catch {
      // 저장소가 없어도 현재 탭에서는 투어를 진행한다.
    }
    navigateAction(GUIDED_TOUR_STEPS[0].actionId);
  }, [navigateAction]);

  /**
   * 다음 단계로 넘어가고, 마지막 단계였으면 투어를 완료 처리한다.
   *
   * 완료로 넘어갈 때는 stepIndex를 마지막 값 그대로 둬서 카드가 진행도를
   * "전체/전체"로 표시할 수 있게 한다. 질문 체험을 건너뛰는 skip도 결국 같은
   * 동작이라 이 함수를 그대로 쓴다. 진행 중이 아니면 아무것도 하지 않는다.
   */
  const advance = useCallback(() => {
    if (state.status !== "active") return;
    const nextIndex = state.stepIndex + 1;
    if (nextIndex >= GUIDED_TOUR_STEPS.length) {
      setState({
        status: "completed",
        stepIndex: state.stepIndex,
        interaction: "ready",
      });
      return;
    }
    setState({
      status: "active",
      stepIndex: nextIndex,
      interaction: guidedTourInteractionForStep(GUIDED_TOUR_STEPS[nextIndex]),
    });
    navigateAction(GUIDED_TOUR_STEPS[nextIndex].actionId);
  }, [navigateAction, state]);

  /**
   * 이전 단계로 되돌아가 그 위치로 다시 이동한다.
   *
   * 첫 단계이거나 진행 중이 아니면 아무것도 하지 않는다. 되돌아간 단계의
   * interaction은 새로 계산하므로, 이미 답변까지 마친 단계로 돌아가면 질문
   * 체험을 처음부터 다시 하게 된다.
   */
  const previous = useCallback(() => {
    if (state.status !== "active" || state.stepIndex <= 0) return;
    const previousIndex = state.stepIndex - 1;
    setState({
      status: "active",
      stepIndex: previousIndex,
      interaction: guidedTourInteractionForStep(
        GUIDED_TOUR_STEPS[previousIndex],
      ),
    });
    navigateAction(GUIDED_TOUR_STEPS[previousIndex].actionId);
  }, [navigateAction, state]);

  /**
   * 투어를 즉시 끝내고 초기 상태로 되돌린다.
   *
   * 완주가 아니라 중단이므로 방문 기록은 `dismissed`로 남기고 세션에 남은
   * 진행 상태도 지운다. 남겨 두면 다음 페이지 이동에서 복원 효과가 끝난
   * 투어를 되살려 버린다.
   */
  const stop = useCallback(() => {
    setState(IDLE_GUIDED_TOUR_STATE);
    setInviteVisible(false);
    try {
      window.localStorage.setItem(GUIDED_TOUR_VISIT_KEY, "dismissed");
      window.sessionStorage.removeItem(GUIDED_TOUR_SESSION_KEY);
    } catch {
      // 저장 실패가 현재 화면에서 투어를 닫는 동작을 막지는 않는다.
    }
  }, []);

  /**
   * 첫 방문 안내 배너만 닫는다. 투어 자체는 시작된 적이 없으므로 상태는 건드리지 않는다.
   *
   * 방문 기록을 `dismissed`로 남겨 다음 방문에 다시 권하지 않는다.
   * 저장에 실패하면 기록이 남지 않아 다음 방문에 배너가 한 번 더 뜰 수 있다.
   */
  const dismissInvite = useCallback(() => {
    setInviteVisible(false);
    try {
      window.localStorage.setItem(GUIDED_TOUR_VISIT_KEY, "dismissed");
    } catch {
      // 저장 실패 시 다음 방문에 다시 안내될 수 있다.
    }
  }, []);

  /**
   * 강조된 버튼이 눌렸을 때 그 질문을 투어의 체험 단계로 받아들인다.
   *
   * 지금 진행 중인 단계가 그 targetId를 기다리고 있을 때만 `answering`으로
   * 넘기고 true를 돌려준다. 투어와 무관하게 눌린 버튼이거나 이미 답변을 받은
   * 뒤라면 false다. 호출부(AskAiButton)는 이 반환값으로 답변 후
   * completeQuestion까지 이어 부를지 결정한다.
   */
  const beginQuestion = useCallback(
    (targetId: GuidedTourTargetId) => {
      if (
        state.status !== "active" ||
        step?.targetId !== targetId ||
        state.interaction !== "waiting-for-ai"
      ) {
        return false;
      }
      setState((current) => ({ ...current, interaction: "answering" }));
      return true;
    },
    [state, step],
  );

  /**
   * 질문 체험이 끝났음을 표시해 "다음" 버튼 잠금을 푼다.
   *
   * 답변을 기다리는 동안(await) 상태가 바뀌었을 수 있어 갱신 함수 안에서
   * 최신 상태를 다시 읽고 단계·targetId·interaction을 모두 확인한다. 조건이
   * 어긋나면 상태를 그대로 돌려 아무 일도 일어나지 않게 한다. 의존성이 비어
   * 있어도 안전한 이유가 여기에 있다.
   */
  const completeQuestion = useCallback((targetId: GuidedTourTargetId) => {
    setState((current) => {
      const currentStep = currentGuidedTourStep(current);
      if (
        current.status !== "active" ||
        currentStep?.targetId !== targetId ||
        current.interaction !== "answering"
      ) {
        return current;
      }
      return { ...current, interaction: "answered" };
    });
  }, []);

  /**
   * 지금 단계의 위치로 다시 이동시킨다. 방문자가 투어 도중 딴 곳을 둘러본 뒤 제자리로 돌아올 때 쓴다.
   *
   * 단계는 그대로 두고 이동만 다시 하므로 질문 체험 진행 상태도 유지된다.
   */
  const returnToCurrentStep = useCallback(() => {
    if (state.status !== "active" || !step) return;
    navigateAction(step.actionId);
  }, [navigateAction, state.status, step]);

  /**
   * 현재 단계의 대상 요소를 찾아 `data-guided-tour-active` 속성으로 강조한다.
   *
   * 라우팅 직후에는 대상이 아직 DOM에 없거나 레이아웃 전이라, 100ms 간격으로
   * 최대 40번(약 4초)까지 다시 찾는다. getClientRects까지 확인하는 이유는
   * 요소는 붙었지만 아직 그려지지 않아 강조가 보이지 않는 경우를 거르기 위해서다.
   * 질문을 요구하지 않는 단계는 interaction과 무관하게 강조만 하고, 질문 단계는
   * `waiting-for-ai`일 때만 강조해 답변 중에 버튼이 계속 빛나지 않게 한다.
   * highlightDurationMs가 있으면 그만큼 뒤에 스스로 강조를 거두되, 그 사이 다른
   * 요소로 교체됐으면 건드리지 않는다.
   *
   * 정리 단계에서 cancelled 플래그를 세워 진행 중이던 재시도를 멈추고 두 타이머를
   * 모두 해제한다. 그러지 않으면 단계가 바뀐 뒤 옛 대상에 강조가 다시 붙는다.
   * pathname은 본문에서 쓰지 않지만, 페이지가 바뀌면 대상을 다시 찾도록
   * 의존성에 넣어 둔 값이다.
   */
  useEffect(() => {
    targetRef.current?.removeAttribute("data-guided-tour-active");
    targetRef.current = null;

    const targetId = step?.targetId;
    const highlightOptionalTarget =
      Boolean(targetId) && step?.requiresQuestion !== true;
    if (
      state.status !== "active" ||
      availability !== "online" ||
      !targetId ||
      (!highlightOptionalTarget && state.interaction !== "waiting-for-ai")
    ) {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let locateTimer: number | undefined;
    let highlightTimer: number | undefined;

    const locateTarget = () => {
      if (cancelled) return;
      const target = document.querySelector<HTMLElement>(
        `[data-guided-tour-target="${targetId}"]`,
      );
      if (!target || target.getClientRects().length === 0) {
        attempts += 1;
        if (attempts < 40) {
          locateTimer = window.setTimeout(locateTarget, 100);
        }
        return;
      }

      targetRef.current = target;
      target.setAttribute("data-guided-tour-active", "true");
      if (step.highlightDurationMs) {
        highlightTimer = window.setTimeout(() => {
          if (targetRef.current !== target) return;
          target.removeAttribute("data-guided-tour-active");
          targetRef.current = null;
        }, step.highlightDurationMs);
      }
    };
    locateTarget();

    return () => {
      cancelled = true;
      if (locateTimer !== undefined) window.clearTimeout(locateTimer);
      if (highlightTimer !== undefined) window.clearTimeout(highlightTimer);
      targetRef.current?.removeAttribute("data-guided-tour-active");
      targetRef.current = null;
    };
  }, [availability, pathname, state.interaction, state.status, step]);

  return {
    state,
    step,
    inviteVisible,
    start,
    advance,
    previous,
    /** 질문 체험을 건너뛰는 동작이다. 결과가 다음 단계 이동과 같아 advance를 그대로 노출한다. */
    skip: advance,
    stop,
    dismissInvite,
    returnToCurrentStep,
    beginQuestion,
    completeQuestion,
  };
}
