import { query } from '@anthropic-ai/claude-agent-sdk';
import { SessionManager } from './SessionManager.js';

export async function runAgent(
  sessionManager: SessionManager,
  agentId: number,
  projectPath: string,
  goalId: string,
  goalDescription: string
): Promise<void> {
  const prompt = `You are an autonomous coding agent working on a project with goals defined in goals.yaml.

CRITICAL INSTRUCTIONS - Follow these steps exactly:

1. READ goals.yaml to see all goals and their current status
2. FIND the goal with id "${goalId}"
3. WORK on that goal:
   - Update status to "in_progress" in goals.yaml
   - Implement the goal, write code, run tests, verify it works
4. UPDATE goals.yaml:
   - When complete, change status to "completed"
   - Use the Edit tool to update the status field

Goal to work on: ${goalDescription}

Start by reading goals.yaml now.`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: projectPath,
        model: 'claude-sonnet-4-5-20250929',
        settingSources: ['project', 'local'],
      },
    });

    // Stream output to SessionManager
    for await (const message of result) {
      const output = JSON.stringify(message);
      sessionManager.appendLog(agentId, output);
    }

    sessionManager.updateStatus(agentId, 'completed', 0);
  } catch (error) {
    sessionManager.appendLog(agentId, `Error: ${error}`);
    sessionManager.updateStatus(agentId, 'failed', 1);
  }
}
