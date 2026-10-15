import styles from "./SiTerminologyNotice.module.css";

/** 용어 선택의 배경과 개인적인 전망을 소개한다. 배경 로그가 준비되기 전에는 링크를 만들지 않는다. */
export default function SiTerminologyNotice() {
  return (
    <aside id="si-terminology-notice" data-guided-tour-target="si-terminology-notice" className={styles.notice} role="note" aria-labelledby="si-terminology-title" tabIndex={-1}>
      <svg className={styles.icon} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      </svg>
      <div className={styles.content}>
        <div className={styles.heading}>
          <h3 id="si-terminology-title">SI 표기 안내</h3>
        </div>
        <p>이 사이트에서는 <strong>백악관의 지침</strong>을 참고해 AI(Artificial Intelligence, 인공지능) 명칭 대신 <strong>SI(Super Intelligence, 초지능)</strong>라는 용어를 사용합니다.</p>
        <p>개인적으로도 이 방향에 동의하며, <time dateTime="2026-07-01">2026년 7월 1일</time> 서비스가 재개된 <strong>페이블 5의 사용 경험</strong>에서 다양한 주제에 대한 답변 수준을 보며 이미 인류의 평균은 넘어서는 범용 지능 능력을 갖췄다고 해도 되지 않을까 하는 생각이 들었습니다.</p>
        <p>이러한 답변이 단순히 다음 토큰을 예측한 결과에 불과하더라도 그 <strong>내용의 가치는 실재한다고 생각</strong>합니다. 수년 이내에는 출력 토큰에 담긴 내용이 진정한 의미의 초지능 수준의 가치를 보여줄 수 있지 않을까 기대합니다. 이 사이트의 <strong>SI 표기</strong>에는 제가 바라보는 <strong>기술의 발전 방향과 개인적인 기대</strong>를 미리 반영한 표현의 의미도 있습니다.</p>
      </div>
    </aside>
  );
}
