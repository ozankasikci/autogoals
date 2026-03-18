import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { ProjectState } from "../../core/types.js";

const STATE_FILE = "state.json";

export function createInitialState(): ProjectState {
  return {
    spec: null,
    goals: [],
    totalCostUsd: 0,
    currentPhase: "interview",
    interviewNotes: [],
  };
}

export function saveState(specsDir: string, state: ProjectState): void {
  mkdirSync(specsDir, { recursive: true });
  const filePath = join(specsDir, STATE_FILE);
  writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
}

export function loadState(specsDir: string): ProjectState | null {
  const filePath = join(specsDir, STATE_FILE);
  if (!existsSync(filePath)) {
    return null;
  }
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as ProjectState;
}
