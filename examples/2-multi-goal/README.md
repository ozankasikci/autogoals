# Example 2: Multi-Goal Project

Demonstrates multi-session execution with dependent goals.

## Goals

1. **Setup Project** - Create package.json
2. **Add Dependencies** - Install express and nodemon
3. **Create Server** - Build Express server
4. **Add README** - Document the project

## How to Run

```bash
cd examples/2-multi-goal
autogoals start
```

## Expected Behavior

### Session 1
- Shows: "0/4 completed, 0 in progress, 4 pending"
- Claude works on goals (might complete 1-2)
- Updates goals.yaml
- Session exits

### Session 2
- AutoGoals re-parses goals.yaml
- Shows: "2/4 completed, 0 in progress, 2 pending"
- Spawns new session automatically
- Claude continues remaining goals
- Updates goals.yaml

### Session 3 (if needed)
- Continues until all 4 goals are completed
- Shows: "4/4 completed, 0 in progress, 0 pending"
- Exits with success message

## Multi-Session Testing

This example demonstrates Phase 2's key feature: **autonomous session continuity**.

After each Claude Code session completes, AutoGoals:
1. Re-parses goals.yaml
2. Checks for remaining work
3. Spawns a new session if needed
4. Continues until all goals are done
