import { describe, it, expect, vi } from "vitest";
import { createLogger } from "../../../src/logging/index.js";
import type { LogEvent } from "../../../src/logging/types.js";

describe("logger", () => {
  it("emits events that pass the filter", () => {
    const output: LogEvent[] = [];
    const logger = createLogger({
      filter: () => true,
      sink: (event) => output.push(event),
    });

    logger.log({ type: "phase_transition", message: "Starting interview" });
    expect(output).toHaveLength(1);
    expect(output[0].message).toBe("Starting interview");
  });

  it("suppresses events that fail the filter", () => {
    const output: LogEvent[] = [];
    const logger = createLogger({
      filter: () => false,
      sink: (event) => output.push(event),
    });

    logger.log({ type: "file_read", message: "reading foo.ts" });
    expect(output).toHaveLength(0);
  });

  it("always passes phase_transition and goal events with default filter", () => {
    const output: LogEvent[] = [];
    const logger = createLogger({
      sink: (event) => output.push(event),
    });

    logger.log({ type: "phase_transition", message: "entering spec" });
    logger.log({ type: "goal_start", message: "goal 1" });
    logger.log({ type: "goal_complete", message: "goal 1 done" });
    logger.log({ type: "goal_fail", message: "goal 2 failed" });
    logger.log({ type: "file_read", message: "read foo.ts" });

    expect(output).toHaveLength(4);
  });
});
