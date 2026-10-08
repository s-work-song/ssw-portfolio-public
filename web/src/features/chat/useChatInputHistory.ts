"use client";

/**
 * 채팅 입력창에 셸 같은 위·아래 방향키 히스토리 탐색을 붙이는 훅이다.
 *
 * 입력값 자체는 화면 쪽 상태로 남겨 두고, 이 훅은 "지금 몇 번째 기록을 보고
 * 있는지"와 "히스토리로 들어가기 직전의 초안"만 ref로 들고 있다. 렌더를
 * 유발하지 않아야 하는 값이라 상태 대신 ref를 쓴다.
 *
 * 방향키는 원래 캐럿을 옮기는 키이므로, 히스토리로 가로채는 조건을 좁게 잡는
 * 것이 이 파일의 핵심이다. 한글 조합 중이거나 조합키가 눌린 경우, 여러 줄
 * 입력에서 캐럿이 맨 앞이 아닌 경우에는 손대지 않고 브라우저 기본 동작에 맡긴다.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

/**
 * 훅에 넘기는 입력창 문맥이다.
 *
 * entries는 오래된 것부터 정렬된 이전 질문 목록이고, value는 현재 입력값,
 * onValueChange는 그 값을 바꾸는 setter다. inputRef는 캐럿을 끝으로 옮길 때만 쓴다.
 */
interface UseChatInputHistoryOptions {
  entries: readonly string[];
  value: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onValueChange: (value: string) => void;
}

/**
 * 입력창에 연결할 값 변경 함수와 키 핸들러를 돌려준다.
 *
 * onChange에는 changeValue를, onKeyDown에는 handleHistoryKeyDown을 연결한다.
 * handleHistoryKeyDown이 true를 돌려주면 그 키를 이미 처리했다는 뜻이므로
 * 호출부는 뒤따르는 자체 처리를 건너뛰어야 한다. resetNavigation은 전송 직후처럼
 * 밖에서 입력값을 비울 때 탐색 상태도 함께 초기화하려고 노출한다.
 */
