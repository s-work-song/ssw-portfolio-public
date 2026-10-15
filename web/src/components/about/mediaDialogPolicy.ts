/** 드래그 직후나 핀치 중에는 팝업 바깥 클릭을 닫기 의도로 해석하지 않습니다. */
export function mediaDialogOutsideCloseAllowed(
  pinching: boolean,
  lastDragFinishedAt: number | null,
  now: number,
): boolean {
  return !pinching && (lastDragFinishedAt === null || now - lastDragFinishedAt >= 250);
}
