# GSD-Inspired Improvements for Small Singularity

Analysis of [Get Shit Done](https://github.com/gsd-build/get-shit-done) — a meta-prompting and context engineering system for AI-assisted development. Below are improvement ideas derived from GSD's patterns, prioritized by impact and effort.

---

## 1. Fresh Context Per Goal Execution (Priority 1)

**GSD pattern:** Each agent task gets a fresh 200K context window. The orchestrator stays lean (30-40% utilization). This prevents "context rot" where AI quality degrades over long sessions.

**Current state:** Our agent session accumulates context across the entire supervisor loop. Long-running projects hit quality degradation as the context fills with prior goal executions.

**Implementation:**
- Spin up a fresh `AgentSession` per goal execution instead of reusing one
- Keep the supervisor's system prompt lean — only inject rules + current goal
- Track context utilization and warn when it's getting high

**Impact:** High | **Effort:** Low

---

## 2. Goal-Backward Verification (Priority 2)

**GSD pattern:** Verification starts from "what should be true" — checking if goals are actually delivered, not just if tasks ran. Checks at 4 levels: exists, substantive, wired, data flows.

**Current state:** Our verification phase just asks the agent "is this done?" — a single-pass check that can miss integration gaps, stubs, and empty implementations.

**Implementation:**
- Structured verification that checks each acceptance criterion individually
- Integration verification — does the goal's output actually connect to the rest of the codebase?
- Anti-pattern scanning (TODOs, stubs, hardcoded values, console.logs)

**Impact:** High | **Effort:** Medium

---

## 3. Retry Memory (Priority 3)

**GSD pattern:** Debug sessions persist across context resets with a hypothesis-driven approach. A knowledge base prevents re-investigating dead ends.

**Current state:** When a goal fails and the agent retries, it starts fresh with no memory of what it already tried.

**Implementation:**
- Store the error + what was attempted in the goal's error field (more structured)
- On retry, inject: "Previous attempt failed because X. You already tried Y. Try a different approach."
- Track retry history per goal

**Impact:** Medium | **Effort:** Low

---

## 4. Wave-Based Parallel Execution (Priority 4)

**GSD pattern:** Groups tasks into dependency-aware "waves" — independent tasks run in parallel, dependent ones wait.

**Current state:** Our supervisor loop executes goals one at a time (non-recurring first, then round-robin). No dependency-aware parallelization.

**Implementation:**
- Analyze `dependsOn` relationships to build a wave structure
- Execute independent goals concurrently (multiple agent sessions)
- Visualize waves in the Goals panel — show which goals can run in parallel

**Impact:** High | **Effort:** High

---

## 5. Research Before Planning (Priority 5)

**GSD pattern:** Spawns a dedicated research agent that investigates the tech ecosystem, existing patterns, and pitfalls BEFORE creating a plan.

**Current state:** Our "refine" step goes straight from draft to approach without dedicated research. The agent might not know about existing patterns in the codebase.

**Implementation:**
- A "research" phase for goals where the agent analyzes the codebase structure, existing patterns, and relevant ecosystem tools before proposing an approach
- Store research findings per goal so they persist across retries

**Impact:** Medium | **Effort:** Medium

---

## 6. Plan Verification Before Execution (Priority 6)

**GSD pattern:** A dedicated plan-checker agent verifies plans against 8 dimensions (requirements coverage, dependencies, scope, data contracts) BEFORE execution. Up to 3 revision cycles.

**Current state:** We go straight from refined to execute. If the approach is wrong, we waste agent time and tokens.

**Implementation:**
- After refinement, run a quick verification pass: "Does this approach cover all acceptance criteria? Are there missing dependencies?"
- Show verification results to the user before approving

**Impact:** Medium | **Effort:** Medium

---

## 7. Decision Capture Per Goal (Priority 7)

**GSD pattern:** Before planning, interviews the user about gray areas (layout preferences, API format, error handling approach) and locks decisions in a CONTEXT.md file.

**Current state:** Our interview phase is basic. No structured decision capture that persists and gets injected into future executions.

**Implementation:**
- A "Decisions" section per goal where the user can lock implementation choices
- The agent references these decisions during execution
- Show decisions alongside goals in the panel

**Impact:** Medium | **Effort:** Low

---

## 8. Project Stats Dashboard (Priority 8)

**GSD pattern:** Stats command shows project metrics — phases completed, tasks executed, time spent, token usage.

**Current state:** We show cost per goal and total cost, but no broader metrics.

**Implementation:**
- A stats section in the Project panel: total goals completed, success rate, average cost per goal, time active, verification pass rate
- Timeline view showing when goals were completed

**Impact:** Low | **Effort:** Low

---

## 9. Session Pause/Resume (Priority 9)

**GSD pattern:** pause-work saves structured handoff context. resume-work restores it. Sessions survive context resets cleanly.

**Current state:** When the API server restarts, active goals get stuck. No clean handoff mechanism.

**Implementation:**
- Save execution context (what the agent was doing, where it left off) when stopping
- On restart, the agent picks up from the saved context rather than starting fresh
- Show "Resuming..." state in the UI

**Impact:** Medium | **Effort:** Medium

---

## 10. Milestone System (Priority 10)

**GSD pattern:** Projects go through structured phases (discuss, plan, execute, verify, ship). Each phase has its own research, planning, and verification.

**Current state:** We have a phase field but it's mostly cosmetic. No structured lifecycle per phase.

**Implementation:**
- Allow users to define milestones that group goals together
- Add a "discuss" step before execution where the agent interviews the user about approach
- Milestone completion triggers: git tag, summary, archive achieved goals

**Impact:** Medium | **Effort:** High

---

## Additional Ideas

### Auto-Next Detection
GSD's `/gsd:next` analyzes current state and suggests the logical next action. We could add a "Suggested next" indicator: "2 goals are ready to execute" or "Goal X needs verification."

### UI Design Contract
For frontend goals, allow users to attach design notes (we already have screenshots — add a "design notes" text field). The agent uses these as constraints during execution.

### Anti-Pattern Scanning
After goal execution, scan for common issues: TODO comments left behind, console.log statements, hardcoded values, unused imports, empty catch blocks.