export function useChatInputHistory({
  entries,
  value,
  inputRef,
  onValueChange,
}: UseChatInputHistoryOptions) {
  /** 지금 보고 있는 기록의 인덱스다. null이면 히스토리를 탐색 중이 아니라 사용자의 초안을 보여 주는 상태다. */
  const historyIndexRef = useRef<number | null>(null);
  /** 히스토리로 들어가기 직전에 쓰고 있던 초안이다. 가장 최근 기록에서 한 번 더 내려오면 이 값으로 되돌린다. */
  const draftBeforeHistoryRef = useRef(value);

  /**
   * 바뀐 값의 맨 끝으로 캐럿을 옮긴다.
   *
   * 값 갱신은 React 상태를 거치므로 이 시점의 DOM에는 아직 옛 문자열이 들어
   * 있다. 한 프레임 미뤄야 새 길이를 기준으로 선택 범위를 잡을 수 있어
   * requestAnimationFrame을 쓴다. 그 사이 입력창이 사라졌으면 아무것도 하지 않는다.
   */
  const moveCaretToEnd = useCallback(
    (nextValue: string) => {
      window.requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        const end = nextValue.length;
        input.setSelectionRange(end, end);
      });
    },
    [inputRef],
  );

  /** 히스토리에서 꺼낸 값을 입력창에 채우고 캐럿을 끝에 둔다. 이어서 바로 고쳐 쓸 수 있게 하려는 배치다. */
  const showHistoryValue = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      moveCaretToEnd(nextValue);
    },
    [moveCaretToEnd, onValueChange],
  );

  /**
   * 히스토리 탐색을 끝내고 초안 기준점을 새로 잡는다.
   *
   * 인자를 생략하면 빈 초안으로 본다. 전송 직후처럼 입력창을 비우는 쪽에서
   * 그대로 부르면 되고, 그 뒤 위 방향키를 누르면 가장 최근 기록부터 다시 시작한다.
   */
  const resetNavigation = useCallback((nextDraft = "") => {
    historyIndexRef.current = null;
    draftBeforeHistoryRef.current = nextDraft;
  }, []);

  /**
   * 입력창의 onChange에 연결하는 값 변경 함수다.
   *
   * 사용자가 직접 타이핑한 순간 히스토리 탐색은 의미가 없어지므로, 값을 넘기기
   * 전에 탐색 상태를 접고 그 값을 새 초안으로 기억한다.
   */
  const changeValue = useCallback(
    (nextValue: string) => {
      resetNavigation(nextValue);
      onValueChange(nextValue);
    },
    [onValueChange, resetNavigation],
  );

  /**
   * 기록 목록이 줄거나 비면 탐색 상태를 정리한다.
   *
   * 대화 초기화처럼 목록이 통째로 바뀌면 들고 있던 인덱스가 엉뚱한 기록을
   * 가리키거나 범위를 벗어난다. 그럴 때 현재 입력값을 새 초안으로 삼아 탐색을
   * 접어, 아래 방향키가 사라진 초안을 복원하려다 값을 지워 버리는 일을 막는다.
   */
  useEffect(() => {
    const historyIndex = historyIndexRef.current;
    if (
      entries.length === 0 ||
      (historyIndex !== null && historyIndex >= entries.length)
    ) {
      resetNavigation(value);
    }
  }, [entries.length, resetNavigation, value]);

  /**
   * 위·아래 방향키로 이전 질문을 오간다. 히스토리로 처리했으면 true를 돌려준다.
   *
   * false를 돌려주면 방향키는 손대지 않았다는 뜻이라 호출부가 이어서 기본
   * 동작이나 자체 처리를 하면 된다. 한글 조합 중(isComposing)이거나 조합키가
   * 함께 눌린 경우, 방향키가 아닌 경우에는 곧바로 빠진다. 조합 중 방향키를
   * 가로채면 입력하던 글자가 깨지기 때문이다.
   *
   * 위 방향키는 탐색을 시작할 때만 조건이 하나 더 붙는다. 입력창에 이미 글이
   * 있고 캐럿이 맨 앞(0..0)이 아니면 윗줄로 올라가려는 의도로 보고 넘긴다.
   * 캐럿이 맨 앞에 있거나 입력창이 비어 있을 때만 히스토리로 들어간다.
   * 탐색을 시작하는 순간의 초안은 따로 보관해 두고, 가장 오래된 기록에서 더
   * 올라가려 하면 그 자리에 머문다.
   *
   * 아래 방향키는 탐색 중일 때만 의미가 있다. 최신 기록을 지나 한 번 더
   * 내려오면 보관해 둔 초안을 되살리고 탐색을 끝낸다.
   */
  const handleHistoryKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        event.nativeEvent.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.key !== "ArrowUp" && event.key !== "ArrowDown")
      ) {
        return false;
      }

      const currentIndex = historyIndexRef.current;
      if (event.key === "ArrowUp") {
        if (entries.length === 0) return false;
        if (
          currentIndex === null &&
          value.length > 0 &&
          (event.currentTarget.selectionStart !== 0 ||
            event.currentTarget.selectionEnd !== 0)
        ) {
          return false;
        }

        event.preventDefault();
        if (currentIndex === null) {
          draftBeforeHistoryRef.current = value;
        }
        const nextIndex =
          currentIndex === null
            ? entries.length - 1
            : Math.max(0, Math.min(currentIndex - 1, entries.length - 1));
        historyIndexRef.current = nextIndex;
        showHistoryValue(entries[nextIndex] ?? "");
        return true;
      }

      if (currentIndex === null) return false;
      event.preventDefault();
      if (currentIndex < entries.length - 1) {
        const nextIndex = currentIndex + 1;
        historyIndexRef.current = nextIndex;
        showHistoryValue(entries[nextIndex] ?? "");
      } else {
        const restoredDraft = draftBeforeHistoryRef.current;
        historyIndexRef.current = null;
        showHistoryValue(restoredDraft);
      }
      return true;
    },
    [entries, showHistoryValue, value],
  );

  return {
    changeValue,
    handleHistoryKeyDown,
    resetNavigation,
  };
}
