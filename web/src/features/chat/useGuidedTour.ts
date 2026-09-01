"use client";

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

interface UseGuidedTourOptions {
  pathname: string;
  availability: ChatAvailability;
  navigateAction: (id: ActionId) => void;
}

export function useGuidedTour({
  pathname,
  availability,
  navigateAction,
}: UseGuidedTourOptions) {
  const [state, setState] = useState<GuidedTourState>(IDLE_GUIDED_TOUR_STATE);
  const [inviteVisible, setInviteVisible] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);
  const step = useMemo(() => currentGuidedTourStep(state) ?? null, [state]);

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

  const dismissInvite = useCallback(() => {
    setInviteVisible(false);
    try {
      window.localStorage.setItem(GUIDED_TOUR_VISIT_KEY, "dismissed");
    } catch {
      // 저장 실패 시 다음 방문에 다시 안내될 수 있다.
    }
  }, []);

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

  const returnToCurrentStep = useCallback(() => {
    if (state.status !== "active" || !step) return;
    navigateAction(step.actionId);
  }, [navigateAction, state.status, step]);

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
    skip: advance,
    stop,
    dismissInvite,
    returnToCurrentStep,
    beginQuestion,
    completeQuestion,
  };
}
