Pause autonomous goal execution.

**Usage:**
/pause

**What it does:**
1. Saves current state
2. Stops autonomous execution
3. Keeps worktree intact (if exists)
4. Allows manual inspection/intervention

**Example:**
```bash
/pause
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
- Resume with /resume
- Skip current goal with /skip e2e-tests
```
