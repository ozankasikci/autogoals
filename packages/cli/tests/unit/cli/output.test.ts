import { describe, it, expect } from "vitest";
import { printBanner, printPhaseHeader } from "../../../src/output.js";

describe("cli output", () => {
  it("printBanner returns formatted string", () => {
    const output = printBanner();
    expect(output).toContain("AutoGoals");
  });

  it("printPhaseHeader formats phase name", () => {
    const output = printPhaseHeader("interview");
    expect(output).toContain("Interview");
  });
});
