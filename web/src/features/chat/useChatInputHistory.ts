"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

interface UseChatInputHistoryOptions {
  entries: readonly string[];
  value: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onValueChange: (value: string) => void;
}

export function useChatInputHistory({
  entries,
  value,
  inputRef,
  onValueChange,
}: UseChatInputHistoryOptions) {
  const historyIndexRef = useRef<number | null>(null);
  const draftBeforeHistoryRef = useRef(value);

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

  const showHistoryValue = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      moveCaretToEnd(nextValue);
    },
    [moveCaretToEnd, onValueChange],
  );

  const resetNavigation = useCallback((nextDraft = "") => {
    historyIndexRef.current = null;
    draftBeforeHistoryRef.current = nextDraft;
  }, []);

  const changeValue = useCallback(
    (nextValue: string) => {
      resetNavigation(nextValue);
      onValueChange(nextValue);
    },
    [onValueChange, resetNavigation],
  );

  useEffect(() => {
    const historyIndex = historyIndexRef.current;
    if (
      entries.length === 0 ||
      (historyIndex !== null && historyIndex >= entries.length)
    ) {
      resetNavigation(value);
    }
  }, [entries.length, resetNavigation, value]);

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
