/**
 * 전역 버튼 클래스(hover-btn-primary·hover-btn-secondary·hover-btn-inverse)의 견본이다.
 *
 * 이 클래스들은 모양을 정하지 않고 hover 움직임·다크 화면 글자색·시즌 무늬만 맡는다. 모양은
 * 쓰는 곳의 인라인 스타일이 정하므로, 견본도 사이트에서 실제로 쓰는 스타일을 그대로 옮겨 둔다.
 * 사이트에서는 Link나 a로 쓰지만 여기서는 이동하지 않는 button으로 그린다.
 */
import type { CSSProperties } from 'react';
import { Card } from '@/components/surface/Surface';
import styles from './StyleGuide.module.css';

/** 설정 화면 맨 아래 "홈으로 돌아가기"와 같은 모양이다. */
const PRIMARY_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '9px',
  padding: '13px 22px',
  border: 'none',
  borderRadius: '12px',
  background: 'var(--accent, #6366f1)',
  color: 'var(--accent-contrast, #fff)',
  fontSize: '14.5px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 16px 34px -14px var(--accent-soft)',
};

/** 소개 화면 마지막 "이력서(Resume) 보러 가기"와 같은 모양이다. */
const INVERSE_STYLE: CSSProperties = {
  display: 'inline-block',
  padding: '12px 28px',
  border: 'none',
  borderRadius: '8px',
  background: 'var(--text)',
  color: 'var(--bg)',
  fontSize: '1rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: 'var(--shadow)',
};

/** 프로젝트 카드의 보조 링크와 같은 모양이다. */
const SECONDARY_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  minHeight: '36px',
  padding: '7px 11px',
  border: '1px solid var(--border-strong)',
  borderRadius: '9px',
  background: 'var(--bg-elev)',
  color: 'var(--text-dim)',
  fontSize: '0.78rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const SAMPLES = [
  {
    name: '주요 버튼',
    className: 'hover-btn-primary',
    style: PRIMARY_STYLE,
    label: '홈으로 돌아가기',
    usage: '설정 화면 맨 아래 이동 버튼, 프로젝트 카드의 데모 링크. 포인트 색 바탕이다.',
  },
  {
    name: '반전 주요 버튼',
    className: 'hover-btn-primary hover-btn-inverse',
    style: INVERSE_STYLE,
    label: '이력서 보러 가기',
    usage: '소개·이력서·자기소개서·기록 마지막 이동 버튼, 404 화면. 글자색 바탕에 바탕색 글자다.',
  },
  {
    name: '보조 버튼',
    className: 'hover-btn-secondary',
    style: SECONDARY_STYLE,
    label: '자세히 보기',
    usage: '프로젝트 카드의 링크, 실험 갤러리의 기록 링크. 마우스를 올리면 포인트 색 테두리와 옅은 바탕으로 바뀐다.',
  },
] as const;

export default function ButtonSamples() {
  return (
    <div className={styles.buttonGrid}>
      {SAMPLES.map((sample) => (
        <Card key={sample.className} tone="base" className={styles.buttonSpecimen}>
          <div className={styles.groupHead}>
            <h3 className={styles.groupName}>{sample.name}</h3>
          </div>
          <div className={styles.buttonStage}>
            <button type="button" className={sample.className} style={sample.style}>
              {sample.label}
            </button>
          </div>
          <p className={styles.snippet}>
            <code>{`className="${sample.className}"`}</code>
          </p>
          <p className={styles.specimenNote}>{sample.usage}</p>
        </Card>
      ))}
    </div>
  );
}
