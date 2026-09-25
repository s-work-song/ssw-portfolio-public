"use client";

/**
 * 스트리밍으로 도착하는 답변 텍스트를 연출과 함께 그리는 표현 전용 컴포넌트다.
 * SSE는 전체 길이를 모른 채 delta만 도착하므로, 데모처럼 진행률(0..1)을 쓰지 않고
 * "방금 도착한 꼬리 구간"만 애니메이션 span으로 렌더한다. 앞부분은 평범한 문자열로
 * 굳혀 두어 delta마다 전체 텍스트를 다시 쪼개지 않는다(긴 답변 성능 보호).
 *
 * 각 span의 key는 메시지 안에서의 절대 오프셋이라, 창이 밀려도 이미 붙은 span은
 * 그대로 유지된다. 그래서 새로 마운트되는 조각만 CSS 애니메이션이 한 번 재생된다.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./ChatWidget.module.css";
import type { ChatStreamAnimation } from "./types";

/** 단어 단위 연출이 애니메이션 span으로 유지하는 최근 단어 수 */
const WORD_TAIL_COUNT = 10;
/** 글자 단위 연출이 애니메이션 span으로 유지하는 최근 글자 수 */
const CHAR_TAIL_COUNT = 24;
/** 토큰 청크 연출이 유지하는 최근 글자 수 */
const CHUNK_TAIL_COUNT = 28;
/** 스크램블이 무작위 문자로 덮어 두는 최근 글자 수 */
const SCRAMBLE_TAIL_COUNT = 6;
/** 스크램블 문자를 갈아 끼우는 주기(ms) */
const SCRAMBLE_INTERVAL_MS = 70;

/** 스크램블이 덮어쓸 때 골라 쓰는 문자 풀이다. 폭이 들쭉날쭉하지 않도록 라틴 문자와 기호만 담았다. */
const SCRAMBLE_SET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#%&*+=<>";

/**
 * 토큰 청크의 경계를 오프셋만으로 결정한다. 주기 14 안에서 2·4·3·5자로 끊기며,
 * 창이 밀려도 같은 오프셋은 항상 같은 청크의 시작이라 조각이 흔들리지 않는다.
 */
const CHUNK_PERIOD = 14;
const CHUNK_STARTS = new Set([0, 2, 6, 9]);

/** 꼬리를 단어 단위로 쪼개 재생하는 연출들이다. */
const WORD_ANIMATIONS: ReadonlySet<ChatStreamAnimation> = new Set([
  "word-fade",
  "blur-focus",
  "slide-up",
]);

/** 꼬리를 글자 단위로 쪼개 재생하는 연출들이다. */
const CHAR_ANIMATIONS: ReadonlySet<ChatStreamAnimation> = new Set([
  "mask-wipe",
  "letter-drop",
  "highlight-trail",
]);

/** 연출별로 조각 span에 붙일 CSS 클래스다. 여기에 없는 연출은 조각에 클래스를 붙이지 않는다. */
const PIECE_CLASS: Partial<Record<ChatStreamAnimation, string>> = {
  "word-fade": styles.streamWordFade,
  "blur-focus": styles.streamBlurFocus,
  "slide-up": styles.streamSlideUp,
  "token-chunks": styles.streamTokenChunk,
  "mask-wipe": styles.streamMaskWipe,
  "letter-drop": styles.streamLetterDrop,
  "highlight-trail": styles.streamHighlightTrail,
};

/** CSS에 정의된 기본 효과 시간을 미리보기 재생 배율과 함께 사용한다. */
const PIECE_DURATION_MS: Partial<Record<ChatStreamAnimation, number>> = {
  "word-fade": 320,
  "blur-focus": 420,
  "slide-up": 380,
  "token-chunks": 520,
  "mask-wipe": 260,
  "letter-drop": 300,
  "highlight-trail": 700,
};

