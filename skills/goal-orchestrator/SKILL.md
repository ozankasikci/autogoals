---
name: goal-orchestrator
description: Use when goals.yaml exists in project - orchestrates autonomous multi-goal execution with planning, implementation, and verification phases
---

# Goal Orchestrator

## Overview

Master orchestration skill that manages autonomous execution of multiple goals defined in goals.yaml. Automatically activates on session start when goals configuration is detected.

## When to Use

**Auto-activates when:**
- Session starts
- `goals.yaml` exists in project root
- `.goals-state.json` exists or needs initialization

**DO NOT use this skill manually.** It loads automatically via session hook.

## How It Works

**This skill MUST run the orchestrator script to ensure correct behavior:**

```bash
node ~/.claude/plugins/cache/autogoals/scripts/orchestrator.js
```

The script enforces:
1. Load and validate goals.yaml
2. Load/initialize state
3. **Plan ALL pending goals before ANY execution**
4. Execute goals in loop until all complete
5. Proper state management and transitions

**DO NOT try to implement orchestrator logic manually!**
Use the script - it has the correct control flow hardcoded.

## Workflow

```
Session Start
  ↓
Load goals.yaml
  ↓
Validate dependencies
  ↓
Load/Initialize .goals-state.json
  ↓
Check if ANY goals need planning (status = pending)
  ↓ YES
**Plan ALL pending goals before ANY execution:**
  - For EACH goal with status=pending:
    1. Call goal-planning skill
    2. Wait for planning to complete
    3. Move to next pending goal
  - Continue until NO goals have status=pending
  ↓ ALL PLANNED (all goals now ready_for_execution)
Get next executable goal
  ↓
Delegate to skill based on status:
  - ready_for_execution → goal-execution
  - ready_for_verification → goal-verification
  - completed → next goal
  - failed → stop

Loop: After each goal completes, get next goal and delegate
```

**CRITICAL LOOP BEHAVIOR:**
- **NEVER stop after one goal!**
- After each goal status change (planning complete, execution complete, verification complete):
  1. Save state
  2. Get next executable goal
  3. If next goal exists → delegate immediately
  4. If no more goals → show completion summary
- **Continue autonomously until ALL goals are completed or one fails**

**IMPORTANT: Plan ALL goals before starting execution!**

## Error Handling

**Configuration Errors:**
- Invalid YAML → Show parse error with line number
- Circular dependencies → Show dependency cycle
- Unknown dependencies → List unknown goal IDs
- Action: Stop execution, ask user to fix

**State File Corruption:**
- Offer to restore from .goals-state.json.backup
- Offer to reset to fresh state
- Action: Wait for user decision

**Git Errors:**
- Worktree creation fails → Check disk space and permissions
- Action: Mark goal as failed, stop execution

## Output Format

**On initialization:**
```
🎯 AutoGoals System Active

Goals Configuration:
- 5 goals defined
- Dependencies validated (no cycles)
- Execution order: backend → frontend → e2e-tests → admin → deploy

Current Status:
- backend: PENDING
- frontend: PENDING (waiting: backend)
- e2e-tests: PENDING (waiting: backend, frontend)
- admin: PENDING (waiting: backend)
- deploy: PENDING (waiting: admin)

Starting with goal: backend
Delegating to goal-planning skill...
```

**On resume:**
```
🎯 AutoGoals System Resuming

Progress: 2/5 goals completed (40%)
[✓] backend: COMPLETED
[✓] frontend: COMPLETED
[→] e2e-tests: IN_PROGRESS (retry 1/3)

Resuming goal: e2e-tests
Last error: Test timeout (will retry with adjusted config)
Delegating to goal-execution skill...
```

## Integration

**Called by:**
- Session hook (automatic on startup)

**Calls:**
- goal-planning (for pending goals)
- goal-execution (for ready_for_execution goals)
- goal-verification (for ready_for_verification goals)

## Implementation Notes

- Uses `lib/goals-core.js` for all config and state operations
- Never modifies goals.yaml (read-only)
- Always saves state before transitioning
- Graceful degradation on errors (don't corrupt state)

## Continuous Execution Loop

**The orchestrator MUST continue running until ALL goals are complete:**

```javascript
// Pseudo-code for orchestrator behavior
while (true) {
  const nextGoal = getNextGoal(goals, state);

  if (!nextGoal) {
    // No more executable goals
    if (allGoalsCompleted(state)) {
      showCompletionSummary();
      break; // SUCCESS - all done
    } else {
      // Some goals waiting on dependencies or failed
      showStatus();
      break; // WAIT - cannot proceed
    }
  }

  // Delegate to appropriate skill
  if (nextGoal.status === 'pending') {
    await runPlanningSkill(nextGoal);
    // IMPORTANT: After planning, LOOP BACK to get next goal
    continue;
  }

  if (nextGoal.status === 'ready_for_execution') {
    await runExecutionSkill(nextGoal);
    // IMPORTANT: After execution, LOOP BACK to get next goal
    continue;
  }

  if (nextGoal.status === 'ready_for_verification') {
    await runVerificationSkill(nextGoal);
    // IMPORTANT: After verification, LOOP BACK to get next goal
    continue;
  }
}
```

**Key points:**
- After EACH skill completes, loop back to find next goal
- Don't wait for user input between goals
- Only stop when: all completed OR dependency blocked OR failure
