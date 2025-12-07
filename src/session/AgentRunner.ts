import { SessionManager } from './SessionManager.js';
import { ContainerManager } from '../docker/ContainerManager.js';
import { EnvLoader } from '../docker/EnvLoader.js';

export async function runAgent(
  sessionManager: SessionManager,
  agentId: number,
  projectPath: string,
  goalId: string,
  goalDescription: string
): Promise<void> {
  const prompt = `You are an autonomous coding agent working on a project with goals defined in goals.yaml.

CRITICAL INSTRUCTIONS - Follow these steps exactly:

1. READ goals.yaml in the current directory to see all goals and their current status
2. FIND the goal with id "${goalId}"
3. WORK on that goal:
   - Update status to "in_progress" in goals.yaml
   - Implement the goal, write code, run tests, verify it works
   - CREATE ALL FILES in the current working directory (${projectPath})
   - DO NOT navigate to other directories or create files elsewhere
4. UPDATE goals.yaml:
   - When complete, change status to "completed"
   - Use the Edit tool to update the status field

Goal to work on: ${goalDescription}

IMPORTANT: You are working in ${projectPath}. All files must be created here.

Start by reading goals.yaml now.`;

  try {
    // Load environment variables
    const env = EnvLoader.loadEnvironment(projectPath);

    // Get or create container
    const containerManager = new ContainerManager();
    const containerName = await containerManager.getOrCreateContainer(projectPath, env);

    sessionManager.appendLog(agentId, `Using container: ${containerName}`);

    // Execute Claude Code inside container using docker exec
    const dockerClient = new (await import('../docker/DockerClient.js')).DockerClient();

    // Escape prompt for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    // Build claude CLI command
    const claudeCommand = `claude query --model claude-opus-4-5-20251101 '${escapedPrompt}'`;

    sessionManager.appendLog(agentId, 'Starting Claude agent in container...');

    // Execute in container
    const execResult = await dockerClient.exec(containerName, claudeCommand, { env });

    // Log output
    if (execResult.stdout) {
      sessionManager.appendLog(agentId, execResult.stdout);
    }
    if (execResult.stderr) {
      sessionManager.appendLog(agentId, `[stderr] ${execResult.stderr}`);
    }

    if (execResult.exitCode === 0) {
      sessionManager.updateStatus(agentId, 'completed', 0);
    } else {
      sessionManager.updateStatus(agentId, 'failed', execResult.exitCode);
    }
  } catch (error) {
    sessionManager.appendLog(agentId, `Error: ${error}`);
    sessionManager.updateStatus(agentId, 'failed', 1);
  }
}
