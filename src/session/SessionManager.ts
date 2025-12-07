import { AgentState } from '../tui/types.js';
import { LogBuffer } from './LogBuffer.js';

export class SessionManager {
  private agents: Map<number, AgentState> = new Map();
  private logBuffers: Map<number, LogBuffer> = new Map();
  private nextAgentId: number = 1;

  createAgent(goalId: string, goalDescription: string): number {
    const agentId = this.nextAgentId++;

    const agent: AgentState = {
      id: agentId,
      status: 'running',
      goalId,
      goalDescription,
      startedAt: new Date(),
      logBuffer: [],
    };

    this.agents.set(agentId, agent);
    this.logBuffers.set(agentId, new LogBuffer());

    return agentId;
  }

  appendLog(agentId: number, line: string): void {
    const buffer = this.logBuffers.get(agentId);
    if (buffer) {
      buffer.append(line);
      // Log synchronization is lazy - only happens when getAgent/getAgents is called
    }
  }

  updateStatus(
    agentId: number,
    status: AgentState['status'],
    exitCode?: number
  ): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      if (status === 'completed' || status === 'failed') {
        agent.endedAt = new Date();
      }
      if (exitCode !== undefined) {
        agent.exitCode = exitCode;
      }
    }
  }

  getAgents(): AgentState[] {
    // Lazy sync: update all log buffers before returning
    for (const [agentId, agent] of this.agents) {
      const buffer = this.logBuffers.get(agentId);
      if (buffer) {
        agent.logBuffer = buffer.getLines();
      }
    }
    return Array.from(this.agents.values());
  }

  getAgent(agentId: number): AgentState | undefined {
    const agent = this.agents.get(agentId);
    if (agent) {
      // Lazy sync: update log buffer before returning
      const buffer = this.logBuffers.get(agentId);
      if (buffer) {
        agent.logBuffer = buffer.getLines();
      }
    }
    return agent;
  }
}
