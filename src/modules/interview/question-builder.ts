export interface InterviewPromptInput {
  existingFiles: string[];
  userDescription: string;
}

export function buildInterviewPrompt(input: InterviewPromptInput): string {
  const fileContext =
    input.existingFiles.length > 0
      ? `The project already contains these files:\n${input.existingFiles.map((f) => `- ${f}`).join("\n")}\n\nScan these files to understand the current state before asking questions.`
      : "This is a new/empty project.";

  return `You are an expert project planner conducting an interview to gather requirements.

The user wants: ${input.userDescription}

${fileContext}

Your job:
- Ask one question at a time to fully understand what needs to be built
- Prefer multiple-choice questions when possible
- Cover: scope, constraints, tech preferences, success criteria, edge cases
- When you feel you have enough information, respond with exactly: "INTERVIEW_COMPLETE"
- Include a summary of all gathered requirements when you say INTERVIEW_COMPLETE

Do NOT write any code. Do NOT start building. Only gather information.
Ask your first question now.`;
}
