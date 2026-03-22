import { spawn, execSync, ChildProcess } from "child_process";

interface ManagedProcess {
  id: string;
  projectId: string;
  command: string;
  name: string;
  pid: number | null;
  status: "running" | "stopped" | "crashed";
  output: string[];
  startedAt: string | null;
  process: ChildProcess | null;
}

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private MAX_OUTPUT_LINES = 500;

  startProcess(
    projectId: string,
    processId: string,
    name: string,
    command: string,
    cwd: string,
    envVars?: Record<string, string>,
  ): ManagedProcess {
    if (this.processes.has(processId)) {
      const existing = this.processes.get(processId)!;
      if (existing.status === "running") throw new Error("Process already running");
    }

    const child = spawn("sh", ["-c", command], {
      cwd,
      env: { ...process.env, FORCE_COLOR: "1", ...envVars },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const managed: ManagedProcess = {
      id: processId,
      projectId,
      command,
      name,
      pid: child.pid ?? null,
      status: "running",
      output: [],
      startedAt: new Date().toISOString(),
      process: child,
    };

    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        managed.output.push(line);
        if (managed.output.length > this.MAX_OUTPUT_LINES) {
          managed.output.shift();
        }
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n").filter(Boolean);
      for (const line of lines) {
        managed.output.push(`[stderr] ${line}`);
        if (managed.output.length > this.MAX_OUTPUT_LINES) {
          managed.output.shift();
        }
      }
    });

    child.on("exit", (code) => {
      managed.status = code === 0 ? "stopped" : "crashed";
      managed.process = null;
      managed.pid = null;
    });

    child.on("error", (err) => {
      managed.status = "crashed";
      managed.output.push(`[error] ${err.message}`);
      managed.process = null;
    });

    this.processes.set(processId, managed);
    return managed;
  }

  stopProcess(processId: string): boolean {
    const managed = this.processes.get(processId);
    if (!managed?.process) return false;
    managed.process.kill("SIGTERM");
    setTimeout(() => {
      if (managed.process && !managed.process.killed) {
        managed.process.kill("SIGKILL");
      }
    }, 5000);
    managed.status = "stopped";
    return true;
  }

  restartProcess(
    projectId: string,
    processId: string,
    name: string,
    command: string,
    cwd: string,
    envVars?: Record<string, string>,
  ): ManagedProcess {
    this.stopProcess(processId);
    return this.startProcess(projectId, processId, name, command, cwd, envVars);
  }

  removeProcess(processId: string): boolean {
    const managed = this.processes.get(processId);
    if (!managed) return false;
    if (managed.status === "running") return false;
    this.processes.delete(processId);
    return true;
  }

  getProcess(processId: string): ManagedProcess | undefined {
    return this.processes.get(processId);
  }

  getProjectProcesses(projectId: string): ManagedProcess[] {
    return Array.from(this.processes.values()).filter(
      (p) => p.projectId === projectId,
    );
  }

  getProcessOutput(processId: string, lastN?: number): string[] {
    const managed = this.processes.get(processId);
    if (!managed) return [];
    if (lastN) return managed.output.slice(-lastN);
    return managed.output;
  }

  detectRunningProcesses(projectPath: string): { pid: number; port: number; command: string }[] {
    const results: { pid: number; port: number; command: string }[] = [];
    const commonPorts = [3000, 3001, 4000, 5000, 5173, 5891, 8000, 8080, 8765];

    for (const port of commonPorts) {
      try {
        const output = execSync(`lsof -ti:${port}`, { encoding: "utf-8" }).trim();
        if (output) {
          const pids = output.split("\n").map(p => parseInt(p.trim())).filter(p => !isNaN(p));
          for (const pid of pids) {
            try {
              const cmdOutput = execSync(`ps -p ${pid} -o command=`, { encoding: "utf-8" }).trim();
              // Check if the process is related to this project
              let cwdOutput = "";
              try {
                cwdOutput = execSync(`lsof -p ${pid} | grep cwd | awk '{print $NF}'`, { encoding: "utf-8" }).trim();
              } catch {}
              const isRelated = cmdOutput.includes(projectPath) || cwdOutput.includes(projectPath);
              if (isRelated) {
                results.push({ pid, port, command: cmdOutput });
              }
            } catch {}
          }
        }
      } catch {
        // Port not in use
      }
    }
    return results;
  }

  killPort(port: number): boolean {
    try {
      execSync(`kill $(lsof -ti:${port})`, { encoding: "utf-8" });
      return true;
    } catch {
      return false;
    }
  }

  stopAll(): void {
    for (const [id] of this.processes) {
      this.stopProcess(id);
    }
  }
}