/** 타자기·토큰 청크 연출이 쓰는 얇은 커서의 깜빡임 주기(ms)다. */
const CURSOR_DURATION_MS = 1_000;
/** 스크램블 연출이 쓰는 블록 커서의 깜빡임 주기(ms)다. */
const BLOCK_CURSOR_DURATION_MS = 900;
/** 스켈레톤 연출이 쓰는 자리 표시 막대의 재생 주기(ms)다. */
const SKELETON_DURATION_MS = 1_400;

/** 애니메이션 span 하나로 그려질 꼬리 조각이다. */
interface TailPiece {
  /** 메시지 안에서의 절대 오프셋. span의 key로 쓴다. */
  key: number;
  value: string;
  /** 공백·줄바꿈이라 애니메이션을 걸지 않는 조각 */
  blank: boolean;
}

/** 텍스트를 굳어 버린 앞부분(head)과 애니메이션이 걸릴 꼬리 조각들로 나눈 결과다. */
interface TailSplit {
  head: string;
  pieces: TailPiece[];
}

/** 애니메이션을 걸지 않을 공백 문자인지 판별한다. 정규식보다 호출이 잦아 직접 비교한다. */
function isSpace(character: string): boolean {
  return (
    character === " " ||
    character === "\n" ||
    character === "\t" ||
    character === "\r"
  );
}

/** 그 오프셋이 토큰 청크의 시작 위치인지 판별한다. 텍스트 내용과 무관하게 오프셋만 본다. */
function isChunkStart(offset: number): boolean {
  return CHUNK_STARTS.has(offset % CHUNK_PERIOD);
}

/** 서로게이트 쌍 한가운데를 자르지 않도록 경계를 한 칸 앞으로 당긴다. */
function safeStart(text: string, start: number): number {
  if (start <= 0) return 0;
  const code = text.charCodeAt(start);
  return code >= 0xdc00 && code <= 0xdfff ? start - 1 : start;
}

/**
 * 뒤에서부터 훑어 최근 maxWords개 단어가 시작되는 오프셋을 찾는다.
 * 전체 길이와 무관하게 꼬리 길이에만 비례한다.
 */
function wordTailStart(text: string, maxWords: number): number {
  let end = text.length;
  let words = 0;

  while (end > 0 && words < maxWords) {
    let cursor = end;
    while (cursor > 0 && isSpace(text[cursor - 1])) cursor -= 1;
    if (cursor === 0) return 0;
    while (cursor > 0 && !isSpace(text[cursor - 1])) cursor -= 1;
    words += 1;
    end = cursor;
  }

  return end;
}

/**
 * 최근 maxWords개 단어만 조각으로 떼어 낸다.
 *
 * 공백도 조각으로 남겨 원문 간격이 그대로 유지되게 하되 blank로 표시해
 * 애니메이션은 걸지 않는다. key로 쓰는 오프셋은 텍스트 시작 기준 절대 위치라,
 * 창이 밀려도 이미 붙은 조각은 다시 마운트되지 않는다.
 */
function splitWordTail(text: string, maxWords: number): TailSplit {
  const start = wordTailStart(text, maxWords);
  const pieces: TailPiece[] = [];
  let offset = start;

  for (const token of text.slice(start).split(/(\s+)/u)) {
    if (!token) continue;
    pieces.push({ key: offset, value: token, blank: isSpace(token[0]) });
    offset += token.length;
  }

  return { head: text.slice(0, start), pieces };
}

/**
 * 최근 maxChars자를 한 글자씩 조각으로 떼어 낸다.
 *
 * for...of로 순회하므로 서로게이트 쌍은 한 조각으로 묶이고, 시작 지점도
 * safeStart로 당겨 잘린 반쪽이 나오지 않게 한다. 스크램블 연출도 이 분할을 쓴다.
 */
function splitCharTail(text: string, maxChars: number): TailSplit {
  const start = safeStart(text, Math.max(0, text.length - maxChars));
  const pieces: TailPiece[] = [];
  let offset = start;

  for (const character of text.slice(start)) {
    pieces.push({ key: offset, value: character, blank: isSpace(character) });
    offset += character.length;
  }

  return { head: text.slice(0, start), pieces };
}

