import {
  ACCENTS, CHAT_FONTS, CHAT_FONT_SIZES, CHAT_LAYOUTS,
  CHAT_STREAM_ANIMATIONS, THEME_MODES,
} from "../portfolio-tools/settings.ts";
import type { ChatSettingChange, ChatSettingChangeToolName, ChatToolExecution } from "./types";

export const UI_SETTING_CHANGE_STORAGE_KEY = "portfolio-chat-verified-setting-changes-v1";
export const MAX_UI_SETTING_CHANGES = 20;

const VALUES: Record<ChatSettingChangeToolName, readonly string[]> = {
  set_portfolio_theme: THEME_MODES,
  set_portfolio_accent: ACCENTS,
  set_portfolio_chat_layout: CHAT_LAYOUTS,
  set_portfolio_chat_font: CHAT_FONTS,
  set_portfolio_chat_font_size: CHAT_FONT_SIZES,
  set_portfolio_stream_animation: CHAT_STREAM_ANIMATIONS,
};
const CALL_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/u;

function normalizeChange(value: unknown): ChatSettingChange | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  const hasGroupId = Object.hasOwn(entry, "groupId");
  if (Object.keys(entry).length !== 4 + Number(hasGroupId) ||
    ["toolCallId", "toolName", "before", "after"].some((key) => !Object.hasOwn(entry, key))) {
    return null;
  }
  if (hasGroupId && (typeof entry.groupId !== "string" || !CALL_ID_PATTERN.test(entry.groupId))) {
    return null;
  }
  const values = typeof entry.toolName === "string" &&
    Object.hasOwn(VALUES, entry.toolName)
    ? VALUES[entry.toolName as ChatSettingChangeToolName] : null;
  if (!(values !== null && typeof entry.toolCallId === "string" &&
    CALL_ID_PATTERN.test(entry.toolCallId) &&
    typeof entry.before === "string" && values.includes(entry.before) &&
    typeof entry.after === "string" && values.includes(entry.after) &&
    entry.before !== entry.after)) return null;
  return {
    toolCallId: entry.toolCallId,
    groupId: hasGroupId ? entry.groupId as string : entry.toolCallId,
    toolName: entry.toolName as ChatSettingChangeToolName,
    before: entry.before,
    after: entry.after,
  };
}

export function parseUiSettingChanges(value: unknown): ChatSettingChange[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeChange)
    .filter((entry): entry is ChatSettingChange => entry !== null)
    .slice(-MAX_UI_SETTING_CHANGES);
}

export function appendUiSettingChange(
  changes: readonly ChatSettingChange[],
  entry: ChatSettingChange,
): ChatSettingChange[] {
  const normalized = normalizeChange(entry);
  if (!normalized) return [...changes];
  return [...changes, normalized].slice(-MAX_UI_SETTING_CHANGES);
}

/** 실제 반영이 확인된 설정 도구만 기록한다. 순회와 제자리 설정은 제외한다. */
export function createUiSettingChange(
  execution: ChatToolExecution,
  before: string | null,
  after: string | null,
  groupId = execution.toolCallId,
): ChatSettingChange | null {
  const entry = {
    toolCallId: execution.toolCallId,
    groupId,
    toolName: execution.toolName,
    before,
    after,
  };
  return normalizeChange(entry);
}
