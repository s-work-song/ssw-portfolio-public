import DeploymentDiagramCarousel from '@/components/about/DeploymentDiagramCarousel';
import {
  deploymentDiagrams,
  deploymentProjects,
} from '@/data/deployment';
import styles from './DeploymentOverview.module.css';

/** 본문은 정적 HTML로 제공하고 다이어그램 렌더링만 클라이언트에 맡긴다. */
export default function DeploymentOverview() {
  return (
    <section
      id="deployment-overview"
      tabIndex={-1}
      className={styles.overview}
      aria-labelledby="deployment-overview-title"
    >
      <header className={styles.header}>
        <p className={styles.eyebrow}>DEPLOYMENT</p>
        <h3 id="deployment-overview-title">프로젝트별 배포 구성</h3>
        <p className={styles.intro}>
          정적 웹 화면, API, LLM 추론을 역할에 맞게 나누었습니다.
          포트폴리오, 공용 인프라, 이커머스, 에셋 라이브러리의 배포 환경과
          요청 경로를 프로젝트별로 정리했습니다.
        </p>
      </header>

      <div className={styles.projects}>
        {deploymentProjects.map((project) => (
          <article key={project.id} className={styles.project}>
            <span className={styles.role}>{project.role}</span>
            <h4>{project.label}</h4>
            <p className={styles.hosting}>{project.hosting}</p>
            <p className={styles.projectDescription}>{project.description}</p>
          </article>
        ))}
      </div>

      <p className={styles.boundaryNote}>
        <strong>외부 공개 경계</strong>
        포트폴리오 API는 Worker에서 처리하고, 이커머스 업무 API와 공용 인프라 API는 별도 Tunnel 진입점을 사용합니다.
        에셋 라이브러리는 LAN·Tailscale에서 자체 인증으로 접근합니다.
        LLM 추론은 각 웹의 서버 측에서 요청하며, 추론용 Tunnel을 거쳐 Google Colab 추론 서버에 연결합니다.
        내부 데이터베이스와 파일 저장소를 직접 공개하지 않습니다.
      </p>

      <DeploymentDiagramCarousel diagrams={deploymentDiagrams} />
    </section>
  );
}
