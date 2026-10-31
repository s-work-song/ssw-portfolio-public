/**
 * 오픈웨이트 모델 실험 탭의 학습 데이터 카드 세 장(형식·한 줄 구성·예시)을 그린다.
 * 콘텐츠는 data/trainingData에 두고, 이 파일은 JSON 표시 방식과 카드 배치만 맡는다.
 */
import { AskAiButton } from '@/features/chat';
import {
  trainingDataFormats,
  trainingExamples,
  trainingExamplesDescription,
  trainingFormatChoice,
  trainingLineParts,
  trainingLineSkeleton,
  trainingLossNote,
  type TrainingExample,
} from '@/features/research/data/trainingData';
import styles from './TrainingDataCards.module.css';

/** 중첩된 키마다 줄을 나누고 두 칸씩 들여 써, 검색 결과처럼 깊은 JSON도 구조가 보이게 한다. */
function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** 호출·결과를 학습 대화 순서대로 한 블록에 적는다. 호출만 정답이고 결과는 입력이다. */
function trainingTranscript({ steps }: TrainingExample): string {
  const lines: string[] = [];
  steps.forEach(({ call, result }, index) => {
    const order = steps.length > 1 ? ` ${index + 1}` : '';
    lines.push(`// 호출${order} · 정답`, prettyJson(call), `// 결과${order} · 입력`, prettyJson(result));
  });
  return lines.join('\n');
}

function CardHeader({ id, title, badge }: { id: string; title: string; badge: string }) {
  return (
    <div className={styles.header}>
      <h3 id={id}>{title}</h3>
      <span className={styles.badge}>{badge}</span>
    </div>
  );
}

const otherFormats = trainingDataFormats.filter((format) => !format.used);
const usedFormat = trainingDataFormats.find((format) => format.used);

export default function TrainingDataCards() {
  return (
    <>
      <section id="research-training-data" tabIndex={-1} className={styles.card} aria-labelledby="research-training-data-title">
        <CardHeader id="research-training-data-title" title="학습 데이터 형식" badge="Dataset Format" />
        <p className={styles.lead}>
          미세조정 학습 데이터는 보통 한 줄에 샘플 하나를 담는 JSONL(JSON Lines) 파일로 준비하며, 샘플을 적는 형식은 학습 목적에 따라 여러 가지가 있습니다.
        </p>
        <AskAiButton align="end" question="「학습 데이터 형식」에서 Alpaca 같은 다른 형식 대신 Conversational 형식으로 학습한 이유를 설명해 주세요." />
        <div className={styles.formatGrid}>
          {otherFormats.map((format) => (
            <article key={format.id} className={styles.format}>
              <h4>{format.name}</h4>
              <pre tabIndex={0} aria-label={`${format.name} 한 줄 모양`}><code>{prettyJson(format.shape)}</code></pre>
              <p>{format.desc}</p>
            </article>
          ))}
        </div>
        {/* 이 챗봇이 쓴 형식은 다른 형식 뒤에 넓게 두고, 고른 이유를 바로 옆에 적는다. */}
        {usedFormat && (
          <article className={styles.formatUsed}>
            <h4>
              {usedFormat.name}
              <span className={styles.usedMark}>이 사이트 챗봇에 사용</span>
            </h4>
            <div className={styles.usedBody}>
              <pre tabIndex={0} aria-label={`${usedFormat.name} 한 줄 모양`}><code>{prettyJson(usedFormat.shape)}</code></pre>
              <div>
                <p>{usedFormat.desc}</p>
                <p className={styles.reasonTitle}>{trainingFormatChoice.title}</p>
                <ul>
                  {trainingFormatChoice.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              </div>
            </div>
          </article>
        )}
      </section>

      <section id="research-training-line" tabIndex={-1} className={styles.card} aria-labelledby="research-training-line-title">
        <CardHeader id="research-training-line-title" title="학습 파일 한 줄의 구성" badge="JSONL Line" />
        <p className={styles.lead}>
          아래 학습 데이터 예시의 카드 하나가 학습 파일(JSONL)의 한 줄입니다. 한 줄은 방문자 질문으로 시작하는 대화 한 편(에피소드)이고, 예시 카드에는 사람이 읽을 부분만 남겼습니다.
        </p>
        <AskAiButton align="end" question="「학습 파일 한 줄의 구성」에서 예시 카드에 생략된 부분과 정답으로 학습하는 범위를 설명해 주세요." />
        {/* 넓은 화면에서는 줄인 JSON과 생략한 부분 설명을 나란히 둔다. */}
        <div className={styles.lineBody}>
          <pre className={styles.skeleton} tabIndex={0} aria-label="일반 질문 예시의 실제 학습 줄을 줄인 모양"><code>{prettyJson(trainingLineSkeleton)}</code></pre>
          <div className={styles.partsColumn}>
            <h4>예시 카드에서 생략한 부분</h4>
            <dl className={styles.parts}>
              {trainingLineParts.map((part) => (
                <div key={part.label}>
                  <dt>
                    {part.label}
                    <code>{part.location}</code>
                  </dt>
                  <dd>{part.desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <p className={styles.lossNote}>{trainingLossNote}</p>
      </section>

      <section id="research-training-examples" tabIndex={-1} className={styles.card} aria-labelledby="research-training-examples-title">
        <CardHeader id="research-training-examples-title" title="학습 데이터 예시" badge="Training Examples" />
        <p className={styles.lead}>{trainingExamplesDescription}</p>
        <AskAiButton align="end" question="「학습 데이터 예시」의 두 예시가 각각 무엇을 가르치려는지 설명해 주세요." />
        <div className={styles.trainingGrid}>
          {trainingExamples.map((example) => (
            <article className={styles.trainingExample} key={example.id} aria-labelledby={`research-training-${example.id}`}>
              <h4 id={`research-training-${example.id}`}>{example.title}</h4>
              <dl>
                <dt>방문자 질문</dt>
                <dd className={styles.trainingRequest}>{example.question}</dd>
                <dt>도구 호출과 결과</dt>
                <dd className={styles.trainingOutput}><pre tabIndex={0} aria-label={`${example.title} 도구 호출과 결과`}><code>{trainingTranscript(example)}</code></pre></dd>
                <dt>답변 · 학습용 정답</dt>
                <dd className={styles.trainingReport}>{example.answer}</dd>
                <dt>학습 의도</dt>
                <dd className={styles.trainingIntent}>
                  {example.intent}
                  {example.note && <strong className={styles.trainingNote}>{example.note}</strong>}
                </dd>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
