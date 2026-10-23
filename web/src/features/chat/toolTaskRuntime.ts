import type {
  ChatRequest, ChatToolExecution, ChatToolTaskDirective, ChatToolTaskProgress,
  ChatToolTaskResponse, ChatToolTaskScope, ChatToolTaskStep, ToolResult,
} from "./types";

export const TOOL_TASK_SCHEMA_VERSION = "portfolio-tool-task-v1" as const;
export const MAX_TOOL_TASK_STEPS = 16;
const SCOPE_KEYS = ["schemaVersion", "conversationId", "turnId", "taskId", "generation"];
const STEP_KEYS = ["stepIndex", "toolCallId", "toolName", "source", "dispatchStatus"];
const READ_TOOLS = new Set(["get_portfolio_ui_settings", "get_portfolio_view_state"]);
const WRITE_TOOLS = new Set([
  "set_portfolio_theme", "set_portfolio_accent", "cycle_portfolio_accent",
  "set_portfolio_chat_layout", "set_portfolio_chat_font", "set_portfolio_chat_font_size",
  "set_portfolio_stream_animation", "control_portfolio_view",
  "control_portfolio_research_details", "open_portfolio_settings",
]);
const INVALID_ID_CHARACTER = /[^A-Za-z0-9._:-]/u;

export class ToolTaskProtocolError extends Error {
  readonly code = "tool_task_protocol";
  constructor() {
    super("화면 도구 작업의 순서나 식별자가 맞지 않아 중단했어요. 새 질문으로 다시 요청해 주세요.");
    this.name = "ToolTaskProtocolError";
  }
}

function check(condition: unknown): asserts condition {
  if (!condition) throw new ToolTaskProtocolError();
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  check(Object.keys(value).every((key) => allowed.includes(key)));
}
function id(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 && !INVALID_ID_CHARACTER.test(value);
}

/** 키 순서만 달라도 같은 실행이다. 원래 native ID나 인수 문자열은 변경하지 않는다. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function expectedToolTaskScope(request: Pick<ChatRequest,
  "toolTask" | "conversationId" | "turnId">): ChatToolTaskScope | undefined {
  if (!request.toolTask) return undefined;
  const task = request.toolTask;
  check(task.schemaVersion === TOOL_TASK_SCHEMA_VERSION && id(task.taskId)
    && id(request.conversationId) && id(request.turnId)
    && Number.isSafeInteger(task.generation) && task.generation >= 1 && task.generation <= 2_147_483_647);
  return { schemaVersion: TOOL_TASK_SCHEMA_VERSION, conversationId: request.conversationId,
    turnId: request.turnId, taskId: task.taskId, generation: task.generation };
}

export function assertToolTaskScope(value: unknown, expected: ChatToolTaskScope): asserts value is Record<string, unknown> {
  check(record(value) && SCOPE_KEYS.every((key) => value[key] === expected[key as keyof ChatToolTaskScope]));
}

export function assertToolTaskMeta(value: unknown, expected: ChatToolTaskScope): void {
  assertToolTaskScope(value, expected);
  keys(value, [...SCOPE_KEYS, "status"]);
  check(value.status === "running");
}

export function parseToolTaskSteps(value: unknown): ChatToolTaskStep[] {
  check(Array.isArray(value) && value.length <= MAX_TOOL_TASK_STEPS);
  const ids = new Set<string>();
  return value.map((raw, index) => {
    check(record(raw));
    keys(raw, STEP_KEYS);
    check(raw.stepIndex === index && id(raw.toolCallId) && !ids.has(raw.toolCallId)
      && typeof raw.toolName === "string" && (READ_TOOLS.has(raw.toolName) || WRITE_TOOLS.has(raw.toolName))
      && (raw.source === "native" || raw.source === "auxiliary")
      && raw.dispatchStatus === (READ_TOOLS.has(raw.toolName) ? "reported" : "accepted")
      && (raw.source !== "auxiliary" || raw.toolName === "get_portfolio_ui_settings"));
    ids.add(raw.toolCallId);
    return { stepIndex: index, toolCallId: raw.toolCallId,
      toolName: raw.toolName as ChatToolTaskStep["toolName"], source: raw.source,
      dispatchStatus: raw.dispatchStatus as ChatToolTaskStep["dispatchStatus"] };
  });
}

export function stepFromExecution(execution: ChatToolExecution): ChatToolTaskStep {
  const task = execution.toolTask;
  check(task);
  return { stepIndex: task.stepIndex, toolCallId: execution.toolCallId, toolName: execution.toolName,
    source: task.source, dispatchStatus: task.dispatchStatus };
}

/** v1은 레거시의 개별 drop/정규화/slice 대신 전체 계약을 엄격하게 검사한다. */
export function parseTaskToolExecution(value: unknown, scope: ChatToolTaskScope,
  parseExecution: (value: unknown) => ChatToolExecution | null): ChatToolExecution {
  check(record(value));
  const { toolTask, ...base } = value;
  assertToolTaskScope(toolTask, scope);
  keys(toolTask, [...SCOPE_KEYS, "stepIndex", "source", "dispatchStatus"]);
  check(Number.isInteger(toolTask.stepIndex) && Number(toolTask.stepIndex) >= 0
    && Number(toolTask.stepIndex) < MAX_TOOL_TASK_STEPS);
  const execution = parseExecution(base);
  check(execution && base.toolName === execution.toolName && id(base.toolCallId)
    && base.toolCallId === execution.toolCallId);
  keys(base, Object.keys(execution));
  check(READ_TOOLS.has(execution.toolName) || WRITE_TOOLS.has(execution.toolName));
  check((toolTask.source === "native" || toolTask.source === "auxiliary")
    && toolTask.dispatchStatus === (READ_TOOLS.has(execution.toolName) ? "reported" : "accepted")
    && (toolTask.source !== "auxiliary" || execution.toolName === "get_portfolio_ui_settings"));
  if (execution.type === "report_portfolio_ui_settings") check(execution.available === Boolean(execution.uiSettings));
  return { ...execution, toolTask: { ...scope, stepIndex: Number(toolTask.stepIndex),
    source: toolTask.source, dispatchStatus: toolTask.dispatchStatus } as ChatToolTaskDirective };
}

