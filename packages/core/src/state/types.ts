import type { PhaseName, Spec, SpecGoal, GoalState } from "../core/types.js";

export interface Message {
  id: number;
  projectId: string;
  role: "user" | "agent";
  content: string;
  read: boolean;
  createdAt: string;
}

export interface StateStore {
  // Project
  getPhase(): PhaseName;
  setPhase(phase: PhaseName): void;
  getTotalCost(): number;
  addCost(amount: number): void;

  // Interview
  getInterviewNotes(): string[];
  addInterviewNote(note: string): void;

  // Spec
  getSpec(): Spec | null;
  saveSpec(spec: Spec): void;

  // Goals
  getGoals(): GoalState[];
  getGoal(id: string): GoalState | null;
  upsertGoal(goal: GoalState): void;
  getNextPendingGoal(specGoals: SpecGoal[]): GoalState | null;

  // Sessions
  saveSession(phase: string, sessionId: string, goalId?: string): void;
  getLatestSession(phase: string, goalId?: string): string | null;

  // Messages
  getMessages(limit?: number, beforeId?: number): Message[];
  getUnreadMessages(): Message[];
  addMessage(role: "user" | "agent", content: string): Message;
  markMessagesRead(): void;

  // Rules
  getRules(): { id: number; content: string }[];
  addRule(content: string): { id: number; content: string };
  updateRule(id: number, content: string): void;
  removeRule(id: number): void;

  // Spec editing
  updateSpec(overview: string, technicalDecisions: string[]): void;

  // Goal editing
  updateGoal(id: string, updates: Partial<{
    name: string;
    description: string;
    approach: string;
    acceptanceCriteria: string[];
    dependsOn: string[];
    status: string;
    ongoing: boolean;
  }>): void;
  addGoal(goal: { id: string; name: string; description: string; acceptanceCriteria: string[]; dependsOn: string[]; approach?: string; ongoing?: boolean }): void;
  removeGoal(id: string): void;

  // Activity
  getActivityEvents(limit?: number, beforeId?: number): { id: number; type: string; message: string; costUsd: number | null; createdAt: string }[];
  addActivityEvent(type: string, message: string, costUsd?: number): void;

  // Lifecycle
  close(): void;
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStore {
  createProject(name: string, path: string): ProjectRecord;
  listProjects(): ProjectRecord[];
  getProject(id: string): ProjectRecord | null;
  getProjectByPath(path: string): ProjectRecord | null;
  deleteProject(id: string): boolean;
  close(): void;
}
