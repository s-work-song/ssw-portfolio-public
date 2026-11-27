/**
 * 전역 디자인 토큰(app/globals.css)의 색 견본이다.
 *
 * 견본은 값을 적어 두지 않고 CSS 변수를 그대로 읽어(`background: var(--x)`) 칠하므로, 지금의
 * 화면 모드·포인트 컬러·시즌 테마 값이 보인다. 투명한 토큰도 보이도록 체크무늬 위에 칠한다.
 * 숫자 토큰(투명도)은 글자색 칸에 그 투명도를 걸어 보여 준다.
 */
import { cardClassName } from '@/components/surface/Surface';
import styles from './StyleGuide.module.css';

type TokenGroup = {
  title: string;
  note: string;
  tokens: readonly string[];
  /** 색이 아니라 투명도(0~1) 토큰이다. */
  opacity?: boolean;
};

const TOKEN_GROUPS: readonly TokenGroup[] = [
  { title: '바탕', note: '페이지·떠 있는 상자·옅은 상자', tokens: ['--bg', '--bg-elev', '--bg-elev-2'] },
  { title: '글자', note: '본문·보조·흐린 글자', tokens: ['--text', '--text-dim', '--text-mute'] },
  { title: '테두리', note: '보통·진한 테두리', tokens: ['--border', '--border-strong'] },
  {
    title: '포인트 색',
    note: '기능 버튼·링크·데이터 막대. 설정의 포인트 컬러를 따른다',
    tokens: ['--accent', '--accent-text', '--accent-soft'],
  },
  {
    title: '장식 강조색',
    note: '강조 막대·소제목·단계 번호처럼 꾸밈에만. 평소엔 포인트 색과 같고 시즌 테마가 바꿀 수 있다',
    tokens: ['--decor-accent', '--decor-accent-text', '--decor-accent-soft'],
  },
  {
    title: '시즌 장식 색',
    note: 'features/seasonal 그림 전용. 포인트 색이나 본문 의미색에는 쓰지 않는다',
    tokens: [
      '--season-fir',
      '--season-fir-bright',
      '--season-trunk',
      '--season-gold',
      '--season-gold-deep',
      '--season-ribbon',
      '--season-wire',
      '--season-bulb-edge',
      '--season-ice',
      '--season-ice-fill',
      '--season-blossom',
      '--season-blossom-deep',
      '--season-branch',
      '--season-sun',
      '--season-sea',
      '--season-maple-red',
      '--season-maple-orange',
      '--season-maple-yellow',
      '--season-snow',
    ],
  },
  {
    title: '시즌 투명도',
    note: '글자 뒤 워터마크와 해 그림의 투명도. 견본은 글자색에 그 투명도를 건 것',
    tokens: ['--season-watermark-opacity', '--season-sun-opacity'],
    opacity: true,
  },
];

export default function TokenSwatches() {
  return (
    <>
      {TOKEN_GROUPS.map((group) => (
        <div key={group.title} className={styles.group}>
          <div className={styles.groupHead}>
            <h3 className={styles.groupName}>{group.title}</h3>
            <span className={styles.groupMeta}>{group.note}</span>
          </div>
          <ul className={styles.swatchGrid}>
            {group.tokens.map((token) => (
              <li key={token} className={cardClassName({ tone: 'elev' }, styles.swatch)}>
                <span className={styles.swatchChip} aria-hidden="true">
                  <span
                    className={styles.swatchFill}
                    style={group.opacity ? { background: 'var(--text)', opacity: `var(${token})` } : { background: `var(${token})` }}
                  />
                </span>
                <span className={styles.swatchName}>
                  <code>{token}</code>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