export function parseToolTaskResponse(value: unknown, request: Pick<ChatRequest,
  "toolTask" | "conversationId" | "turnId" | "toolVerification">,
  executions: ChatToolExecution[], allowEmptyOfflineFailure = false): ChatToolTaskResponse {
  const scope = expectedToolTaskScope(request);
  check(scope);
  assertToolTaskScope(value, scope);
  keys(value, [...SCOPE_KEYS, "status", "steps", "dispatchComplete"]);
  const steps = parseToolTaskSteps(value.steps);
  check(typeof value.dispatchComplete === "boolean");
  if (request.toolVerification) {
    check(request.toolTask?.steps && typeof request.toolTask.dispatchComplete === "boolean");
    check(canonical(steps) === canonical(parseToolTaskSteps(request.toolTask.steps))
      && value.dispatchComplete === request.toolTask.dispatchComplete && executions.length === 0
      && (value.status === "completed" || value.status === "failed")
      && (value.dispatchComplete || value.status === "failed"));
    const accepted = steps.filter((step) => step.dispatchStatus === "accepted");
    const results = request.toolVerification.results;
    check(results.length === accepted.length && results.every((result, index) => {
      const step = accepted[index];
      return result.stepIndex === step.stepIndex && result.toolCallId === step.toolCallId
        && result.toolName === step.toolName && ["arrived", "applied", "failed"].includes(result.status);
    }));
    if (value.status === "completed") check(results.every((result) => result.status !== "failed"));
  } else {
    check(value.dispatchComplete === true && canonical(steps) === canonical(executions.map(stepFromExecution)));
    const expected = steps.some((step) => step.dispatchStatus === "accepted") ? "awaiting_browser"
      : steps.length > 0 ? "completed" : "not_required";
    check(value.status === expected || (allowEmptyOfflineFailure && steps.length === 0 && value.status === "failed"));
  }
  return { ...scope, status: value.status as ChatToolTaskResponse["status"],
    steps, dispatchComplete: value.dispatchComplete };
}