/**
 * 청크 경계에 맞춰 꼬리를 자르고 2~5자 조각으로 묶는다.
 *
 * 자르려는 지점이 청크 한가운데면 경계를 만날 때까지 앞으로 물러선다. 그래야
 * 같은 청크가 매번 같은 오프셋에서 시작해, 창이 밀려도 조각이 다시 쪼개지지 않는다.
 * 공백도 청크 안에 그대로 흡수되므로 blank 조각은 만들지 않는다.
 */
function splitChunkTail(text: string, maxChars: number): TailSplit {
  let start = safeStart(text, Math.max(0, text.length - maxChars));
  while (start > 0 && !isChunkStart(start)) start -= 1;

  const pieces: TailPiece[] = [];
  let offset = start;

  for (const character of text.slice(start)) {
    const last = pieces[pieces.length - 1];
    if (!last || isChunkStart(offset)) {
      pieces.push({ key: offset, value: character, blank: false });
    } else {
      last.value += character;
    }
    offset += character.length;
  }

  return { head: text.slice(0, start), pieces };
}

/**
 * 오프셋과 틱만으로 무작위처럼 보이는 문자를 고른다.
 * 렌더 중 Math.random을 쓰지 않아 같은 입력이면 같은 결과가 나온다.
 */
function scrambledCharacter(offset: number, tick: number): string {
  const index = (offset * 31 + tick * 17 + 7) % SCRAMBLE_SET.length;
  return SCRAMBLE_SET[index];
}

/** 스트리밍 텍스트 한 덩어리를 그리는 데 필요한 값이다. */
interface StreamingTextProps {
  text: string;
  animation: ChatStreamAnimation;
  /** 아직 delta가 도착하는 중인지. 커서·스켈레톤·스크램블 타이머를 좌우한다. */
  isStreaming: boolean;
  /**
   * 설정 미리보기의 재생 배율. 실제 채팅은 기본값 1을 사용한다.
   * 글자 도착 속도와 CSS 효과 시간을 같은 배율로 맞춰 효과의 의도를 비교할 수 있다.
   */
  playbackRate?: number;
}

/**
 * 선택된 연출로 스트리밍 텍스트를 그린다.
 *
 * 연출은 크게 세 갈래다. typewriter·skeleton은 텍스트를 그대로 두고 끝에
 * 표식만 붙이고, scramble은 꼬리 글자를 무작위 문자로 덮으며, 나머지는 꼬리
 * 조각마다 CSS 클래스를 입힌다. 아는 연출이 아니면 분할 없이 원문만 내보내
 * 새 연출 값이 들어와도 화면이 비지 않는다.
 *
 * 커서·가장자리 같은 장식은 모두 aria-hidden이고 스트리밍 중에만 붙는다.
 */
