/**
 * 서버(작업 세션)가 요청한 브라우저 도구를 실행하고, 실제 화면 반영을 관측해 결과를 만든다.
 *
 * 결과 output은 작업 세션 모델이 읽는 tool 결과가 된다. 그래서 "요청했다"가 아니라
 * "반영됐다/도착했다"를 확인한 뒤 돌려주고, 설정 변경에는 바꾸기 전 값(previous)을
 * 담아 작업자가 "되돌려" 요청에 쓸 수 있게 한다. 화면의 도구 칩은 report로 갱신한다.
 *
 * DOM·React를 직접 알지 않도록 실행기와 관측 함수를 주입받는다.
 */
import { settingToolResultLabel } from "../constants.ts";
import { waitForAbortableDelay } from "../../portfolio-tools/abortableDelay.ts";
import {
  CHAT_DOCK_NARROW_NOTICE,
  CHOICE_SETTING_TARGETS,
  PORTFOLIO_CHAT_TOOLS,
  type PortfolioChoiceSetting,
} from "../../portfolio-tools/schema.ts";
import type { BrowserToolCall } from "../transport/sse.ts";
import type { BrowserToolResult } from "../transport/api.ts";
import type { PortfolioUiToolExecutor } from "../../portfolio-tools/portfolioUiToolExecutor.ts";
import type { ChatPortfolioViewState, ChatUiSettings, ToolResult } from "../types";

/** UI 도구 실행 직후의 낡은 React/DOM 상태를 읽지 않도록 보장하는 최소 관측 시간이다. */
export const TOOL_OBSERVATION_MIN_DELAY_MS = 500;
/** 설정 도구가 실제 상태에 반영되기를 기다리는 상한과 확인 주기다. */
const SETTING_SETTLE_TIMEOUT_MS = 1_200;
const SETTING_SETTLE_POLL_MS = 50;

/** 설정 도구별 인자 이름과 화면 설정의 키다. */
const SETTING_TOOLS: Readonly<Record<string, readonly [string, keyof ChatUiSettings]>> = {
  set_portfolio_theme: ["theme", "theme"],
  set_portfolio_accent: ["accent", "accent"],
  set_portfolio_chat_layout: ["layout", "chatLayout"],
  set_portfolio_chat_font: ["font", "chatFont"],
  set_portfolio_chat_font_size: ["size", "chatFontSize"],
  set_portfolio_stream_animation: ["animation", "streamAnimation"],
};

/** 답변 말풍선에 띄울 설정 선택지다. current는 띄울 때의 설정 값이다. */
export interface SettingChoiceRequest {
  callId: string;
  setting: PortfolioChoiceSetting;
  current: string | null;
}

