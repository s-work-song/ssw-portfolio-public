/**
 * 시즌 장식에 쓰는 SVG 조각 모음이다(별·산타 양말·눈송이·벚꽃·해·단풍잎·전구 줄·전나무·썰매 등).
 *
 * 색은 모두 CSS 클래스(`SeasonDecoration.module.css`)가 `--season-*` 토큰으로 칠한다.
 * 모양만 여기서 정하므로 라이트·다크가 바뀌어도 마크업은 그대로다.
 */
import styles from './SeasonDecoration.module.css';

type ArtProps = { className?: string };

export const STAR_PATH = 'M12 2.5l2.76 5.6 6.18.9-4.47 4.36 1.06 6.15L12 16.6l-5.53 2.91 1.06-6.15L3.06 9l6.18-.9z';
const MAPLE_PATH =
  'M12 1.8l1.7 3.9 2.8-1.3-.7 4.1 3.9-.9-1.5 3 2.4 1.3-3.7 2.4.9 2.4-3.9-.7L12 19l-1.9-3-3.9.7.9-2.4-3.7-2.4 2.4-1.3-1.5-3 3.9.9-.7-4.1 2.8 1.3z';

export function Star({ className }: ArtProps) {
  return (
    <svg className={`${styles.star} ${className ?? ''}`} viewBox="0 0 24 24" focusable="false">
      <path d={STAR_PATH} />
    </svg>
  );
}

/** 고리에 걸린 산타 양말. 빨간 몸통·흰 털 띠·초록 뒤꿈치와 발끝, 금빛 고리. */
export function Stocking({ className }: ArtProps) {
  return (
    <svg className={`${styles.stocking} ${className ?? ''}`} viewBox="0 0 24 24" focusable="false">
      <path d="M9.4 3.2c-.6-1.6.4-2.6 1.6-2.3" className={styles.stockingLoop} />
      <path
        d="M8.6 7h7.2v7.3c0 .8.4 1.3 1.1 1.6l2.5 1.1c1.7.8 2.1 2.6 1.1 3.9-.9 1.1-2.4 1.4-3.8.8l-6-2.5C9.3 18.6 8.6 17.6 8.6 16.2Z"
        className={styles.stockingBody}
      />
      <path d="M16.9 15.9l2.5 1.1c1.7.8 2.1 2.6 1.1 3.9-.4.5-.9.8-1.5.9-.6-1.9-1.5-3.4-3-4.6.3-.6.5-1 .9-1.3Z" className={styles.stockingPatch} />
      <path d="M8.6 15.4c1.6.1 2.9.8 3.6 2.1l-1.6-.7C9.3 16.2 8.7 15.9 8.6 15.4Z" className={styles.stockingPatch} />
      <rect x={7.6} y={3.2} width={9.2} height={4.4} rx={1.6} className={styles.stockingCuff} />
    </svg>
  );
}

export function Snowflake({ className }: ArtProps) {
  return (
    <svg className={`${styles.snowflake} ${className ?? ''}`} viewBox="-12 -12 24 24" focusable="false">
      {[0, 60, 120].map((angle) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <line x1={0} y1={-10} x2={0} y2={10} />
          <polyline points="-3,-7.5 0,-4.5 3,-7.5" />
          <polyline points="-3,7.5 0,4.5 3,7.5" />
        </g>
      ))}
    </svg>
  );
}

export function Blossom({ className }: ArtProps) {
  return (
    <svg className={`${styles.blossom} ${className ?? ''}`} viewBox="-12 -12 24 24" focusable="false">
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse key={angle} className={styles.petal} cx={0} cy={-5.6} rx={3.7} ry={5.2} transform={`rotate(${angle})`} />
      ))}
      <circle className={styles.blossomCore} r={2.2} />
    </svg>
  );
}

export function Sun({ className }: ArtProps) {
  return (
    <svg className={`${styles.sun} ${className ?? ''}`} viewBox="-12 -12 24 24" focusable="false">
      <circle className={styles.sunDisc} r={5.6} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line key={angle} className={styles.sunRay} x1={0} y1={-8} x2={0} y2={-11} transform={`rotate(${angle})`} />
      ))}
    </svg>
  );
}

