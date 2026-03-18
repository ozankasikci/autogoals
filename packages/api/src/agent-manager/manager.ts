import { AgentSession, SQLiteStore, type AgentEvent } from "@small-singularity/core";
import type Database from "better-sqlite3";
import { pubsub, EVENTS } from "../subscriptions/index.js";

export class AgentManager {
  private sessions = new Map<string, AgentSession>();
  private getDb: () => Database.Database;

  constructor(getDb: () => Database.Database) {
    this.getDb = getDb;
  }

  isRunning(projectId: string): boolean {
    return this.sessions.has(projectId);
  }

  getRunningIds(): Set<string> {
    return new Set(this.sessions.keys());
  }

  start(projectId: string, projectPath: string, systemPrompt?: string): void {
    if (this.sessions.has(projectId)) {
      throw new Error(`Agent already running for project ${projectId}`);
    }

    const session = new AgentSession({
      cwd: projectPath,
      model: "sonnet",
      systemPrompt:
        systemPrompt ??
        `You are an autonomous AI agent working on a project at ${projectPath}. Help the user build their project. Ask clarifying questions when needed. Be concise.`,
      allowedTools: [
        "Read",
        "Write",
        "Edit",
        "Bash",
        "Glob",
        "Grep",
        "WebSearch",
        "WebFetch",
      ],
      maxTurns: 200,
    });

    this.sessions.set(projectId, session);

    // Start consuming events in the background
    this.consumeEvents(projectId, session);
  }

  sendMessage(projectId: string, content: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      throw new Error(`No agent running for project ${projectId}`);
    }
    session.send(content);
  }

  private async consumeEvents(
    projectId: string,
    session: AgentSession,
  ): Promise<void> {
    try {
      console.log(`[AgentManager] Starting event consumption for project ${projectId}`);
      for await (const event of session.events()) {
        console.log(`[AgentManager] Event: ${event.type}`, event.type === "text" ? event.text?.slice(0, 80) : event.type === "error" ? event.error : "");
        switch (event.type) {
          case "text": {
            // Store in DB
            const db = this.getDb();
            const store = new SQLiteStore(db, projectId);
            const msg = store.addMessage("agent", event.text!);

            // Publish via subscription
            pubsub.publish(EVENTS.NEW_MESSAGE, {
              newMessage: { ...msg, projectId },
            });
            pubsub.publish(EVENTS.LOG_EVENT, {
              logEvent: {
                type: "info",
                message: event.text!.slice(0, 200),
                timestamp: new Date().toISOString(),
                projectId,
              },
            });
            break;
          }

          case "tool_use":
            pubsub.publish(EVENTS.LOG_EVENT, {
              logEvent: {
                type: "info",
                message: `Using ${event.toolName}${event.toolInput?.file_path ? `: ${event.toolInput.file_path}` : ""}${event.toolInput?.command ? `: ${String(event.toolInput.command).slice(0, 60)}` : ""}`,
                timestamp: new Date().toISOString(),
                projectId,
              },
            });
            break;

          case "result":
            pubsub.publish(EVENTS.LOG_EVENT, {
              logEvent: {
                type: "info",
                message: `Agent completed (cost: $${event.result?.costUsd.toFixed(4) ?? "?"})`,
                timestamp: new Date().toISOString(),
                projectId,
              },
            });
            break;

          case "error":
            pubsub.publish(EVENTS.LOG_EVENT, {
              logEvent: {
                type: "error",
                message: `Agent error: ${event.error}`,
                timestamp: new Date().toISOString(),
                projectId,
              },
            });
            break;
        }
      }
    } catch (err: any) {
      pubsub.publish(EVENTS.LOG_EVENT, {
        logEvent: {
          type: "error",
          message: `Agent crashed: ${err.message}`,
          timestamp: new Date().toISOString(),
          projectId,
        },
      });
    } finally {
      this.sessions.delete(projectId);
    }
  }

  stop(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) return;
    session.close();
    this.sessions.delete(projectId);
  }

  stopAll(): void {
    for (const [id] of this.sessions) {
      this.stop(id);
    }
  }
}
