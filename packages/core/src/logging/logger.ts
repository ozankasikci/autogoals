import type { LogEvent, LoggerOptions } from "./types.js";
import { defaultFilter } from "./filters.js";

export interface Logger {
  log(event: LogEvent): void;
}

export function createLogger(options: LoggerOptions): Logger {
  const filter = options.filter ?? defaultFilter;
  const sink = options.sink;

  return {
    log(event: LogEvent) {
      event.timestamp = event.timestamp ?? Date.now();
      if (filter(event)) {
        sink(event);
      }
    },
  };
}
