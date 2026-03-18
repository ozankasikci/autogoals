export interface SDKResult {
  text: string;
  costUsd: number;
  durationMs: number;
  sessionId: string;
}

export interface ToolUseInfo {
  name: string;
  id: string;
  input: Record<string, unknown>;
}

export function extractSessionId(msg: any): string | null {
  if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
    return msg.session_id;
  }
  return null;
}

export function extractResult(msg: any): SDKResult | null {
  if (msg.type === "result") {
    return {
      text: msg.result ?? "",
      costUsd: msg.total_cost_usd ?? 0,
      durationMs: msg.duration_ms ?? 0,
      sessionId: msg.session_id ?? "",
    };
  }
  return null;
}

export function extractAssistantText(msg: any): string | null {
  if (msg.type !== "assistant" || !msg.message?.content) return null;
  const textBlocks = msg.message.content.filter(
    (block: any) => block.type === "text"
  );
  if (textBlocks.length === 0) return null;
  return textBlocks.map((b: any) => b.text).join("");
}

export function extractToolUse(msg: any): ToolUseInfo[] {
  if (msg.type !== "assistant" || !msg.message?.content) return [];
  return msg.message.content
    .filter((block: any) => block.type === "tool_use")
    .map((block: any) => ({
      name: block.name,
      id: block.id,
      input: block.input ?? {},
    }));
}
