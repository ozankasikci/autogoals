import type { Phase, PhaseResult, AgentContext } from "../../core/types.js";
import { runQuery } from "../../sdk/index.js";
import { INTERVIEW_TOOLS } from "../../sdk/tool-config.js";
import { buildInterviewPrompt } from "./question-builder.js";
import type { InterviewResult } from "./types.js";
import * as readline from "readline";

export class InterviewPhase implements Phase {
  name = "interview" as const;

  async execute(context: AgentContext): Promise<PhaseResult> {
    const { config, projectPath } = context;

    // Scan existing files
    const existingFiles = await this.scanProject(projectPath);

    // Get initial description from user
    const description = await this.askUser(
      "What do you want to build or change? Describe it in your own words:\n> "
    );

    const systemPrompt = buildInterviewPrompt({
      existingFiles,
      userDescription: description,
    });

    const notes: string[] = [description];
    let sessionId: string | undefined;
    let interviewDone = false;

    // Multi-turn interview loop
    let currentPrompt = systemPrompt;
    let isFirstTurn = true;

    while (!interviewDone) {
      const result = await runQuery(
        {
          prompt: isFirstTurn ? "Begin the interview." : currentPrompt,
          systemPrompt: isFirstTurn ? systemPrompt : undefined,
          allowedTools: INTERVIEW_TOOLS,
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
          onAssistantText: (text) => {
            if (text.includes("INTERVIEW_COMPLETE")) {
              interviewDone = true;
              notes.push(text);
            }
          },
        }
      );

      isFirstTurn = false;

      if (interviewDone) break;

      // Get the assistant's last text (the question)
      const assistantText = result?.text ?? "";
      if (assistantText) {
        console.log(`\n${assistantText}`);
      }

      // Get user's answer
      const answer = await this.askUser("> ");
      notes.push(answer);
      currentPrompt = answer;
    }

    context.state.interviewNotes = notes;

    return {
      next: "spec",
      data: {
        notes,
        rawTranscript: notes.join("\n\n"),
      } satisfies InterviewResult as unknown as Record<string, unknown>,
    };
  }

  private async scanProject(projectPath: string): Promise<string[]> {
    const { readdirSync, statSync } = await import("fs");
    const { join, relative } = await import("path");

    const files: string[] = [];
    const scan = (dir: string, depth: number) => {
      if (depth > 3) return;
      try {
        for (const entry of readdirSync(dir)) {
          if (entry.startsWith(".") || entry === "node_modules") continue;
          const full = join(dir, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            scan(full, depth + 1);
          } else {
            files.push(relative(projectPath, full));
          }
        }
      } catch {
        // ignore permission errors
      }
    };
    scan(projectPath, 0);
    return files;
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