export function MapleLeaf({ className, tone = 'red' }: ArtProps & { tone?: 'red' | 'orange' | 'yellow' }) {
  const toneClass = tone === 'red' ? styles.mapleRed : tone === 'orange' ? styles.mapleOrange : styles.mapleYellow;
  return (
    <svg className={`${styles.maple} ${toneClass} ${className ?? ''}`} viewBox="0 0 24 24" focusable="false">
      <path d={MAPLE_PATH} />
      <line className={styles.mapleStem} x1={12} y1={18} x2={12} y2={23} />
    </svg>
  );
}

/** 전구 하나(처진 전선 위 한 점 x, y 아래에 매달림). */
function Bulb({ x, y, tone, size = 1 }: { x: number; y: number; tone: string; size?: number }) {
  return (
    <g className={tone}>
      <rect className={styles.bulbCap} x={x - 2.4 * size} y={y - 0.6} width={4.8 * size} height={3.4 * size} rx={1} />
      <ellipse className={styles.bulbGlass} cx={x} cy={y + 7.5 * size} rx={4.2 * size} ry={6 * size} />
    </g>
  );
}

const BULB_TONES = [styles.bulbGold, styles.bulbRibbon, styles.bulbFir];

/** 리본 매듭(전나무 줄이 걸린 자리). */
function Bow({ x, y }: { x: number; y: number }) {
  return (
    <g className={styles.bow} transform={`translate(${x} ${y})`}>
      <path d="M0 0 L-9 -6 L-9 6 Z" />
      <path d="M0 0 L9 -6 L9 6 Z" />
      <path d="M0 0 L-5 12 L-1 11 Z" />
      <path d="M0 0 L5 12 L1 11 Z" />
      <circle r={2.6} />
    </g>
  );
}

/**
 * 전나무 가랜드다. 처짐 `swags`번, 처짐마다 전구 세 개, 걸린 자리마다 리본.
 * 전구 위치는 각 2차 곡선의 t = 0.25, 0.5, 0.75 지점이다.
 */
export function Garland({ className, swags = 5, width = 1000 }: ArtProps & { swags?: number; width?: number }) {
  const span = width / swags;
  const top = 8;
  const sag = 50;
  const yAt = (t: number) => (1 - t) ** 2 * top + 2 * t * (1 - t) * sag + t ** 2 * top;
  let d = `M0 ${top}`;
  for (let i = 0; i < swags; i += 1) d += ` Q${span * i + span / 2} ${sag} ${span * (i + 1)} ${top}`;
  let index = 0;
  return (
    <svg className={`${styles.garland} ${className ?? ''}`} viewBox={`0 -4 ${width} 74`} focusable="false" preserveAspectRatio="xMidYMin meet">
      <path className={styles.garlandRope} d={d} />
      <path className={styles.garlandNeedles} d={d} />
      {Array.from({ length: swags }, (_, i) =>
        [0.25, 0.5, 0.75].map((t) => {
          const tone = BULB_TONES[index % BULB_TONES.length];
          index += 1;
          return <Bulb key={`${i}-${t}`} x={span * i + span * t} y={yAt(t) + 3} tone={tone} size={1.15} />;
        }),
      )}
      {Array.from({ length: swags + 1 }, (_, i) => <Bow key={i} x={span * i} y={top} />)}
    </svg>
  );
}

/** 세 단 기하학 전나무 실루엣. 꼭대기에 별, 단마다 장식볼. */
export function FirTree({ className }: ArtProps) {
  return (
    <svg className={`${styles.tree} ${className ?? ''}`} viewBox="0 0 120 150" focusable="false">
      <g className={styles.fir}>
        <polygon points="60,24 88,62 32,62" />
        <polygon points="60,44 98,94 22,94" />
        <polygon points="60,70 112,130 8,130" />
        <rect x={52} y={130} width={16} height={16} rx={2} className={styles.trunk} />
      </g>
      <circle cx={50} cy={56} r={3.2} className={styles.ornamentGold} />
      <circle cx={72} cy={84} r={3.2} className={styles.ornamentRibbon} />
      <circle cx={40} cy={88} r={3.2} className={styles.ornamentGold} />
      <circle cx={84} cy={122} r={3.4} className={styles.ornamentGold} />
      <circle cx={56} cy={114} r={3.4} className={styles.ornamentRibbon} />
      <circle cx={28} cy={124} r={3.4} className={styles.ornamentGold} />
      <g transform="translate(47 2) scale(1.08)">
        <path d={STAR_PATH} className={styles.starPath} />
      </g>
    </svg>
  );
}

