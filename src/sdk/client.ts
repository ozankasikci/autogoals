import { query } from "@anthropic-ai/claude-agent-sdk";
import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { SDKResult } from "./message-handler.js";
import {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "./message-handler.js";
import type { Logger, LogEvent } from "../modules/logging/index.js";

export interface QueryOptions {
  prompt: string;
  systemPrompt?: string;
  allowedTools?: string[];
  cwd?: string;
  model?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  resume?: string;
  permissionMode?: PermissionMode;
}

export interface QueryCallbacks {
  onSessionId?: (id: string) => void;
  onAssistantText?: (text: string) => void;
  onToolUse?: (name: string, input: Record<string, unknown>) => void;
}

export async function runQuery(
  options: QueryOptions,
  logger?: Logger,
  callbacks?: QueryCallbacks,
): Promise<SDKResult | null> {
  let lastResult: SDKResult | null = null;

  for await (const message of query({
    prompt: options.prompt,
    options: {
      systemPrompt: options.systemPrompt,
      allowedTools: options.allowedTools,
      cwd: options.cwd,
      model: options.model,
      maxTurns: options.maxTurns,
      maxBudgetUsd: options.maxBudgetUsd,
      resume: options.resume,
      permissionMode: options.permissionMode ?? "bypassPermissions",
    },
  })) {
    const sessionId = extractSessionId(message);
    if (sessionId) {
      callbacks?.onSessionId?.(sessionId);
    }

    const text = extractAssistantText(message);
    if (text) {
      callbacks?.onAssistantText?.(text);
    }

    const tools = extractToolUse(message);
    for (const tool of tools) {
      callbacks?.onToolUse?.(tool.name, tool.input);

      if (logger) {
        const event = toolUseToLogEvent(tool.name, tool.input);
        if (event) logger.log(event);
      }
    }

    const result = extractResult(message);
    if (result) {
      lastResult = result;
    }
  }

  return lastResult;
}

function toolUseToLogEvent(
  name: string,
  input: Record<string, unknown>
): LogEvent | null {
  switch (name) {
    case "Write":
      return {
        type: "file_created",
        message: `Created ${input.file_path ?? "file"}`,
      };
    case "Edit":
      return {
        type: "file_edited",
        message: `Edited ${input.file_path ?? "file"}`,
      };
    case "Read":
      return {
        type: "file_read",
        message: `Read ${input.file_path ?? "file"}`,
      };
    case "Bash":
      return {
        type: "shell_success",
        message: `$ ${String(input.command ?? "").slice(0, 80)}`,
      };
    default:
      return null;
  }
}
