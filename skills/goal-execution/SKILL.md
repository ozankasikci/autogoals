---
name: goal-execution
description: Use when goal status is ready_for_execution - implements plan autonomously using TDD in isolated git worktree, commits regularly, transitions to ready_for_verification
---

# Goal Execution

## Overview

Autonomous implementation skill that executes the plan created by goal-planning. Works in isolated git worktree, follows TDD strictly, commits every 15 minutes or after task completion, runs without human intervention.

## When to Use

**Triggered when:**
- Goal status = "ready_for_execution"
- Called by goal-orchestrator
- Implementation plan exists at docs/goals/plans/{goal-id}-plan.md

**DO NOT use manually.** Orchestrator activates this skill.

## Process

### Phase 1: Setup Worktree

```javascript
import { createWorktree } from '../../lib/git-operations.js';

const worktreePath = createWorktree(
  goalId,              // 'backend-structure'
  goal.branch_name,    // 'goal/backend-structure'
  projectPath          // '/Users/ozan/Projects/myapp'
);

// Switch context to worktree
process.chdir(worktreePath);
```

### Phase 2: Load Implementation Plan

```javascript
const planPath = `docs/goals/plans/${goalId}-plan.md`;
const planContent = fs.readFileSync(planPath, 'utf8');

// Parse tasks from plan
const tasks = parsePlanTasks(planContent);
// Returns: [
//   { name: 'Task 1: Setup TypeScript', steps: [...] },
//   { name: 'Task 2: Express Server', steps: [...] }
// ]
```

### Phase 3: Execute Tasks (TDD Loop)

**For each task:**

```javascript
for (const task of tasks) {
  console.log(`\n▶ ${task.name}`);

  // Step 1: Write failing test
  writeFile(task.testFile, task.testCode);
  console.log(`  ✓ Test written: ${task.testFile}`);

  // Step 2: Run test - verify RED
  const redResult = runCommand(task.testCommand);
  if (redResult.exitCode === 0) {
    throw new Error('Test passed before implementation! Fix test.');
  }
  console.log(`  ✓ Test fails as expected: ${redResult.stderr}`);

  // Step 3: Write minimal implementation
  writeFile(task.implFile, task.implCode);
  console.log(`  ✓ Implementation written: ${task.implFile}`);

  // Step 4: Run test - verify GREEN
  const greenResult = runCommand(task.testCommand);
  if (greenResult.exitCode !== 0) {
    // Retry logic or mark for debugging
    throw new Error(`Test still failing: ${greenResult.stderr}`);
  }
  console.log(`  ✓ Test passes!`);

  // Step 5: Commit
  commitChanges(task.commitMessage, worktreePath);
  console.log(`  ✓ Committed: ${task.commitMessage}`);

  // Update progress in state
  logEvent({
    goal_id: goalId,
    event: 'task_completed',
    message: task.name
  });
}
```

### Phase 4: Final Verification

```javascript
// Run all tests in worktree
const allTestsResult = runCommand('npm test');

if (allTestsResult.exitCode === 0) {
  console.log('\n✅ All tests passing in worktree');
} else {
  console.log('\n⚠️ Some tests failing, will be caught in verification phase');
}
```

### Phase 5: Transition State

```javascript
updateGoalStatus(goalId, 'ready_for_verification', state);
saveState('.goals-state.json', state);
```

### Phase 6: Return to Main Directory

```javascript
// Switch back to main project
process.chdir(projectPath);

// Return control to orchestrator
// Orchestrator will trigger goal-verification next
```

## TDD Enforcement

**RED-GREEN-REFACTOR cycle is MANDATORY:**

1. **RED**: Write test, run it, **watch it fail**
   - If test passes → Error: "Test not testing the right thing"
   - Fix test and re-run until it fails correctly

2. **GREEN**: Write minimal code, run test, **watch it pass**
   - If test fails → Fix implementation (not test)
   - Keep trying until test passes

3. **REFACTOR**: Clean up code while keeping tests green
   - Extract functions
   - Improve names
   - Remove duplication
   - **Must keep all tests passing**

4. **COMMIT**: Save progress
   - Commit message format: `feat: {what was added}`
   - Include test files and implementation files

## Error Handling

**Test fails in RED phase (unexpected reason):**
```javascript
if (redResult.stderr.includes('syntax error')) {
  // Fix syntax, re-run
  fixSyntaxError(task.testFile);
  continue;
}
```

**Test fails in GREEN phase:**
```javascript
if (greenResult.exitCode !== 0) {
  // Log for debugging
  logEvent({
    goal_id: goalId,
    event: 'test_failure',
    message: `Task '${task.name}' test still failing after implementation`,
    details: greenResult.stderr
  });

  // Mark in state for verification phase to catch
  state.goals_status[goalId].last_error = {
    task: task.name,
    stderr: greenResult.stderr
  };
}
```

**Execution timeout (4 hours):**
```javascript
const MAX_EXECUTION_TIME = 4 * 60 * 60 * 1000; // 4 hours

if (Date.now() - startTime > MAX_EXECUTION_TIME) {
  logEvent({
    goal_id: goalId,
    event: 'execution_timeout',
    message: 'Goal execution exceeded 4 hours'
  });

  updateGoalStatus(goalId, 'failed', state);
  throw new Error('Execution timeout');
}
```

## Commit Strategy

**Frequency:**
- After every task completion (5-15 minutes per task)
- Every 15 minutes if task is long
- Before switching to verification phase

**Format:**
```bash
feat: add user authentication middleware

- Implement JWT token validation
- Add auth middleware to Express
- Tests for valid/invalid tokens

Task 4/12 complete
```

## Output Format

**Start:**
```
🔨 Executing Goal: backend-structure

Creating worktree...
  ✓ Worktree created: /Users/ozan/Projects/myapp-worktrees/backend-structure
  ✓ Branch: goal/backend-structure

Loading plan: docs/goals/plans/backend-structure-plan.md
  ✓ 15 tasks identified

Beginning autonomous implementation...
```

**During execution:**
```
▶ Task 3/15: Express Server Setup

  ✓ Test written: tests/server.test.ts
  ✓ Test fails as expected: "Cannot find module '../src/server'"
  ✓ Implementation written: src/server.ts
  ✓ Test passes!
  ✓ Committed: feat: add Express server with health endpoint

Progress: 3/15 tasks complete (20%)
Elapsed: 25 minutes
```

**Completion:**
```
✅ All Tasks Complete

Execution Summary:
- 15/15 tasks completed
- 32 files created
- 28 test files
- 47 commits
- Total time: 2h 15m

Switching to verification phase...
```

## Integration

**Called by:**
- goal-orchestrator (when status = ready_for_execution)

**Uses:**
- lib/git-operations.js (worktree management)
- lib/goals-core.js (state updates)

**Updates:**
- Creates git worktree
- Implements all tasks from plan
- Commits regularly
- Updates state: status = ready_for_verification
- Returns control to orchestrator
