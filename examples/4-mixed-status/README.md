# Example 4: Mixed Status Goals

Tests status detection across all AutoGoals states.

## Goal Statuses

- ✅ **completed** - Verified done
- 🏗️ **in_progress** - Currently working
- 🚀 **ready_for_execution** - Ready to implement
- 🧪 **ready_for_verification** - Needs testing
- ⏳ **pending** - Not started

## How to Run

```bash
cd examples/4-mixed-status
autogoals start
```

## Expected Output

```
📊 Goal Status: 1/5 completed, 3 in progress, 1 pending
🤖 Starting Claude Code session #1...
```

## Status Grouping

AutoGoals groups statuses as:
- **Completed**: `completed`
- **In Progress**: `in_progress`, `ready_for_execution`, `ready_for_verification`
- **Pending**: `pending`, `failed`

This matches the AutoGoals skill workflow:
1. `pending` → initial state
2. `ready_for_execution` → plan complete
3. `in_progress` → implementing
4. `ready_for_verification` → testing
5. `completed` → done
