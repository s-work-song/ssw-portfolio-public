/** 안내 카드는 일반 대화 흐름에 남기고, 생성 중에는 선택만 잠근다. */
export function onboardingPresentation({
  availability,
  guidedTourStatus,
  isLoading,
}: {
  availability: string;
  guidedTourStatus: string;
  isLoading: boolean;
}) {
  return {
    visible: availability === "online" && guidedTourStatus === "idle",
    disabled: isLoading,
  };
}
