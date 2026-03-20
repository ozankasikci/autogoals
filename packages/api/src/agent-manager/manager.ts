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

const VERIFY_COOLDOWN = 30 * 60 * 1000; // 30 min between re-verifying the same goal

export class AgentManager {
  private loops = new Map<string, boolean>(); // projectId → running flag
  private sessions = new Map<string, AgentSession>();
  private activeGoals = new Map<string, string>(); // projectId → goalId
  private lastVerified = new Map<string, number>(); // goalId → timestamp
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

  // Start the continuous loop for a project
  start(projectId: string, projectPath: string, systemPromptBase: string): void {
    if (this.loops.has(projectId)) throw new Error(`Already running for project ${projectId}`);
    this.loops.set(projectId, true);
    this.runContinuous(projectId, projectPath, systemPromptBase);
  }

  // Stop the continuous loop
  stop(projectId: string): void {
    this.loops.delete(projectId);
    const session = this.sessions.get(projectId);
    if (session) {
      session.close();
      this.sessions.delete(projectId);
    }
    this.activeGoals.delete(projectId);
  }

  stopAll(): void {
    for (const [id] of this.loops) {
      this.stop(id);
    }
  }

  isRunning(projectId: string): boolean {
    return this.loops.has(projectId);
  }

  getRunningIds(): Set<string> {
    return new Set(this.loops.keys());
  }

  // Push a message to the active session, or store for next pickup
  sendMessage(projectId: string, content: string): void {
    const session = this.sessions.get(projectId);
    if (session && !session.closed) {
      session.send(content);
    }
    // Message is already stored in DB by the resolver
    // The loop will pick it up if no active session
  }

