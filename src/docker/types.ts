export interface ContainerConfig {
  name: string;
  image: string;
  workspacePath: string;
  env: Record<string, string>;
  labels?: Record<string, string>;
}

export interface ContainerInfo {
  id: string;
  name: string;
  state: 'running' | 'stopped' | 'paused' | 'restarting';
  createdAt: Date;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
