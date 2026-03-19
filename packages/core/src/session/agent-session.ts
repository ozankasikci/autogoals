import { query } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "child_process";
import { MessageQueue } from "./message-queue.js";
import {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "../sdk/message-handler.js";
import type { SDKResult, ToolUseInfo } from "../sdk/message-handler.js";

function findClaudeExecutable(): string {
  try {
    return execSync("which claude", { encoding: "utf-8" }).trim();
  } catch {
    throw new Error("Claude Code CLI not found.");
  }
}

export interface AgentSessionOptions {
  systemPrompt?: string;
  allowedTools?: string[];
  cwd: string;
  model?: string;
  maxTurns?: number;
  permissionMode?: string;
}

export interface AgentEvent {
  type: "text" | "tool_use" | "session_id" | "result" | "error";
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  sessionId?: string;
  result?: SDKResult;
  error?: string;
}

export class AgentSession {
  private queue: MessageQueue;
  private outputIterator: AsyncIterator<any>;
  private _sessionId: string | null = null;
  private _closed = false;

  constructor(options: AgentSessionOptions) {
    this.queue = new MessageQueue();

    const claudePath = findClaudeExecutable();

    this.outputIterator = query({
      prompt: this.queue as any,
      options: {
        pathToClaudeCodeExecutable: claudePath,
        systemPrompt: options.systemPrompt,
        allowedTools: options.allowedTools ?? [
          "Read", "Write", "Edit", "Bash", "Glob", "Grep",
          "WebSearch", "WebFetch",
        ],
        cwd: options.cwd,
        model: options.model ?? "sonnet",
        maxTurns: options.maxTurns ?? 200,
        permissionMode: (options.permissionMode ?? "bypassPermissions") as any,
        settingSources: ["project"],
      },
    })[Symbol.asyncIterator]();
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get closed(): boolean {
    return this._closed;
  }

  send(content: string): void {
    if (this._closed) throw new Error("Session is closed");
    this.queue.push(content);
  }

  async *events(): AsyncGenerator<AgentEvent> {
    try {
      while (true) {
        const { value, done } = await this.outputIterator.next();
        if (done) break;

        const sessionId = extractSessionId(value);
        if (sessionId) {
          this._sessionId = sessionId;
          yield { type: "session_id", sessionId };
        }

        const text = extractAssistantText(value);
        if (text) {
          yield { type: "text", text };
        }

        const tools = extractToolUse(value);
        for (const tool of tools) {
          yield {
            type: "tool_use",
            toolName: tool.name,
            toolInput: tool.input,
          };
        }

        const result = extractResult(value);
        if (result) {
          yield { type: "result", result };
        }
      }
    } catch (err: any) {
      yield { type: "error", error: err.message ?? String(err) };
    } finally {
      this._closed = true;
    }
  }

  close(): void {
    this._closed = true;
    this.queue.close();
  }
}
