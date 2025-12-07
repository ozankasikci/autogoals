import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import type { GoalsFile, GoalStatus } from './types.js';

export function parseGoals(path: string): GoalsFile {
  const content = readFileSync(path, 'utf-8');
  return yaml.load(content) as GoalsFile;
}

export function getGoalStatus(goalsFile: GoalsFile): GoalStatus {
  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  for (const goal of goalsFile.goals) {
    if (goal.status === 'completed') {
      completed++;
    } else if (['in_progress', 'ready_for_execution', 'ready_for_verification'].includes(goal.status)) {
      inProgress++;
    } else {
      pending++;
    }
  }

  return {
    completed,
    inProgress,
    pending,
    total: goalsFile.goals.length
  };
}

export function hasPendingWork(goalsFile: GoalsFile): boolean {
  return goalsFile.goals.some(g => 
    g.status !== 'completed' && g.status !== 'failed'
  );
}