/** 한 HTTP 실행 작업의 순서·중복·실제 관측을 관리한다. 다른 작업은 공유하지 않는다. */
export class ToolTaskRuntime {
  private readonly scope: ChatToolTaskScope;
  private readonly isActive: () => boolean;
  private readonly executions: ChatToolExecution[] = [];
  private readonly states: ChatToolTaskProgress["steps"][number]["state"][] = [];
  private stage: ChatToolTaskProgress["status"] = "running";
  private completeDispatch = false;
  private startedMutations = 0;

  constructor(scope: ChatToolTaskScope, isActive: () => boolean) {
    this.scope = { ...scope };
    this.isActive = isActive;
  }

  get mutationDispatchCount(): number { return this.startedMutations; }
  get dispatchComplete(): boolean { return this.completeDispatch; }
  get terminal(): boolean { return ["completed", "failed", "cancelled"].includes(this.stage); }
  get steps(): ChatToolTaskStep[] { return this.executions.map(stepFromExecution); }

  accept(execution: ChatToolExecution): boolean {
    if (!this.isActive()) return false;
    check(this.stage === "running");
    assertToolTaskScope(execution.toolTask, this.scope);
    const step = stepFromExecution(execution);
    check(Number.isInteger(step.stepIndex) && step.stepIndex >= 0 && step.stepIndex < MAX_TOOL_TASK_STEPS);
    if (step.stepIndex < this.executions.length) {
      check(canonical(this.executions[step.stepIndex]) === canonical(execution));
      return false;
    }
    check(!this.completeDispatch && step.stepIndex === this.executions.length
      && !this.executions.some((previous) => previous.toolCallId === execution.toolCallId));
    parseToolTaskSteps([...this.steps, step]);
    this.executions.push(execution);
    this.states.push(step.dispatchStatus === "reported" ? "reported" : "accepted");
    return true;
  }

  start(toolCallId: string): boolean {
    if (!this.isActive() || this.stage !== "running") return false;
    const index = this.executions.findIndex((execution) => execution.toolCallId === toolCallId);
    check(index >= 0);
    check(this.states.slice(0, index).every((state) => state !== "accepted" && state !== "running"));
    if (this.states[index] === "reported") return true;
    check(this.states[index] === "accepted");
    this.states[index] = "running";
    this.startedMutations++;
    return true;
  }

  observe(result: ToolResult): void {
    if (!this.isActive() || this.terminal) return;
    const index = this.executions.findIndex((execution) => execution.toolCallId === result.callId);
    check(index >= 0 && this.executions[index].toolTask?.dispatchStatus === "accepted");
    if (result.status !== "started") {
      check(this.states[index] === "running");
      this.states[index] = result.status;
    }
  }

  seal(task: ChatToolTaskResponse): void {
    if (!this.isActive()) return;
    assertToolTaskScope(task, this.scope);
    check(task.dispatchComplete && canonical(task.steps) === canonical(this.steps));
    this.completeDispatch = true;
  }

  awaitingVerification(): void {
    if (!this.isActive() || this.terminal) return;
    check(this.completeDispatch && this.states.every((state) => !["accepted", "running"].includes(state)));
    this.stage = "awaiting_verification";
  }

  finish(status: "completed" | "failed"): void {
    if (!this.isActive()) return;
    if (this.terminal) { check(this.stage === status); return; }
    check(this.completeDispatch && this.states.every((state) => !["accepted", "running"].includes(state)));
    if (status === "completed") check(this.states.every((state) => ["reported", "arrived", "applied"].includes(state)));
    this.stage = status;
  }

  terminate(status: "cancelled" | "failed"): void {
    if (this.terminal) return;
    this.stage = status;
    this.states.forEach((state, index) => {
      if (state === "accepted" || state === "running") this.states[index] = status;
    });
  }

  snapshot(): ChatToolTaskProgress {
    return { scope: { ...this.scope }, status: this.stage, dispatchComplete: this.completeDispatch,
      steps: this.steps.map((step, index) => ({ ...step, state: this.states[index] })) };
  }
}
