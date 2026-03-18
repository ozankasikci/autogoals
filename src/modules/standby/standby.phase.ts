import type { Phase, PhaseResult, AgentContext } from "../../core/types.js";
import { runQuery, STANDBY_TOOLS } from "../../sdk/index.js";
import { createSpinner } from "../logging/index.js";
import * as readline from "readline";

export function buildStandbyPrompt(
  spec: import("../../core/types.js").Spec,
  goalResults: string[],
  costInfo: string[]
): string {
  return `You are a project assistant in standby mode. The project has been built according to this spec:

## Project Overview
${spec.overview}

## Goals completed
${goalResults.map((r) => `- ${r}`).join("\n")}

## Cost info
${costInfo.join("\n")}

You are now waiting for follow-up instructions. The user may:
- Ask questions about what was built
- Request changes to completed work
- Add new goals (respond with NEW_GOALS_REQUESTED to trigger a new interview)
- Say "quit" or "exit" to stop

Be helpful and concise.`;
}

export class StandbyPhase implements Phase {
  name = "standby" as const;

  async execute(context: AgentContext): Promise<PhaseResult> {
    const { config, state, projectPath } = context;
    const spec = context.spec;

    if (!spec) {
      return { next: "done" };
    }

    const goalResults = state.goals.map(
      (g) => `${g.id}: ${spec.goals.find((sg) => sg.id === g.id)?.name ?? g.id} - ${g.status}`
    );
    const costInfo = [`Total cost: $${state.totalCostUsd.toFixed(2)}`];

    const systemPrompt = buildStandbyPrompt(spec, goalResults, costInfo);
    let sessionId: string | undefined;
    const spinner = createSpinner();

    console.log(
      `\nAll goals processed. Total cost: $${state.totalCostUsd.toFixed(2)}`
    );
    console.log("Waiting for instructions... (type 'quit' to exit)\n");

    while (true) {
      const input = await this.askUser("> ");

      if (input.toLowerCase() === "quit" || input.toLowerCase() === "exit") {
        return { next: "done" };
      }

      spinner.start("Thinking...");
      const result = await runQuery(
        {
          prompt: input,
          systemPrompt: sessionId ? undefined : systemPrompt,
          allowedTools: STANDBY_TOOLS,
          cwd: projectPath,
          model: config.model,
          maxTurns: 30,
          resume: sessionId,
        },
        undefined,
        {
          onSessionId: (id) => {
            sessionId = id;
          },
        }
      );
      spinner.stop();

      const text = result?.text ?? "";

      if (text.includes("NEW_GOALS_REQUESTED")) {
        return { next: "interview" };
      }

      console.log(`\n${text}\n`);
    }
  }

  private askUser(prompt: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}
