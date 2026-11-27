'use client';

/**
 * 크리스마스 테마에서 본문 뒤 하늘로 루돌프 썰매가 이따금 지나가게 하는 레이어다.
 * 아래 조건이 모두 맞을 때만 그린다.
 * - 지금 테마가 썰매가 있는 테마다(`data-season`이 SLEIGH_THEME_IDS 안, 지금은 크리스마스뿐).
 * - 사이트 모션 설정이 움직임을 허용한다(눈 내리기와 같은 규칙, `seasonMotion`).
 *
 * 눈 내리기 설정과는 묶지 않는다. 그 스위치는 화면 위를 덮는 눈만 끄는 것이라 이름과 뜻이 다르고,
 * 썰매는 본문 뒤에서 가끔 지나갈 뿐이라 읽기를 가리지 않는다. 움직임 자체가 싫으면 모션 설정의
 * "항상 끔"(또는 "시스템 따름" + 운영체제의 모션 줄이기)이 썰매도 함께 끈다.
 *
 * 자리: 페이지(문서 좌표)에 붙인다. 넓은 화면은 크리스마스 트리 꼭대기 근처(살짝 겹치기까지), 휴대폰은 소개 카드의 제목~첫 문단(트리 꼭대기까지) 띠 안을,
 * 둘 다 없으면 머리글 구분선과 본문 첫 패널 사이 빈 칸을 지난다(flightTopInDocument). 비행마다 방향(좌우)과 크기(±15%)를 새로 고른다. 아래로 내려가 읽는 사람에게는 보이지 않는다. 층은 본문 카드 위·눈 레이어 아래(z-index 55, SleighLayer.module.css)다.
 * 처음엔 카드 뒤(z-index -1)로 지나가게 했으나 카드가 많은 화면에서 거의 다 가려져서 위로 올렸다.
 * 그림이 반투명이라 글자 위를 지나가도 읽히고, 클릭은 막지 않는다. 눈·챗봇·대화상자는 늘 위에 있다.
 *
 * 움직임: 한 번 지나가는 동안은 CSS transform 애니메이션만 쓴다. 프레임마다 도는 스크립트는 없다.
 * 스크립트는 타이머로 다음 비행 차례만 정하고, 그때마다 지나갈 자리를 다시 잰다. 지나가지 않는 동안은
 * 요소를 빼 두어 아무것도 그리지 않는다. 클릭을 막지 않고 스크린 리더에서 뺀다. 인쇄에서는 숨긴다.
 */
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { SantaSleigh } from './SeasonArt';
import { rootMotionAllowed, subscribeSeasonMotion } from './seasonMotion';
import { SLEIGH_THEME_IDS } from './seasonPolicy';
import styles from './SleighLayer.module.css';

/** 첫 비행은 화면이 자리 잡은 뒤에 시작한다. */
const FIRST_PASS_DELAY_MS = 4000;
/** 화면을 한 번 가로지르는 시간이다. CSS 애니메이션 길이도 이 값을 받는다. */
const FLIGHT_MS = 16000;
/** 비행이 끝난 뒤 요소를 빼기까지의 여유다. 애니메이션이 타이머보다 한두 프레임 늦게 시작해도 끝까지 날게 한다. */
const FLIGHT_SLACK_MS = 600;
/** 비행 사이 쉬는 시간(무작위 범위). 앞 비행 시작부터 다음 비행까지 약 22~29초다. */
const PAUSE_MIN_MS = 5000;
const PAUSE_MAX_MS = 12000;
/** SantaSleigh 그림의 높이/폭 비(viewBox 390×94)다. */
const SLEIGH_ASPECT = 94 / 390;
/** 비행마다 썰매 크기를 기본 폭의 이 배수 사이에서 고른다. 멀고 가까운 느낌만 살짝 나게 한다. */
const SIZE_MIN = 0.85;
const SIZE_MAX = 1.15;
/** CSS sleigh-arc의 위아래 진폭(px)이다(--sleigh-arc). 휴대폰은 좁은 빈 칸 안에 머물게 작게 한다. */
const ARC_WIDE_PX = 16;
const ARC_NARROW_PX = 6;
/** 썰매 아랫변이 트리 그림 안으로 내려올 수 있는 깊이(트리 높이에 대한 비율)다. 꼭대기와 살짝 겹칠 만큼만. */
const TREE_OVERLAP = 0.3;
/** 썰매 영역 위아래 여유(흔들림·기울기가 잘리지 않게)다. */
const SKY_PAD_PX = 24;
/** 이 폭 이상이면 트리 위로, 좁으면(휴대폰) 소개 카드 안 제목~첫 문단 높이로 지나간다. */
const WIDE_QUERY = '(min-width: 768px)';

