import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { SessionManager } from './SessionManager.js';

/**
 * Format SDK messages into human-readable text
 */
function formatMessage(message: SDKMessage): string {
  switch (message.type) {
    case 'assistant': {
      // Extract text content from assistant messages
      const content = message.message.content;
      const textParts: string[] = [];

      for (const block of content) {
        if (block.type === 'text') {
          textParts.push(block.text);
        } else if (block.type === 'tool_use') {
          textParts.push(`[Using tool: ${block.name}]`);
        }
      }

      return textParts.length > 0 ? textParts.join('\n') : '[Assistant response]';
    }

    case 'user': {
      // For synthetic user messages (tool results), show brief status
      if (message.isSynthetic) {
        return '[Tool result received]';
      }
      return '[User message]';
    }

    case 'result': {
      if (message.subtype === 'success') {
        return `Completed in ${(message.duration_ms / 1000).toFixed(1)}s - ${message.num_turns} turns - $${message.total_cost_usd.toFixed(4)}`;
      } else {
        const errorMsg = 'errors' in message && message.errors.length > 0
          ? message.errors.join(', ')
          : message.subtype;
        return `Failed: ${errorMsg}`;
      }
    }

    case 'system': {
      if (message.subtype === 'init') {
        return `Session initialized - Model: ${message.model}`;
      } else if (message.subtype === 'status') {
        return message.status ? `Status: ${message.status}` : '';
      } else if (message.subtype === 'compact_boundary') {
        return `[Context compacted - ${message.compact_metadata.trigger}]`;
      } else if (message.subtype === 'hook_response') {
        return message.stdout || message.stderr || `[Hook: ${message.hook_name}]`;
      }
      return '[System message]';
    }

    case 'tool_progress': {
      return `[${message.tool_name}: ${message.elapsed_time_seconds}s]`;
    }

    case 'auth_status': {
      if (message.error) {
        return `Auth error: ${message.error}`;
      }
      return message.output.join('\n') || '[Authenticating...]';
    }

    case 'stream_event': {
      // Skip partial streaming events for cleaner output
      return '';
    }

    default:
      return '';
  }
}

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
      const output = formatMessage(message);
      if (output) {
        sessionManager.appendLog(agentId, output);
      }
    }

    sessionManager.updateStatus(agentId, 'completed', 0);
  } catch (error) {
    sessionManager.appendLog(agentId, `Error: ${error}`);
    sessionManager.updateStatus(agentId, 'failed', 1);
  }
}