export function StreamingText({
  text,
  animation,
  isStreaming,
  playbackRate = 1,
}: Readonly<StreamingTextProps>) {
  const [scrambleTick, setScrambleTick] = useState(0);
  const scrambling = animation === "scramble" && isStreaming;
  // 미리보기 슬라이더에서 넘어온 값이라 NaN·0·음수까지 들어올 수 있다.
  // 0.25~4배로 가두고 이상한 값은 1배로 되돌려 애니메이션 시간이 깨지지 않게 한다.
  const safePlaybackRate =
    Number.isFinite(playbackRate) && playbackRate > 0
      ? Math.min(4, Math.max(0.25, playbackRate))
      : 1;

  /**
   * CSS에 적힌 기본 재생 시간을 배율만큼 늘리거나 줄인 인라인 스타일을 만든다.
   *
   * 배율이 1이거나 해당 연출에 정의된 시간이 없으면 undefined를 돌려 스타일을
   * 붙이지 않고 CSS 기본값을 그대로 쓰게 한다.
   */
  const animationDurationStyle = (
    durationMs: number | undefined,
  ): CSSProperties | undefined =>
    durationMs === undefined || safePlaybackRate === 1
      ? undefined
      : { animationDuration: `${durationMs / safePlaybackRate}ms` };

  /**
   * 스크램블 연출이 재생되는 동안에만 틱을 올려 무작위 문자를 갈아 끼운다.
   *
   * 다른 연출이거나 스트리밍이 끝나면 타이머를 걸지 않고, 걸려 있던 것도
   * 정리해 화면이 멈춘 뒤까지 리렌더가 이어지지 않게 한다. 배율을 크게 올려도
   * 16ms 아래로는 내려가지 않도록 하한을 둔다.
   */
  useEffect(() => {
    if (!scrambling) return;
    const timer = window.setInterval(
      () => setScrambleTick((tick) => tick + 1),
      Math.max(16, Math.round(SCRAMBLE_INTERVAL_MS / safePlaybackRate)),
    );
    return () => window.clearInterval(timer);
  }, [safePlaybackRate, scrambling]);

  /**
   * 연출 종류에 맞는 꼬리 분할을 고른다. 분할이 필요 없는 연출은 null이다.
   *
   * delta가 도착할 때마다 다시 계산되므로 useMemo로 감싸 두었고, 분할 비용은
   * 전체 길이가 아니라 꼬리 길이에만 비례한다.
   */
  const split = useMemo<TailSplit | null>(() => {
    if (WORD_ANIMATIONS.has(animation)) {
      return splitWordTail(text, WORD_TAIL_COUNT);
    }
    if (CHAR_ANIMATIONS.has(animation)) {
      return splitCharTail(text, CHAR_TAIL_COUNT);
    }
    if (animation === "token-chunks") {
      return splitChunkTail(text, CHUNK_TAIL_COUNT);
    }
    if (animation === "scramble") {
      return splitCharTail(text, SCRAMBLE_TAIL_COUNT);
    }
    return null;
  }, [animation, text]);

  if (animation === "typewriter") {
    return (
      <>
        {text}
        {isStreaming && (
          <span
            className={styles.streamCursor}
            style={animationDurationStyle(CURSOR_DURATION_MS)}
            aria-hidden="true"
          />
        )}
      </>
    );
  }

  if (animation === "skeleton") {
    return (
      <>
        {text}
        {isStreaming && (
          <span
            className={styles.streamSkeleton}
            style={animationDurationStyle(SKELETON_DURATION_MS)}
            aria-hidden="true"
          />
        )}
      </>
    );
  }

  if (animation === "scramble" && split) {
    return (
      <>
        {split.head}
        {split.pieces.map((piece) =>
          piece.blank ? (
            <span key={piece.key}>{piece.value}</span>
          ) : (
            <span key={piece.key} className={styles.streamScramble}>
              {isStreaming
                ? scrambledCharacter(piece.key, scrambleTick)
                : piece.value}
            </span>
          ),
        )}
        {isStreaming && (
          <span
            className={styles.streamBlockCursor}
            style={animationDurationStyle(BLOCK_CURSOR_DURATION_MS)}
            aria-hidden="true"
          />
        )}
      </>
    );
  }

  // "none"처럼 분할이 필요 없는 연출과, 아직 모르는 값이 들어온 경우의 안전한 기본값이다.
  if (!split) return <>{text}</>;

  const pieceClass = PIECE_CLASS[animation];

  return (
    <>
      {split.head}
      {split.pieces.map((piece) => (
        <span
          key={piece.key}
          className={piece.blank ? undefined : pieceClass}
          style={
            piece.blank
              ? undefined
              : animationDurationStyle(PIECE_DURATION_MS[animation])
          }
        >
          {piece.value}
        </span>
      ))}
      {isStreaming && animation === "token-chunks" && (
        <span
          className={styles.streamCursor}
          style={animationDurationStyle(CURSOR_DURATION_MS)}
          aria-hidden="true"
        />
      )}
      {isStreaming && animation === "mask-wipe" && (
        <span className={styles.streamWipeEdge} aria-hidden="true" />
      )}
      {isStreaming && animation === "highlight-trail" && (
        <span className={styles.streamTrailEdge} aria-hidden="true" />
      )}
    </>
  );
}