  // The main continuous loop
  private async runContinuous(projectId: string, projectPath: string, systemPromptBase: string) {
    const IDLE_COOLDOWN = 60 * 1000;  // 1 min when nothing to do
    const POST_WORK_COOLDOWN = 5 * 1000;   // 5s after completing work

    console.log(`[Supervisor] Starting continuous loop for ${projectId}`);

    // Mark all existing messages as read on startup so we don't replay history
    {
      const db = this.getDb();
      const store = new SQLiteStore(db, projectId);
      store.markMessagesRead();
    }

    while (this.loops.has(projectId)) {
      try {
        const db = this.getDb();
        const store = new SQLiteStore(db, projectId);

        console.log(`[Supervisor:${projectId.slice(0, 8)}] Evaluating...`);

        // --- Phase 0: Empty project — ask user what to build ---
        const allGoals = store.getGoals();
        const projectRules = store.getRules();
        if (allGoals.length === 0 && projectRules.length === 0) {
          // Check if we already asked (has agent messages)
          const existingMessages = store.getMessages(5);
          const hasAgentIntro = existingMessages.some(m => m.role === "agent");
          if (!hasAgentIntro) {
            store.setPhase("interview");
            this.publishLogEvent(projectId, "info", "New project — introducing agent");
            await this.runTask(projectId, projectPath, systemPromptBase, {
              prompt: `This is a brand new project with no goals or rules defined yet. Introduce yourself briefly, scan the project directory to understand what exists (if anything), and ask the user what they want to build. Be concise and direct.`,
              model: "sonnet",
              maxTurns: 20,
            });
            await this.sleep(POST_WORK_COOLDOWN, projectId);
            continue;
          }
        }

        // --- Phase A: Check for unread USER messages (not agent messages) ---
        const unread = store.getUnreadMessages().filter(m => m.role === "user");
        if (unread.length > 0) {
          store.setPhase("standby");
          // Only process the last 5 messages to avoid overwhelming the agent
          const recent = unread.slice(-5);
          const msgText = recent.map(m => `User: ${m.content}`).join("\n");
          await this.runTask(projectId, projectPath, systemPromptBase, {
            prompt: `The user sent you messages:\n\n${msgText}\n\nRespond helpfully.`,
            model: "sonnet",
            maxTurns: 30,
          });
          store.markMessagesRead();
          await this.sleep(POST_WORK_COOLDOWN, projectId);
          continue;
        }

        // --- Phase B1: Refine draft goals first ---
        const goals = store.getGoals();
        const draftGoal = goals.find(g => g.status === "draft");
        if (draftGoal) {
          store.setPhase("interview");
          const goalRow = db.prepare(
            "SELECT id, name, description FROM goals WHERE project_id = ? AND id = ?"
          ).get(projectId, draftGoal.id) as any;

          if (goalRow) {
            this.publishLogEvent(projectId, "info", `Refining goal: ${goalRow.name}`);
            pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });

            const refinePrompt = `A goal needs to be refined before implementation.\n\nGOAL: ${goalRow.name}\nDESCRIPTION: ${goalRow.description || "none"}\n\nAnalyze this goal and generate:\n1. A clear technical approach (2-3 sentences)\n2. Specific, testable acceptance criteria (3-7 items)\n\nRespond with EXACTLY this JSON format:\n\`\`\`json\n{\n  "approach": "your technical approach here",\n  "criteria": ["criterion 1", "criterion 2", "criterion 3"]\n}\n\`\`\``;

            const result = await this.runTask(projectId, projectPath, systemPromptBase, {
              prompt: refinePrompt,
              model: "opus",
              maxTurns: 15,
            });

            // Parse the refinement response
            const jsonMatch = result?.text?.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.criteria && parsed.approach) {
                  store.updateGoal(draftGoal.id, {
                    acceptanceCriteria: parsed.criteria,
                    approach: parsed.approach,
                    status: "pending",
                  });
                  store.setPhase("spec");
                  this.publishLogEvent(projectId, "info", `Goal '${goalRow.name}' refined with ${parsed.criteria.length} criteria → pending`);
                  pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });
                }
              } catch {
                // JSON parse failed — promote to pending anyway so it doesn't get stuck
                store.updateGoal(draftGoal.id, { status: "pending" });
                this.publishLogEvent(projectId, "warning", `Could not parse refinement for '${goalRow.name}', promoting to pending`);
              }
            } else {
              // No JSON block — promote to pending anyway
              store.updateGoal(draftGoal.id, { status: "pending" });
              this.publishLogEvent(projectId, "warning", `No structured refinement for '${goalRow.name}', promoting to pending`);
            }
          }
          await this.sleep(POST_WORK_COOLDOWN, projectId);
          continue;
        }

        // --- Phase B2: Work on actionable goals ---
        const actionable = goals.find(g =>
          g.status === "pending" || g.status === "ready" || g.status === "regressed" || g.status === "active"
        );
        if (actionable) {
          store.setPhase("execution");
          const goalRow = db.prepare(
            "SELECT id, name, description, approach, acceptance_criteria, recurring FROM goals WHERE project_id = ? AND id = ?"
          ).get(projectId, actionable.id) as any;

          if (goalRow) {
            const criteria = JSON.parse(goalRow.acceptance_criteria || "[]");
            store.updateGoal(actionable.id, { status: "active" });
            this.activeGoals.set(projectId, actionable.id);

            this.publishLogEvent(projectId, "info", `Goal '${goalRow.name}' \u2192 active`);
            pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });

            const uncheckedCriteria = criteria.filter((c: string) => !c.startsWith("[x] "));
            const checkedCriteria = criteria.filter((c: string) => c.startsWith("[x] "));
            const goalPrompt = `Implement this goal:\n\nGOAL: ${goalRow.name}\nDESCRIPTION: ${goalRow.description || "none"}\nAPPROACH: ${goalRow.approach || "none"}\n\nOUTSTANDING CRITERIA (work on these):\n${uncheckedCriteria.map((c: string) => `- ${c.replace(/^\[ \] /, "")}`).join("\n") || "- none specified"}${checkedCriteria.length > 0 ? `\n\nALREADY DONE (skip these):\n${checkedCriteria.map((c: string) => `- ✓ ${c.replace(/^\[x\] /, "")}`).join("\n")}` : ""}\n\nImplement the outstanding criteria. Skip the ones already done.`;

            await this.runTask(projectId, projectPath, systemPromptBase, {
              prompt: goalPrompt,
              model: "opus",
              maxTurns: 100,
            });

            // After goal execution completes:
            if (goalRow.recurring) {
              // Don't mark as done — reset to pending so it runs again next cycle
              store.updateGoal(actionable.id, { status: "pending" });
              this.activeGoals.delete(projectId);
              this.publishLogEvent(projectId, "info", `Recurring goal '${goalRow.name}' \u2192 pending (will re-execute next cycle)`);
            } else {
              store.updateGoal(actionable.id, { status: "done" });
              this.activeGoals.delete(projectId);
              this.publishLogEvent(projectId, "info", `Goal '${goalRow.name}' \u2192 done`);
            }
            pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });
          }
          await this.sleep(POST_WORK_COOLDOWN, projectId);
          continue;
        }

        // --- Phase C: Verify completed goals (rotate, skip recently verified) ---
        // Skip recurring goals — they cycle pending→active→pending, never stay "done"
        const doneGoals = goals.filter(g => g.status === "done" && !g.recurring);
        const now = Date.now();
        const needsVerification = doneGoals.filter(g => {
          const lastCheck = this.lastVerified.get(g.id) ?? 0;
          return (now - lastCheck) > VERIFY_COOLDOWN;
        });
        if (needsVerification.length > 0) {
          store.setPhase("monitoring");
          const goalToVerify = needsVerification[0];
          const goalRow = db.prepare(
            "SELECT id, name, acceptance_criteria FROM goals WHERE project_id = ? AND id = ?"
          ).get(projectId, goalToVerify.id) as any;

          if (goalRow) {
            const criteria = JSON.parse(goalRow.acceptance_criteria || "[]");
            if (criteria.length > 0) {
              this.publishLogEvent(projectId, "info", `Verifying goal: ${goalRow.name}`);

              const verifyPrompt = `Verify that this goal is still met. Do NOT make changes \u2014 only check.\n\nGOAL: ${goalRow.name}\nCRITERIA:\n${criteria.map((c: string) => `- ${c}`).join("\n")}\n\nRun tests, check files, verify each criterion. Respond with:\n- VERIFIED: if all criteria still pass\n- REGRESSED: [reason] if any criterion fails`;

              const result = await this.runTask(projectId, projectPath, systemPromptBase, {
                prompt: verifyPrompt,
                model: "sonnet",
                maxTurns: 20,
              });

              // Mark as verified regardless of outcome
              this.lastVerified.set(goalToVerify.id, Date.now());

              if (result?.text?.includes("REGRESSED")) {
                store.updateGoal(goalToVerify.id, { status: "regressed" });
                this.publishLogEvent(projectId, "warning", `Goal '${goalRow.name}' regressed!`);
                pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });
                await this.sleep(POST_WORK_COOLDOWN, projectId);
                continue; // Next iteration will pick it up as incomplete
              } else {
                this.publishLogEvent(projectId, "info", `Goal '${goalRow.name}' verified ✓ (next check in 30m)`);
              }
            }
          }
        }

        // --- Phase D: Check rules (with cooldown) ---
        const rulesKey = `rules:${projectId}`;
        const lastRulesCheck = this.lastVerified.get(rulesKey) ?? 0;
        const rules = store.getRules();
        if (rules.length > 0 && (now - lastRulesCheck) > VERIFY_COOLDOWN) {
          this.lastVerified.set(rulesKey, Date.now());
          const rulesText = rules.map(r => `- ${r.content}`).join("\n");
          this.publishLogEvent(projectId, "info", "Checking rules compliance...");

          const rulesPrompt = `Check if these project rules are being followed. Do NOT make changes \u2014 only check.\n\nRULES:\n${rulesText}\n\nScan the codebase. Respond with:\n- ALL_CLEAR: if all rules are followed\n- VIOLATION: [rule] [details] if any rule is broken`;

          const result = await this.runTask(projectId, projectPath, systemPromptBase, {
            prompt: rulesPrompt,
            model: "sonnet",
            maxTurns: 15,
          });

          if (result?.text?.includes("VIOLATION")) {
            // Store the violation as a chat message so user sees it
            const violationText = `Rule violation detected:\n\n${result.text}`;
            store.addMessage("agent", violationText);
            pubsub.publish(EVENTS.NEW_MESSAGE, {
              newMessage: { role: "agent", content: result.text, projectId },
            });
          } else {
            this.publishLogEvent(projectId, "info", "All rules compliant");
          }
        }

        // --- Phase E: All green → sleep ---
        store.setPhase("standby");
        this.publishLogEvent(projectId, "info", `All clear. Sleeping ${IDLE_COOLDOWN / 1000}s...`);
        await this.sleep(IDLE_COOLDOWN, projectId);

      } catch (err: any) {
        console.error(`[Supervisor] Error in loop for ${projectId}:`, err.message);
        this.publishLogEvent(projectId, "error", `Supervisor error: ${err.message}`);
        // Don't crash the loop — sleep and retry
        await this.sleep(30_000, projectId);
      }
    }

    console.log(`[Supervisor] Loop ended for ${projectId}`);
  }

  // Run a single focused task session with timeout
  private async runTask(
    projectId: string,
    projectPath: string,
    systemPromptBase: string,
    task: { prompt: string; model: string; maxTurns: number }
  ): Promise<{ text?: string; costUsd?: number } | null> {
    const pid = projectId.slice(0, 8);
    console.log(`[Task:${pid}] Starting task (model=${task.model}, maxTurns=${task.maxTurns})`);
    console.log(`[Task:${pid}] Prompt: ${task.prompt.slice(0, 100)}...`);

    const db = this.getDb();
    const store = new SQLiteStore(db, projectId);

    // Build system prompt with rules
    const rules = store.getRules();
    let systemPrompt = systemPromptBase;
    if (rules.length > 0) {
      systemPrompt += `\n\nRULES (you MUST follow ALL of these):\n`;
      systemPrompt += rules.map(r => `- ${r.content}`).join("\n");
      systemPrompt += `\n\nYou must comply with ALL rules above. If a goal conflicts with a rule, the rule wins.`;
    }

    console.log(`[Task:${pid}] Creating AgentSession...`);
    const session = new AgentSession({
      cwd: projectPath,
      model: task.model,
      systemPrompt,
      maxTurns: task.maxTurns,
    });

    this.sessions.set(projectId, session);
    console.log(`[Task:${pid}] Sending prompt to session...`);
    session.send(task.prompt);

    let lastText: string | undefined;
    let totalCost = 0;

    // Timeout: 5 min for the entire task
    const TASK_TIMEOUT = 30 * 60 * 1000; // 30 min
    const timeoutPromise = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), TASK_TIMEOUT);
    });

    try {
      console.log(`[Task:${pid}] Consuming events...`);
      const eventIterator = session.events();

      while (true) {
        if (!this.loops.has(projectId)) break; // stopped

        const nextEvent = eventIterator.next();
        const result = await Promise.race([nextEvent, timeoutPromise]);

        if (result === "timeout") {
          console.log(`[Task:${pid}] TIMEOUT after ${TASK_TIMEOUT / 1000}s`);
          this.publishLogEvent(projectId, "warning", `Task timed out after ${TASK_TIMEOUT / 60000} minutes`);
          session.close();
          break;
        }

        const { value: event, done } = result as IteratorResult<any>;
        if (done) break;

        switch (event.type) {
          case "text": {
            lastText = event.text;
            const msg = store.addMessage("agent", event.text!);
            pubsub.publish(EVENTS.NEW_MESSAGE, { newMessage: { ...msg, projectId } });
            this.publishLogEvent(projectId, "info", event.text!.slice(0, 150));
            break;
          }
          case "tool_use": {
            // Store tool-use in chat
            const toolMsg = JSON.stringify({
              _type: "tool_use",
              tool: event.toolName,
              input: event.toolInput,
              summary: buildToolSummary(event.toolName!, event.toolInput || {}),
            });
            const msg = store.addMessage("agent", toolMsg);
            pubsub.publish(EVENTS.NEW_MESSAGE, { newMessage: { ...msg, projectId } });
            this.publishLogEvent(projectId, "info",
              `Using ${event.toolName}${event.toolInput?.file_path ? `: ${event.toolInput.file_path}` : ""}${event.toolInput?.command ? `: ${String(event.toolInput.command).slice(0, 60)}` : ""}`
            );
            break;
          }
          case "result": {
            totalCost += event.result?.costUsd ?? 0;
            store.addCost(event.result?.costUsd ?? 0);
            this.publishLogEvent(projectId, "info", `Task done (cost: $${totalCost.toFixed(4)})`);
            console.log(`[Task:${pid}] Result received, ending task`);
            session.close();
            this.sessions.delete(projectId);
            return { text: lastText, costUsd: totalCost };
          }
          case "error": {
            this.publishLogEvent(projectId, "error", `Agent error: ${event.error}`);
            break;
          }
        }
      }
    } catch (err: any) {
      console.log(`[Task:${pid}] Error: ${err.message}`);
      this.publishLogEvent(projectId, "error", `Session error: ${err.message}`);
    } finally {
      this.sessions.delete(projectId);
      console.log(`[Task:${pid}] Session ended (cost: $${totalCost.toFixed(4)})`);
    }

    return { text: lastText, costUsd: totalCost };
  }

  // Sleep that can be interrupted by stop()
  private sleep(ms: number, projectId: string): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      const check = setInterval(() => {
        if (!this.loops.has(projectId)) {
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 1000);
    });
  }
}
