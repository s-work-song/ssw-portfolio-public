import { ACTION_ROUTES } from '@/features/chat/constants';
import { researchOptimizationTabs } from '@/features/research/data/research';
import ResearchLink from './ResearchLink';
import styles from './OptimizationPreview.module.css';

const tabLabel = (id: string) => researchOptimizationTabs.find((tab) => tab.id === id)?.label ?? id;

/** 하위 탭마다 대표 실험 하나의 수치를 연구 페이지 표기 그대로 옮긴다. 수치를 바꾸면 연구 페이지도 함께 바꾼다. */
const optimizationHighlights = [
  {
    tab: 'cpu',
    href: ACTION_ROUTES.research_cpu,
    title: '분기 예측과 SIMD 벡터화',
    metric: '5,341 μs → 37 μs',
    note: '1M 바이트 범위 합산 · AVX2 SIMD 단독 약 143배',
  },
  {
    tab: 'memory',
    href: ACTION_ROUTES.research_memory,
    title: '캐시 친화 배치와 메모리 매핑 파일',
    metric: '915 ms → 65 ms',
    note: '10MB 파일 2개 대조 · SHA256 해시 비교 대비 약 14배',
  },
  {
    tab: 'serialization',
    href: ACTION_ROUTES.research_serialization,
    title: '비트 패킹과 압축 전송',
    metric: '68,502 B → 74 B',
    note: '프레임 기록 · JSON 대비 Protobuf + Nibble Pack + ZSTD 약 1/925',
  },
] as const;

/** 연구 페이지 성능 최적화 탭의 진입점이다. 카드는 각 하위 탭으로 바로 이동한다. */
export default function OptimizationPreview() {
  return (
    <section id="optimization-preview" className={styles.preview} aria-labelledby="optimization-preview-title">
      <p className={styles.eyebrow}>PERFORMANCE OPTIMIZATION</p>
      <h3 id="optimization-preview-title">성능 최적화 연구</h3>
      <p className={styles.intro}>
        CPU 파이프라인과 SIMD 벡터화, 메모리 배치와 파일 입출력, 직렬화와 전송 크기까지
        실행 계층별로 병목을 나눠 측정하고 개선했습니다.
      </p>
      <ul className={styles.cards} aria-label="성능 최적화 하위 주제 바로 보기">
        {optimizationHighlights.map((item) => (
          <li key={item.tab}>
            <ResearchLink href={item.href} className={styles.card}>
              <span className={styles.label}>{tabLabel(item.tab)}</span>
              <strong className={styles.title}>{item.title}</strong>
              <span className={styles.metric}>{item.metric}</span>
              <span className={styles.note}>{item.note}</span>
            </ResearchLink>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <p>측정 조건과 재구성한 벤치마크 코드는 연구 페이지에서 확인할 수 있습니다.</p>
        <ResearchLink href={ACTION_ROUTES.research_optimization} className={styles.more}>
          성능 최적화 살펴보기
        </ResearchLink>
      </div>
    </section>
  );
}
