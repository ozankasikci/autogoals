import { readFileSync } from 'fs';
import yaml from 'js-yaml';
export function parseGoals(path) {
    const content = readFileSync(path, 'utf-8');
    return yaml.load(content);
}
export function getGoalStatus(goalsFile) {
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    for (const goal of goalsFile.goals) {
        if (goal.status === 'completed') {
            completed++;
        }
        else if (['in_progress', 'ready_for_execution', 'ready_for_verification'].includes(goal.status)) {
            inProgress++;
        }
        else {
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
export function hasPendingWork(goalsFile) {
    return goalsFile.goals.some(g => g.status !== 'completed' && g.status !== 'failed');
}
