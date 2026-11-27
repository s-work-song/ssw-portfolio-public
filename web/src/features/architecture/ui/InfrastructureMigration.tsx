import DeploymentMemoryHistory from '@/features/architecture/ui/DeploymentMemoryHistory';
import { infrastructureMigrationReasons, infrastructureTransition } from '@/features/architecture/data/deployment';
import layoutStyles from './DeploymentOverview.module.css';
import styles from './InfrastructureMigration.module.css';

/** 현재 배포 구성과 최적화·이관 배경을 분리하되 기존 메모리 상세 앵커는 유지한다. */
export default function InfrastructureMigration() {
  return (
    <section id="infrastructure-migration" tabIndex={-1} className={layoutStyles.overview}
      aria-labelledby="infrastructure-migration-title">
      <header className={layoutStyles.header}>
        <p className={layoutStyles.eyebrow}>INFRASTRUCTURE OPTIMIZATION</p>
        <h3 id="infrastructure-migration-title">공용 인프라 최적화와 이관</h3>
        <p className={layoutStyles.intro}>
          클라우드 비용 절감에서 시작해, 파일 서버용 Pi에 전체 백엔드를 이전하는 작업으로 이어졌습니다.
          Rust 재구현과 메모리 최적화, Raspberry Pi 이관 과정을 정리했습니다.
        </p>
      </header>
      <ul className={styles.reasons} aria-label="비용 절감에서 Pi 이전까지">
        {infrastructureMigrationReasons.map(reason => (
          <li key={reason.id}><h4>{reason.title}</h4><p>{reason.description}</p></li>
        ))}
      </ul>
      <ol className={styles.timeline} aria-label="공용 인프라 전환 단계">
        {infrastructureTransition.map(step => (
          <li key={step.id}>
            <span className={styles.stepNumber} aria-hidden="true">{step.number}</span>
            <div className={styles.stepContent}>
              <h4>{step.title}</h4>
              <p className={styles.technologies}>{step.technologies}</p>
              <p className={styles.stepDescription}>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <DeploymentMemoryHistory />
    </section>
  );
}
