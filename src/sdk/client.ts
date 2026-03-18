import { query } from "@anthropic-ai/claude-agent-sdk";
import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "child_process";
import type { SDKResult } from "./message-handler.js";
import {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "./message-handler.js";
import type { Logger, LogEvent, Spinner } from "../modules/logging/index.js";

function findClaudeExecutable(): string {
  try {
    return execSync("which claude", { encoding: "utf-8" }).trim();
  } catch {
    throw new Error(
      "Claude Code CLI not found. Install it or ensure 'claude' is in your PATH."
    );
  }
}

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
  spinner?: Spinner,
): Promise<SDKResult | null> {
  let lastResult: SDKResult | null = null;

  const claudePath = findClaudeExecutable();

  for await (const message of query({
    prompt: options.prompt,
    options: {
      pathToClaudeCodeExecutable: claudePath,
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

      if (spinner) {
        const spinnerMsg = toolUseToSpinnerMessage(tool.name, tool.input);
        if (spinnerMsg) spinner.update(spinnerMsg);
      }
    }

    const result = extractResult(message);
    if (result) {
      lastResult = result;
    }
  }

  return lastResult;
}

function toolUseToSpinnerMessage(
  name: string,
  input: Record<string, unknown>
): string | null {
  switch (name) {
    case "Write":
    case "Edit":
      return `Creating ${String(input.file_path ?? "file").split("/").pop()}...`;
    case "Bash":
      return `Running: ${String(input.command ?? "").slice(0, 60)}...`;
    default:
      return null;
  }
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
