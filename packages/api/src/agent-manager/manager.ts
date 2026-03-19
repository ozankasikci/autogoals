import { AgentSession, SQLiteStore, type AgentEvent } from "@small-singularity/core";
import type Database from "better-sqlite3";
import { basename } from "path";
import { pubsub, EVENTS } from "../subscriptions/index.js";

function buildToolSummary(tool: string, input: Record<string, unknown>): string {
  switch (tool) {
    case "Write": return `Created ${basename(String(input.file_path || "file"))}`;
    case "Edit": return `Edited ${basename(String(input.file_path || "file"))}`;
    case "Read": return `Read ${basename(String(input.file_path || "file"))}`;
    case "Bash": return `$ ${String(input.command || "").slice(0, 80)}`;
    case "Glob": return `Searched for ${input.pattern || "files"}`;
    case "Grep": return `Searched for "${String(input.pattern || "").slice(0, 40)}"`;
    case "WebSearch": return `Searched web: ${String(input.query || "").slice(0, 60)}`;
    case "WebFetch": return `Fetched ${String(input.url || "URL").slice(0, 60)}`;
    default: return `Used ${tool}`;
  }
}

// Tools that indicate the agent is actively working (not just reading)
const ACTIVE_TOOLS = new Set(["Write", "Edit", "Bash"]);

export class AgentManager {
  private sessions = new Map<string, AgentSession>();
  private activeGoals = new Map<string, string>(); // projectId → goalId
  private getDb: () => Database.Database;

  constructor(getDb: () => Database.Database) {
    this.getDb = getDb;
  }

  private publishLogEvent(projectId: string, type: string, message: string, costUsd?: number) {
    const db = this.getDb();
    const store = new SQLiteStore(db, projectId);
    store.addActivityEvent(type, message, costUsd);

    pubsub.publish(EVENTS.LOG_EVENT, {
      logEvent: {
        type,
        message,
        costUsd: costUsd ?? null,
        timestamp: new Date().toISOString(),
        projectId,
      },
    });
  }

  isRunning(projectId: string): boolean {
    return this.sessions.has(projectId);
  }

  getRunningIds(): Set<string> {
    return new Set(this.sessions.keys());
  }

  start(projectId: string, projectPath: string, systemPrompt?: string, initialMessage?: string): void {
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

    // Set phase based on what we're about to do
    const db = this.getDb();
    const store = new SQLiteStore(db, projectId);
    const goals = store.getGoals();
    const hasDraftGoals = goals.some(g => g.status === "draft");
    const hasPendingGoals = goals.some(g => g.status === "pending" || g.status === "ready");

    if (hasDraftGoals) {
      store.setPhase("interview");
    } else if (hasPendingGoals) {
      store.setPhase("execution");
    } else {
      store.setPhase("standby");
    }

    this.consumeEvents(projectId, session);

    if (initialMessage) {
      session.send(initialMessage);
    }
  }

