import type { Phase, PhaseResult, AgentContext, Logger } from "@autogoals/core";
import { GoalTracker, runQuery, EXECUTION_TOOLS, createSpinner } from "@autogoals/core";
import { buildExecutionPrompt } from "./planner.js";
import { verifyGoal } from "./verifier.js";
import type { ExecutionSummary } from "./types.js";

export class ExecutionPhase implements Phase {
  name = "execution" as const;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async execute(context: AgentContext): Promise<PhaseResult> {
    const { config, projectPath } = context;
    const spec = context.spec;

    if (!spec) {
      throw new Error("No spec available for execution");
    }

    const tracker = new GoalTracker(context.store, spec.goals, config.maxRetriesPerGoal);
    const completedSummaries: string[] = [];
    const summary: ExecutionSummary = {
      completed: [],
      failed: [],
      skipped: [],
      totalCostUsd: 0,
    };
    const spinner = createSpinner();

    while (!tracker.isAllDone()) {
      const next = tracker.getNextPending();
      if (!next) {
        this.logger.log({
          type: "warning",
          message: "No actionable goals remaining (possible dependency deadlock)",
        });
        break;
      }

      const goalSpec = spec.goals.find((g) => g.id === next.id)!;

      // Check budget
      const remainingBudget = config.budget.maxTotal - tracker.totalCost();
      if (remainingBudget <= 0) {
        this.logger.log({
          type: "error",
          message: `Total budget exhausted ($${config.budget.maxTotal})`,
        });
        break;
      }

      this.logger.log({
        type: "goal_start",
        message: `Goal ${goalSpec.id}: ${goalSpec.name}`,
      });

      tracker.start(next.id);

      // Execute the goal
      spinner.start(`Working on Goal ${goalSpec.id}: ${goalSpec.name}...`);
      const executionPrompt = buildExecutionPrompt(goalSpec, completedSummaries);
      const result = await runQuery(
        {
          prompt: executionPrompt,
          allowedTools: EXECUTION_TOOLS,
          cwd: projectPath,
          model: config.model,
          maxTurns: 50,
          maxBudgetUsd: Math.min(config.budget.maxPerGoal, remainingBudget),
        },
        this.logger,
        undefined,
        spinner,
      );

      const executionCost = result?.costUsd ?? 0;

      // Verify
      tracker.startVerifying(next.id);
      spinner.start(`Verifying Goal ${goalSpec.id}...`);
      this.logger.log({ type: "info", message: "Verifying goal..." });

      const verification = await verifyGoal(goalSpec, projectPath, config.model);
      const totalGoalCost = executionCost + verification.costUsd;

      if (verification.passed) {
        tracker.complete(next.id, totalGoalCost);
        completedSummaries.push(`${goalSpec.name}: ${result?.text ?? "completed"}`);
        summary.completed.push(goalSpec.id);

        spinner.succeed(`Goal ${goalSpec.id}: ${goalSpec.name} ($${totalGoalCost.toFixed(2)})`);
        this.logger.log({
          type: "goal_complete",
          message: `Goal ${goalSpec.id}: ${goalSpec.name}`,
          costUsd: totalGoalCost,
        });
      } else {
        tracker.fail(next.id, verification.reason, totalGoalCost);
        summary.failed.push(goalSpec.id);

        if (tracker.canRetry(next.id)) {
          spinner.fail(`Goal ${goalSpec.id} failed: ${verification.reason}`);
          this.logger.log({
            type: "goal_fail",
            message: `Goal ${goalSpec.id} failed: ${verification.reason}. Retrying...`,
          });
          tracker.retry(next.id);
        } else {
          spinner.fail(`Goal ${goalSpec.id} failed: ${verification.reason}`);
          tracker.skip(next.id);
          summary.skipped.push(goalSpec.id);
          this.logger.log({
            type: "goal_skip",
            message: `Goal ${goalSpec.id}: ${goalSpec.name} (max retries exceeded)`,
          });
        }
      }

      // Check for unread messages from the user (e.g. sent via dashboard)
      const unread = context.store.getUnreadMessages();
      if (unread.length > 0) {
        this.logger.log({ type: "info", message: `Processing ${unread.length} message(s) from user...` });

        const messagesText = unread.map(m => `[${m.createdAt}] ${m.content}`).join("\n");

        const inboxPrompt = `The user sent you these messages while you were working:\n\n${messagesText}\n\nRespond briefly to acknowledge, then continue with your work. If any message requires a change in approach, note it.`;

        const inboxSpinner = createSpinner();
        inboxSpinner.start("Reading messages...");

        const inboxResult = await runQuery(
          {
            prompt: inboxPrompt,
            allowedTools: [],
            cwd: projectPath,
            model: config.model,
            maxTurns: 1,
          },
          this.logger,
        );

        inboxSpinner.stop();

        if (inboxResult?.text) {
          context.store.addMessage("agent", inboxResult.text);
          console.log(`\nAgent: ${inboxResult.text}\n`);
        }

        context.store.markMessagesRead();
      }
    }

    summary.totalCostUsd = tracker.totalCost();
    context.store.addCost(summary.totalCostUsd);

    return {
      next: "standby",
      data: summary as unknown as Record<string, unknown>,
    };
  }
}
