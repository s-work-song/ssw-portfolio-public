/**
 * 본인이 제공한 구직 사유를 바탕으로 자기소개서의 경력 전환 서사를 표시한다.
 * 새 탐색 탭이나 챗봇 계약 없이 기존 자기소개서 안의 독립 섹션으로 표시한다.
 */
import styles from './CareerTurningPointPreview.module.css';

const chapters = [
  {
    step: '01',
    phase: '멈춤',
    title: '직장생활을 멈춘 이유',
    paragraphs: [
      '저는 컴퓨터로 체계를 만들고 효율을 높이는 엔지니어링 자체에서 재미를 느껴 왔습니다. 다만 당시에는 업무 안에서 이런 관심을 충분히 탐구하기 어렵다고 느꼈습니다.',
      '웹 개발 경력 이후 게임 개발을 시작하면서, 바로 재취업하기보다 개인적으로 해보고 싶었던 것과 궁금했던 것을 직접 학습하고 실험하는 시간을 선택했습니다.',
    ],
  },
  {
    step: '02',
    phase: '생각의 정리',
    title: '그 시간을 지나며 정리한 생각',
    paragraphs: [
      'GPT 챗봇을 처음 사용해 보고, 궁금한 것을 알아보고 독학하는 데 유용하겠다고 느꼈습니다.',
      '이후 IDE에서 대규모 언어 모델(LLM)을 활용한 코드 제안 기능을 접하며, 개발 도구가 충분히 유용해질 때까지 학습과 실험을 이어가고자 했습니다.',
      'LLM 코드 제안 기능의 개선을 기다리던 중, AI 에이전트가 코드를 수정하고 작업을 진행하는 에이전틱 코딩을 접했습니다.',
      '처음에는 위험성과 한계 때문에 거리를 두었지만, 이후 직접 사용해 보면서 실제 작업에 활용할 수 있다는 가능성을 느꼈습니다.',
    ],
  },
  {
    step: '03',
    phase: '재시작',
    title: '다시 직장생활을 시작하려는 이유',
    paragraphs: [
      '현재의 AI 개발 도구는 실무에 활용할 수 있을 만큼 충분한 수준에 도달했다고 생각합니다. 이제는 개인적인 학습과 실험을 이어가는 데서 나아가, 실제 업무를 접하며 경력을 다시 이어 갈 시점이라고 판단했습니다.',
      '회사에서 승인한 AI 도구를 활용할 수 있는 환경에서 실무에 적응하고, 함께 일하는 사람들과 경험과 관계를 쌓고 싶습니다. 컴퓨터 시스템과 병목을 탐구해 온 경험을 바탕으로 문제를 살피고, 얻은 인사이트를 팀과 공유하며 기여하고자 합니다.',
    ],
  },
] as const;

export default function CareerTurningPointPreview() {
  return (
    <section
      id="cover-letter-career-turning-point"
      className={styles.section}
      tabIndex={-1}
      aria-labelledby="career-turning-point-title"
    >
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>생각과 선택의 흐름</p>
          <h3 id="career-turning-point-title" className={styles.title}>
            경력의 전환점
          </h3>
        </div>
      </div>

      <p className={styles.introduction}>
        직장생활을 멈췄던 배경부터 다시 시작하려는 이유까지,
        그 사이의 생각과 선택을 돌아봅니다.
      </p>

      <div className={styles.chapters}>
        {chapters.map((chapter) => (
          <article className={styles.chapter} key={chapter.step}>
            <div className={styles.chapterMeta}>
              <span className={styles.step} aria-hidden="true">{chapter.step}</span>
              <span className={styles.phase}>{chapter.phase}</span>
            </div>
            <h4 className={styles.chapterTitle}>{chapter.title}</h4>
            <div className={styles.copy}>
              {chapter.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
