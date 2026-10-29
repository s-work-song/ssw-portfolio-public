/** 안내 카드는 일반 대화 흐름에 남기고, 생성 중에는 선택만 잠근다. */
export function onboardingPresentation({
  availability,
  guidedTourStatus,
  isLoading,
  retryWaitSeconds = 0,
}: {
  availability: string;
  guidedTourStatus: string;
  isLoading: boolean;
  retryWaitSeconds?: number;
}) {
  return {
    visible: availability === "online" && guidedTourStatus === "idle",
    disabled: isLoading || retryWaitSeconds > 0,
    tourIntroVisible: availability === "online" && guidedTourStatus === "active",
  };
}
