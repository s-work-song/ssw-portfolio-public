import { ACTION_ROUTES } from '@/features/chat/constants';
import ResearchLink from '@/features/research/ui/ResearchLink';
import styles from './OpenWeightDetailFooter.module.css';

/** 소개 페이지 오픈웨이트 모델 실험 섹션에서 같은 이름의 연구 탭(상세)으로 넘어가는 진입점이다. */
export default function OpenWeightDetailFooter() {
  return (
    <div className={styles.footer}>
      <p>챗봇 구조 실험과 미세조정 학습 데이터의 형식·예시는 연구 경험의 오픈웨이트 모델 실험 탭에 자세히 정리했습니다.</p>
      <ResearchLink href={ACTION_ROUTES.research_open_weight} className={styles.more}>
        오픈웨이트 모델 실험 상세 보기
      </ResearchLink>
    </div>
  );
}