/**
 * 루돌프 다리 자세다(몸 가운데가 원점, 오른쪽이 앞).
 * - tuck: 앞다리를 접고 뒷다리를 뒤로 뻗은 도약.
 * - reach: 앞다리를 뻗고 뒷다리를 모은 착지 직전.
 * - gather: 네 다리를 몸 아래로 모은 순간.
 * - extend: 앞뒤 다리를 모두 쭉 뻗은 공중 동작.
 * 멈춘 그림에서는 tuck·reach를 번갈아 세워 무리가 달리는 것처럼 읽히게 하고,
 * 나는 동안(galloping)에는 GALLOP_FRAMES 순서로 네 자세를 바꿔 다리가 실제로 움직인다.
 */
const REINDEER_LEGS = {
  tuck: ['M11 3 L18 9 L13 14', 'M8 4.5 L14 11 L9 14.5', 'M-11 3 L-19 7 L-28 8', 'M-13 1.5 L-21 3.5 L-30 2.5'],
  reach: ['M11 3 L19 8 L27 8.5', 'M8 4.5 L16 10 L23 13', 'M-11 3 L-15 10 L-10 15', 'M-13 1.5 L-19 8 L-16 13.5'],
  gather: ['M11 3 L14 10 L10 15', 'M8 4.5 L10 11 L6 15.5', 'M-11 3 L-9 10 L-5 14.5', 'M-13 1.5 L-12.5 8.5 L-8.5 13.5'],
  extend: ['M11 3 L19 8 L27 8.5', 'M8 4.5 L16 10 L23 13', 'M-11 3 L-19 7 L-28 8', 'M-13 1.5 L-21 3.5 L-30 2.5'],
} as const;

type ReindeerPose = keyof typeof REINDEER_LEGS;

/** 한 번 뛰는 동안의 다리 자세 차례다. 모았다가 앞을 뻗고, 공중에서 쭉 펴고, 앞을 접으며 내려온다. */
const GALLOP_FRAMES: readonly ReindeerPose[] = ['gather', 'reach', 'extend', 'tuck'];
/** 네 자세를 한 바퀴 도는 시간(초)이다. CSS(.gallopFrame)의 애니메이션 길이와 같아야 한다. */
const GALLOP_CYCLE_S = 0.56;

/** 뒤로 젖힌 뿔 두 개(먼 쪽·가까운 쪽). 줄기마다 가지 세 개. */
const REINDEER_ANTLERS =
  'M24.5 -21 C22 -26 19 -29 15 -31 M21.5 -26.2 L23 -31.5 M18 -29.4 L18.5 -34.5 M15 -31 L12.5 -34 ' +
  'M26.5 -21.5 C26 -27 24 -31 20.5 -34 M25.9 -26.5 L29.5 -30 M23.9 -30.5 L26 -35.5 M20.5 -34 L19 -38';

/**
 * 썰매를 끄는 루돌프 넷. 오른쪽 위로 조금씩 오르며 한 줄로 선다.
 * phase는 나는 동안 다리 박자를 마리마다 조금씩 어긋나게 하는 몫(한 바퀴 중 비율)이다. 똑같이 뛰면 기계처럼 보인다.
 */
const SLEIGH_TEAM = [
  { x: 164, y: 72, pose: 'tuck', phase: 0 },
  { x: 226, y: 65, pose: 'reach', phase: 0.375 },
  { x: 288, y: 58, pose: 'tuck', phase: 0.125 },
  { x: 350, y: 51, pose: 'reach', phase: 0.5 },
] as const;

interface ReindeerProps {
  x: number;
  y: number;
  pose: ReindeerPose;
  phase: number;
  galloping: boolean;
}

