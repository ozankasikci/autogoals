# Autonomous Goals System - Design Document

**Date:** 2025-12-07
**Purpose:** Long-term autonomous goal execution system for Claude Code
**Architecture:** Skill-based Claude Code plugin

---

## Executive Summary

The Autonomous Goals System (working name: "AutoGoals") is a Claude Code plugin that enables truly autonomous, long-running execution of multiple interconnected project goals. Unlike traditional task management, this system combines:

- **Declarative goal definition** in YAML with dependencies and acceptance criteria
- **Interactive planning phase** with Socratic questioning before implementation
- **Autonomous execution** following TDD principles without human intervention
- **Automated verification gates** with retry logic and failure recovery
- **Git worktree isolation** for clean separation between goals
- **State persistence** for resumability across sessions

The system is completely independent from Superpowers, purpose-built for long-term autonomous workflows.

---

## Core Concepts

### Goal Lifecycle Phases

1. **Planning Phase (Interactive)**
   - Agent asks clarifying questions one at a time
   - User provides context, preferences, constraints
   - Agent creates detailed implementation plan
   - Plan saved to `docs/goals/plans/{goal-id}-plan.md`

2. **Execution Phase (Autonomous)**
   - Agent implements plan using TDD (RED-GREEN-REFACTOR)
   - Works in isolated git worktree
   - Commits regularly with meaningful messages
   - No human intervention required

3. **Verification Phase (Automated)**
   - Runs verification commands from goals.yaml
   - All must pass to mark goal complete
   - Retry logic with configurable max attempts
   - Advances to next goal on success

### Key Principles

- **Evidence over claims** - Verification commands prove completion
- **Isolation** - Each goal in separate git worktree
- **Resumability** - State persisted, can resume after interruption
- **Dependency-aware** - Topological sort ensures valid execution order
- **Fail-safe** - Retry logic with limits, graceful degradation

---

## Configuration Format

### goals.yaml Structure

```yaml
version: "1.0"
project_name: "my-fullstack-app"

goals:
  - id: "backend-structure"
    name: "Setup Node.js Backend Structure"
    description: |
      Create a maintainable and extensible Node.js backend with:
      - Express.js for API
      - TypeScript for type safety
      - PostgreSQL with Prisma ORM
      - JWT authentication
      - Environment-based configuration

    dependencies: []  # No dependencies

    acceptance_criteria:
      - "npm test passes with 100% of tests green"
      - "npm run build completes without errors"
      - "API responds to GET /health with 200 OK"

    verification_commands:
      - "npm install"
      - "npm run build"
      - "npm test"

    max_retries: 2
    branch_name: "goal/backend-structure"

  - id: "frontend-app"
    name: "Setup React Frontend"
    description: |
      Create a modern React frontend with:
      - Vite for build tooling
      - TypeScript
      - Tailwind CSS for styling
      - React Router for navigation
      - Axios for API calls

    dependencies: ["backend-structure"]  # Requires backend first

    acceptance_criteria:
      - "npm run build succeeds"
      - "npm test passes"
      - "App renders without console errors"

    verification_commands:
      - "npm install"
      - "npm run build"
      - "npm test"

    max_retries: 2
    branch_name: "goal/frontend-app"

  - id: "e2e-tests"
    name: "End-to-End Testing Suite"
    description: |
      Create E2E tests using Playwright that:
      - Test complete user flows (signup, login, CRUD operations)
      - Run against both frontend and backend
      - Include database seeding for test data

    dependencies: ["backend-structure", "frontend-app"]

    acceptance_criteria:
      - "All E2E tests pass"
      - "Test coverage > 80% for critical paths"

    verification_commands:
      - "npm run test:e2e"

    max_retries: 3  # E2E tests can be flaky
    branch_name: "goal/e2e-tests"
```

### .goals-state.json Structure

```json
{
  "version": "1.0",
  "current_goal_id": "backend-structure",
  "goals_status": {
    "backend-structure": {
      "status": "in_progress",
      "started_at": "2025-12-07T10:30:00Z",
      "completed_at": null,
      "retry_count": 0,
      "branch": "goal/backend-structure",
      "last_error": null,
      "execution_time_seconds": 0
    },
    "frontend-app": {
      "status": "pending"
    },
    "e2e-tests": {
      "status": "pending"
    }
  },
  "execution_log": [
    {
      "timestamp": "2025-12-07T10:30:00Z",
      "goal_id": "backend-structure",
      "event": "started",
      "message": "Beginning planning phase"
    }
  ]
}
```

