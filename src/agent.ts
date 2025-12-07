import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export async function runAgentSession(projectPath: string, sessionNum: number): Promise<void> {
  // Check if there's a CLAUDE.md with instructions
  const claudeMdPath = join(projectPath, 'CLAUDE.md');
  const hasClaudeMd = existsSync(claudeMdPath);
  
  // Build the prompt
  let prompt = `You are an autonomous coding agent working on a project with goals defined in goals.yaml.

CRITICAL INSTRUCTIONS - Follow these steps exactly:

1. READ goals.yaml in the current directory to see all goals and their current status
2. FIND the first goal with status "pending" or "in_progress"
3. WORK on that goal:
   - If status is "pending": Update it to "in_progress" and start planning/implementing
   - If status is "in_progress": Continue working on it
   - Implement the goal, write code, run tests, verify it works
   - CREATE ALL FILES in the current working directory (${projectPath})
   - DO NOT navigate to other directories or create files elsewhere
4. UPDATE goals.yaml:
   - When you complete a goal, change its status to "completed"
   - Use the Edit tool to update the status field in goals.yaml
   - Be explicit about marking goals as completed

GOAL STATUS LIFECYCLE:
- pending → in_progress → completed

This is session #${sessionNum}. You MUST make progress on at least one goal this session.
If you don't update goals.yaml, this session is wasted.

IMPORTANT: You are working in ${projectPath}. All files must be created here.

Start by reading goals.yaml now.`;

  if (hasClaudeMd) {
    const claudeMd = readFileSync(claudeMdPath, 'utf-8');
    prompt += `\n\nProject instructions from CLAUDE.md:\n${claudeMd}`;
  }

  // Run the agent
  const result = query({
    prompt,
    options: {
      cwd: projectPath,
      model: 'claude-opus-4-5-20251101',
      // Allow the agent to work autonomously
      settingSources: ['project', 'local'],
    }
  });

  // Stream the results (Query is an AsyncGenerator)
  for await (const message of result) {
    // Just let messages flow - the SDK handles output
    // In the future we could filter/format specific message types
  }

  console.log('\n');
}