/**
 * 도약하는 루돌프 한 마리. 몸·목·머리·귀는 면, 다리와 뿔은 선이다.
 * 꼬리는 두지 않는다. 엉덩이 위를 지나는 고삐에 걸려 화살촉처럼 보인다.
 *
 * galloping이면 다리 자세 넷을 모두 그려 두고, CSS가 차례로 하나씩만 보이게 한다(.gallopFrame, steps 전환).
 * 자세 i는 한 바퀴의 i번째 4분의 1에 보이도록 지연을 준다(같은 순간에는 하나만 보인다). 애니메이션이 꺼지면 첫 자세만 남는다.
 */
function Reindeer({ x, y, pose, phase, galloping }: ReindeerProps) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={0} rx={17} ry={6.4} transform="rotate(-10)" />
      <path d="M9 -5 C14 -9 19 -14 22 -19 L28 -15 C25 -10 21 -4 15 2 Z" />
      <ellipse cx={28} cy={-18} rx={6.2} ry={3.4} transform="rotate(18 28 -18)" />
      <path d="M24.5 -20.5 L19.5 -23.5 L23 -18.5 Z" />
      {galloping ? (
        GALLOP_FRAMES.map((frame, index) => (
          <g
            key={frame}
            className={`${styles.sleighLimbs} ${styles.gallopFrame}`}
            data-frame={index}
            style={{ animationDelay: `${-((1 - index / GALLOP_FRAMES.length + phase) % 1) * GALLOP_CYCLE_S}s` }}
          >
            {REINDEER_LEGS[frame].map((d) => <path key={d} d={d} />)}
          </g>
        ))
      ) : (
        <g className={styles.sleighLimbs}>
          {REINDEER_LEGS[pose].map((d) => <path key={d} d={d} />)}
        </g>
      )}
      <path className={styles.sleighAntlers} d={REINDEER_ANTLERS} />
    </g>
  );
}

/**
 * 루돌프 넷이 끄는 산타 썰매의 실루엣이다(오른쪽으로 난다). 옛 크리스마스 카드처럼 한 가지 색만 쓴다.
 * 산타는 고깔모자·방울·수염으로, 썰매는 말린 앞코와 날로, 뒤에는 선물 자루를 싣는다.
 * 고삐는 산타 손에서 루돌프들의 어깨를 차례로 잇는다. 옅기는 그림을 쓰는 쪽이 정한다.
 * galloping이면 루돌프 다리가 달리는 자세로 바뀌며 움직인다(하늘을 나는 썰매 레이어만 켠다).
 */
export function SantaSleigh({ className, galloping = false }: ArtProps & { galloping?: boolean }) {
  return (
    <svg className={`${styles.sleigh} ${className ?? ''}`} viewBox="0 8 390 94" focusable="false">
      <path className={styles.sleighRein} d="M93 63.5 Q130 70 172 64 Q203 62 234 57 Q265 55 296 50 Q327 48 358 43" />
      {SLEIGH_TEAM.map((deer) => (
        <Reindeer key={deer.x} x={deer.x} y={deer.y} pose={deer.pose} phase={deer.phase} galloping={galloping} />
      ))}
      {/* 선물 자루와 묶은 끝 */}
      <path d="M20 72 C10 66 10 48 20 42 C25 39 29 40 31 43 C36 40 42 43 41 49 C46 56 44 67 36 72 Z" />
      <path d="M27 42 L23 35 L29 38.5 L32 34 L31.5 41.5 Z" />
      {/* 산타: 몸·머리·수염·모자(챙과 방울)·고삐를 쥔 팔 */}
      <path d="M50 82 C48 71 52 63 61 61 C70 59 78 64 80 72 L82 82 Z" />
      <circle cx={68} cy={53} r={6.2} />
      <path d="M70 54 C76 56 77 63 72 67 C68 65 66 60 66 56 Z" />
      <path d="M61.5 50.5 L74 48.5 C73 42 68 37 61 35 C58 34.5 55.5 35.5 54 37.5 C58 38.5 60.5 43 61.5 50.5 Z" />
      <rect x={59.5} y={47.5} width={16} height={4.4} rx={2.2} transform="rotate(-8 67.5 49.7)" />
      <circle cx={53.5} cy={37.5} r={2.6} />
      <path className={styles.sleighArm} d="M72 66 L84 68 L92 64" />
      <circle cx={93} cy={63.5} r={2.5} />
      {/* 썰매 몸통(높은 등받이와 솟은 앞코) */}
      <path d="M16 90 L96 90 C106 90 112 84 115 74 C116 71 112 70 111 73 C108 79 102 81 92 81 L44 81 C40 81 37 77 35 70 C32 60 28 54 20 54 C12 54 9 62 10 72 C11 80 13 86 16 90 Z" />
      {/* 날·버팀대·앞코의 말린 장식 */}
      <path
        className={styles.sleighRunner}
        d="M6 91.5 C3 93 4 97 8 97 L104 97 C116 97 121 90 118 84 C116 80 111 81 112 85 M26 90 L24 97 M58 90 L58 97 M90 90 L92 97 M113.5 71.5 C115 66 110 63.5 107.5 66.5"
      />
    </svg>
  );
}

