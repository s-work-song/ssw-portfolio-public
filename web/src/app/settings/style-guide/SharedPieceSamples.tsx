/**
 * 표면·버튼 말고 여러 화면이 함께 쓰는 작은 부품의 견본이다.
 *
 * 상태·외부 데이터 없이 정적으로 그릴 수 있는 부품만 실물로 둔다. 실제 미디어·브라우저 스크립트·
 * 채팅 백엔드가 있어야 하는 부품은 속을 흉내 내지 않고 이름과 위치, 뺀 까닭만 적는다.
 */
import AboutDecorativeGrid from '@/components/layout/AboutDecorativeGrid';
import SkillTagGroup from '@/components/ui/SkillTagGroup';
import { Card, Inset } from '@/components/surface/Surface';
import styles from './StyleGuide.module.css';

/** 여기서 그리지 않는 공용 부품과 그 까닭이다. */
const SKIPPED_PIECES = [
  {
    name: 'MermaidDiagram',
    path: 'components/diagrams',
    reason: '브라우저에서 흐름도 스크립트를 내려받아 그리는 부품이라 정적 견본에서 뺐다. 구조 화면에서 볼 수 있다.',
  },
  {
    name: 'ZoomableImage · MediaDialog · ArchiveVideoGallery',
    path: 'components/media',
    reason: '실제 사진·영상 항목과 확대·대화 상자 상태가 있어야 해서 뺐다. 소개 화면의 아카이브·프로젝트 카드에서 쓴다.',
  },
  {
    name: 'SettingsRadioGroup',
    path: 'features/settings/ui',
    reason: '설정 값과 묶인 선택 부품이다. 설정 화면에서 직접 본다.',
  },
  {
    name: '채팅 위젯 · AskAiButton · 둘러보기',
    path: 'features/chat',
    reason: '채팅 상태와 백엔드 API가 있어야 동작해서 뺐다.',
  },
] as const;

export default function SharedPieceSamples() {
  return (
    <>
      <div className={styles.pieceGrid}>
        <Card tone="base" className={styles.pieceCard}>
          <div className={styles.groupHead}>
            <h3 className={styles.groupName}>SkillTagGroup</h3>
            <span className={styles.groupMeta}>components/ui</span>
          </div>
          <SkillTagGroup title="분류 제목" skills={['TypeScript', 'Next.js', 'CSS Modules', 'Node.js']} />
          <p className={styles.snippet}>
            <code>{'<SkillTagGroup title="…" skills={[…]} />'}</code>
          </p>
          <p className={styles.specimenNote}>이력서 기술 분류처럼 제목과 태그 목록을 같은 규칙으로 그린다.</p>
        </Card>

        <Card tone="base" className={styles.pieceCard}>
          <div className={styles.groupHead}>
            <h3 className={styles.groupName}>AboutDecorativeGrid</h3>
            <span className={styles.groupMeta}>components/layout</span>
          </div>
          <Inset className={styles.gridStage}>
            <AboutDecorativeGrid />
            <span className={styles.gridStageLabel}>점 그리드 워터마크</span>
          </Inset>
          <p className={styles.snippet}>
            <code>{'<AboutDecorativeGrid />'}</code>
          </p>
          <p className={styles.specimenNote}>
            소개 패널 뒤에 까는 장식이다. 부모가 position: relative여야 하고, 다크 화면에서는 숨는다.
          </p>
        </Card>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupName}>여기서 그리지 않는 부품</h3>
        </div>
        <Inset dashed as="div">
          <ul className={styles.skippedList}>
            {SKIPPED_PIECES.map((piece) => (
              <li key={piece.name}>
                <span className={styles.skippedName}>
                  {piece.name} <code>{piece.path}</code>
                </span>
                <span className={styles.skippedReason}>{piece.reason}</span>
              </li>
            ))}
          </ul>
        </Inset>
      </div>
    </>
  );
}
