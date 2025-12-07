# AutoGoals

Autonomous long-term goal execution system for Claude Code.

Define multiple interconnected project goals in YAML, and let Claude Code work autonomously for hours implementing them one by one with interactive planning, autonomous execution, and automated verification.

## Features

- **Multi-goal execution** - Define 10+ goals with explicit dependencies
- **Interactive planning** - Socratic questioning before implementation
- **Autonomous execution** - Hours of work without human intervention
- **Verification gates** - Automated testing with retry logic
- **State persistence** - Resume across sessions seamlessly
- **Git isolation** - Each goal in separate worktree

## Quick Start

### 1. Install Plugin

```bash
# Add marketplace (if not already added)
/plugin marketplace add <your-marketplace>

# Install AutoGoals
/plugin install autogoals@<your-marketplace>
```

### 2. Create goals.yaml

Create `goals.yaml` in your project root:

```yaml
version: "1.0"
project_name: "my-app"

goals:
  - id: "backend"
    name: "Backend Setup"
    description: "Create Node.js backend with Express and TypeScript"
    dependencies: []
    acceptance_criteria:
      - "npm test passes"
    verification_commands:
      - "npm test"
    max_retries: 2
    branch_name: "goal/backend"

  - id: "frontend"
    name: "Frontend Setup"
    description: "Create React frontend with TypeScript"
    dependencies: ["backend"]
    acceptance_criteria:
      - "npm run build succeeds"
    verification_commands:
      - "npm run build"
    max_retries: 2
    branch_name: "goal/frontend"
```

### 3. Start Claude Code

AutoGoals activates automatically when it detects `goals.yaml`.

Or manually start:

```bash
/start
```

### 4. Watch It Work

Claude will:
1. Ask clarifying questions for the first goal
2. Create implementation plan
3. Execute autonomously using TDD
4. Run verification tests
5. Merge to main on success
6. Move to next goal automatically

## How It Works

### Goal Lifecycle

Each goal progresses through these states:

```
pending
  ↓ (interactive planning with questions)
planning
  ↓ (user approves plan)
ready_for_execution
  ↓ (autonomous TDD implementation)
executing
  ↓ (all tasks complete)
ready_for_verification
  ↓ (run verification commands)
verifying
  ↓
├─→ completed (all tests pass) → next goal
├─→ retrying (tests failed, retry < max_retries) → back to executing
└─→ failed (tests failed, retry >= max_retries) → STOP
```

### Interactive Planning Phase

For each goal, Claude:
- Reads goal description and acceptance criteria
- Asks clarifying questions (one at a time, Socratic method)
- Explores architecture options
- Creates detailed implementation plan
- Saves plan to `docs/goals/plans/{goal-id}-plan.md`
- Asks for approval before execution

**Example planning session:**
```
Question 1/5: Architecture preferences

For the Node.js backend, which architecture would you prefer?

A) Layered architecture (controllers → services → repositories)
B) Feature-based modules (each feature is self-contained)
C) Hexagonal architecture (ports and adapters)
D) Other approach you have in mind?

> A

Question 2/5: ORM selection
...
```

### Autonomous Execution Phase

Claude works autonomously:
- Creates isolated git worktree
- Implements plan using TDD (RED-GREEN-REFACTOR)
- Commits every 15 minutes or after task completion
- Runs without human intervention
- Can work for 2-4 hours per goal

### Verification Phase

Automatic quality gates:
- Runs all verification commands from goals.yaml
- If all pass: merges to main, deletes worktree, starts next goal
- If any fail: increments retry count
  - If retry < max_retries: returns to execution with error context
  - If retry >= max_retries: marks goal as failed, stops

## Commands

### /start
Initialize and begin goal execution

### /status
Show progress dashboard:
```
Overall Progress: 2/5 goals completed (40%)

[✓] backend         COMPLETED  (2h 15m)
[✓] frontend        COMPLETED  (1h 45m)
[→] e2e-tests      IN_PROGRESS (35m, retry 1/3)
[ ] admin          PENDING    (waiting: e2e-tests)
[ ] deployment     PENDING    (waiting: admin)
```

### /pause
Pause autonomous execution

### /resume
Resume from current state

## goals.yaml Format

```yaml
version: "1.0"
project_name: "string"

goals:
  - id: "unique-id"                    # Required, unique identifier
    name: "Display Name"               # Required, shown in UI
    description: |                     # Required, used for planning
      Detailed description of what to build.
      Include tech stack preferences, architecture notes.

    dependencies: ["other-goal-id"]    # Required, can be empty []

    acceptance_criteria:               # Required, list of criteria
      - "Tests pass"
      - "Build succeeds"

    verification_commands:             # Required, shell commands
      - "npm install"
      - "npm test"

    max_retries: 2                     # Required, retry limit
    branch_name: "goal/branch-name"    # Required, git branch
```

## Examples

See `examples/` directory:
- `fullstack-app/` - Complete full-stack application (5 goals)

## State Management

AutoGoals tracks state in `.goals-state.json`:

```json
{
  "version": "1.0",
  "current_goal_id": "backend",
  "goals_status": {
    "backend": {
      "status": "in_progress",
      "started_at": "2025-12-07T10:30:00Z",
      "retry_count": 0,
      "branch": "goal/backend"
    }
  },
  "execution_log": [...]
}
```

**Important:**
- Don't edit this file manually
- Backed up automatically to `.goals-state.json.backup`
- Committed to `.gitignore` by default

## Design

See `docs/plans/2025-12-07-autogoals-design.md` for complete design specification.

## Troubleshooting

**Goals not starting:**
- Check `goals.yaml` exists in project root
- Validate YAML syntax: `npx js-yaml goals.yaml`
- Check for circular dependencies

**Goal verification keeps failing:**
- Check error in `.goals-state.json` → `goals_status.{id}.last_error`
- Review worktree: `./{project}-worktrees/{goal-id}/`
- Manually inspect and fix, then `/autogoals:resume`

**State file corrupted:**
- Restore from `.goals-state.json.backup`
- Or delete and restart: `rm .goals-state.json && /autogoals:start`

## Development

```bash
# Clone repository
git clone https://github.com/ozan/autogoals
cd autogoals

# Install dependencies
npm install

# Run tests
npm test

# Watch mode
npm run test:watch
```

## License

MIT - see LICENSE file

## Credits

Inspired by [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent.