/** 위 가장자리에 매달린 고드름 줄. 길이를 조금씩 달리해 반복한다. */
export function Icicles({ className, width = 1000 }: ArtProps & { width?: number }) {
  const lengths = [22, 12, 30, 16, 9, 26, 14, 34, 11, 20];
  const step = 26;
  const count = Math.floor(width / step);
  const points: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = i * step;
    const length = lengths[i % lengths.length];
    points.push(`${x},0 ${x + step / 2},${length} ${x + step},0`);
  }
  return (
    <svg className={`${styles.icicles} ${className ?? ''}`} viewBox={`0 0 ${width} 40`} focusable="false" preserveAspectRatio="xMidYMin meet">
      <rect className={styles.iceRim} x={0} y={0} width={width} height={3} rx={1.5} />
      {points.map((polygon, i) => <polygon key={i} points={polygon} />)}
    </svg>
  );
}

/** 위 오른쪽 모서리에서 뻗어 나온 벚꽃 가지. */
export function BlossomBranch({ className }: ArtProps) {
  const flowers: [number, number, number][] = [
    [250, 22, 1.5], [200, 46, 1.25], [148, 40, 1.4], [96, 68, 1.1], [176, 84, 1], [62, 92, 0.9],
  ];
  return (
    <svg className={`${styles.branch} ${className ?? ''}`} viewBox="0 0 300 120" focusable="false">
      <path className={styles.branchWood} d="M300 4 C252 18 214 30 176 44 C138 58 104 70 52 100" />
      <path className={styles.branchWood} d="M214 32 C204 54 192 70 176 84" />
      <path className={styles.branchWood} d="M140 52 C150 40 158 34 168 26" />
      {flowers.map(([x, y, scale]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${scale})`}>
          {[0, 72, 144, 216, 288].map((angle) => (
            <ellipse key={angle} className={styles.petal} cx={0} cy={-5.6} rx={3.7} ry={5.2} transform={`rotate(${angle})`} />
          ))}
          <circle className={styles.blossomCore} r={2.2} />
        </g>
      ))}
      <circle className={styles.bud} cx={120} cy={50} r={3.2} />
      <circle className={styles.bud} cx={228} cy={14} r={2.8} />
    </svg>
  );
}

/** 아래 가장자리의 두 겹 물결. */
export function Waves({ className, width = 1000 }: ArtProps & { width?: number }) {
  const wave = (base: number, amp: number, period: number) => {
    let d = `M0 ${base}`;
    for (let x = 0; x < width; x += period) d += ` q${period / 4} ${-amp} ${period / 2} 0 t${period / 2} 0`;
    return `${d} L${width} 60 L0 60 Z`;
  };
  return (
    <svg className={`${styles.waves} ${className ?? ''}`} viewBox={`0 0 ${width} 60`} focusable="false" preserveAspectRatio="none">
      <path className={styles.waveBack} d={wave(26, 10, 120)} />
      <path className={styles.waveFront} d={wave(38, 8, 90)} />
    </svg>
  );
}
