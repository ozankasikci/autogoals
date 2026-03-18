export type LogEventType =
  | "phase_transition"
  | "goal_start"
  | "goal_complete"
  | "goal_fail"
  | "goal_skip"
  | "test_run"
  | "file_created"
  | "file_edited"
  | "file_read"
  | "shell_success"
  | "shell_failure"
  | "package_install"
  | "info"
  | "warning"
  | "error";

export interface LogEvent {
  type: LogEventType;
  message: string;
  detail?: string;
  costUsd?: number;
  timestamp?: number;
}

export type LogFilter = (event: LogEvent) => boolean;
export type LogSink = (event: LogEvent) => void;

export interface LoggerOptions {
  filter?: LogFilter;
  sink: LogSink;
}
