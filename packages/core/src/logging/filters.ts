import type { LogFilter, LogEventType } from "./types.js";

const ALWAYS_SHOW: Set<LogEventType> = new Set([
  "phase_transition",
  "goal_start",
  "goal_complete",
  "goal_fail",
  "goal_skip",
  "test_run",
  "file_created",
  "package_install",
  "shell_failure",
  "warning",
  "error",
]);

const NEVER_SHOW: Set<LogEventType> = new Set([
  "file_read",
  "file_edited",
]);

export const defaultFilter: LogFilter = (event) => {
  if (ALWAYS_SHOW.has(event.type)) return true;
  if (NEVER_SHOW.has(event.type)) return false;
  return false;
};
