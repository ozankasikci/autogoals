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
    recurring: boolean;
  }>): void;
  addGoal(goal: { id: string; name: string; description: string; acceptanceCriteria: string[]; dependsOn: string[]; approach?: string; recurring?: boolean }): void;
  removeGoal(id: string): void;

  // Activity
  getActivityEvents(limit?: number, beforeId?: number): { id: number; type: string; message: string; costUsd: number | null; createdAt: string }[];
  addActivityEvent(type: string, message: string, costUsd?: number): void;

  // Checkpoints
  getCheckpoints(limit?: number): { id: number; goalId: string | null; goalName: string; commitHash: string; tag: string; message: string; createdAt: string }[];
  addCheckpoint(goalId: string | null, goalName: string, commitHash: string, tag: string, message: string): void;

  // Run commands
  getRunCommands(): { id: number; name: string; command: string; autoStart: boolean }[];
  addRunCommand(name: string, command: string): { id: number; name: string; command: string; autoStart: boolean };
  updateRunCommand(id: number, updates: Partial<{ name: string; command: string; autoStart: boolean }>): void;
  removeRunCommand(id: number): void;

  // Environment variables
  getEnvVars(): { id: number; key: string; value: string }[];
  setEnvVar(key: string, value: string): void;
  removeEnvVar(id: number): void;

  // Goal screenshots
  getGoalScreenshots(goalId: string): { id: number; filePath: string; fileName: string }[];
  addGoalScreenshot(goalId: string, filePath: string, fileName: string): { id: number; filePath: string; fileName: string };
  removeGoalScreenshot(id: number): void;

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

  // Global rules
  getGlobalRules(): { id: number; content: string }[];
  addGlobalRule(content: string): { id: number; content: string };
  updateGlobalRule(id: number, content: string): void;
  removeGlobalRule(id: number): void;

  close(): void;
}
