"use client";

/**
 * 추론 서버 연결 상태를 사용자에게 알리는 화면 조각들이다.
 *
 * 상태에 따라 알림의 무게가 다르다. 아직 대화가 없으면 화면 전체를 안내로
 * 바꿔 기대치를 먼저 맞추고, 대화가 시작된 뒤에는 얇은 배너만 띄워 검색
 * 기반 답변을 계속 받게 한다. 대화 도중에 화면을 통째로 갈아 끼우면
 * 사용자가 방금 읽던 답변을 잃기 때문이다.
 */
import styles from "./ChatWidget.module.css";

/**
 * 연결 상태를 확인하는 동안 보여 주는 대기 화면이다.
 *
 * 빈 화면 대신 무엇을 기다리는지 알려 준다. `role="status"`라 화면 낭독기도
 * 상태 변화를 조용히 전달받는다.
 */
export function ChatAvailabilityCheckingScreen() {
  return (
    <section className={styles.availabilityState} role="status">
      <span className={styles.availabilitySpinner} aria-hidden="true" />
      <span className={styles.availabilityEyebrow}>연결 상태 확인</span>
      <h3>챗봇을 준비하고 있어요</h3>
      <p>
        AI 추론 서버에 연결할 수 있는지 확인한 뒤 채팅을 시작합니다.
      </p>
    </section>
  );
}

/**
 * 대화가 시작되기 전, 서버가 꺼져 있을 때의 전체 안내 화면이다.
 *
 * 포트폴리오의 나머지는 정상이라는 점과 연락 방법을 함께 알려, 방문자가
 * 사이트 전체가 고장 났다고 오해하지 않게 한다. "다시 확인"은 상태 조회를
 * 한 번 더 돌린다.
 */
export function ChatOfflineScreen({
  onRetry,
}: Readonly<{ onRetry: () => void }>) {
  return (
    <section className={styles.availabilityState} role="status">
      <span className={styles.availabilityOfflineIcon} aria-hidden="true">
        !
      </span>
      <span className={styles.availabilityBadge}>오프라인</span>
      <h3>현재 챗봇을 이용할 수 없습니다</h3>
      <p className={styles.availabilityCopy}>
        <span>AI 추론 서버가 중지되어 있습니다.</span>
        <span>
          포트폴리오의 다른 내용은
          <br />
          정상적으로 둘러볼 수 있어요.
        </span>
        <span>
          실제 생성 답변 시연이 필요하면
          <br />
          포트폴리오에 공개된 연락처로 문의해 주세요.
        </span>
      </p>
      <button
        type="button"
        className={styles.availabilityRetry}
        onClick={onRetry}
      >
        다시 확인
      </button>
    </section>
  );
}

/**
 * 대화 도중 서버가 꺼져 있을 때 목록 위에 붙는 얇은 배너다.
 *
 * 대화와 입력창은 그대로 두고 "지금 답변은 검색 결과 기반"이라는 사실만
 * 알린다. 사용자가 답변의 성격을 오해하지 않게 하는 것이 목적이다.
 */
export function ChatOfflineBanner({
  onRetry,
}: Readonly<{ onRetry: () => void }>) {
  return (
    <div className={styles.offlineBanner} role="status">
      <p>추론 서버가 오프라인이에요. 검색 결과 기반 안내만 가능해요.</p>
      <button type="button" onClick={onRetry}>
        다시 확인
      </button>
    </div>
  );
}
