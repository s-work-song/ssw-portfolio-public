/**
 * 사이트가 함께 쓰는 UI 부품을 한 화면에 모은 스타일 가이드다(설정 → 스타일 가이드).
 *
 * 견본은 모두 실제 부품과 전역 토큰으로 그리므로, 화면 모드·포인트 컬러·시즌 테마를 바꾸면
 * 여기도 같이 바뀐다. 이 파일은 머리글·소개·목차와 절 순서만 맡고, 절마다의 견본은 같은
 * 폴더의 부품이 그린다. 상태·효과가 없는 서버 컴포넌트라 정적 export에 그대로 나간다.
 * 절의 상자도 공통 표면 부품(Panel)을 써서 이 화면 자체가 같은 규칙을 따른다.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { Panel } from '@/components/surface/Surface';
import ButtonSamples from './ButtonSamples';
import SeasonArtGallery from './SeasonArtGallery';
import SeasonParticlePreview from './SeasonParticlePreview';
import SharedPieceSamples from './SharedPieceSamples';
import SiteSeasonControls from './SiteSeasonControls';
import SurfaceCatalog from './SurfaceCatalog';
import ThemePreviewGrid from './ThemePreviewGrid';
import TokenSwatches from './TokenSwatches';
import styles from './StyleGuide.module.css';

/**
 * 설정 레이아웃이 제목을 문자열로만 정해 루트의 제목 틀('%s | SSW 소개페이지')이 이 화면까지
 * 내려오지 않으므로, 다른 화면과 같은 꼴이 되게 전체 제목을 직접 적는다.
 */
export const metadata: Metadata = {
  title: { absolute: '스타일 가이드 | SSW 소개페이지' },
  description: '사이트가 함께 쓰는 표면 부품·디자인 토큰·버튼·시즌 장식과 계절 효과를 모은 화면',
};

/** 절 목록이다. 목차와 본문이 같은 표를 쓰고 움직이는 계절 효과를 바로 찾을 수 있게 둔다. */
const SECTIONS: readonly {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  Content: ComponentType;
}[] = [
  {
    id: 'particle-preview',
    eyebrow: 'Seasonal Motion',
    title: '계절 효과 미리보기',
    description:
      '사이트의 눈·낙엽·벚꽃·비를 같은 조건에서 비교합니다. 여기서 고른 효과와 카드 앞뒤 설정은 이 견본 안에서만 적용됩니다.',
    Content: SeasonParticlePreview,
  },
  {
    id: 'theme-preview',
    eyebrow: 'Theme Preview',
    title: '테마 미리보기',
    description:
      '시즌 테마마다 소개 화면을 줄여 그린 견본입니다. 칸마다 자기 테마를 따로 그리므로 사이트 전체의 테마 설정은 바뀌지 않습니다. 패널 장식·카드 모서리 장식·위 가장자리 띠·안내 상자 막대·버튼 무늬·장식 강조색을 한눈에 비교할 수 있어요.',
    Content: ThemePreviewGrid,
  },
  {
    id: 'surfaces',
    eyebrow: 'Surfaces',
    title: '표면 부품',
    description:
      'components/surface의 네 부품입니다. 모양(모서리·테두리·바탕·그림자)은 부품이 정하고, 안쪽 배치는 쓰는 쪽이 className·style로 더합니다. 새 상자도 이 부품으로 그리면 시즌 테마가 따라옵니다.',
    Content: SurfaceCatalog,
  },
  {
    id: 'tokens',
    eyebrow: 'Design Tokens',
    title: '디자인 토큰',
    description:
      'app/globals.css의 전역 색 토큰입니다. 견본은 CSS 변수를 그대로 읽어 칠하므로 지금 화면 모드·포인트 컬러·시즌 테마의 값이 보입니다.',
    Content: TokenSwatches,
  },
  {
    id: 'buttons',
    eyebrow: 'Buttons',
    title: '버튼',
    description:
      '전역 버튼 클래스는 hover 움직임과 다크 화면 글자색, 시즌 무늬(크리스마스의 줄무늬·금빛 테두리)만 맡고 모양은 쓰는 곳의 인라인 스타일이 정합니다. 아래 견본은 사이트에서 실제로 쓰는 모양 그대로입니다.',
    Content: ButtonSamples,
  },
  {
    id: 'shared-pieces',
    eyebrow: 'Shared Pieces',
    title: '기타 공용 부품',
    description: '여러 화면이 함께 쓰는 작은 부품입니다. 정적으로 그릴 수 있는 것만 실물로 두었습니다.',
    Content: SharedPieceSamples,
  },
  {
    id: 'season-art',
    eyebrow: 'Season Art',
    title: '시즌 장식 그림',
    description:
      'features/seasonal/SeasonArt의 SVG 조각입니다. 색은 --season-* 토큰으로 칠하므로 라이트·다크에 따라 바뀌고, 크기는 쓰는 자리의 클래스가 정합니다.',
    Content: SeasonArtGallery,
  },
];

export default function StyleGuidePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/settings" className={`hover-footer-link ${styles.headerBack}`}>
            <span className={styles.headerBackIcon}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </span>
            설정
          </Link>
          <span className={styles.headerLabel}>STYLE GUIDE</span>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.introEyebrow}>Style Guide</p>
          <h1 className={styles.introTitle}>스타일 가이드</h1>
          <p className={styles.introText}>
            사이트 곳곳에서 함께 쓰는 UI 부품을 한곳에 모았습니다. 어떤 부품과 변형이 있는지, 시즌 테마마다
            어떻게 보이는지 확인할 수 있어요. 견본은 실제 부품과 전역 토큰으로 그려서 설정에서 바꾼 화면 모드와
            포인트 컬러가 그대로 반영됩니다.
          </p>
          <Link href="/settings" className={`hover-btn-secondary ${styles.backButton}`}>
            <span aria-hidden="true">←</span>
            설정으로 돌아가기
          </Link>
          <SiteSeasonControls />
          <nav aria-label="스타일 가이드 목차">
            <ul className={styles.toc}>
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {SECTIONS.map(({ id, eyebrow, title, description, Content }) => (
          <Panel key={id} id={id} aria-labelledby={`${id}-title`} className={styles.section}>
            <div>
              <p className={styles.sectionEyebrow}>{eyebrow}</p>
              <h2 id={`${id}-title`} className={styles.sectionTitle}>
                {title}
              </h2>
              <p className={styles.sectionText}>{description}</p>
            </div>
            <Content />
          </Panel>
        ))}
      </main>
    </div>
  );
}