export interface BrowserToolRunnerDeps {
  execute: PortfolioUiToolExecutor;
  readSettings(): ChatUiSettings | null;
  readViewState(): ChatPortfolioViewState | null;
  /** 이동 도구가 정말 목적지에 닿았는지 지켜본다. */
  observeNavigation(route: string, startedAt: number, signal: AbortSignal): Promise<"arrived" | "failed">;
  /** 앵커 이동 직전에 부른다(도착 뒤 입력창 포커스 복원 예약 등). */
  beforeNavigate?(): void;
  /** 화면의 도구 칩을 갱신한다. 같은 callId면 덮어쓴다. */
  report(result: ToolResult): void;
  /** 답변 말풍선에 설정 선택지를 띄운다. 버튼은 대화 턴 없이 설정을 바꾸므로 결과를 기다리지 않는다. 없으면 선택지 도구를 실행하지 않는다. */
  showChoice?(request: SettingChoiceRequest): void;
  /** 고정 패널을 그릴 만큼 화면이 넓은지 본다. 없으면 넓다고 본다. */
  chatDockFits?(): boolean;
  now(): number;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function waitMinimum(startedAt: number, deps: BrowserToolRunnerDeps, signal: AbortSignal) {
  const remaining = TOOL_OBSERVATION_MIN_DELAY_MS - (deps.now() - startedAt);
  if (remaining > 0) await waitForAbortableDelay(remaining, signal);
}

async function waitForSetting(read: () => unknown, expected: unknown, signal: AbortSignal, deps: BrowserToolRunnerDeps) {
  const startedAt = deps.now();
  for (;;) {
    await waitForAbortableDelay(SETTING_SETTLE_POLL_MS, signal);
    if (read() === expected) return true;
    if (deps.now() - startedAt >= SETTING_SETTLE_TIMEOUT_MS) return false;
  }
}

function fallbackLabel(name: string): string {
  if (name === "choose_portfolio_setting") return "설정 선택지";
  if (name === "control_portfolio_view") return "화면 이동";
  if (name === "control_portfolio_research_details") return "연구 상세 제어";
  if (name === "open_portfolio_settings") return "포트폴리오 설정 페이지";
  return name;
}

/** 도구 하나를 실행한다. 실행 실패는 오류 결과로 돌려주고, 사용자 중단만 던진다. */
export async function runBrowserToolCall(
  call: BrowserToolCall,
  deps: BrowserToolRunnerDeps,
  signal: AbortSignal,
): Promise<BrowserToolResult> {
  const { callId, name } = call;
  const input = call.arguments;
  const startedAt = deps.now();
  const setting = SETTING_TOOLS[name];
  const label = settingToolResultLabel(name, input) ?? fallbackLabel(name);
  const chip = (status: ToolResult["status"], extra: Partial<ToolResult> = {}) =>
    deps.report({ callId, tool: name, label, status, ...extra });
  try {
    // 선택지는 띄우고 바로 끝낸다. 띄울 때의 값(current)은 작업 세션이 "되돌려"에 쓴다.
    if (name === "choose_portfolio_setting") {
      const { setting } = PORTFOLIO_CHAT_TOOLS.choose_portfolio_setting.parse(input);
      if (!deps.showChoice) return { callId, ok: false, output: { setting, error: "unsupported_tool" } };
      const current = deps.readSettings()?.[CHOICE_SETTING_TARGETS[setting].settingsKey] ?? null;
      deps.showChoice({ callId, setting, current });
      return { callId, ok: true, output: { setting, shown: true, current } };
    }

    if (name === "get_portfolio_ui_settings" || name === "get_portfolio_view_state") {
      const output = await deps.execute({ name, input, signal });
      return { callId, ok: output.ok === true, output };
    }

    if (setting) {
      const [argumentKey, settingKey] = setting;
      const previous = deps.readSettings()?.[settingKey] ?? null;
      chip("started");
      await deps.execute({ name, input, signal });
      const expected = input[argumentKey];
      const applied = await waitForSetting(() => deps.readSettings()?.[settingKey], expected, signal, deps);
      await waitMinimum(startedAt, deps, signal);
      chip(applied ? "applied" : "failed", applied ? {} : { detail: "설정이 화면에 반영되지 않았어요" });
      const output: Record<string, unknown> = { [argumentKey]: expected, previous, ...(applied ? {} : { error: "not_applied" }) };
      // 좁은 화면은 dock을 저장해도 플로팅 창으로 그린다. 작업 세션이 "고정했다"고만 보고하지 않도록 실제 모습을 함께 담는다.
      if (applied && name === "set_portfolio_chat_layout" && expected === "dock" && deps.chatDockFits?.() === false) {
        output.displayed = "floating";
        output.notice = CHAT_DOCK_NARROW_NOTICE;
      }
      return { callId, ok: applied, output };
    }

    if (name === "control_portfolio_view" || name === "open_portfolio_settings") {
      const before = deps.readViewState();
      const previous = before ? { page: before.page, anchor: before.anchor } : null;
      if (name === "control_portfolio_view") deps.beforeNavigate?.();
      const output = await deps.execute({ name, input, signal });
      const route = typeof output.route === "string" ? output.route : null;
      const targetLabel = typeof output.label === "string" ? output.label : label;
      const action = typeof input.action === "string" ? { action: input.action } : {};
      deps.report({ callId, tool: name, ...action, label: targetLabel, status: "started" });
      const status = route ? await deps.observeNavigation(route, startedAt, signal) : "failed";
      if (!route) await waitMinimum(startedAt, deps, signal);
      deps.report({
        callId, tool: name, ...action, label: targetLabel, status,
        ...(status === "failed" ? { detail: route ? "목적지에 도착하지 못했어요" : "이동 목적지를 확인하지 못했어요" } : {}),
      });
      return {
        callId, ok: status === "arrived",
        output: {
          ...action, route, label: targetLabel, arrived: status === "arrived", previous,
          ...(status === "arrived" ? {} : { error: "not_arrived" }),
        },
      };
    }

    if (name === "control_portfolio_research_details") {
      const details = { action: String(input.action ?? ""), target: input.target as ToolResult["target"] };
      deps.report({ callId, tool: name, ...details, label, status: "started" });
      // 상세 제어도 그 연도 앵커로 이동해 대상에 포커스를 준다. 입력창 복원을 예약하지 않으면
      // 포커스가 본문에 남아 대화를 이으려면 입력창을 다시 눌러야 한다.
      deps.beforeNavigate?.();
      const output = await deps.execute({ name, input, signal });
      await waitMinimum(startedAt, deps, signal);
      const applied = output.ok === true && output.status === "applied";
      deps.report({
        callId, tool: name, ...details,
        label: typeof output.label === "string" ? output.label : label,
        status: applied ? "applied" : "failed",
        ...(applied ? {} : { detail: "연구 상세 변경이 화면에 반영되지 않았어요" }),
      });
      return { callId, ok: applied, output: { ...output, ...(applied ? {} : { error: "not_applied" }) } };
    }

    return { callId, ok: false, output: { error: "unsupported_tool" } };
  } catch (error) {
    if (isAbort(error) || signal.aborted) throw error;
    chip("failed", { detail: "도구를 실행하지 못했어요" });
    return { callId, ok: false, output: { error: "execution_failed" } };
  }
}

/** 서버가 한 번에 요청한 도구들을 순서대로 실행한다. 앞 조작의 결과를 본 뒤 다음으로 넘어간다. */
export async function runBrowserToolCalls(
  calls: readonly BrowserToolCall[],
  deps: BrowserToolRunnerDeps,
  signal: AbortSignal,
): Promise<BrowserToolResult[]> {
  const results: BrowserToolResult[] = [];
  for (const call of calls) {
    if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    results.push(await runBrowserToolCall(call, deps, signal));
  }
  return results;
}
