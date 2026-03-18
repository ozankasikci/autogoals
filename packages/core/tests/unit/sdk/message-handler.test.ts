import { describe, it, expect } from "vitest";
import {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "../../../src/sdk/message-handler.js";

describe("message handler", () => {
  it("extracts session ID from init message", () => {
    const msg = { type: "system", subtype: "init", session_id: "abc-123" };
    expect(extractSessionId(msg)).toBe("abc-123");
  });

  it("returns null for non-init messages", () => {
    const msg = { type: "assistant", message: { content: [] } };
    expect(extractSessionId(msg)).toBeNull();
  });

  it("extracts result from success message", () => {
    const msg = {
      type: "result",
      subtype: "success",
      result: "done",
      total_cost_usd: 0.5,
      duration_ms: 3000,
      session_id: "abc",
    };
    const result = extractResult(msg);
    expect(result).not.toBeNull();
    expect(result!.text).toBe("done");
    expect(result!.costUsd).toBe(0.5);
  });

  it("extracts text from assistant message", () => {
    const msg = {
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Hello" },
          { type: "tool_use", name: "Read", id: "1", input: {} },
        ],
      },
    };
    expect(extractAssistantText(msg)).toBe("Hello");
  });

  it("extracts tool use from assistant message", () => {
    const msg = {
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Bash", id: "1", input: { command: "ls" } },
        ],
      },
    };
    const tools = extractToolUse(msg);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("Bash");
  });
});
