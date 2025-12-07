Resume autonomous goal execution from current state.

**Usage:**
/autogoals:resume

**What it does:**
1. Loads .goals-state.json
2. Determines current goal and status
3. Resumes from where it left off
4. Continues autonomous execution

**Example:**
```bash
/autogoals:resume
```

**Output:**
```
▶️ AutoGoals Resuming

Progress: 2/5 goals completed (40%)
Current goal: e2e-tests (IN_PROGRESS, retry 1/3)
Worktree: /Users/ozan/Projects/myapp-worktrees/e2e-tests

Resuming execution...
```
