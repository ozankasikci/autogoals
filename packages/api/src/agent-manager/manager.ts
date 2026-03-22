import { AgentSession, SQLiteStore, SQLiteProjectStore, type AgentEvent } from "@small-singularity/core";
import type Database from "better-sqlite3";
import { basename, join } from "path";
import { writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
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
  private wakeResolvers = new Map<string, () => void>(); // projectId → wake callback
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
    // Wake from sleep so the loop exits immediately
    const wakeResolver = this.wakeResolvers.get(projectId);
    if (wakeResolver) {
      wakeResolver();
      this.wakeResolvers.delete(projectId);
    }
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

  // Wake a sleeping agent so it immediately checks for work
  wake(projectId: string): void {
    const resolver = this.wakeResolvers.get(projectId);
    if (resolver) {
      resolver();
      this.wakeResolvers.delete(projectId);
    }
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

        // --- Phase B1: Refine draft goals ---
        // YOLO mode: auto-refine via agent task
        // Interview mode: skip — user is driving refinement through chat
        const goals = store.getGoals();
        const draftGoal = goals.find(g => g.status === "draft");
        if (draftGoal) {
          const draftRow = db.prepare(
            "SELECT id, name, description, planning_mode FROM goals WHERE project_id = ? AND id = ?"
          ).get(projectId, draftGoal.id) as any;

          if (!draftRow?.planning_mode) {
            // No mode selected yet — wait for user to click Interview or Auto-Plan
            await this.sleep(POST_WORK_COOLDOWN, projectId);
            continue;
          }

          if (draftRow.planning_mode === "interview") {
            // Interview mode — the resolver already sent the interview prompt to chat.
            // The agent will ask questions and the user will reply.
            // When the agent outputs the JSON block, we parse it from chat messages.
            // Check if the interview has completed (look for JSON in recent agent messages)
            const recentMessages = store.getMessages(10);
            const agentMessages = recentMessages.filter(m => m.role === "agent");
            let parsed: { approach?: string; criteria?: string[]; decisions?: string[] } | null = null;

            for (const msg of agentMessages) {
              const jsonMatch = msg.content.match(/```json\s*([\s\S]*?)\s*```/);
              if (jsonMatch) {
                try {
                  const candidate = JSON.parse(jsonMatch[1]);
                  if (candidate.criteria && candidate.approach) {
                    parsed = candidate;
                    break;
                  }
                } catch {}
              }
            }

            if (parsed) {
              // Interview complete — apply the results
              store.updateGoal(draftGoal.id, {
                acceptanceCriteria: parsed.criteria!,
                approach: parsed.approach!,
                status: "refined",
              });
              store.setPhase("spec");
              this.publishLogEvent(projectId, "info", `Goal '${draftRow.name}' refined via interview with ${parsed.criteria!.length} criteria → refined`);
              pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });
            }
            // If not complete yet, just skip — the user is still chatting with the agent
            await this.sleep(POST_WORK_COOLDOWN, projectId);
            continue;
          }

          // YOLO mode: auto-refine
          if (draftRow) {
            store.setPhase("interview");
            this.publishLogEvent(projectId, "info", `Auto-refining goal: ${draftRow.name}`);
            pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });

            const refinePrompt = `A goal needs to be refined before implementation.\n\nGOAL: ${draftRow.name}\nDESCRIPTION: ${draftRow.description || "none"}\n\nAnalyze the codebase and generate:\n1. A clear technical approach (2-3 sentences)\n2. Specific, testable acceptance criteria (3-7 items)\n\nRespond with EXACTLY this JSON format:\n\`\`\`json\n{\n  "approach": "your technical approach here",\n  "criteria": ["criterion 1", "criterion 2", "criterion 3"]\n}\n\`\`\``;

            const result = await this.runTask(projectId, projectPath, systemPromptBase, {
              prompt: refinePrompt,
              model: "opus",
              maxTurns: 15,
            });

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
                  this.publishLogEvent(projectId, "info", `Goal '${draftRow.name}' auto-refined with ${parsed.criteria.length} criteria → pending`);
                  pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });
                }
              } catch {
                store.updateGoal(draftGoal.id, { status: "pending" });
                this.publishLogEvent(projectId, "warning", `Could not parse refinement for '${draftRow.name}', promoting to pending`);
              }
            } else {
              store.updateGoal(draftGoal.id, { status: "pending" });
              this.publishLogEvent(projectId, "warning", `No structured refinement for '${draftRow.name}', promoting to pending`);
            }
          }
          await this.sleep(POST_WORK_COOLDOWN, projectId);
          continue;
        }

        // --- Phase B2: Work on actionable goals ---
        // Priority: non-recurring first, then recurring (round-robin)
        const actionableStatuses = new Set(["pending", "ready", "regressed", "active"]);
        const nonRecurring = goals.find(g => actionableStatuses.has(g.status) && !g.recurring);
        const recurringGoals = goals.filter(g => actionableStatuses.has(g.status) && g.recurring);

        // For recurring goals, rotate using lastExecuted tracking
        let nextRecurring: typeof goals[0] | undefined;
        if (recurringGoals.length > 0) {
          // Find the one that was least recently executed
          const lastExecKey = (id: string) => `lastExec:${id}`;
          nextRecurring = recurringGoals.reduce((oldest, g) => {
            const oldestTime = this.lastVerified.get(lastExecKey(oldest.id)) ?? 0;
            const gTime = this.lastVerified.get(lastExecKey(g.id)) ?? 0;
            return gTime < oldestTime ? g : oldest;
          });
        }

        // Non-recurring goals take priority over recurring ones
        const actionable = nonRecurring ?? nextRecurring;
        if (actionable) {
          store.setPhase("execution");
          const goalRow = db.prepare(
            "SELECT id, name, description, approach, acceptance_criteria, depends_on, recurring FROM goals WHERE project_id = ? AND id = ?"
          ).get(projectId, actionable.id) as any;

          if (goalRow) {
            const criteria = JSON.parse(goalRow.acceptance_criteria || "[]");
            store.updateGoal(actionable.id, { status: "active" });
            this.activeGoals.set(projectId, actionable.id);

            this.publishLogEvent(projectId, "info", `Goal '${goalRow.name}' \u2192 active`);
            pubsub.publish(EVENTS.PROJECT_UPDATED, { projectUpdated: { id: projectId } });

            // Build rich context for the fresh agent session
            const goalPrompt = this.buildGoalPrompt(db, projectId, actionable.id, goalRow, store);

            const result = await this.runTask(projectId, projectPath, systemPromptBase, {
              prompt: goalPrompt,
              model: "opus",
              maxTurns: 100,
            });

            // Track cost against this goal
            if (result?.costUsd) {
              const currentCost = (db.prepare("SELECT cost_usd FROM goals WHERE project_id = ? AND id = ?")
                .get(projectId, actionable.id) as any)?.cost_usd ?? 0;
              db.prepare("UPDATE goals SET cost_usd = ? WHERE project_id = ? AND id = ?")
                .run(currentCost + result.costUsd, projectId, actionable.id);
            }

            // After goal execution completes:
            if (goalRow.recurring) {
              store.updateGoal(actionable.id, { status: "pending" });
              this.activeGoals.delete(projectId);
              this.lastVerified.set(`lastExec:${actionable.id}`, Date.now());
              this.publishLogEvent(projectId, "info", `Recurring goal '${goalRow.name}' \u2192 pending (will re-execute after other goals)`);
            } else {
              store.updateGoal(actionable.id, { status: "done" });
              this.activeGoals.delete(projectId);
              this.publishLogEvent(projectId, "info", `Goal '${goalRow.name}' \u2192 done`);
            }
            // Git checkpoint: auto-commit after goal completion
            try {
              // Check if git repo exists, init if not
              try {
                execSync("git rev-parse --git-dir", { cwd: projectPath, encoding: "utf-8" });
              } catch {
                execSync("git init", { cwd: projectPath });
                this.publishLogEvent(projectId, "info", "Initialized git repository");
              }
              const hasChanges = execSync("git status --porcelain", { cwd: projectPath, encoding: "utf-8" }).trim();
              if (hasChanges) {
                execSync("git add -A", { cwd: projectPath });

                // Get diff stats AFTER staging
                let diffStats = "";
                try {
                  diffStats = execSync("git diff --cached --stat", { cwd: projectPath, encoding: "utf-8" }).trim();
                } catch {}

                // Parse diff stat lines: " file.js | 15 ++---" → per-file changes
                const statLines = diffStats.split("\n").filter(l => l.includes("|"));
                const fileSummaries = statLines.map(l => {
                  const parts = l.trim().split("|");
                  const file = parts[0]?.trim() ?? "";
                  const changes = parts[1]?.trim() ?? "";
                  return `${file} (${changes})`;
                }).slice(0, 10); // max 10 files shown

                // Get total summary line: "3 files changed, 45 insertions(+), 12 deletions(-)"
                const totalLine = diffStats.split("\n").pop()?.trim() ?? "";

                // Commit
                const commitTitle = `[checkpoint] ${goalRow.name.slice(0, 72)}`;
                const msgFile = join(projectPath, ".ss-commit-msg");
                writeFileSync(msgFile, commitTitle + "\n\n" + diffStats);
                execSync(`git commit -F "${msgFile}"`, { cwd: projectPath });
                unlinkSync(msgFile);

                const commitHash = execSync("git rev-parse --short HEAD", { cwd: projectPath, encoding: "utf-8" }).trim();

                // Get a one-line diff summary for AI description
                let aiSummary = "";
                try {
                  const diffContent = execSync("git diff HEAD~1 --stat", { cwd: projectPath, encoding: "utf-8" }).trim();
                  // Generate a brief AI summary using haiku (cheap + fast)
                  const summaryResult = await this.runTask(projectId, projectPath, "", {
                    prompt: `Summarize this git diff in ONE short sentence (max 15 words). Be specific about what changed, not vague.\n\nGoal: ${goalRow.name}\n\nDiff stats:\n${diffContent}\n\nRespond with ONLY the summary sentence, nothing else.`,
                    model: "haiku",
                    maxTurns: 1,
                  });
                  aiSummary = summaryResult?.text?.trim().replace(/^["']|["']$/g, "") ?? "";
                } catch {
                  aiSummary = goalRow.approach?.slice(0, 100) ?? goalRow.name;
                }

                const dateStr = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
                const slug = goalRow.name.slice(0, 40).replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase().replace(/-+/g, "-").replace(/-$/, "");
                const tagName = `checkpoint/${dateStr}-${slug}`;
                execSync(`git tag "${tagName}"`, { cwd: projectPath });

                // Store: goalName = AI summary, message = file changes
                const fileChangesText = fileSummaries.join("\n") + (totalLine ? `\n${totalLine}` : "");
                store.addCheckpoint(actionable.id, aiSummary || goalRow.name, commitHash, tagName, fileChangesText);
                this.publishLogEvent(projectId, "info", `Checkpoint: ${commitHash} — ${aiSummary || totalLine}`);
              }
            } catch (err: any) {
              this.publishLogEvent(projectId, "warning", `Git commit failed: ${err.message?.slice(0, 100)}`);
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
        const pStore = new SQLiteProjectStore(db);
        const allRules = [...pStore.getGlobalRules(), ...store.getRules()];
        if (allRules.length > 0 && (now - lastRulesCheck) > VERIFY_COOLDOWN) {
          this.lastVerified.set(rulesKey, Date.now());
          const rulesText = allRules.map(r => `- ${r.content}`).join("\n");
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

  // Build a rich prompt for goal execution with full project context
  private buildGoalPrompt(
    db: Database.Database,
    projectId: string,
    goalId: string,
    goalRow: any,
    store: InstanceType<typeof SQLiteStore>,
  ): string {
    const criteria = JSON.parse(goalRow.acceptance_criteria || "[]");
    const uncheckedCriteria = criteria.filter((c: string) => !c.startsWith("[x] "));
    const checkedCriteria = criteria.filter((c: string) => c.startsWith("[x] "));

    // 1. Project context: what goals are already done (so the fresh agent knows the codebase state)
    const allGoalRows = db.prepare(
      "SELECT id, name, status FROM goals WHERE project_id = ?"
    ).all(projectId) as { id: string; name: string; status: string }[];
    const completedGoals = allGoalRows.filter(g => g.status === "done" || g.status === "achieved");
    const otherActiveGoals = allGoalRows.filter(g => g.id !== goalId && (g.status === "pending" || g.status === "ready"));

    let projectContext = "";
    if (completedGoals.length > 0) {
      projectContext += `\n\nPROJECT CONTEXT — Already completed goals (the codebase already has these):\n`;
      projectContext += completedGoals.map(g => `- ✓ ${g.name}`).join("\n");
    }
    if (otherActiveGoals.length > 0) {
      projectContext += `\n\nUPCOMING GOALS (don't implement these, but be aware they exist):\n`;
      projectContext += otherActiveGoals.map(g => `- ${g.name}`).join("\n");
    }

    // 2. Retry history: what failed before so the agent doesn't repeat mistakes
    const retries = (db.prepare("SELECT retries, error FROM goals WHERE project_id = ? AND id = ?")
      .get(projectId, goalId) as any);
    let retryContext = "";
    if (retries?.retries > 0 && retries?.error) {
      retryContext += `\n\nPREVIOUS ATTEMPT FAILED (retry #${retries.retries}):\n`;
      retryContext += `Error: ${retries.error}\n`;
      retryContext += `IMPORTANT: Do NOT repeat the same approach that failed. Try a different strategy.`;
    }

    // 3. Screenshots
    const screenshots = store.getGoalScreenshots(goalId);
    let screenshotInfo = "";
    if (screenshots.length > 0) {
      screenshotInfo = `\n\nSCREENSHOTS (${screenshots.length} attached — read these files to see what the user wants):\n`;
      screenshotInfo += screenshots.map(s => `- ${s.filePath}`).join("\n");
      screenshotInfo += `\n\nIMPORTANT: Read the screenshot files using the Read tool to understand the visual context.`;
    }

    // 4. Dependencies: what this goal depends on
    const dependsOn = JSON.parse(goalRow.depends_on || "[]") as string[];
    let depContext = "";
    if (dependsOn.length > 0) {
      const depGoals = dependsOn
        .map(id => allGoalRows.find(g => g.id === id))
        .filter((g): g is NonNullable<typeof g> => g != null);
      if (depGoals.length > 0) {
        depContext += `\n\nDEPENDENCIES (this goal builds on top of these):\n`;
        depContext += depGoals.map(g => `- ${g.name} (${g.status})`).join("\n");
      }
    }

    // Assemble the prompt
    return [
      `Implement this goal:`,
      ``,
      `GOAL: ${goalRow.name}`,
      `DESCRIPTION: ${goalRow.description || "none"}`,
      `APPROACH: ${goalRow.approach || "none"}`,
      ``,
      `OUTSTANDING CRITERIA (work on these):`,
      uncheckedCriteria.length > 0
        ? uncheckedCriteria.map((c: string) => `- ${c.replace(/^\[ \] /, "")}`).join("\n")
        : "- none specified",
      ...(checkedCriteria.length > 0 ? [
        ``,
        `ALREADY DONE (skip these):`,
        checkedCriteria.map((c: string) => `- ✓ ${c.replace(/^\[x\] /, "")}`).join("\n"),
      ] : []),
      projectContext,
      depContext,
      retryContext,
      screenshotInfo,
      ``,
      `Implement the outstanding criteria. Skip the ones already done.`,
    ].filter(Boolean).join("\n");
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

    // Build system prompt with rules (global + project)
    const projectStore = new SQLiteProjectStore(db);
    const globalRules = projectStore.getGlobalRules();
    const projectRules = store.getRules();
    let systemPrompt = systemPromptBase;
    if (globalRules.length > 0 || projectRules.length > 0) {
      systemPrompt += `\n\nRULES (you MUST follow ALL of these):\n`;
      if (globalRules.length > 0) {
        systemPrompt += globalRules.map(r => `- ${r.content}`).join("\n");
      }
      if (projectRules.length > 0) {
        if (globalRules.length > 0) systemPrompt += "\n";
        systemPrompt += projectRules.map(r => `- ${r.content}`).join("\n");
      }
      systemPrompt += `\n\nYou must comply with ALL rules above. If a goal conflicts with a rule, the rule wins.`;
    }

    // Append environment variables so the agent knows about them
    const envVars = store.getEnvVars();
    if (envVars.length > 0) {
      systemPrompt += `\n\nEnvironment variables for this project:\n`;
      systemPrompt += envVars.map(v => `${v.key}=${v.value}`).join("\n");
      systemPrompt += `\n\nUse these values when configuring or running services.`;
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

  // Sleep that can be interrupted by stop() or wake()
  private sleep(ms: number, projectId: string): Promise<void> {
    return new Promise(resolve => {
      const cleanup = () => {
        clearTimeout(timer);
        this.wakeResolvers.delete(projectId);
        resolve();
      };
      const timer = setTimeout(cleanup, ms);
      // Register wake callback so wake() can interrupt
      this.wakeResolvers.set(projectId, cleanup);
    });
  }
}