/** 썰매가 지나가야 하는지 문서 루트 속성과 운영체제 설정으로 판정한다. */
function sleighActive(): boolean {
  return SLEIGH_THEME_IDS.includes(document.documentElement.dataset.season ?? '') && rootMotionAllowed();
}

const serverSnapshot = () => false;

const between = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * 비행 한 번의 자리와 모양이다(길이는 px). 썰매 영역의 문서 위치·높이, 그 안에서 썰매가 나는 높이,
 * 이번 썰매 폭, 나는 방향(true면 오른쪽에서 왼쪽으로).
 */
interface Pass {
  skyTop: number;
  skyHeight: number;
  flightTop: number;
  arc: number;
  width: number;
  leftward: boolean;
}

/** 화면 폭에 맞춘 기본 썰매 폭이다(휴대폰 150px부터 넓은 화면 340px까지). 비행마다 SIZE_MIN~SIZE_MAX배를 곱한다. */
function baseSleighWidth(): number {
  return Math.min(340, Math.max(150, window.innerWidth * 0.24));
}

function visibleRect(element: Element | null): DOMRect | null {
  const rect = element?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

/** 지금 보이는 크리스마스 트리 그림의 화면 위치다. */
function treeRect(): DOMRect | null {
  return (
    Array.from(document.querySelectorAll('[data-season-layer="christmas"] svg[class*="__tree"]'))
      .map(visibleRect)
      .find(Boolean) ?? null
  );
}

/** 썰매 아랫변이 내려올 수 있는 가장 낮은 화면 높이다(트리 꼭대기에서 TREE_OVERLAP만큼 안쪽). */
function treeOverlapBottom(tree: DOMRect): number {
  return tree.top + tree.height * TREE_OVERLAP;
}

/**
 * 썰매가 지나갈 높이(문서 좌표 px, 썰매 위쪽)를 정한다. 위치는 페이지 기준이라 아래로 내려가 읽는 사람에게는 보이지 않는다.
 * - 넓은 화면에서 크리스마스 트리 그림이 보이면: 호의 양 끝에서 썰매 아랫변이 트리 꼭대기 16px 위부터
 *   트리 높이의 30%(TREE_OVERLAP) 안쪽까지 사이 무작위. 낮게 고르면 트리 꼭대기와 살짝 겹쳐 지나간다.
 * - 휴대폰에서 소개 카드(#portfolio-overview)가 있으면: 카드 제목 윗변부터 첫 문단 아랫변까지(트리가 그 아래에 보이면
 *   트리 높이의 30% 안쪽까지)의 띠 안 무작위 높이. 호의 위아래까지 띠 안에 들어오게 고르고,
 *   띠가 썰매보다 좁으면 띠 한가운데로 지난다. 트리와 한 화면에 보이게 하려는 것이다.
 * - 그것도 없으면: 머리글 아래 구분선과 본문 첫 패널 사이 빈 칸의 한가운데.
 * - 모두 없으면 페이지 위쪽 고정 높이.
 */
function flightTopInDocument(sleighHeight: number, arc: number): number {
  const scroll = window.scrollY;
  if (window.matchMedia(WIDE_QUERY).matches) {
    const tree = treeRect();
    if (tree) return between(tree.top - 16, treeOverlapBottom(tree)) + scroll - sleighHeight - arc;
  } else {
    const overview = document.getElementById('portfolio-overview');
    const heading = visibleRect(overview?.querySelector('h1, h2') ?? null);
    const paragraph = visibleRect(overview?.querySelector('p') ?? null);
    if (heading && paragraph && paragraph.bottom > heading.top) {
      const tree = treeRect();
      const bandBottom = Math.max(paragraph.bottom, tree ? treeOverlapBottom(tree) : 0);
      const low = heading.top + arc;
      const high = bandBottom - arc - sleighHeight;
      return (high > low ? between(low, high) : (heading.top + bandBottom - sleighHeight) / 2) + scroll;
    }
  }
  const panel = visibleRect(document.querySelector('main [data-surface="panel"]'));
  if (panel) {
    const header = visibleRect(document.querySelector('.about-header'));
    const gapTop = header && header.bottom <= panel.top ? header.bottom : panel.top - 2 * sleighHeight;
    return (gapTop + panel.top) / 2 + scroll - sleighHeight / 2;
  }
  return 100;
}

function SleighFlight() {
  const [pass, setPass] = useState<Pass | null>(null);

  useEffect(() => {
    let timer = 0;
    const rest = () => {
      timer = window.setTimeout(fly, between(PAUSE_MIN_MS, PAUSE_MAX_MS));
    };
    const fly = () => {
      // 탭이 가려져 있으면 볼 사람이 없으니 이번 차례는 건너뛴다.
      if (document.visibilityState === 'hidden') {
        rest();
        return;
      }
      const arc = window.matchMedia(WIDE_QUERY).matches ? ARC_WIDE_PX : ARC_NARROW_PX;
      const width = baseSleighWidth() * between(SIZE_MIN, SIZE_MAX);
      const sleighHeight = width * SLEIGH_ASPECT;
      const flightTop = flightTopInDocument(sleighHeight, arc);
      const skyTop = Math.max(0, flightTop - arc - SKY_PAD_PX);
      // 문서 끝을 넘어 페이지를 늘리지 않게 남은 문서 길이 안으로 자른다.
      const skyHeight = Math.max(
        0,
        Math.min(sleighHeight + 2 * (arc + SKY_PAD_PX), document.documentElement.scrollHeight - skyTop),
      );
      setPass({ skyTop, skyHeight, flightTop: flightTop - skyTop, arc, width, leftward: Math.random() < 0.5 });
      timer = window.setTimeout(() => {
        setPass(null);
        rest();
      }, FLIGHT_MS + FLIGHT_SLACK_MS);
    };
    timer = window.setTimeout(fly, FIRST_PASS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!pass) return null;
  const skyStyle = { '--sleigh-sky-top': `${pass.skyTop}px`, '--sleigh-sky-height': `${pass.skyHeight}px` } as CSSProperties;
  const flightStyle = {
    '--sleigh-top': `${pass.flightTop}px`,
    '--sleigh-flight': `${FLIGHT_MS}ms`,
    '--sleigh-arc': `${pass.arc}px`,
    '--sleigh-width': `${pass.width}px`,
  } as CSSProperties;
  // 왼쪽으로 날 때는 .facing이 그림을 좌우로 뒤집는다. 호의 기울기(.arc)도 그 안에서 함께 뒤집혀 늘 앞코가 들린다.
  return (
    <div className={styles.sky} style={skyStyle} aria-hidden="true">
      <div className={styles.flight} style={flightStyle} data-direction={pass.leftward ? 'left' : 'right'}>
        <div className={styles.facing}>
          <div className={styles.arc}>
            <div className={styles.bob}>
              <SantaSleigh className={styles.art} galloping />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SleighLayer() {
  const active = useSyncExternalStore(subscribeSeasonMotion, sleighActive, serverSnapshot);
  return active ? <SleighFlight /> : null;
}
