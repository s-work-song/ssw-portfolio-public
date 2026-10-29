import type { Metadata } from 'next';
import ArchitectureTabs from '@/features/architecture/ui/ArchitectureTabs';
import DeploymentOverview from '@/features/architecture/ui/DeploymentOverview';
import DevelopmentEnvironmentOverview from '@/features/architecture/ui/DevelopmentEnvironmentOverview';
import InfrastructureMigration from '@/features/architecture/ui/InfrastructureMigration';
import styles from './Architecture.module.css';

export const metadata: Metadata = {
  title: '개발·배포 환경 구성 | Environments',
  description: '사설망·원격 작업·외부 클라우드 개발 환경과 프로젝트별 배포·API·LLM 연결 구조, 인프라 전환 이력을 정리합니다.',
};

export default function ArchitecturePage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>DEVELOPMENT &amp; DEPLOYMENT</p>
        <h2>개발·배포 환경 구성</h2>
        <p className={styles.lead}>
          개발 환경에서는 기기·도구의 접속 경로를, 배포 구성에서는 프로젝트별
          화면·API·추론의 연결을 살펴볼 수 있습니다. 인프라 최적화에서는 Rust 재구현과 Pi 이관 과정을 정리했습니다.
        </p>
      </header>
      <ArchitectureTabs
        development={<DevelopmentEnvironmentOverview />}
        deployment={<DeploymentOverview />}
        migration={<InfrastructureMigration />}
      />
    </div>
  );
}
