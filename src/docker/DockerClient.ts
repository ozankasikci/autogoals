import { exec } from 'child_process';
import { promisify } from 'util';
import type { ContainerConfig, ContainerInfo, ExecResult } from './types.js';

const execAsync = promisify(exec);

export class DockerClient {
  /**
   * Check if Docker daemon is running
   */
  async isDockerRunning(): Promise<boolean> {
    try {
      await execAsync('docker info');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create and start a new container
   */
  async createContainer(config: ContainerConfig): Promise<string> {
    const labels = Object.entries(config.labels || {})
      .map(([k, v]) => `--label ${k}="${v}"`)
      .join(' ');

    const envVars = Object.entries(config.env)
      .map(([k, v]) => `-e ${k}="${v}"`)
      .join(' ');

    const cmd = `docker run -d \
      --name ${config.name} \
      ${labels} \
      -v ${config.workspacePath}:/workspace \
      -w /workspace \
      ${envVars} \
      ${config.image}`;

    const { stdout } = await execAsync(cmd);
    return stdout.trim(); // Container ID
  }

  /**
   * Start a stopped container
   */
  async startContainer(nameOrId: string): Promise<void> {
    await execAsync(`docker start ${nameOrId}`);
  }

  /**
   * Stop a running container
   */
  async stopContainer(nameOrId: string): Promise<void> {
    await execAsync(`docker stop ${nameOrId}`);
  }

  /**
   * Remove a container
   */
  async removeContainer(nameOrId: string, force: boolean = false): Promise<void> {
    const forceFlag = force ? '-f' : '';
    await execAsync(`docker rm ${forceFlag} ${nameOrId}`);
  }

  /**
   * Get container info
   */
  async getContainer(nameOrId: string): Promise<ContainerInfo | null> {
    try {
      const { stdout } = await execAsync(
        `docker inspect --format '{{json .}}' ${nameOrId}`
      );
      const data = JSON.parse(stdout);

      return {
        id: data.Id,
        name: data.Name.replace(/^\//, ''),
        state: data.State.Status,
        createdAt: new Date(data.Created),
      };
    } catch {
      return null;
    }
  }

  /**
   * List containers by label
   */
  async listContainers(label?: string): Promise<ContainerInfo[]> {
    const labelFilter = label ? `--filter label=${label}` : '';
    const { stdout } = await execAsync(
      `docker ps -a ${labelFilter} --format '{{json .}}'`
    );

    if (!stdout.trim()) return [];

    return stdout
      .trim()
      .split('\n')
      .map(line => {
        const data = JSON.parse(line);
        return {
          id: data.ID,
          name: data.Names,
          state: data.State as ContainerInfo['state'],
          createdAt: new Date(data.CreatedAt),
        };
      });
  }

  /**
   * Execute command in container
   */
  async exec(
    nameOrId: string,
    command: string,
    options: { env?: Record<string, string> } = {}
  ): Promise<ExecResult> {
    const envVars = Object.entries(options.env || {})
      .map(([k, v]) => `-e ${k}="${v}"`)
      .join(' ');

    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${envVars} ${nameOrId} ${command}`
      );
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1,
      };
    }
  }
}
