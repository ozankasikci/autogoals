import { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { createStore } from "../modules/state/index.js";
import { createLogger, formatForTerminal } from "../modules/logging/index.js";
import type { Logger } from "../modules/logging/index.js";
import { Agent } from "../core/agent.js";
import { InterviewPhase } from "../modules/interview/index.js";
import { SpecPhase } from "../modules/spec/index.js";
import { ExecutionPhase } from "../modules/execution/index.js";
import { StandbyPhase } from "../modules/standby/index.js";
import { printBanner } from "./output.js";
import { resolve } from "path";
import { mkdirSync } from "fs";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("small-singularity")
    .description("Autonomous project agent")
    .version("0.1.0");

  program
    .command("start")
    .description("Start the agent on a project directory")
    .argument("<project-path>", "Path to the project directory")
    .option("-m, --model <model>", "Claude model to use", "sonnet")
    .option("--budget <amount>", "Max total budget in USD", "20")
    .option("--budget-per-goal <amount>", "Max budget per goal in USD", "2")
    .option("-v, --verbose", "Verbose logging", false)
    .action(async (projectPath: string, opts) => {
      const resolvedPath = resolve(projectPath);
      mkdirSync(resolvedPath, { recursive: true });

      console.log(printBanner());

      const config = loadConfig({
        projectPath: resolvedPath,
        model: opts.model,
        budget: {
          maxTotal: parseFloat(opts.budget),
          maxPerGoal: parseFloat(opts.budgetPerGoal),
        },
        verbose: opts.verbose,
      });

      const store = createStore(resolvedPath);

      const logger: Logger = createLogger({
        sink: (event) => {
          console.log(formatForTerminal(event));
        },
      });

      const agent = new Agent({
        interview: new InterviewPhase(),
        spec: new SpecPhase(),
        execution: new ExecutionPhase(logger),
        standby: new StandbyPhase(),
      });

      await agent.run(
        {
          config,
          store,
          projectPath: resolvedPath,
          spec: store.getSpec(),
        },
        logger
      );

      store.close();
      console.log("\nAgent stopped. State saved.");
    });

  program
    .command("status")
    .description("Show current project status")
    .argument("<project-path>", "Path to the project directory")
    .action((projectPath: string) => {
      const resolvedPath = resolve(projectPath);
      let store;
      try {
        store = createStore(resolvedPath);
      } catch {
        console.log("No state found. Run 'start' first.");
        return;
      }

      const phase = store.getPhase();
      const totalCost = store.getTotalCost();
      const goals = store.getGoals();

      console.log(`Phase: ${phase}`);
      console.log(`Total cost: $${totalCost.toFixed(2)}`);
      console.log(`Goals: ${goals.length}`);
      for (const goal of goals) {
        console.log(`  ${goal.id}: ${goal.status} ($${goal.costUsd.toFixed(2)})`);
      }

      store.close();
    });

  return program;
}
