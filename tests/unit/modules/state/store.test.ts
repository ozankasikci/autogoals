import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createInitialState,
  loadState,
  saveState,
} from "../../../../src/modules/state/index.js";

describe("state store", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `ss-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates initial state with empty values", () => {
    const state = createInitialState();
    expect(state.spec).toBeNull();
    expect(state.goals).toEqual([]);
    expect(state.totalCostUsd).toBe(0);
    expect(state.currentPhase).toBe("interview");
    expect(state.interviewNotes).toEqual([]);
  });

  it("saves and loads state to disk", () => {
    const state = createInitialState();
    state.totalCostUsd = 1.5;
    state.currentPhase = "execution";

    saveState(dir, state);
    const loaded = loadState(dir);

    expect(loaded).not.toBeNull();
    expect(loaded!.totalCostUsd).toBe(1.5);
    expect(loaded!.currentPhase).toBe("execution");
  });

  it("returns null when no state file exists", () => {
    const loaded = loadState(dir);
    expect(loaded).toBeNull();
  });
});
