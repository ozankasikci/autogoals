import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export async function runAgentSession(projectPath: string, sessionNum: number): Promise<void> {
  // Check if there's a CLAUDE.md with instructions
  const claudeMdPath = join(projectPath, 'CLAUDE.md');
  const hasClaudeMd = existsSync(claudeMdPath);
  
  // Build the prompt
  let prompt = `You are working on a project with goals defined in goals.yaml.

Your task is to:
1. Read and understand the goals.yaml file
2. Work on any pending or in-progress goals
3. Update the goals.yaml file as you complete goals
4. Follow the AutoGoals goal lifecycle (pending → ready_for_execution → in_progress → ready_for_verification → completed)

This is session #${sessionNum}. Focus on making meaningful progress.`;

  if (hasClaudeMd) {
    const claudeMd = readFileSync(claudeMdPath, 'utf-8');
    prompt += `\n\nProject instructions from CLAUDE.md:\n${claudeMd}`;
  }

  // Run the agent
  const result = query({
    prompt,
    options: {
      cwd: projectPath,
      model: 'claude-sonnet-4-5-20250929',
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