---

## Architecture

### Directory Structure

```
autogoals/                          # Plugin root
├── .claude-plugin/
│   ├── plugin.json                 # Plugin metadata
│   └── marketplace.json            # Optional marketplace config
│
├── hooks/
│   ├── hooks.json                  # Session hook configuration
│   └── session-start.sh            # Bootstrap hook
│
├── lib/
│   ├── goals-core.js               # Core goal operations
│   │                               # - parseGoalsConfig()
│   │                               # - loadState()
│   │                               # - saveState()
│   │                               # - validateDependencies()
│   │                               # - getNextGoal()
│   │                               # - initializeState()
│   │                               # - updateGoalStatus()
│   │                               # - canExecuteGoal()
│   │                               # - logEvent()
│   └── git-operations.js           # Git worktree management
│                                   # - createWorktree()
│                                   # - switchToWorktree()
│                                   # - mergeWorktree()
│                                   # - deleteWorktree()
│                                   # - commitChanges()
│
├── skills/
│   ├── goal-orchestrator/
│   │   └── SKILL.md                # Master orchestration skill
│   │
│   ├── goal-planning/
│   │   └── SKILL.md                # Interactive planning phase
│   │
│   ├── goal-execution/
│   │   └── SKILL.md                # Autonomous implementation
│   │
│   ├── goal-verification/
│   │   └── SKILL.md                # Test running & retry logic
│   │
│   └── goal-management/
│       └── SKILL.md                # Manual control commands
│
├── commands/
│   ├── goals-start.md              # /autogoals:start
│   ├── goals-status.md             # /autogoals:status
│   ├── goals-pause.md              # /autogoals:pause
│   ├── goals-resume.md             # /autogoals:resume
│   ├── goals-skip.md               # /autogoals:skip {goal-id}
│   ├── goals-reset.md              # /autogoals:reset {goal-id}
│   └── goals-logs.md               # /autogoals:logs {goal-id}
│
└── README.md
```

### Skill Responsibilities

#### 1. goal-orchestrator (Auto-activates)
- **Trigger:** Session start when `goals.yaml` exists
- **Responsibilities:**
  - Load goals configuration
  - Load/initialize state
  - Validate dependency graph (detect cycles)
  - Determine next executable goal
  - Delegate to appropriate skill based on status
  - Manage state transitions

#### 2. goal-planning (Interactive)
- **Trigger:** Goal status = "pending"
- **Responsibilities:**
  - Read goal description and acceptance criteria
  - Ask clarifying questions (one at a time, Socratic method)
  - Explore tech stack preferences
  - Identify architecture patterns
  - Create detailed implementation plan
  - Save plan to `docs/goals/plans/{goal-id}-plan.md`
  - Update status to "ready_for_execution"
  - Ask user: "Ready to begin implementation?"

#### 3. goal-execution (Autonomous)
- **Trigger:** Goal status = "ready_for_execution"
- **Responsibilities:**
  - Create git worktree for goal branch
  - Switch to worktree context
  - Implement plan using TDD:
    - Write failing test (RED)
    - Verify it fails correctly
    - Write minimal code (GREEN)
    - Verify it passes
    - Refactor (stay GREEN)
    - Commit changes
  - Regular commits (every 15 min or per task)
  - Update status to "ready_for_verification"

#### 4. goal-verification (Automated)
- **Trigger:** Goal status = "ready_for_verification"
- **Responsibilities:**
  - Run verification commands sequentially
  - Capture exit codes, stdout, stderr
  - **If all pass:**
    - Merge worktree to main
    - Delete worktree
    - Mark status "completed"
    - Trigger next goal
  - **If any fail:**
    - Increment retry_count
    - Store error context in state
    - **If retry_count < max_retries:**
      - Status = "executing" (retry with error context)
    - **If retry_count >= max_retries:**
      - Status = "failed"
      - Stop execution
      - Report to user

