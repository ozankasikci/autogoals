---
name: goal-verification
description: Use when goal status is ready_for_verification - runs verification commands, handles retry logic, merges worktree on success, marks goal complete or failed
---

# Goal Verification

## Overview

Automated verification skill that runs verification commands from goals.yaml, implements retry logic with error context, merges successful implementations to main branch, and triggers next goal.

## When to Use

**Triggered when:**
- Goal status = "ready_for_verification"
- Called by goal-orchestrator
- Worktree exists for goal

**DO NOT use manually.** Orchestrator activates this skill.

## Process

### Phase 1: Load Verification Commands

```javascript
const goal = getGoalById(goalId, goals);
const commands = goal.verification_commands;
// Example: ["npm install", "npm run build", "npm test"]
```

### Phase 2: Switch to Worktree

```javascript
const worktreePath = getWorktreePath(goalId, projectPath);
process.chdir(worktreePath);
```

### Phase 3: Run Verification Commands

```javascript
const results = [];

for (const command of commands) {
  console.log(`▶ Running: ${command}`);

  const result = execSync(command, {
    cwd: worktreePath,
    encoding: 'utf8',
    timeout: 600000, // 10 minute timeout per command
    stdio: 'pipe'
  });

  results.push({
    command,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  });

  if (result.status !== 0) {
    console.log(`✗ FAILED: ${command}`);
    console.log(`  Exit code: ${result.status}`);
    console.log(`  Error: ${result.stderr}`);
    break; // Stop on first failure
  } else {
    console.log(`✓ PASSED: ${command}`);
  }
}
```

### Phase 4: Handle Results

**All commands passed:**

```javascript
if (allPassed(results)) {
  console.log('\n✅ All verification commands passed');

  // Switch back to main project
  process.chdir(projectPath);

  // Merge worktree to main
  mergeBranch(goal.branch_name, projectPath, 'main');
  console.log(`✓ Merged ${goal.branch_name} to main`);

  // Delete worktree
  deleteWorktree(worktreePath, goal.branch_name, projectPath);
  console.log(`✓ Cleaned up worktree`);

  // Update state
  updateGoalStatus(goalId, 'completed', state);
  state.goals_status[goalId].completed_at = new Date().toISOString();
  saveState('.goals-state.json', state);

  // Trigger next goal
  console.log('\n🎯 Goal completed! Moving to next goal...');
  return 'trigger_next_goal';
}
```

**Some commands failed:**

```javascript
else {
  const failedCmd = results.find(r => r.exitCode !== 0);

  // Increment retry count
  const currentRetries = state.goals_status[goalId].retry_count || 0;
  const newRetries = currentRetries + 1;

  // Store error context
  state.goals_status[goalId].last_error = {
    command: failedCmd.command,
    exit_code: failedCmd.exitCode,
    stdout: failedCmd.stdout,
    stderr: failedCmd.stderr,
    timestamp: new Date().toISOString()
  };
  state.goals_status[goalId].retry_count = newRetries;

  // Check retry limit
  if (newRetries < goal.max_retries) {
    console.log(`\n⚠️ Verification failed (retry ${newRetries}/${goal.max_retries})`);
    console.log(`Failed command: ${failedCmd.command}`);
    console.log(`Error: ${failedCmd.stderr.substring(0, 200)}...`);

    // Return to execution phase with error context
    updateGoalStatus(goalId, 'executing', state);
    saveState('.goals-state.json', state);

    console.log('\n🔄 Retrying with error context...');
    return 'retry_execution';
  } else {
    console.log(`\n❌ Verification failed after ${goal.max_retries} retries`);

    // Mark as failed
    updateGoalStatus(goalId, 'failed', state);
    saveState('.goals-state.json', state);

    console.log('\n⛔ Goal execution stopped');
    return 'goal_failed';
  }
}
```

## Retry Logic with Context

When verification fails and retry is triggered:

1. **Error context is available** in state:
   ```javascript
   state.goals_status[goalId].last_error = {
     command: "npm test",
     exit_code: 1,
     stderr: "Test 'user signup' failed: timeout waiting for element",
     timestamp: "2025-12-07T15:30:00Z"
   }
   ```

2. **Execution skill receives this context** and can:
   - Analyze what went wrong
   - Adjust implementation approach
   - Fix specific failing tests
   - Add timeouts, retries, or configuration

3. **Fresh attempt with knowledge** of previous failure

## Timeout Handling

**Per-command timeout:**
```javascript
const COMMAND_TIMEOUT = 600000; // 10 minutes

try {
  execSync(command, { timeout: COMMAND_TIMEOUT });
} catch (error) {
  if (error.killed) {
    results.push({
      command,
      exitCode: -1,
      stderr: `Command timeout after ${COMMAND_TIMEOUT / 1000} seconds`
    });
  }
}
```

## Output Format

**Start:**
```
✓ Verification Phase: backend-structure

Worktree: /Users/ozan/Projects/myapp-worktrees/backend-structure
Commands to run: 3

Running verification...
```

**During:**
```
▶ Running: npm install
  ✓ PASSED (12.3s)

▶ Running: npm run build
  ✓ PASSED (8.7s)

▶ Running: npm test
  ✗ FAILED
  Exit code: 1
  Error: Test 'authentication' failed: Invalid token signature
```

**Success:**
```
✅ All verification commands passed

Merging to main...
  ✓ Merged goal/backend-structure to main
  ✓ Cleaned up worktree

Goal Status: COMPLETED
Execution time: 2h 15m
Commits: 47

🎯 Moving to next goal: frontend-app
```

**Retry:**
```
⚠️ Verification failed (retry 1/2)

Failed command: npm test
Error: Test 'authentication' failed: Invalid token signature

Retry count: 1/2
Previous attempts:
1. Failed at 2025-12-07T15:30:00Z - Invalid token signature

🔄 Retrying with error context...
Returning to execution phase...
```

**Failure:**
```
❌ Verification failed after 2 retries

Failed command: npm test
Final error: Test 'authentication' failed: Database connection refused

Retry history:
1. Invalid token signature
2. Database connection refused

Goal Status: FAILED

⛔ Execution stopped

Manual intervention required:
- Review worktree: /Users/ozan/Projects/myapp-worktrees/backend-structure
- Fix issues manually
- Run: /autogoals:reset backend-structure
```

## Integration

**Called by:**
- goal-orchestrator (when status = ready_for_verification)

**Uses:**
- lib/git-operations.js (merge, cleanup)
- lib/goals-core.js (state updates)

**Updates:**
- Runs verification commands
- Handles success: merge, cleanup, mark complete
- Handles failure: retry or fail
- Returns control to orchestrator

**Next steps:**
- Success → Orchestrator triggers next goal
- Retry → Orchestrator triggers execution again
- Failure → Orchestrator stops, reports to user
