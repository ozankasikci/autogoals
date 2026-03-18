import { spawn, execSync, type ChildProcess } from "child_process";
import { resolve } from "path";
import { pubsub, EVENTS } from "../subscriptions/index.js";

function findExecutable(name: string): string {
  try {
    return execSync(`which ${name}`, { encoding: "utf-8" }).trim();
  } catch {
    return name; // fallback to bare name
  }
}

export class AgentManager {
  private processes = new Map<string, ChildProcess>();

  isRunning(projectId: string): boolean {
    return this.processes.has(projectId);
  }

  getRunningIds(): Set<string> {
    return new Set(this.processes.keys());
  }

  start(projectId: string, projectPath: string): void {
    if (this.processes.has(projectId)) {
      throw new Error(`Agent already running for project ${projectId}`);
    }

    const cliPath = resolve(
      import.meta.dirname,
      "../../../../packages/cli/src/index.ts",
    );

    const npxPath = findExecutable("npx");

    const child = spawn(npxPath, ["tsx", cliPath, "start", projectPath], {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PATH: process.env.PATH },
    });

    this.processes.set(projectId, child);

    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        pubsub.publish(EVENTS.LOG_EVENT, {
          logEvent: {
            type: "info",
            message: line.trim(),
            timestamp: new Date().toISOString(),
            projectId,
          },
        });
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        pubsub.publish(EVENTS.LOG_EVENT, {
          logEvent: {
            type: "error",
            message: line.trim(),
            timestamp: new Date().toISOString(),
            projectId,
          },
        });
      }
    });

    // Handle spawn errors without crashing the server
    child.on("error", (err) => {
      this.processes.delete(projectId);
      pubsub.publish(EVENTS.LOG_EVENT, {
        logEvent: {
          type: "error",
          message: `Failed to start agent: ${err.message}`,
          timestamp: new Date().toISOString(),
          projectId,
        },
      });
    });

    child.on("exit", (code) => {
      this.processes.delete(projectId);
      pubsub.publish(EVENTS.LOG_EVENT, {
        logEvent: {
          type: "info",
          message: `Agent exited with code ${code}`,
          timestamp: new Date().toISOString(),
          projectId,
        },
      });
    });
  }

  stop(projectId: string): void {
    const child = this.processes.get(projectId);
    if (!child) return;
    child.kill("SIGTERM");
    this.processes.delete(projectId);
  }

  stopAll(): void {
    for (const [id] of this.processes) {
      this.stop(id);
    }
  }
}