#### 5. goal-management (Manual Controls)
- **Trigger:** User commands
- **Responsibilities:**
  - `/autogoals:status` - Show progress dashboard
  - `/autogoals:pause` - Pause autonomous execution
  - `/autogoals:resume` - Resume from current state
  - `/autogoals:skip {goal-id}` - Skip goal, mark as skipped
  - `/autogoals:reset {goal-id}` - Reset goal to pending (for retry)
  - `/autogoals:logs {goal-id}` - Show execution logs

---

## State Machine

### Goal Statuses

```
pending
  ↓
planning (interactive)
  ↓
ready_for_execution (waiting for approval)
  ↓
executing (autonomous)
  ↓
ready_for_verification
  ↓
verifying (running tests)
  ↓
├─→ completed → next goal
├─→ retrying (failed, retry_count < max_retries) → executing
├─→ failed (failed, retry_count >= max_retries) → STOP
└─→ skipped (manual skip)
```

### Execution Flow

**Session Start:**
```
1. Hook detects goals.yaml
2. Load goal-orchestrator skill
3. Load/initialize .goals-state.json
4. Validate dependency graph
5. Get next executable goal
6. Delegate to appropriate skill
```

**Planning Phase:**
```
1. goal-planning activates
2. Read goal definition
3. Ask questions (one at a time)
4. Create implementation plan
5. Save to docs/goals/plans/{goal-id}-plan.md
6. status = "ready_for_execution"
7. Ask: "Ready to begin implementation?"
```

**Execution Phase:**
```
1. goal-execution activates
2. Create git worktree
3. Switch to worktree
4. FOR EACH task in plan:
   - Write failing test
   - Run test (verify RED)
   - Write minimal code
   - Run test (verify GREEN)
   - Refactor if needed
   - Git commit
5. status = "ready_for_verification"
6. Trigger verification
```

**Verification Phase:**
```
1. goal-verification activates
2. FOR EACH verification command:
   - Execute command
   - Capture exit code + output
   - IF exit code ≠ 0:
     - Log failure
     - Increment retry_count
     - IF retry_count < max_retries:
       - status = "executing" (retry with context)
     - ELSE:
       - status = "failed"
       - STOP
3. All commands passed:
   - Merge worktree to main
   - Delete worktree
   - status = "completed"
   - Trigger next goal
```

---

## Core Library Design

### lib/goals-core.js

**Key Functions:**

```javascript
// Configuration management
parseGoalsConfig(yamlPath)
  - Parse and validate goals.yaml
  - Return goals array or throw validation error

validateDependencies(goals)
  - Topological sort to detect cycles
  - Return execution order or throw cycle error

// State management
loadState(statePath)
  - Load .goals-state.json
  - Return state object or null if missing

saveState(statePath, state)
  - Backup current state to .goals-state.json.backup
  - Write state atomically
  - Validate JSON before writing

initializeState(goals)
  - Create initial .goals-state.json
  - All goals start as "pending"
  - Set current_goal_id to first goal

// Goal selection and status
getNextGoal(goals, state)
  - Find first goal where:
    - status ∈ {pending, retrying, ready_for_execution}
    - All dependencies are "completed"
  - Return goal or null if none eligible

canExecuteGoal(goalId, goals, state)
  - Check if all dependencies are satisfied
  - Return boolean

updateGoalStatus(goalId, status, state)
  - Update status in state
  - Log event
  - Return updated state

// Utilities
getGoalById(goalId, goals)
  - Retrieve goal definition by ID

logEvent(event, state)
  - Append to execution_log array
  - Include timestamp, goal_id, event type, message
```

**Key Algorithms:**

```javascript
// Topological sort for dependency validation
function validateDependencies(goals) {
  const graph = buildDependencyGraph(goals);
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(goalId) {
    if (visiting.has(goalId)) {
      throw new Error(`Circular dependency detected: ${Array.from(visiting).join(' → ')} → ${goalId}`);
    }
    if (visited.has(goalId)) return;

    visiting.add(goalId);
    const deps = graph[goalId] || [];
    for (const dep of deps) {
      visit(dep);
    }
    visiting.delete(goalId);
    visited.add(goalId);
    sorted.push(goalId);
  }

  for (const goal of goals) {
    visit(goal.id);
  }

  return sorted;
}
```

### lib/git-operations.js

**Key Functions:**

