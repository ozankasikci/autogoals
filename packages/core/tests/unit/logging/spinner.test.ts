import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSpinner } from "../../../src/logging/index.js";

describe("spinner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("can start and stop without errors", () => {
    const spinner = createSpinner();
    spinner.start("Loading...");
    vi.advanceTimersByTime(200);
    spinner.stop();
  });

  it("can update message", () => {
    const spinner = createSpinner();
    spinner.start("Loading...");
    spinner.update("Still loading...");
    vi.advanceTimersByTime(200);
    spinner.stop();
  });

  it("handles double stop gracefully", () => {
    const spinner = createSpinner();
    spinner.start("Loading...");
    vi.advanceTimersByTime(200);
    spinner.stop();
    spinner.stop(); // should not throw
  });

  it("handles start when already started", () => {
    const spinner = createSpinner();
    spinner.start("First");
    spinner.start("Second"); // should just update
    vi.advanceTimersByTime(200);
    spinner.stop();
  });

  it("succeed prints checkmark message", () => {
    const spinner = createSpinner();
    spinner.start("Working...");
    vi.advanceTimersByTime(200);
    spinner.succeed("Done!");

    const calls = (process.stderr.write as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1][0] as string;
    expect(lastCall).toContain("✓");
    expect(lastCall).toContain("Done!");
  });

  it("fail prints cross message", () => {
    const spinner = createSpinner();
    spinner.start("Working...");
    vi.advanceTimersByTime(200);
    spinner.fail("Oops!");

    const calls = (process.stderr.write as ReturnType<typeof vi.fn>).mock.calls;
    const lastCall = calls[calls.length - 1][0] as string;
    expect(lastCall).toContain("✗");
    expect(lastCall).toContain("Oops!");
  });
});
