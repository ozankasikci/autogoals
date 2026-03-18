import type { LogEvent } from "./types.js";

const TYPE_PREFIXES: Record<string, string> = {
  phase_transition: "---",
  goal_start: " >>",
  goal_complete: " OK",
  goal_fail: "ERR",
  goal_skip: "SKP",
  test_run: "TST",
  file_created: " + ",
  package_install: "PKG",
  shell_failure: " ! ",
  warning: "WRN",
  error: "ERR",
  info: "   ",
};

export function formatForTerminal(event: LogEvent): string {
  const prefix = TYPE_PREFIXES[event.type] ?? "   ";
  const cost = event.costUsd != null ? ` ($${event.costUsd.toFixed(2)})` : "";
  return `${prefix} ${event.message}${cost}`;
}
