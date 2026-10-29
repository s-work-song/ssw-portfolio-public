import Image from 'next/image';
import type { CSSProperties } from 'react';
import { aiWorkflowToolGroups } from '@/features/ai-workflow/data/aiWorkflow';
import styles from '../../../app/about-me/ai-workflow/AiWorkflow.module.css';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function WorkflowTools() {
  return (
    <section className={styles.example} aria-labelledby="workflow-tools-gallery-title">
      <p className={styles.eyebrow}>CONNECTED TOOLS</p>
      <h4 id="workflow-tools-gallery-title">MCP·CLI로 활용하는 도구의 예시</h4>
      <p className={styles.exampleSummary}>
        코드·문서·이슈 관리부터 디자인, 노트북 실험, 게임·3D 제작까지.
        아래 아이콘은 활용할 수 있는 수많은 도구 중 일부입니다.
      </p>
      {aiWorkflowToolGroups.map((group) => (
        <section key={group.id} className={styles.toolGroup} aria-labelledby={`workflow-tool-group-${group.id}`}>
          <h5 id={`workflow-tool-group-${group.id}`}>{group.title}</h5>
          <p className={styles.toolGroupDescription}>{group.description}</p>
          <ul className={styles.toolGrid} data-group={group.id} aria-label={`${group.title} 도구의 일부 예시`}>
            {group.tools.map((tool) => (
              <li key={tool.id} className={styles.toolCard}>
                <span className={styles.toolIcon} aria-hidden="true">
                  <Image src={`${basePath}${tool.icon}`} alt="" width={44} height={44} />
                </span>
                <strong>{tool.name}</strong>
                <span className={styles.toolDetail}>{tool.detail}</span>
              </li>
            ))}
            {group.id === 'cli' && (
              <li className={styles.toolMore} style={{ '--tool-more-span': Math.max(1, 7 - group.tools.length) } as CSSProperties}>
                <span role="img" aria-label="이 밖에도 다양한 CLI 도구가 있습니다">⋯</span>
              </li>
            )}
          </ul>
        </section>
      ))}
      <div className={styles.toolScope}>
        <h5>도구도, 활용 방식도 이 목록에 한정되지 않습니다</h5>
        <p>
          이 밖에도 문서·데이터·디자인·개발·운영을 위한 다양한 도구를 활용할 수 있습니다.
          MCP나 플러그인이 없어도, 명령을 실행할 수 있는 환경과 권한이 있다면
          에이전트가 CLI를 통해 도구를 직접 실행하고 결과를 확인하며 작업할 수 있습니다.
        </p>
        <p>
          예를 들어 Git으로 변경 이력을 관리하고, FFmpeg로 영상·음원을 변환하거나,
          Google Cloud CLI의 gcloud 명령으로 클라우드 자원을 다룰 수 있습니다.
          중요한 것은 연결 방식 자체보다 어떤 작업을 맡기고, 어디까지 허용하며, 결과를 어떻게 검증하느냐입니다.
        </p>
      </div>
      <p className={styles.environmentNote}>
        이해를 돕기 위한 분류이며, 같은 도구도 MCP·플러그인·CLI 등 여러 방식으로 활용할 수 있습니다.
        아이콘은 현재 연결 상태나 모든 작업 권한을 뜻하지 않습니다.
      </p>
    </section>
  );
}
