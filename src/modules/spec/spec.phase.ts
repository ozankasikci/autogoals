import type { Phase, PhaseResult, AgentContext, Spec } from "../../core/types.js";
import { runQuery, SPEC_TOOLS } from "../../sdk/index.js";
import { parseSpec } from "./spec-parser.js";
import { createSpinner } from "../logging/index.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import * as readline from "readline";

export class SpecPhase implements Phase {
  name = "spec" as const;

  async execute(context: AgentContext): Promise<PhaseResult> {
    const { config, projectPath } = context;
    const notes = context.store.getInterviewNotes().join("\n\n");

    const systemPrompt = `You are an expert project architect. Based on the interview notes below, write a complete project specification.

OUTPUT FORMAT — you MUST output ONLY a markdown document in this exact format:

# Project Spec

## Overview
[1-3 sentences describing the project]

## Goals
### Goal 1: [name]
[description]
**Acceptance Criteria:**
- [criterion 1]
- [criterion 2]
**Depends on:** [comma-separated goal IDs, or omit if none]

### Goal 2: [name]
...

## Technical Decisions
- [decision 1]
- [decision 2]

INTERVIEW NOTES:
${notes}

Rules:
- Number goals sequentially starting from 1
- Each goal must have concrete, testable acceptance criteria
- Order goals by dependency (earlier goals first)
- Be specific — no vague goals like "make it work"
- Keep it concise — only what was discussed in the interview`;

    let approved = false;
    let spec: Spec | null = null;
    let specMarkdown = "";
    let sessionId: string | undefined;
    let nextPrompt = "Write the project specification now.";
    const spinner = createSpinner();
    let isFirstPass = true;

    while (!approved) {
      spinner.start(isFirstPass ? "Writing spec..." : "Revising spec...");
      isFirstPass = false;

      const result = await runQuery(
        {
          prompt: nextPrompt,
          systemPrompt: sessionId ? undefined : systemPrompt,
          allowedTools: SPEC_TOOLS,
          cwd: projectPath,
          model: config.model,
          maxTurns: 10,
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
      specMarkdown = result?.text ?? "";
      console.log("\n" + specMarkdown);

      try {
        spec = parseSpec(specMarkdown);
      } catch {
        console.log("\nFailed to parse spec. Asking agent to reformat...");
        nextPrompt = "The spec could not be parsed. Please reformat it using the exact markdown format specified.";
        continue;
      }

      const answer = await this.askUser(
        "\nApprove this spec? (y/n/your feedback)\n> "
      );

      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        approved = true;
      } else {
        nextPrompt = `The user gave this feedback on the spec:\n\n${answer}\n\nPlease revise the spec accordingly. Output the full revised spec in the same format.`;
      }
    }

    // Save spec to disk
    const specsDir = join(projectPath, "specs");
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(join(specsDir, "project-spec.md"), specMarkdown, "utf-8");

    context.spec = spec;
    context.store.saveSpec(spec!);
    if (sessionId) {
      context.store.saveSession("spec", sessionId);
    }

    return {
      next: "execution",
      data: { spec, specPath: join(specsDir, "project-spec.md") },
    };
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
