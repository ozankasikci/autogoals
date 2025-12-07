export interface AgentState {
  id: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  goalId: string;
  goalDescription: string;
  startedAt: Date;
  endedAt?: Date;
  logBuffer: string[];
  exitCode?: number;
}

export interface AppState {
  agents: AgentState[];
  selectedIndex: number;
  currentView: 'list' | 'detail';
  detailAgentId?: number;
}
