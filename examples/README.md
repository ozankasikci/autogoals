# AutoGoals Examples

Test projects demonstrating AutoGoals functionality.

## Quick Start

```bash
# Build autogoals first
cd ..
cargo build --release

# Add to PATH or use full path
export PATH="$(pwd)/target/release:$PATH"

# Run any example
cd examples/1-hello-world
autogoals start
```

## Examples

### 1. Hello World
**Purpose:** Simple single-goal test  
**Difficulty:** Beginner  
**Features:** Basic execution, single goal

```bash
cd 1-hello-world
autogoals start
```

Creates a hello.txt file. Perfect for first-time testing.

---

### 2. Multi-Goal Project
**Purpose:** Multi-session autonomous execution  
**Difficulty:** Intermediate  
**Features:** Session continuity, multiple goals, dependencies

```bash
cd 2-multi-goal
autogoals start
```

Builds a Node.js project with multiple related goals. Demonstrates how AutoGoals:
- Spawns multiple sessions automatically
- Tracks progress across sessions
- Continues until all goals complete

---

### 3. All Completed
**Purpose:** Completion detection test  
**Difficulty:** Beginner  
**Features:** Status detection, early exit

```bash
cd 3-all-completed
autogoals start
```

All goals are already completed. AutoGoals should:
- Detect completion immediately
- NOT spawn Claude Code
- Exit with success message

---

### 4. Mixed Status
**Purpose:** Status parsing and grouping  
**Difficulty:** Intermediate  
**Features:** All goal statuses, progress tracking

```bash
cd 4-mixed-status
autogoals start
```

Goals in various states (completed, in_progress, pending, etc.). Tests:
- Accurate status counting
- Proper status grouping
- Progress display

## Testing Without Claude Code

You can test status detection without running Claude:

```bash
cd 1-hello-world

# See it detect pending work
autogoals start

# Ctrl-C to exit Claude

# Manually mark as completed
sed -i '' 's/pending/completed/' goals.yaml

# See it detect completion
autogoals start
# Should exit immediately with "All goals completed!"
```

## Creating Your Own Example

```bash
mkdir examples/my-example
cat > examples/my-example/goals.yaml << 'YAML'
goals:
  - id: "my-goal"
    description: "What you want Claude to build"
    status: "pending"
YAML

cd examples/my-example
autogoals start
```

## What AutoGoals Does

1. **Parse** - Reads goals.yaml, counts status
2. **Check** - If work remains, spawn Claude Code
3. **Wait** - Let Claude work on goals
4. **Re-check** - After session, parse goals.yaml again
5. **Loop** - Continue until all goals completed
6. **Success** - Exit when done

## Troubleshooting

### "No goals.yaml found"
Make sure you're in the example directory and goals.yaml exists.

### "Failed to spawn 'claude' command"
Install Claude Code or check it's in your PATH.

### Sessions exit but goals not updated
Claude Code should use the AutoGoals skill to update goals.yaml. Make sure the skill is available.

## Phase Support

| Example | Phase 1 | Phase 2 | Phase 3+ |
|---------|---------|---------|----------|
| 1-hello-world | ✅ | ✅ | - |
| 2-multi-goal | ⚠️ | ✅ | - |
| 3-all-completed | ✅ | ✅ | - |
| 4-mixed-status | ⚠️ | ✅ | - |

- ✅ Fully supported
- ⚠️ Partial (starts but doesn't loop)
- Future phases will add logging, TUI, error handling

## Next Steps

After testing examples:
1. Try AutoGoals on your own projects
2. Create a goals.yaml for a feature you want to build
3. Let Claude Code + AutoGoals work autonomously
4. Watch progress through multiple sessions