  sendMessage(projectId: string, content: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      throw new Error(`No agent running for project ${projectId}`);
    }
    session.send(content);
  }

  private activateNextGoal(projectId: string): void {
    const db = this.getDb();
    const store = new SQLiteStore(db, projectId);
    const goals = store.getGoals();

    // Only pick up pending or ready goals (skip draft, refined)
    const pending = goals.find(g => g.status === "pending" || g.status === "ready");
    if (!pending) return;

    store.updateGoal(pending.id, { status: "active" });
    store.setPhase("execution");
    this.activeGoals.set(projectId, pending.id);

    console.log(`[AgentManager] Goal '${pending.id}' → active`);

    pubsub.publish(EVENTS.PROJECT_UPDATED, {
      projectUpdated: { id: projectId },
    });
  }

  private completeActiveGoal(projectId: string): void {
    const activeGoalId = this.activeGoals.get(projectId);
    if (!activeGoalId) return;

    const db = this.getDb();
    const store = new SQLiteStore(db, projectId);
    store.updateGoal(activeGoalId, { status: "done" });
    this.activeGoals.delete(projectId);

    // Check if more goals remain, otherwise standby
    const remaining = store.getGoals().filter(g => g.status === "pending" || g.status === "ready" || g.status === "draft");
    if (remaining.length === 0) {
      store.setPhase("standby");
    }

    console.log(`[AgentManager] Goal '${activeGoalId}' → done`);

    pubsub.publish(EVENTS.PROJECT_UPDATED, {
      projectUpdated: { id: projectId },
    });
  }

  private async consumeEvents(
    projectId: string,
    session: AgentSession,
  ): Promise<void> {
    let hasSeenActiveTool = false;

    try {
      console.log(`[AgentManager] Starting event consumption for project ${projectId}`);
      for await (const event of session.events()) {
        console.log(`[AgentManager] Event: ${event.type}`, event.type === "text" ? event.text?.slice(0, 80) : event.type === "error" ? event.error : event.type === "tool_use" ? event.toolName : "");

        switch (event.type) {
          case "text": {
            const db = this.getDb();
            const store = new SQLiteStore(db, projectId);
            const msg = store.addMessage("agent", event.text!);

            // Check if this is a refinement response with structured JSON
            const jsonMatch = event.text!.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.criteria && parsed.approach) {
                  // Find the draft goal and update it
                  const draftGoals = db
                    .prepare(
                      "SELECT id, name FROM goals WHERE project_id = ? AND status = 'draft' ORDER BY rowid DESC LIMIT 1",
                    )
                    .all(projectId) as { id: string; name: string }[];

                  if (draftGoals.length > 0) {
                    const goalId = draftGoals[0].id;
                    store.updateGoal(goalId, {
                      acceptanceCriteria: parsed.criteria,
                      approach: parsed.approach,
                      status: "refined",
                    });

                    // Update project spec if specUpdate provided
                    if (parsed.specUpdate) {
                      const existingSpec = store.getSpec();
                      if (existingSpec) {
                        store.updateSpec(
                          existingSpec.overview + "\n\n" + parsed.specUpdate,
                          existingSpec.technicalDecisions,
                        );
                      } else {
                        store.saveSpec({
                          overview: parsed.specUpdate,
                          goals: [],
                          technicalDecisions: [],
                        });
                      }
                    }

                    // Move to spec phase since we just generated criteria
                    store.setPhase("spec");

                    console.log(
                      `[AgentManager] Goal '${draftGoals[0].name}' refined with ${parsed.criteria.length} criteria`,
                    );

                    pubsub.publish(EVENTS.PROJECT_UPDATED, {
                      projectUpdated: { id: projectId },
                    });
                  }
                }
              } catch {
                // Not valid JSON refinement, just a normal message
              }
            }

            pubsub.publish(EVENTS.NEW_MESSAGE, {
              newMessage: { ...msg, projectId },
            });
            this.publishLogEvent(projectId, "info", event.text!.slice(0, 200));
            break;
          }

          case "tool_use": {
            // If agent uses a write/edit/bash tool, activate the next pending goal
            if (ACTIVE_TOOLS.has(event.toolName!) && !this.activeGoals.has(projectId)) {
              this.activateNextGoal(projectId);
              hasSeenActiveTool = true;
            }

            // Store a tool-use message in the chat stream
            const toolMsg = JSON.stringify({
              _type: "tool_use",
              tool: event.toolName,
              input: event.toolInput,
              summary: buildToolSummary(event.toolName!, event.toolInput || {}),
            });

            {
              const db = this.getDb();
              const store = new SQLiteStore(db, projectId);
              const msg = store.addMessage("agent", toolMsg);

              pubsub.publish(EVENTS.NEW_MESSAGE, {
                newMessage: { ...msg, projectId },
              });
            }

            // Also keep the log event
            this.publishLogEvent(projectId, "info", `Using ${event.toolName}${event.toolInput?.file_path ? `: ${event.toolInput.file_path}` : ""}${event.toolInput?.command ? `: ${String(event.toolInput.command).slice(0, 60)}` : ""}`);
            break;
          }

          case "result": {
            // Agent turn completed — if there was an active goal and the agent was working, mark it done
            if (hasSeenActiveTool && this.activeGoals.has(projectId)) {
              this.completeActiveGoal(projectId);
              hasSeenActiveTool = false;

              // Check if there are more pending goals — query with names
              const db = this.getDb();
              const remainingRows = db
                .prepare("SELECT id, name, description FROM goals WHERE project_id = ? AND status IN ('pending', 'ready') ORDER BY rowid LIMIT 1")
                .all(projectId) as { id: string; name: string; description: string }[];
              if (remainingRows.length > 0) {
                const next = remainingRows[0];
                session.send(`Great work! Now move on to the next goal: "${next.name}". Description: ${next.description}. Begin implementing it.`);
              }
            }

            this.publishLogEvent(projectId, "info", `Agent completed turn (cost: $${event.result?.costUsd.toFixed(4) ?? "?"})`, event.result?.costUsd);
            break;
          }

          case "error":
            this.publishLogEvent(projectId, "error", `Agent error: ${event.error}`);
            break;
        }
      }
    } catch (err: any) {
      this.publishLogEvent(projectId, "error", `Agent crashed: ${err.message}`);
    } finally {
      this.sessions.delete(projectId);
      this.activeGoals.delete(projectId);
    }
  }

  stop(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) return;
    session.close();
    this.sessions.delete(projectId);
    this.activeGoals.delete(projectId);
  }

  stopAll(): void {
    for (const [id] of this.sessions) {
      this.stop(id);
    }
  }
}