```javascript
createWorktree(goalId, branchName, basePath)
  - Calculate worktree path: ../{project}-worktrees/{goalId}
  - Execute: git worktree add {path} -b {branchName}
  - Return worktree path

switchToWorktree(worktreePath)
  - Change process working directory
  - Verify worktree is valid

mergeWorktree(branchName, mainBranch = 'main')
  - Checkout main
  - Merge branch
  - Push to remote (optional)

deleteWorktree(worktreePath, branchName)
  - git worktree remove {path}
  - git branch -d {branchName}

commitChanges(message, files = '.')
  - git add {files}
  - git commit -m "{message}"
  - Return commit hash

getCurrentBranch()
  - git branch --show-current

hasUncommittedChanges()
  - git status --porcelain
  - Return boolean
```

**Worktree Strategy:**

```
Project structure:
/Users/ozan/Projects/my-app/              (main project)
/Users/ozan/Projects/my-app-worktrees/
  ├── backend-structure/                   (worktree for goal 1)
  ├── frontend-app/                        (worktree for goal 2)
  └── e2e-tests/                           (worktree for goal 3)

Benefits:
- Clean separation between goals
- Main project directory stays clean
- Can inspect multiple worktrees simultaneously
- Easy cleanup (delete entire worktrees directory)
```

---

## Error Handling

### Configuration Errors

**Invalid Dependency:**
```yaml
dependencies: ["nonexistent-goal"]
```
**Error:** `Goal 'backend-structure' depends on unknown goal 'nonexistent-goal'`
**Action:** Refuse to start, show error message

**Circular Dependency:**
```yaml
goal-a: dependencies: ["goal-b"]
goal-b: dependencies: ["goal-a"]
```
**Error:** `Circular dependency detected: goal-a → goal-b → goal-a`
**Action:** Show dependency chain, refuse to start

**Invalid YAML Syntax:**
**Error:** `Failed to parse goals.yaml: {parse error details}`
**Action:** Show line number and fix suggestion

### State File Corruption

```javascript
if (!validateState(state)) {
  // Prompt user:
  // "State file corrupted. Options:"
  // A) Reset to fresh state (lose progress)
  // B) Manually fix .goals-state.json
  // C) Restore from backup (.goals-state.json.backup)
}

// Automatic backups before each state change
function saveState(state) {
  fs.copyFileSync('.goals-state.json', '.goals-state.json.backup');
  fs.writeFileSync('.goals-state.json', JSON.stringify(state, null, 2));
}
```

### Git Operation Failures

```javascript
try {
  createWorktree(goalId);
} catch (err) {
  logEvent('worktree_failed', { goalId, error: err.message });
  updateGoalStatus(goalId, 'failed');
  // Report: "Git worktree creation failed. Check disk space and permissions."
  // Pause execution
}
```

### Verification Failures

```javascript
// Capture detailed output
const result = execSync(command, {
  encoding: 'utf8',
  stdio: 'pipe',
  timeout: 600000  // 10 minute timeout
});

// Store for retry context
state.goals_status[goalId].last_error = {
  command: command,
  exit_code: result.status,
  stdout: result.stdout,
  stderr: result.stderr,
  timestamp: new Date().toISOString()
};
```

---

## Edge Cases

### User Interruption Mid-Execution
- State saved after every significant step
- On resume: Continue from last saved state
- Uncommitted changes? Prompt: commit, discard, or manual intervention

### Goal Becomes Blocked
```javascript
// If goal can't start due to failed dependencies:
getNextGoal(goals, state);  // Returns null

// Show status:
// "Execution paused. Goal 'e2e-tests' waiting on:"
// - backend-structure: FAILED (max retries reached)
// - frontend-app: PENDING (blocked by backend-structure)
//
// Options:
// /autogoals:skip backend-structure
// /autogoals:reset backend-structure
```

### All Goals Complete
```javascript
if (allGoalsCompleted(state)) {
  console.log("🎉 All goals completed successfully!");
  generateSummaryReport(goals, state);
  // Saved to: docs/goals/summary-YYYY-MM-DD.md
}
```

---

## User Experience

### Progress Dashboard

