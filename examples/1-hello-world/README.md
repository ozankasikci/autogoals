# Example 1: Hello World

Simple single-goal example to test AutoGoals.

## Goal

Create a `hello.txt` file with "Hello, World!" content.

## How to Run

```bash
cd examples/1-hello-world
autogoals start
```

## Expected Behavior

1. AutoGoals reads goals.yaml
2. Shows: "0/1 completed, 0 in progress, 1 pending"
3. Spawns Claude Code session
4. Claude creates hello.txt with the content
5. Updates goals.yaml to mark goal as completed
6. AutoGoals detects completion and exits

## Test Without Claude

To test detection without running Claude:

```bash
# Show it detects pending work
autogoals start .

# Update to completed
sed -i '' 's/pending/completed/' goals.yaml

# Show it detects completion
autogoals start .
```
