import type { GoalState } from "../../core/types.js";
import { GoalTracker } from "./tracker.js";

export function serializeGoals(tracker: GoalTracker): GoalState[] {
  return tracker.getAll();
}
