import Link from 'next/link';
import styles from './ArchitecturePreview.module.css';

export default function ArchitecturePreview() {
  return (
    <section id="architecture-preview" tabIndex={-1} className={styles.preview} aria-labelledby="architecture-preview-title">
      <p className={styles.eyebrow}>DEVELOPMENT &amp; DEPLOYMENT</p>
      <h3 id="architecture-preview-title">개발·배포 환경 구성</h3>
      <p className={styles.intro}>
        프로젝트별 배포 구조와 개발 환경의 연결 관계를 정리했습니다.
        화면·API·LLM의 역할과 인프라 전환 이력을 살펴보세요.
      </p>
      <Link href="/about-me/architecture/" className={styles.more}>
        개발·배포 환경 살펴보기 <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