```bash
$ /autogoals:status

Autonomous Goals System - Progress Report
==========================================

Overall Progress: 2/5 goals completed (40%)

[✓] backend-structure    COMPLETED  (2h 15m)
[✓] frontend-app         COMPLETED  (1h 45m)
[→] e2e-tests           IN_PROGRESS (35m elapsed, 1/3 retries)
[ ] admin-dashboard      PENDING    (waiting: e2e-tests)
[ ] deployment-pipeline  PENDING    (waiting: admin-dashboard)

Current Activity:
Running verification for 'e2e-tests'
- Command: npm run test:e2e
- Status: Running... (12 tests passed, 3 in progress)

Last Error (e2e-tests, retry 1):
  Test 'user signup flow' failed: timeout waiting for element
  Retrying with increased timeout configuration...
```

### Plan Preview

```markdown
Goal: backend-structure
Plan Overview:
- 12 tasks identified
- Estimated files to create: 15
- Estimated files to modify: 3
- Test files: 8

Key tasks:
1. Setup TypeScript configuration
2. Configure Express.js server
3. Setup Prisma schema
4. Implement authentication middleware
... (8 more)

Proceed with autonomous implementation? (y/n)
```

### Execution Logs

Stored in `docs/goals/logs/{goal-id}.log`:
- Timestamp for each action
- Files created/modified
- Tests run and results
- Errors encountered
- Commits made

**View with:** `/autogoals:logs {goal-id}`

---

## Safety Mechanisms

1. **Max Execution Time Per Goal**
   - Configurable timeout (default: 4 hours)
   - Prevents infinite loops

2. **Commit Frequency**
   - Commit every 15 minutes or after task completion
   - Ensures work isn't lost

3. **Verification Timeout**
   - Individual command timeout (default: 10 minutes)
   - Prevents hanging on stuck tests

4. **State Backup**
   - Automatic backup before destructive operations
   - `.goals-state.json.backup` for recovery

5. **Dry Run Mode**
   - `/autogoals:start --dry-run`
   - Validate configuration without execution

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Setup plugin structure
2. Implement `lib/goals-core.js` (config parsing, state management)
3. Implement `lib/git-operations.js` (worktree management)
4. Add session hook for auto-activation
5. Write tests for core library

### Phase 2: Orchestration Skill
1. Implement `goal-orchestrator` skill
2. Dependency validation
3. Next goal selection logic
4. State transitions
5. Integration tests

### Phase 3: Planning Skill
1. Implement `goal-planning` skill
2. Question generation logic
3. Plan creation and formatting
4. Save to docs/goals/plans/
5. User interaction flow

### Phase 4: Execution Skill
1. Implement `goal-execution` skill
2. TDD workflow (RED-GREEN-REFACTOR)
3. Git worktree integration
4. Commit automation
5. Progress tracking

### Phase 5: Verification Skill
1. Implement `goal-verification` skill
2. Command execution
3. Retry logic
4. Error context capture
5. Merge and cleanup

### Phase 6: Management Commands
1. Implement slash commands
2. Status dashboard
3. Manual controls (pause, resume, skip, reset)
4. Logs viewer

### Phase 7: Polish & Documentation
1. Error messages and user guidance
2. README and usage examples
3. Example goals.yaml files
4. Video walkthrough

---

## Success Metrics

**System is successful if:**
- User can define 10 goals in goals.yaml
- Planning phase asks meaningful clarifying questions
- Execution runs autonomously for 4+ hours without intervention
- Verification gates catch real failures and trigger retries
- State persists correctly across session interruptions
- Git worktrees isolate goals cleanly
- User can resume after days/weeks without confusion

**Example Success Scenario:**
```
User defines 5 goals: backend, frontend, e2e-tests, admin-dashboard, deployment
Day 1 (2 hours): Plans backend, executes autonomously, verifies, completes
Day 1 (1.5 hours): Plans frontend, executes, verifies, completes
Day 2 (3 hours): Plans e2e-tests, executes, verification fails (timeout)
Day 2 (retry): Executes with adjusted config, verification passes, completes
Day 3: Plans admin-dashboard, user interrupts mid-execution
Day 4: User runs /autogoals:resume, continues admin-dashboard from last state
Day 4: Completes admin-dashboard, starts deployment, completes all goals
Result: 5 goals completed autonomously over 4 days with minimal intervention
```

---

