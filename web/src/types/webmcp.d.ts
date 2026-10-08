type WebMcpToolResult = {
  content: Array<{ type: 'text'; text: string }>;
};

type WebMcpTool = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (
    input: Record<string, unknown>,
    options: { signal: AbortSignal },
  ) => WebMcpToolResult | Promise<WebMcpToolResult>;
};

interface WebMcpModelContext {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
}

interface Document {
  readonly modelContext?: WebMcpModelContext;
}
