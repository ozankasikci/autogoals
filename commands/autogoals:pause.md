Pause autonomous goal execution.

**Usage:**
/autogoals:pause

**What it does:**
1. Saves current state
2. Stops autonomous execution
3. Keeps worktree intact (if exists)
4. Allows manual inspection/intervention

**Example:**
```bash
/autogoals:pause
```

**Output:**
```
⏸️ AutoGoals Paused

Current goal: e2e-tests (IN_PROGRESS)
Worktree: /Users/ozan/Projects/myapp-worktrees/e2e-tests
State saved to: .goals-state.json

You can:
- Inspect worktree manually
- Make manual changes
- Resume with /autogoals:resume
- Skip current goal with /autogoals:skip e2e-tests
```