## Technical Decisions Summary

1. **Skill-based architecture** - Leverages Claude Code's auto-activation
2. **YAML configuration** - Human-readable, version-controllable
3. **JSON state file** - Simple, debuggable, backed up automatically
4. **Git worktrees** - Clean isolation, parallel inspection possible
5. **Topological sort** - Ensures valid execution order
6. **Retry with context** - Failed attempts inform next attempt
7. **TDD enforcement** - Quality over speed
8. **Atomic state updates** - Corruption prevention
9. **Graceful degradation** - Don't corrupt state on errors
10. **Evidence-based completion** - Verification commands prove success

---

## Future Enhancements

**Not in initial version, but possible:**
1. Parallel goal execution (independent goals run simultaneously)
2. Goal templates library (common patterns like "setup backend", "add auth")
3. Cost estimation (predict time/complexity before execution)
4. Interactive debugging mode (pause execution, inspect state, resume)
5. Goal dependencies with version constraints ("requires backend >= v1.2.0")
6. Rollback capability (undo completed goal, restore previous state)
7. Multi-repository support (goals span multiple repos)
8. Cloud state sync (share state across machines)
9. Collaboration mode (multiple users working on different goals)
10. Analytics dashboard (execution time trends, failure patterns)

---

## Comparison to Existing Systems

**vs. Superpowers:**
- Superpowers: Single-goal workflows with human checkpoints
- AutoGoals: Multi-goal autonomous execution with verification gates

**vs. AutoGPT:**
- AutoGPT: Freeform goal pursuit with agent-generated subtasks
- AutoGoals: Structured goals with explicit dependencies and verification

**vs. GitHub Actions:**
- GitHub Actions: Event-driven CI/CD workflows
- AutoGoals: Long-running development workflows in local environment

**Unique Value:**
- Combines structured goal definition with autonomous AI execution
- Verification gates ensure quality without constant monitoring
- Resumable across sessions (unlike one-shot automation)
- Planning phase ensures understanding before execution

---

## Risks & Mitigations

**Risk 1: Agent gets stuck in infinite loop during execution**
- Mitigation: Max execution time per goal (4 hours default)

**Risk 2: Verification passes but goal isn't actually complete**
- Mitigation: User defines comprehensive acceptance_criteria and verification_commands

**Risk 3: State file gets corrupted**
- Mitigation: Automatic backups, validation before writes

**Risk 4: Dependencies create deadlock (all goals blocked)**
- Mitigation: Upfront topological sort, clear error messages with resolution options

**Risk 5: Git operations fail (disk full, permissions)**
- Mitigation: Try-catch around all git commands, graceful degradation, user notification

**Risk 6: User loses track of what agent is doing**
- Mitigation: Rich status dashboard, execution logs, commit messages

**Risk 7: Code quality suffers from autonomous execution**
- Mitigation: TDD enforcement in execution skill, code review in verification

---

## Appendix: Example goals.yaml Templates

### Full-Stack Application
```yaml
goals:
  - id: backend
    name: "Backend API"
    description: "Node.js + Express + PostgreSQL REST API"
    dependencies: []
    verification_commands: ["npm test", "npm run build"]
    max_retries: 2

  - id: frontend
    name: "React Frontend"
    description: "React + TypeScript + Tailwind"
    dependencies: ["backend"]
    verification_commands: ["npm test", "npm run build"]
    max_retries: 2

  - id: e2e
    name: "E2E Tests"
    description: "Playwright tests for critical flows"
    dependencies: ["backend", "frontend"]
    verification_commands: ["npm run test:e2e"]
    max_retries: 3
```

### DevOps Pipeline
```yaml
goals:
  - id: docker
    name: "Docker Setup"
    description: "Dockerfiles for all services"
    dependencies: []
    verification_commands: ["docker-compose build"]
    max_retries: 1

  - id: ci
    name: "CI Pipeline"
    description: "GitHub Actions for testing and building"
    dependencies: ["docker"]
    verification_commands: ["./test-ci-locally.sh"]
    max_retries: 2

  - id: cd
    name: "CD Pipeline"
    description: "Automated deployment to staging"
    dependencies: ["ci"]
    verification_commands: ["./test-deployment.sh"]
    max_retries: 2
```

---

## End of Design Document
