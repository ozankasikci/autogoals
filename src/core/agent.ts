import type { Phase, PhaseName, PhaseResult, AgentContext } from "./types.js";
import type { Logger } from "../modules/logging/index.js";

export interface PhaseMap {
  interview: Phase;
  spec: Phase;
  execution: Phase;
  standby: Phase;
}

export class Agent {
  private phases: PhaseMap;

  constructor(phases: PhaseMap) {
    this.phases = phases;
  }

  async run(context: AgentContext, logger: Logger): Promise<void> {
    let currentPhase: PhaseName = "interview";

    while (currentPhase !== "done") {
      const phase: Phase = this.phases[currentPhase as keyof PhaseMap];
      if (!phase) {
        throw new Error(`Unknown phase: ${currentPhase}`);
      }

      logger.log({
        type: "phase_transition",
        message: `Entering ${currentPhase} phase`,
      });

      context.state.currentPhase = currentPhase;
      const result: PhaseResult = await phase.execute(context);
      currentPhase = result.next;
    }

    logger.log({
      type: "phase_transition",
      message: "All phases complete",
    });
  }
}
