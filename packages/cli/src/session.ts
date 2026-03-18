export interface SessionInfo {
  sessionId: string | null;
  phase: string;
}

export class SessionManager {
  private sessions: Map<string, string> = new Map();

  setSessionId(phase: string, sessionId: string): void {
    this.sessions.set(phase, sessionId);
  }

  getSessionId(phase: string): string | undefined {
    return this.sessions.get(phase);
  }

  getAllSessions(): Record<string, string> {
    return Object.fromEntries(this.sessions);
  }
}
