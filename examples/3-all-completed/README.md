# Example 3: All Goals Completed

Tests completion detection - should exit immediately without spawning Claude.

## How to Run

```bash
cd examples/3-all-completed
autogoals start
```

## Expected Output

```
🚀 AutoGoals Runner - Phase 2
📁 Project: .

✓ Found goals.yaml

📊 Goal Status: 3/3 completed, 0 in progress, 0 pending

🎉 All goals completed!

✨ All goals completed successfully!
```

## Purpose

This example verifies that AutoGoals:
- Correctly detects all completed goals
- Does NOT spawn unnecessary Claude sessions
- Exits immediately with success
