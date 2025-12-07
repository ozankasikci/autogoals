import { createHash } from 'crypto';
import { basename, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DockerClient } from './DockerClient.js';
import type { ContainerConfig, ContainerState } from './types.js';

export class ContainerManager {
  private docker: DockerClient;
  private baseImage: string = 'autogoals/devbox:latest';

  constructor() {
    this.docker = new DockerClient();
  }

  /**
   * Generate unique container name from workspace path
   */
  private generateContainerName(workspacePath: string): string {
    const absPath = resolve(workspacePath);
    const dirName = basename(absPath);
    const hash = createHash('sha256')
      .update(absPath)
      .digest('hex')
      .substring(0, 8);

    return `autogoals-${dirName}-${hash}`;
  }

  /**
   * Load container state from .autogoals/container.json
   */
  private loadContainerState(workspacePath: string): ContainerState | null {
    const stateFile = join(workspacePath, '.autogoals', 'container.json');

    if (!existsSync(stateFile)) {
      return null;
    }

    try {
      const content = readFileSync(stateFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Save container state to .autogoals/container.json
   */
  private saveContainerState(workspacePath: string, state: ContainerState): void {
    const autogoalsDir = join(workspacePath, '.autogoals');

    if (!existsSync(autogoalsDir)) {
      mkdirSync(autogoalsDir, { recursive: true });
    }

    const stateFile = join(autogoalsDir, 'container.json');
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  }

  /**
   * Get or create container for workspace
   */
  async getOrCreateContainer(
    workspacePath: string,
    env: Record<string, string> = {}
  ): Promise<string> {
    // Check if Docker is running
    const dockerRunning = await this.docker.isDockerRunning();
    if (!dockerRunning) {
      throw new Error(
        'Docker daemon not found. Please start Docker Desktop or install Docker Engine.'
      );
    }

    const containerName = this.generateContainerName(workspacePath);
    const absPath = resolve(workspacePath);

    // Check if container exists
    let container = await this.docker.getContainer(containerName);

    if (container) {
      // Container exists - start if stopped
      if (container.state === 'stopped') {
        await this.docker.startContainer(containerName);
      }

      // Update last used
      const state = this.loadContainerState(workspacePath);
      if (state) {
        state.lastUsed = new Date().toISOString();
        this.saveContainerState(workspacePath, state);
      }

      return containerName;
    }

    // Create new container
    const config: ContainerConfig = {
      name: containerName,
      image: this.baseImage,
      workspacePath: absPath,
      env,
      labels: {
        'autogoals.workspace': absPath,
        'autogoals.created': new Date().toISOString(),
      },
    };

    const containerId = await this.docker.createContainer(config);

    // Save state
    const state: ContainerState = {
      containerId,
      containerName,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };
    this.saveContainerState(workspacePath, state);

    return containerName;
  }

  /**
   * Execute command in workspace container
   */
  async executeInContainer(
    workspacePath: string,
    command: string,
    env: Record<string, string> = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const containerName = await this.getOrCreateContainer(workspacePath, env);
    return this.docker.exec(containerName, command, { env });
  }

  /**
   * Stop workspace container
   */
  async stopContainer(workspacePath: string): Promise<void> {
    const containerName = this.generateContainerName(workspacePath);
    const container = await this.docker.getContainer(containerName);

    if (container && container.state === 'running') {
      await this.docker.stopContainer(containerName);
    }
  }

  /**
   * Remove workspace container
   */
  async removeContainer(workspacePath: string, force: boolean = false): Promise<void> {
    const containerName = this.generateContainerName(workspacePath);
    await this.docker.removeContainer(containerName, force);
  }

  /**
   * List all AutoGoals containers
   */
  async listAllContainers(): Promise<Array<{ name: string; state: string; workspace: string }>> {
    const containers = await this.docker.listContainers('autogoals.workspace');

    return Promise.all(
      containers.map(async (c) => {
        const info = await this.docker.getContainer(c.id);
        // Extract workspace from labels (would need docker inspect)
        return {
          name: c.name,
          state: c.state,
          workspace: '', // TODO: extract from labels
        };
      })
    );
  }
}
