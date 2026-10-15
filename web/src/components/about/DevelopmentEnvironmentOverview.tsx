import DevelopmentEnvironmentDiagram from '@/components/about/DevelopmentEnvironmentDiagram';
import styles from './DevelopmentEnvironmentOverview.module.css';

/** 배포 프로젝트와 분리해 사용자가 알려준 개발 환경의 논리적 연결만 표시한다. */
export default function DevelopmentEnvironmentOverview() {
  return (
    <section id="development-environment" tabIndex={-1} className={styles.environment}
      aria-labelledby="development-environment-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>DEVELOPMENT ENVIRONMENT</p>
        <h3 id="development-environment-title">개발 환경 연결 구조</h3>
        <p className={styles.intro}>
          어느 기기에서 어떤 도구에 접속하는지와 기기 간 연결을 한 그림에 정리했습니다.
          내 기기 4대와 외부 실행 환경 4개를 먼저 나누고, 폰에서 조작하는 앱과 실제 작업이 실행되는 PC를 구분했습니다.
        </p>
      </header>
      <div className={styles.diagramPanel}>
        <DevelopmentEnvironmentDiagram />
      </div>
    </section>
  );
}
