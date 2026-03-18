// Core types
export type {
  PhaseName,
  PhaseResult,
  Phase,
  BudgetConfig,
  AgentConfig,
  Spec,
  SpecGoal,
  GoalStatus,
  GoalState,
  ProjectState,
  AgentContext,
} from "./core/types.js";

// State
export { createStore, createProjectStore } from "./state/store.js";
export { SQLiteStore } from "./state/sqlite-store.js";
export { SQLiteProjectStore } from "./state/project-store.js";
export { SCHEMA_SQL } from "./state/migrations.js";
export type { StateStore, ProjectStore, ProjectRecord, Message } from "./state/types.js";

// Goals
export { GoalTracker } from "./goals/tracker.js";

// Logging
export { createLogger } from "./logging/logger.js";
export { createSpinner } from "./logging/spinner.js";
export { defaultFilter } from "./logging/filters.js";
export { formatForTerminal } from "./logging/formatters.js";
export type { Logger } from "./logging/logger.js";
export type { Spinner } from "./logging/spinner.js";
export type { LogEvent, LogEventType, LogFilter, LogSink, LoggerOptions } from "./logging/types.js";

// SDK
export { runQuery } from "./sdk/client.js";
export type { QueryOptions, QueryCallbacks } from "./sdk/client.js";
export {
  extractSessionId,
  extractResult,
  extractAssistantText,
  extractToolUse,
} from "./sdk/message-handler.js";
export type { SDKResult, ToolUseInfo } from "./sdk/message-handler.js";
export {
  ALL_TOOLS,
  INTERVIEW_TOOLS,
  SPEC_TOOLS,
  EXECUTION_TOOLS,
  STANDBY_TOOLS,
} from "./sdk/tool-config.js";

// Config
export { loadConfig } from "./config/loader.js";
export { DEFAULT_CONFIG } from "./config/defaults.js";
export type { ConfigInput } from "./config/types.js";
