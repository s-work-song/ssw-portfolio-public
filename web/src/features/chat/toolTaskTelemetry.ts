import type { ChatToolTaskScope, ChatToolTaskStep } from "./types";
import { createChatRequestId } from "./chatRequestIdentity.ts";
import { MAX_TOOL_TASK_STEPS } from "./toolTaskRuntime.ts";

export interface BrowserToolTaskEvent {
  eventId: string;
  sequence: number;
  source: "browser";
  agentRole: "verifier";
  kind: "tool" | "task";
  status: "started" | "arrived" | "applied" | "failed" | "completed" | "cancelled";
  stepIndex?: number;
  toolCallId?: string;
  toolName?: ChatToolTaskStep["toolName"];
  callSource?: ChatToolTaskStep["source"];
}
export interface BrowserToolTaskEvents {
  version: 1;
  conversationId: string;
  turnId: string;
  taskId: string;
  generation: number;
  events: BrowserToolTaskEvent[];
}

const INVALID_ID_CHARACTER = /[^A-Za-z0-9._:-]/u;
const TOOL_NAMES = new Set([
  "set_portfolio_theme", "set_portfolio_accent",
  "set_portfolio_chat_layout", "set_portfolio_chat_font", "set_portfolio_chat_font_size",
  "set_portfolio_stream_animation", "control_portfolio_view", "control_portfolio_research_details",
  "open_portfolio_settings", "get_portfolio_ui_settings", "get_portfolio_view_state",
]);
const TOOL_STATUSES = ["started", "arrived", "applied", "failed"];
const TASK_STATUSES = ["completed", "failed", "cancelled"];
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function safeId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 && !INVALID_ID_CHARACTER.test(value);
}

/** API 직전에도 허용 필드만 받는다. 타입 단언으로 본문·URL 등이 끼어도 전송하지 않는다. */
export function isSafeBrowserToolTaskEvents(value: unknown): value is BrowserToolTaskEvents {
  if (!object(value) || Object.keys(value).some(key =>
    !["version", "conversationId", "turnId", "taskId", "generation", "events"].includes(key))
    || value.version !== 1 || !safeId(value.conversationId) || !safeId(value.turnId) || !safeId(value.taskId)
    || !Number.isSafeInteger(value.generation) || Number(value.generation) < 1 || Number(value.generation) > 2_147_483_647
    || !Array.isArray(value.events) || value.events.length < 1 || value.events.length > 32) return false;
  const seen = new Set<string>();
  let sequence = -1;
  return value.events.every(event => {
    if (!object(event) || !safeId(event.eventId) || seen.has(event.eventId)
      || !Number.isSafeInteger(event.sequence) || Number(event.sequence) <= sequence
      || Number(event.sequence) > 2_147_483_647 || event.source !== "browser" || event.agentRole !== "verifier") return false;
    const common = ["eventId", "sequence", "source", "agentRole", "kind", "status"];
    const valid = event.kind === "task"
      ? Object.keys(event).every(key => common.includes(key)) && TASK_STATUSES.includes(String(event.status))
      : event.kind === "tool" && Object.keys(event).every(key => [...common, "stepIndex", "toolCallId", "toolName", "callSource"].includes(key))
        && TOOL_STATUSES.includes(String(event.status)) && Number.isInteger(event.stepIndex)
        && Number(event.stepIndex) >= 0 && Number(event.stepIndex) < MAX_TOOL_TASK_STEPS && safeId(event.toolCallId)
        && typeof event.toolName === "string" && TOOL_NAMES.has(event.toolName)
        && (event.callSource === undefined || event.callSource === "native" || event.callSource === "auxiliary");
    if (valid) { seen.add(event.eventId); sequence = Number(event.sequence); }
    return valid;
  });
}

/** 질문·인수·URL을 입력으로 받지 않는 비필수 브라우저 관측 전송기다. */
export class BrowserToolTaskTelemetry {
  private readonly scope: ChatToolTaskScope;
  private readonly send: (body: BrowserToolTaskEvents) => Promise<void>;
  private readonly createId: () => string;
  private sequence = 0;
  private events: BrowserToolTaskEvent[] = [];
  private scheduled = false;
  private flushing: Promise<void> | null = null;
  private terminal = false;

  constructor(scope: ChatToolTaskScope, send: (body: BrowserToolTaskEvents) => Promise<void>,
    createId: () => string = createChatRequestId) {
    this.scope = { ...scope };
    this.send = send;
    this.createId = createId;
  }

  tool(step: ChatToolTaskStep, status: "started" | "arrived" | "applied" | "failed"): void {
    if (this.terminal || !Number.isInteger(step.stepIndex) || step.stepIndex < 0 || step.stepIndex >= MAX_TOOL_TASK_STEPS
      || !safeId(step.toolCallId) || !TOOL_NAMES.has(step.toolName)
      || (step.source !== "native" && step.source !== "auxiliary")
      || step.dispatchStatus !== "accepted"
      || !TOOL_STATUSES.includes(status)) return;
    this.append({ kind: "tool", status, stepIndex: step.stepIndex, toolCallId: step.toolCallId,
      toolName: step.toolName, callSource: step.source });
  }

  task(status: "completed" | "failed" | "cancelled"): void {
    if (this.terminal || !TASK_STATUSES.includes(status)) return;
    this.terminal = true;
    this.append({ kind: "task", status });
  }

  private append(event: Pick<BrowserToolTaskEvent, "kind" | "status" | "stepIndex" | "toolCallId" | "toolName" | "callSource">): void {
    try {
      if (this.sequence > 2_147_483_647 || !safeId(this.scope.conversationId)
        || !safeId(this.scope.turnId) || !safeId(this.scope.taskId)
        || !Number.isSafeInteger(this.scope.generation) || this.scope.generation < 1
        || this.scope.generation > 2_147_483_647) return;
      const eventId = this.createId();
      if (!safeId(eventId)) return;
      this.events.push({ ...event, eventId, sequence: this.sequence++, source: "browser", agentRole: "verifier" });
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => { void this.flush(); });
      }
    } catch {
      // 관측 전송 실패는 실제 도구나 답변 실패가 아니다.
    }
  }

  flush(): Promise<void> {
    this.scheduled = false;
    if (this.flushing) return this.flushing;
    this.flushing = this.drain().finally(() => {
      this.flushing = null;
      if (this.events.length) void this.flush();
    });
    return this.flushing;
  }

  private async drain(): Promise<void> {
    while (this.events.length) {
      const batch = this.events.splice(0, 32);
      const { conversationId, turnId, taskId, generation } = this.scope;
      const body: BrowserToolTaskEvents = { version: 1, conversationId, turnId, taskId, generation, events: batch };
      if (!isSafeBrowserToolTaskEvents(body)
        || new TextEncoder().encode(JSON.stringify(body)).byteLength > 16 * 1_024) continue;
      try { await this.send(body); } catch { /* 비필수 진단은 사용자 동작을 막지 않는다. */ }
    }
  }
}
