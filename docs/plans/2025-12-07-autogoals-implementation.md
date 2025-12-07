# AutoGoals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous long-term goal execution system as a Claude Code plugin that enables users to define multiple interconnected project goals in YAML and have Claude work autonomously for hours implementing them with interactive planning, autonomous execution, and automated verification.

**Architecture:** Skill-based Claude Code plugin with five core skills (orchestrator, planning, execution, verification, management) that work together through a state machine. Each goal progresses through pending → planning → executing → verifying → completed states, with git worktree isolation and verification gates with retry logic.

**Tech Stack:** Node.js ES modules, js-yaml for config parsing, git CLI for worktree management, bash for session hooks, markdown for skill documentation.

---

## Phase 1: Core Infrastructure (Foundation)

### Task 1: Core Library - Config Parsing

**Files:**
- Create: `lib/goals-core.js`
- Test: `tests/lib/goals-core.test.js`
- Example: `tests/fixtures/valid-goals.yaml`
- Example: `tests/fixtures/invalid-goals.yaml`

**Step 1: Write the failing test**

Create `tests/lib/goals-core.test.js`:

```javascript
import { parseGoalsConfig } from '../../lib/goals-core.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('parseGoalsConfig', () => {
  it('should parse valid goals.yaml', () => {
    const config = parseGoalsConfig('tests/fixtures/valid-goals.yaml');
    assert.strictEqual(config.version, '1.0');
    assert.strictEqual(config.goals.length, 2);
    assert.strictEqual(config.goals[0].id, 'backend');
    assert.deepStrictEqual(config.goals[0].dependencies, []);
  });

  it('should throw on invalid YAML syntax', () => {
    assert.throws(
      () => parseGoalsConfig('tests/fixtures/invalid-goals.yaml'),
      /Failed to parse goals\.yaml/
    );
  });
});
```

Create `tests/fixtures/valid-goals.yaml`:

```yaml
version: "1.0"
project_name: "test-project"

goals:
  - id: "backend"
    name: "Backend Setup"
    description: "Create backend"
    dependencies: []
    acceptance_criteria:
      - "npm test passes"
    verification_commands:
      - "npm test"
    max_retries: 2
    branch_name: "goal/backend"

  - id: "frontend"
    name: "Frontend Setup"
    description: "Create frontend"
    dependencies: ["backend"]
    acceptance_criteria:
      - "npm run build succeeds"
    verification_commands:
      - "npm run build"
    max_retries: 2
    branch_name: "goal/frontend"
```

Create `tests/fixtures/invalid-goals.yaml`:

```yaml
invalid: yaml: syntax:
  - unclosed bracket [
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/ozan/Projects/autogoals
npm install
npm test
```

Expected: FAIL with "Cannot find module '../../lib/goals-core.js'"

**Step 3: Write minimal implementation**

Create `lib/goals-core.js`:

```javascript
import fs from 'fs';
import yaml from 'js-yaml';

/**
 * Parse and validate goals.yaml configuration
 * @param {string} configPath - Path to goals.yaml
 * @returns {Object} Parsed configuration
 */
export function parseGoalsConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(content);

    // Basic validation
    if (!config.version) {
      throw new Error('Missing required field: version');
    }
    if (!config.goals || !Array.isArray(config.goals)) {
      throw new Error('Missing or invalid goals array');
    }

    return config;
  } catch (error) {
    if (error.name === 'YAMLException') {
      throw new Error(`Failed to parse goals.yaml: ${error.message}`);
    }
    throw error;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add lib/goals-core.js tests/
git commit -m "feat: add goals config parsing with validation"
```

---

### Task 2: Core Library - Dependency Validation

**Files:**
- Modify: `lib/goals-core.js`
- Modify: `tests/lib/goals-core.test.js`
- Create: `tests/fixtures/circular-deps.yaml`

**Step 1: Write the failing test**

Add to `tests/lib/goals-core.test.js`:

```javascript
import { validateDependencies } from '../../lib/goals-core.js';

describe('validateDependencies', () => {
  it('should return execution order for valid dependencies', () => {
    const goals = [
      { id: 'backend', dependencies: [] },
      { id: 'frontend', dependencies: ['backend'] },
      { id: 'e2e', dependencies: ['backend', 'frontend'] }
    ];
    const order = validateDependencies(goals);
    assert.deepStrictEqual(order, ['backend', 'frontend', 'e2e']);
  });

  it('should detect circular dependencies', () => {
    const goals = [
      { id: 'a', dependencies: ['b'] },
      { id: 'b', dependencies: ['a'] }
    ];
    assert.throws(
      () => validateDependencies(goals),
      /Circular dependency detected.*a.*b.*a/
    );
  });

  it('should detect unknown dependencies', () => {
    const goals = [
      { id: 'backend', dependencies: ['nonexistent'] }
    ];
    assert.throws(
      () => validateDependencies(goals),
      /Unknown dependency.*nonexistent/
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "validateDependencies is not a function"

**Step 3: Write minimal implementation**

Add to `lib/goals-core.js`:

```javascript
/**
 * Validate dependency graph and return topological sort order
 * @param {Array} goals - Array of goal objects
 * @returns {Array} - Goal IDs in valid execution order
 * @throws {Error} - On circular dependencies or unknown deps
 */
export function validateDependencies(goals) {
  const goalIds = new Set(goals.map(g => g.id));

  // Check for unknown dependencies
  for (const goal of goals) {
    for (const dep of goal.dependencies || []) {
      if (!goalIds.has(dep)) {
        throw new Error(`Goal '${goal.id}' depends on unknown goal '${dep}'`);
      }
    }
  }

  // Topological sort with cycle detection
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(goalId, path = []) {
    if (visiting.has(goalId)) {
      const cycle = [...path, goalId].join(' → ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }
    if (visited.has(goalId)) return;

    const goal = goals.find(g => g.id === goalId);
    visiting.add(goalId);

    for (const dep of goal.dependencies || []) {
      visit(dep, [...path, goalId]);
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

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS (5 tests total)

**Step 5: Commit**

```bash
git add lib/goals-core.js tests/
git commit -m "feat: add dependency validation with topological sort"
```

---

### Task 3: Core Library - State Management

**Files:**
- Modify: `lib/goals-core.js`
- Modify: `tests/lib/goals-core.test.js`

**Step 1: Write the failing test**

Add to `tests/lib/goals-core.test.js`:

```javascript
import { initializeState, loadState, saveState, updateGoalStatus } from '../../lib/goals-core.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('State Management', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autogoals-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize state from goals', () => {
    const goals = [
      { id: 'backend', dependencies: [] },
      { id: 'frontend', dependencies: ['backend'] }
    ];
    const state = initializeState(goals);

    assert.strictEqual(state.version, '1.0');
    assert.strictEqual(state.current_goal_id, 'backend');
    assert.strictEqual(state.goals_status.backend.status, 'pending');
    assert.strictEqual(state.goals_status.frontend.status, 'pending');
  });

  it('should save and load state', () => {
    const goals = [{ id: 'test', dependencies: [] }];
    const state = initializeState(goals);
    const statePath = join(tempDir, '.goals-state.json');

    saveState(statePath, state);
    const loaded = loadState(statePath);

    assert.deepStrictEqual(loaded, state);
  });

  it('should update goal status', () => {
    const state = {
      goals_status: {
        'backend': { status: 'pending' }
      },
      execution_log: []
    };

    const updated = updateGoalStatus('backend', 'in_progress', state);
    assert.strictEqual(updated.goals_status.backend.status, 'in_progress');
    assert.strictEqual(updated.execution_log.length, 1);
    assert.strictEqual(updated.execution_log[0].event, 'status_changed');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "initializeState is not a function"

**Step 3: Write minimal implementation**

Add to `lib/goals-core.js`:

```javascript
/**
 * Initialize fresh state from goals configuration
 * @param {Array} goals - Array of goal objects
 * @returns {Object} - Initial state object
 */
export function initializeState(goals) {
  const goalsStatus = {};

  for (const goal of goals) {
    goalsStatus[goal.id] = {
      status: 'pending'
    };
  }

  return {
    version: '1.0',
    current_goal_id: goals[0]?.id || null,
    goals_status: goalsStatus,
    execution_log: []
  };
}

/**
 * Load state from file
 * @param {string} statePath - Path to .goals-state.json
 * @returns {Object|null} - State object or null if not found
 */
export function loadState(statePath) {
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Save state to file with backup
 * @param {string} statePath - Path to .goals-state.json
 * @param {Object} state - State object to save
 */
export function saveState(statePath, state) {
  // Create backup if file exists
  if (fs.existsSync(statePath)) {
    fs.copyFileSync(statePath, `${statePath}.backup`);
  }

  // Write atomically
  const content = JSON.stringify(state, null, 2);
  fs.writeFileSync(statePath, content, 'utf8');
}

/**
 * Update goal status and log event
 * @param {string} goalId - Goal ID to update
 * @param {string} status - New status
 * @param {Object} state - Current state
 * @returns {Object} - Updated state
 */
export function updateGoalStatus(goalId, status, state) {
  const updated = JSON.parse(JSON.stringify(state)); // Deep clone

  updated.goals_status[goalId].status = status;
  updated.execution_log.push({
    timestamp: new Date().toISOString(),
    goal_id: goalId,
    event: 'status_changed',
    message: `Status changed to ${status}`
  });

  return updated;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add lib/goals-core.js tests/
git commit -m "feat: add state initialization, loading, and saving"
```

---

### Task 4: Core Library - Goal Selection

**Files:**
- Modify: `lib/goals-core.js`
- Modify: `tests/lib/goals-core.test.js`

**Step 1: Write the failing test**

Add to `tests/lib/goals-core.test.js`:

```javascript
import { getNextGoal, canExecuteGoal } from '../../lib/goals-core.js';

describe('Goal Selection', () => {
  it('should return first goal with no dependencies', () => {
    const goals = [
      { id: 'backend', dependencies: [] },
      { id: 'frontend', dependencies: ['backend'] }
    ];
    const state = {
      goals_status: {
        'backend': { status: 'pending' },
        'frontend': { status: 'pending' }
      }
    };

    const next = getNextGoal(goals, state);
    assert.strictEqual(next.id, 'backend');
  });

  it('should return goal after dependencies complete', () => {
    const goals = [
      { id: 'backend', dependencies: [] },
      { id: 'frontend', dependencies: ['backend'] }
    ];
    const state = {
      goals_status: {
        'backend': { status: 'completed' },
        'frontend': { status: 'pending' }
      }
    };

    const next = getNextGoal(goals, state);
    assert.strictEqual(next.id, 'frontend');
  });

  it('should return null when no goals eligible', () => {
    const goals = [
      { id: 'frontend', dependencies: ['backend'] }
    ];
    const state = {
      goals_status: {
        'frontend': { status: 'pending' }
      }
    };

    const next = getNextGoal(goals, state);
    assert.strictEqual(next, null);
  });

  it('should check if goal dependencies are satisfied', () => {
    const goals = [
      { id: 'backend', dependencies: [] },
      { id: 'frontend', dependencies: ['backend'] }
    ];
    const state = {
      goals_status: {
        'backend': { status: 'completed' },
        'frontend': { status: 'pending' }
      }
    };

    assert.strictEqual(canExecuteGoal('frontend', goals, state), true);

    state.goals_status.backend.status = 'pending';
    assert.strictEqual(canExecuteGoal('frontend', goals, state), false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "getNextGoal is not a function"

**Step 3: Write minimal implementation**

Add to `lib/goals-core.js`:

```javascript
/**
 * Check if a goal's dependencies are satisfied
 * @param {string} goalId - Goal ID to check
 * @param {Array} goals - All goals
 * @param {Object} state - Current state
 * @returns {boolean} - True if can execute
 */
export function canExecuteGoal(goalId, goals, state) {
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return false;

  for (const depId of goal.dependencies || []) {
    const depStatus = state.goals_status[depId]?.status;
    if (depStatus !== 'completed') {
      return false;
    }
  }

  return true;
}

/**
 * Get next executable goal
 * @param {Array} goals - All goals
 * @param {Object} state - Current state
 * @returns {Object|null} - Next goal or null
 */
export function getNextGoal(goals, state) {
  const eligibleStatuses = ['pending', 'retrying', 'ready_for_execution'];

  for (const goal of goals) {
    const status = state.goals_status[goal.id]?.status;

    if (eligibleStatuses.includes(status) && canExecuteGoal(goal.id, goals, state)) {
      return goal;
    }
  }

  return null;
}

/**
 * Get goal by ID
 * @param {string} goalId - Goal ID
 * @param {Array} goals - All goals
 * @returns {Object|null} - Goal object or null
 */
export function getGoalById(goalId, goals) {
  return goals.find(g => g.id === goalId) || null;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add lib/goals-core.js tests/
git commit -m "feat: add goal selection logic with dependency checking"
```

---

### Task 5: Git Operations Library

**Files:**
- Create: `lib/git-operations.js`
- Create: `tests/lib/git-operations.test.js`

**Step 1: Write the failing test**

Create `tests/lib/git-operations.test.js`:

```javascript
import { getWorktreePath, createWorktree, deleteWorktree, hasUncommittedChanges } from '../../lib/git-operations.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Git Operations', () => {
  let tempRepo;

  beforeEach(() => {
    tempRepo = mkdtempSync(join(tmpdir(), 'git-test-'));
    execSync('git init', { cwd: tempRepo });
    execSync('git config user.email "test@test.com"', { cwd: tempRepo });
    execSync('git config user.name "Test"', { cwd: tempRepo });
    execSync('echo "test" > README.md && git add . && git commit -m "init"', { cwd: tempRepo });
  });

  afterEach(() => {
    rmSync(tempRepo, { recursive: true, force: true });
  });

  it('should calculate worktree path', () => {
    const path = getWorktreePath('test-goal', '/Users/test/myproject');
    assert.strictEqual(path, '/Users/test/myproject-worktrees/test-goal');
  });

  it('should detect uncommitted changes', () => {
    assert.strictEqual(hasUncommittedChanges(tempRepo), false);

    execSync('echo "change" >> README.md', { cwd: tempRepo });
    assert.strictEqual(hasUncommittedChanges(tempRepo), true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "Cannot find module '../../lib/git-operations.js'"

**Step 3: Write minimal implementation**

Create `lib/git-operations.js`:

```javascript
import { execSync } from 'child_process';
import { dirname, join, basename } from 'path';
import fs from 'fs';

/**
 * Calculate worktree path for a goal
 * @param {string} goalId - Goal ID
 * @param {string} projectPath - Absolute path to project
 * @returns {string} - Worktree path
 */
export function getWorktreePath(goalId, projectPath) {
  const projectName = basename(projectPath);
  const parentDir = dirname(projectPath);
  return join(parentDir, `${projectName}-worktrees`, goalId);
}

/**
 * Create git worktree for a goal
 * @param {string} goalId - Goal ID
 * @param {string} branchName - Branch name
 * @param {string} projectPath - Project root path
 * @returns {string} - Worktree path
 */
export function createWorktree(goalId, branchName, projectPath) {
  const worktreePath = getWorktreePath(goalId, projectPath);

  // Create worktree directory structure if needed
  const worktreesDir = dirname(worktreePath);
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  try {
    execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
      cwd: projectPath,
      stdio: 'pipe'
    });
  } catch (error) {
    throw new Error(`Failed to create worktree: ${error.message}`);
  }

  return worktreePath;
}

/**
 * Delete git worktree
 * @param {string} worktreePath - Path to worktree
 * @param {string} branchName - Branch name to delete
 * @param {string} projectPath - Project root path
 */
export function deleteWorktree(worktreePath, branchName, projectPath) {
  try {
    execSync(`git worktree remove "${worktreePath}"`, {
      cwd: projectPath,
      stdio: 'pipe'
    });

    execSync(`git branch -D "${branchName}"`, {
      cwd: projectPath,
      stdio: 'pipe'
    });
  } catch (error) {
    throw new Error(`Failed to delete worktree: ${error.message}`);
  }
}

/**
 * Check for uncommitted changes
 * @param {string} repoPath - Repository path
 * @returns {boolean} - True if uncommitted changes exist
 */
export function hasUncommittedChanges(repoPath) {
  try {
    const output = execSync('git status --porcelain', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return output.trim().length > 0;
  } catch (error) {
    throw new Error(`Failed to check git status: ${error.message}`);
  }
}

/**
 * Commit changes
 * @param {string} message - Commit message
 * @param {string} repoPath - Repository path
 * @param {string} files - Files to add (default: '.')
 * @returns {string} - Commit hash
 */
export function commitChanges(message, repoPath, files = '.') {
  try {
    execSync(`git add ${files}`, { cwd: repoPath, stdio: 'pipe' });
    execSync(`git commit -m "${message}"`, { cwd: repoPath, stdio: 'pipe' });

    const hash = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();

    return hash;
  } catch (error) {
    throw new Error(`Failed to commit: ${error.message}`);
  }
}

/**
 * Merge branch to main
 * @param {string} branchName - Branch to merge
 * @param {string} projectPath - Project root path
 * @param {string} mainBranch - Main branch name (default: 'main')
 */
export function mergeBranch(branchName, projectPath, mainBranch = 'main') {
  try {
    execSync(`git checkout ${mainBranch}`, { cwd: projectPath, stdio: 'pipe' });
    execSync(`git merge ${branchName} --no-ff`, { cwd: projectPath, stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Failed to merge branch: ${error.message}`);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add lib/git-operations.js tests/
git commit -m "feat: add git worktree operations library"
```

---

## Phase 2: Skills Implementation

### Task 6: Goal Orchestrator Skill

**Files:**
- Create: `skills/goal-orchestrator/SKILL.md`

**Step 1: Create skill document**

Create `skills/goal-orchestrator/SKILL.md`:

```markdown
---
name: goal-orchestrator
description: Use when goals.yaml exists in project - orchestrates autonomous multi-goal execution with planning, implementation, and verification phases
---

# Goal Orchestrator

## Overview

Master orchestration skill that manages autonomous execution of multiple goals defined in goals.yaml. Automatically activates on session start when goals configuration is detected.

## When to Use

**Auto-activates when:**
- Session starts
- `goals.yaml` exists in project root
- `.goals-state.json` exists or needs initialization

**DO NOT use this skill manually.** It loads automatically via session hook.

## Responsibilities

1. **Detect and load configuration**
   - Check for `goals.yaml` in project root
   - Parse and validate configuration
   - Validate dependency graph (detect circular dependencies)

2. **Initialize or resume state**
   - Load `.goals-state.json` if exists
   - Initialize fresh state if missing
   - Validate state consistency

3. **Determine next goal**
   - Check dependency satisfaction
   - Find first eligible goal (pending/retrying/ready_for_execution)
   - Return null if no goals can execute

4. **Delegate to appropriate skill**
   - **pending** → Use goal-planning skill
   - **ready_for_execution** → Use goal-execution skill
   - **ready_for_verification** → Use goal-verification skill
   - **completed** → Move to next goal
   - **failed** → Stop and report

5. **Manage state transitions**
   - Update goal status as work progresses
   - Log events to execution_log
   - Save state after each transition

## Workflow

```
Session Start
  ↓
Load goals.yaml
  ↓
Validate dependencies
  ↓
Load/Initialize .goals-state.json
  ↓
Get next executable goal
  ↓
Delegate to skill based on status:
  - pending → goal-planning
  - ready_for_execution → goal-execution
  - ready_for_verification → goal-verification
  - completed → next goal
  - failed → stop
```

## Error Handling

**Configuration Errors:**
- Invalid YAML → Show parse error with line number
- Circular dependencies → Show dependency cycle
- Unknown dependencies → List unknown goal IDs
- Action: Stop execution, ask user to fix

**State File Corruption:**
- Offer to restore from .goals-state.json.backup
- Offer to reset to fresh state
- Action: Wait for user decision

**Git Errors:**
- Worktree creation fails → Check disk space and permissions
- Action: Mark goal as failed, stop execution

## Output Format

**On initialization:**
```
🎯 AutoGoals System Active

Goals Configuration:
- 5 goals defined
- Dependencies validated (no cycles)
- Execution order: backend → frontend → e2e-tests → admin → deploy

Current Status:
- backend: PENDING
- frontend: PENDING (waiting: backend)
- e2e-tests: PENDING (waiting: backend, frontend)
- admin: PENDING (waiting: backend)
- deploy: PENDING (waiting: admin)

Starting with goal: backend
Delegating to goal-planning skill...
```

**On resume:**
```
🎯 AutoGoals System Resuming

Progress: 2/5 goals completed (40%)
[✓] backend: COMPLETED
[✓] frontend: COMPLETED
[→] e2e-tests: IN_PROGRESS (retry 1/3)

Resuming goal: e2e-tests
Last error: Test timeout (will retry with adjusted config)
Delegating to goal-execution skill...
```

## Integration

**Called by:**
- Session hook (automatic on startup)

**Calls:**
- goal-planning (for pending goals)
- goal-execution (for ready_for_execution goals)
- goal-verification (for ready_for_verification goals)

## Implementation Notes

- Uses `lib/goals-core.js` for all config and state operations
- Never modifies goals.yaml (read-only)
- Always saves state before transitioning
- Graceful degradation on errors (don't corrupt state)
```

**Step 2: Commit**

```bash
git add skills/goal-orchestrator/SKILL.md
git commit -m "docs: add goal-orchestrator skill specification"
```

---

### Task 7: Goal Planning Skill

**Files:**
- Create: `skills/goal-planning/SKILL.md`

**Step 1: Create skill document**

Create `skills/goal-planning/SKILL.md`:

```markdown
---
name: goal-planning
description: Use when goal status is pending - conducts interactive Socratic planning session, creates detailed implementation plan, transitions goal to ready_for_execution
---

# Goal Planning

## Overview

Interactive planning skill that refines goal definitions into detailed implementation plans through Socratic questioning. Asks clarifying questions one at a time, creates comprehensive plan, saves to docs/goals/plans/{goal-id}-plan.md.

## When to Use

**Triggered when:**
- Goal status = "pending"
- Called by goal-orchestrator

**DO NOT use manually.** Orchestrator activates this skill.

## Process

### Phase 1: Read Goal Definition

```javascript
// Load from goals.yaml
const goal = {
  id: "backend-structure",
  name: "Setup Node.js Backend",
  description: "Create maintainable Node.js backend with Express, TypeScript, PostgreSQL",
  dependencies: [],
  acceptance_criteria: ["npm test passes", "npm run build succeeds"],
  verification_commands: ["npm install", "npm test", "npm run build"],
  max_retries: 2
};
```

### Phase 2: Ask Clarifying Questions

**One question at a time, Socratic method:**

1. **Architecture preferences**
   ```
   For the Node.js backend structure, which architecture would you prefer?

   A) Layered architecture (controllers → services → repositories)
   B) Feature-based modules (each feature is self-contained)
   C) Hexagonal architecture (ports and adapters)
   D) Other approach you have in mind?
   ```

2. **Tech stack details**
   ```
   For the PostgreSQL integration, which ORM would you like to use?

   A) Prisma (type-safe, modern)
   B) TypeORM (decorator-based)
   C) Sequelize (traditional)
   D) Raw SQL with pg library
   ```

3. **Testing approach**
   ```
   What testing strategy should we follow?

   A) Unit tests for all layers + integration tests for API
   B) Focus on integration tests, minimal unit tests
   C) E2E tests primarily
   D) Comprehensive coverage at all levels
   ```

**Continue until clear understanding of:**
- Directory structure
- File organization
- Testing strategy
- Third-party libraries
- Configuration approach

### Phase 3: Create Implementation Plan

**Format:**
```markdown
# {Goal Name} Implementation Plan

**Goal:** {One sentence}
**Architecture:** {Approach chosen}
**Tech Stack:** {Libraries/tools}

---

## Task 1: {Component}

**Files:**
- Create: exact/path/to/file.ts
- Test: tests/exact/path/test.ts

**Step 1: Write failing test**
```typescript
// Complete test code
```

**Step 2: Run test (verify RED)**
Command: npm test path/to/test.ts
Expected: FAIL with "{specific error}"

**Step 3: Write minimal implementation**
```typescript
// Complete implementation
```

**Step 4: Run test (verify GREEN)**
Command: npm test path/to/test.ts
Expected: PASS

**Step 5: Commit**
Command: git commit -m "feat: {description}"

---

{Repeat for each task}
```

### Phase 4: Save Plan

Save to: `docs/goals/plans/{goal-id}-plan.md`

### Phase 5: Transition State

```javascript
updateGoalStatus(goalId, 'ready_for_execution', state);
saveState('.goals-state.json', state);
```

### Phase 6: Ask for Approval

```
Implementation plan created: docs/goals/plans/backend-structure-plan.md

Plan includes:
- 15 tasks
- 23 files to create
- 18 test files
- Estimated completion: 2-3 hours autonomous work

Ready to begin autonomous implementation? (y/n)
```

**If yes:** Return control to orchestrator
**If no:** Ask what needs refinement, update plan

## Output Format

**Start:**
```
📋 Planning Goal: backend-structure

Reading goal definition...
- Dependencies: none
- Acceptance criteria: 3 items
- Max retries: 2

Beginning planning session...
```

**During questions:**
```
Question 1/5: Architecture preferences

For the Node.js backend structure, which architecture would you prefer?

A) Layered architecture (controllers → services → repositories)
B) Feature-based modules (each feature is self-contained)
C) Hexagonal architecture (ports and adapters)
D) Other approach you have in mind?
```

**After plan creation:**
```
✅ Plan Complete

Saved to: docs/goals/plans/backend-structure-plan.md

Summary:
- 15 tasks identified
- 23 files to create
- 18 test files
- TDD approach throughout

Ready to begin autonomous implementation? (y/n)
```

## Key Principles

- **One question at a time** - Never overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended
- **Complete code in plan** - Not pseudocode or "add validation"
- **Exact file paths** - Never "create appropriate test file"
- **TDD throughout** - Every task follows RED-GREEN-REFACTOR
- **YAGNI ruthlessly** - Remove unnecessary features

## Integration

**Called by:**
- goal-orchestrator (when goal status = pending)

**Updates:**
- Creates plan file in docs/goals/plans/
- Updates state: status = ready_for_execution
- Returns control to orchestrator
```

**Step 2: Commit**

```bash
git add skills/goal-planning/SKILL.md
git commit -m "docs: add goal-planning skill specification"
```

---

### Task 8: Goal Execution Skill

**Files:**
- Create: `skills/goal-execution/SKILL.md`

**Step 1: Create skill document**

Create `skills/goal-execution/SKILL.md`:

```markdown
---
name: goal-execution
description: Use when goal status is ready_for_execution - implements plan autonomously using TDD in isolated git worktree, commits regularly, transitions to ready_for_verification
---

# Goal Execution

## Overview

Autonomous implementation skill that executes the plan created by goal-planning. Works in isolated git worktree, follows TDD strictly, commits every 15 minutes or after task completion, runs without human intervention.

## When to Use

**Triggered when:**
- Goal status = "ready_for_execution"
- Called by goal-orchestrator
- Implementation plan exists at docs/goals/plans/{goal-id}-plan.md

**DO NOT use manually.** Orchestrator activates this skill.

## Process

### Phase 1: Setup Worktree

```javascript
import { createWorktree } from '../../lib/git-operations.js';

const worktreePath = createWorktree(
  goalId,              // 'backend-structure'
  goal.branch_name,    // 'goal/backend-structure'
  projectPath          // '/Users/ozan/Projects/myapp'
);

// Switch context to worktree
process.chdir(worktreePath);
```

### Phase 2: Load Implementation Plan

```javascript
const planPath = `docs/goals/plans/${goalId}-plan.md`;
const planContent = fs.readFileSync(planPath, 'utf8');

// Parse tasks from plan
const tasks = parsePlanTasks(planContent);
// Returns: [
//   { name: 'Task 1: Setup TypeScript', steps: [...] },
//   { name: 'Task 2: Express Server', steps: [...] }
// ]
```

### Phase 3: Execute Tasks (TDD Loop)

**For each task:**

```javascript
for (const task of tasks) {
  console.log(`\n▶ ${task.name}`);

  // Step 1: Write failing test
  writeFile(task.testFile, task.testCode);
  console.log(`  ✓ Test written: ${task.testFile}`);

  // Step 2: Run test - verify RED
  const redResult = runCommand(task.testCommand);
  if (redResult.exitCode === 0) {
    throw new Error('Test passed before implementation! Fix test.');
  }
  console.log(`  ✓ Test fails as expected: ${redResult.stderr}`);

  // Step 3: Write minimal implementation
  writeFile(task.implFile, task.implCode);
  console.log(`  ✓ Implementation written: ${task.implFile}`);

  // Step 4: Run test - verify GREEN
  const greenResult = runCommand(task.testCommand);
  if (greenResult.exitCode !== 0) {
    // Retry logic or mark for debugging
    throw new Error(`Test still failing: ${greenResult.stderr}`);
  }
  console.log(`  ✓ Test passes!`);

  // Step 5: Commit
  commitChanges(task.commitMessage, worktreePath);
  console.log(`  ✓ Committed: ${task.commitMessage}`);

  // Update progress in state
  logEvent({
    goal_id: goalId,
    event: 'task_completed',
    message: task.name
  });
}
```

### Phase 4: Final Verification

```javascript
// Run all tests in worktree
const allTestsResult = runCommand('npm test');

if (allTestsResult.exitCode === 0) {
  console.log('\n✅ All tests passing in worktree');
} else {
  console.log('\n⚠️ Some tests failing, will be caught in verification phase');
}
```

### Phase 5: Transition State

```javascript
updateGoalStatus(goalId, 'ready_for_verification', state);
saveState('.goals-state.json', state);
```

### Phase 6: Return to Main Directory

```javascript
// Switch back to main project
process.chdir(projectPath);

// Return control to orchestrator
// Orchestrator will trigger goal-verification next
```

## TDD Enforcement

**RED-GREEN-REFACTOR cycle is MANDATORY:**

1. **RED**: Write test, run it, **watch it fail**
   - If test passes → Error: "Test not testing the right thing"
   - Fix test and re-run until it fails correctly

2. **GREEN**: Write minimal code, run test, **watch it pass**
   - If test fails → Fix implementation (not test)
   - Keep trying until test passes

3. **REFACTOR**: Clean up code while keeping tests green
   - Extract functions
   - Improve names
   - Remove duplication
   - **Must keep all tests passing**

4. **COMMIT**: Save progress
   - Commit message format: `feat: {what was added}`
   - Include test files and implementation files

## Error Handling

**Test fails in RED phase (unexpected reason):**
```javascript
if (redResult.stderr.includes('syntax error')) {
  // Fix syntax, re-run
  fixSyntaxError(task.testFile);
  continue;
}
```

**Test fails in GREEN phase:**
```javascript
if (greenResult.exitCode !== 0) {
  // Log for debugging
  logEvent({
    goal_id: goalId,
    event: 'test_failure',
    message: `Task '${task.name}' test still failing after implementation`,
    details: greenResult.stderr
  });

  // Mark in state for verification phase to catch
  state.goals_status[goalId].last_error = {
    task: task.name,
    stderr: greenResult.stderr
  };
}
```

**Execution timeout (4 hours):**
```javascript
const MAX_EXECUTION_TIME = 4 * 60 * 60 * 1000; // 4 hours

if (Date.now() - startTime > MAX_EXECUTION_TIME) {
  logEvent({
    goal_id: goalId,
    event: 'execution_timeout',
    message: 'Goal execution exceeded 4 hours'
  });

  updateGoalStatus(goalId, 'failed', state);
  throw new Error('Execution timeout');
}
```

## Commit Strategy

**Frequency:**
- After every task completion (5-15 minutes per task)
- Every 15 minutes if task is long
- Before switching to verification phase

**Format:**
```bash
feat: add user authentication middleware

- Implement JWT token validation
- Add auth middleware to Express
- Tests for valid/invalid tokens

Task 4/12 complete
```

## Output Format

**Start:**
```
🔨 Executing Goal: backend-structure

Creating worktree...
  ✓ Worktree created: /Users/ozan/Projects/myapp-worktrees/backend-structure
  ✓ Branch: goal/backend-structure

Loading plan: docs/goals/plans/backend-structure-plan.md
  ✓ 15 tasks identified

Beginning autonomous implementation...
```

**During execution:**
```
▶ Task 3/15: Express Server Setup

  ✓ Test written: tests/server.test.ts
  ✓ Test fails as expected: "Cannot find module '../src/server'"
  ✓ Implementation written: src/server.ts
  ✓ Test passes!
  ✓ Committed: feat: add Express server with health endpoint

Progress: 3/15 tasks complete (20%)
Elapsed: 25 minutes
```

**Completion:**
```
✅ All Tasks Complete

Execution Summary:
- 15/15 tasks completed
- 32 files created
- 28 test files
- 47 commits
- Total time: 2h 15m

Switching to verification phase...
```

## Integration

**Called by:**
- goal-orchestrator (when status = ready_for_execution)

**Uses:**
- lib/git-operations.js (worktree management)
- lib/goals-core.js (state updates)

**Updates:**
- Creates git worktree
- Implements all tasks from plan
- Commits regularly
- Updates state: status = ready_for_verification
- Returns control to orchestrator
```

**Step 2: Commit**

```bash
git add skills/goal-execution/SKILL.md
git commit -m "docs: add goal-execution skill specification"
```

---

### Task 9: Goal Verification Skill

**Files:**
- Create: `skills/goal-verification/SKILL.md`

**Step 1: Create skill document**

Create `skills/goal-verification/SKILL.md`:

```markdown
---
name: goal-verification
description: Use when goal status is ready_for_verification - runs verification commands, handles retry logic, merges worktree on success, marks goal complete or failed
---

# Goal Verification

## Overview

Automated verification skill that runs verification commands from goals.yaml, implements retry logic with error context, merges successful implementations to main branch, and triggers next goal.

## When to Use

**Triggered when:**
- Goal status = "ready_for_verification"
- Called by goal-orchestrator
- Worktree exists for goal

**DO NOT use manually.** Orchestrator activates this skill.

## Process

### Phase 1: Load Verification Commands

```javascript
const goal = getGoalById(goalId, goals);
const commands = goal.verification_commands;
// Example: ["npm install", "npm run build", "npm test"]
```

### Phase 2: Switch to Worktree

```javascript
const worktreePath = getWorktreePath(goalId, projectPath);
process.chdir(worktreePath);
```

### Phase 3: Run Verification Commands

```javascript
const results = [];

for (const command of commands) {
  console.log(`▶ Running: ${command}`);

  const result = execSync(command, {
    cwd: worktreePath,
    encoding: 'utf8',
    timeout: 600000, // 10 minute timeout per command
    stdio: 'pipe'
  });

  results.push({
    command,
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  });

  if (result.status !== 0) {
    console.log(`✗ FAILED: ${command}`);
    console.log(`  Exit code: ${result.status}`);
    console.log(`  Error: ${result.stderr}`);
    break; // Stop on first failure
  } else {
    console.log(`✓ PASSED: ${command}`);
  }
}
```

### Phase 4: Handle Results

**All commands passed:**

```javascript
if (allPassed(results)) {
  console.log('\n✅ All verification commands passed');

  // Switch back to main project
  process.chdir(projectPath);

  // Merge worktree to main
  mergeBranch(goal.branch_name, projectPath, 'main');
  console.log(`✓ Merged ${goal.branch_name} to main`);

  // Delete worktree
  deleteWorktree(worktreePath, goal.branch_name, projectPath);
  console.log(`✓ Cleaned up worktree`);

  // Update state
  updateGoalStatus(goalId, 'completed', state);
  state.goals_status[goalId].completed_at = new Date().toISOString();
  saveState('.goals-state.json', state);

  // Trigger next goal
  console.log('\n🎯 Goal completed! Moving to next goal...');
  return 'trigger_next_goal';
}
```

**Some commands failed:**

```javascript
else {
  const failedCmd = results.find(r => r.exitCode !== 0);

  // Increment retry count
  const currentRetries = state.goals_status[goalId].retry_count || 0;
  const newRetries = currentRetries + 1;

  // Store error context
  state.goals_status[goalId].last_error = {
    command: failedCmd.command,
    exit_code: failedCmd.exitCode,
    stdout: failedCmd.stdout,
    stderr: failedCmd.stderr,
    timestamp: new Date().toISOString()
  };
  state.goals_status[goalId].retry_count = newRetries;

  // Check retry limit
  if (newRetries < goal.max_retries) {
    console.log(`\n⚠️ Verification failed (retry ${newRetries}/${goal.max_retries})`);
    console.log(`Failed command: ${failedCmd.command}`);
    console.log(`Error: ${failedCmd.stderr.substring(0, 200)}...`);

    // Return to execution phase with error context
    updateGoalStatus(goalId, 'executing', state);
    saveState('.goals-state.json', state);

    console.log('\n🔄 Retrying with error context...');
    return 'retry_execution';
  } else {
    console.log(`\n❌ Verification failed after ${goal.max_retries} retries`);

    // Mark as failed
    updateGoalStatus(goalId, 'failed', state);
    saveState('.goals-state.json', state);

    console.log('\n⛔ Goal execution stopped');
    return 'goal_failed';
  }
}
```

## Retry Logic with Context

When verification fails and retry is triggered:

1. **Error context is available** in state:
   ```javascript
   state.goals_status[goalId].last_error = {
     command: "npm test",
     exit_code: 1,
     stderr: "Test 'user signup' failed: timeout waiting for element",
     timestamp: "2025-12-07T15:30:00Z"
   }
   ```

2. **Execution skill receives this context** and can:
   - Analyze what went wrong
   - Adjust implementation approach
   - Fix specific failing tests
   - Add timeouts, retries, or configuration

3. **Fresh attempt with knowledge** of previous failure

## Timeout Handling

**Per-command timeout:**
```javascript
const COMMAND_TIMEOUT = 600000; // 10 minutes

try {
  execSync(command, { timeout: COMMAND_TIMEOUT });
} catch (error) {
  if (error.killed) {
    results.push({
      command,
      exitCode: -1,
      stderr: `Command timeout after ${COMMAND_TIMEOUT / 1000} seconds`
    });
  }
}
```

## Output Format

**Start:**
```
✓ Verification Phase: backend-structure

Worktree: /Users/ozan/Projects/myapp-worktrees/backend-structure
Commands to run: 3

Running verification...
```

**During:**
```
▶ Running: npm install
  ✓ PASSED (12.3s)

▶ Running: npm run build
  ✓ PASSED (8.7s)

▶ Running: npm test
  ✗ FAILED
  Exit code: 1
  Error: Test 'authentication' failed: Invalid token signature
```

**Success:**
```
✅ All verification commands passed

Merging to main...
  ✓ Merged goal/backend-structure to main
  ✓ Cleaned up worktree

Goal Status: COMPLETED
Execution time: 2h 15m
Commits: 47

🎯 Moving to next goal: frontend-app
```

**Retry:**
```
⚠️ Verification failed (retry 1/2)

Failed command: npm test
Error: Test 'authentication' failed: Invalid token signature

Retry count: 1/2
Previous attempts:
1. Failed at 2025-12-07T15:30:00Z - Invalid token signature

🔄 Retrying with error context...
Returning to execution phase...
```

**Failure:**
```
❌ Verification failed after 2 retries

Failed command: npm test
Final error: Test 'authentication' failed: Database connection refused

Retry history:
1. Invalid token signature
2. Database connection refused

Goal Status: FAILED

⛔ Execution stopped

Manual intervention required:
- Review worktree: /Users/ozan/Projects/myapp-worktrees/backend-structure
- Fix issues manually
- Run: /autogoals:reset backend-structure
```

## Integration

**Called by:**
- goal-orchestrator (when status = ready_for_verification)

**Uses:**
- lib/git-operations.js (merge, cleanup)
- lib/goals-core.js (state updates)

**Updates:**
- Runs verification commands
- Handles success: merge, cleanup, mark complete
- Handles failure: retry or fail
- Returns control to orchestrator

**Next steps:**
- Success → Orchestrator triggers next goal
- Retry → Orchestrator triggers execution again
- Failure → Orchestrator stops, reports to user
```

**Step 2: Commit**

```bash
git add skills/goal-verification/SKILL.md
git commit -m "docs: add goal-verification skill specification"
```

---

## Phase 3: Session Hook & Commands

### Task 10: Session Hook Implementation

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/session-start.sh`

**Step 1: Create hooks configuration**

Create `hooks/hooks.json`:

```json
{
  "SessionStart": {
    "command": "./hooks/session-start.sh",
    "description": "AutoGoals orchestrator bootstrap"
  }
}
```

**Step 2: Create session start hook**

Create `hooks/session-start.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Check if goals.yaml exists in current project
if [ -f "goals.yaml" ]; then
  # Load orchestrator skill
  orchestrator_content=$(cat "${PLUGIN_ROOT}/skills/goal-orchestrator/SKILL.md" 2>&1 || echo "Error reading goal-orchestrator skill")

  # Escape for JSON using pure bash
  escape_for_json() {
    local input="$1"
    local output=""
    local i char
    for (( i=0; i<${#input}; i++ )); do
      char="${input:$i:1}"
      case "$char" in
        $'\\') output+='\\\\' ;;
        '"') output+='\"' ;;
        $'\n') output+='\n' ;;
        $'\r') output+='\r' ;;
        $'\t') output+='\t' ;;
        *) output+="$char" ;;
      esac
    done
    printf '%s' "$output"
  }

  orchestrator_escaped=$(escape_for_json "$orchestrator_content")

  # Output context injection as JSON
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\n🎯 AutoGoals System Active\n\n${orchestrator_escaped}\n</EXTREMELY_IMPORTANT>"
  }
}
EOF
else
  # No goals.yaml, don't activate
  echo '{"hookSpecificOutput": null}'
fi

exit 0
```

**Step 3: Make hook executable**

```bash
chmod +x hooks/session-start.sh
```

**Step 4: Commit**

```bash
git add hooks/
git commit -m "feat: add session hook for auto-activation"
```

---

### Task 11: Slash Commands

**Files:**
- Create: `commands/goals-start.md`
- Create: `commands/goals-status.md`
- Create: `commands/goals-pause.md`
- Create: `commands/goals-resume.md`

**Step 1: Create start command**

Create `commands/goals-start.md`:

```markdown
Initialize AutoGoals system and begin executing goals defined in goals.yaml.

**Usage:**
/autogoals:start

**What it does:**
1. Validates goals.yaml exists
2. Parses and validates configuration
3. Checks dependency graph for cycles
4. Initializes .goals-state.json
5. Starts with first executable goal

**Example:**
```bash
/autogoals:start
```

**Output:**
```
🎯 AutoGoals System Initializing...

✓ Found goals.yaml
✓ Parsed configuration (5 goals)
✓ Validated dependencies (no cycles)
✓ Initialized state file

Execution order:
1. backend-structure
2. frontend-app
3. e2e-tests
4. admin-dashboard
5. deployment-pipeline

Starting with goal: backend-structure
Entering planning phase...
```
```

**Step 2: Create status command**

Create `commands/goals-status.md`:

```markdown
Show current AutoGoals execution status and progress.

**Usage:**
/autogoals:status

**What it shows:**
- Overall progress (X/Y goals completed)
- Status of each goal
- Current activity
- Last error (if any)
- Execution time

**Example:**
```bash
/autogoals:status
```

**Output:**
```
🎯 AutoGoals Status Report

Overall Progress: 2/5 goals completed (40%)

[✓] backend-structure    COMPLETED  (2h 15m)
[✓] frontend-app         COMPLETED  (1h 45m)
[→] e2e-tests           IN_PROGRESS (35m, retry 1/3)
[ ] admin-dashboard      PENDING    (waiting: e2e-tests)
[ ] deployment-pipeline  PENDING    (waiting: admin-dashboard)

Current Activity:
Running verification for 'e2e-tests'
Command: npm run test:e2e
Status: Running... (12 tests passed, 3 in progress)

Last Error (e2e-tests, retry 1):
Test 'user signup flow' failed: timeout waiting for element
Retrying with increased timeout configuration...
```
```

**Step 3: Create pause command**

Create `commands/goals-pause.md`:

```markdown
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
```

**Step 4: Create resume command**

Create `commands/goals-resume.md`:

```markdown
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
```

**Step 5: Commit**

```bash
git add commands/
git commit -m "feat: add slash commands for goal management"
```

---

## Phase 4: Testing & Documentation

### Task 12: Update package.json for Testing

**Files:**
- Modify: `package.json`

**Step 1: Add test script and dependencies**

Update `package.json`:

```json
{
  "name": "autogoals",
  "version": "0.1.0",
  "description": "Autonomous long-term goal execution system for Claude Code",
  "type": "module",
  "main": "lib/goals-core.js",
  "scripts": {
    "test": "node --test tests/**/*.test.js",
    "test:watch": "node --test --watch tests/**/*.test.js"
  },
  "keywords": [
    "claude-code",
    "plugin",
    "autonomous",
    "goals",
    "automation",
    "ai"
  ],
  "author": "Ozan",
  "license": "MIT",
  "dependencies": {
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {}
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add test scripts to package.json"
```

---

### Task 13: Create Example goals.yaml

**Files:**
- Create: `examples/fullstack-app/goals.yaml`
- Create: `examples/fullstack-app/README.md`

**Step 1: Create example directory**

```bash
mkdir -p examples/fullstack-app
```

**Step 2: Create example goals.yaml**

Create `examples/fullstack-app/goals.yaml`:

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

    dependencies: []

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

    dependencies: ["backend-structure"]

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

    max_retries: 3
    branch_name: "goal/e2e-tests"

  - id: "admin-dashboard"
    name: "Admin Dashboard"
    description: |
      Create admin dashboard for managing:
      - Users and permissions
      - Database records
      - Configuration settings
      - System monitoring

    dependencies: ["backend-structure"]

    acceptance_criteria:
      - "Dashboard accessible at /admin"
      - "All CRUD operations work"
      - "Tests pass"

    verification_commands:
      - "npm install"
      - "npm test"

    max_retries: 2
    branch_name: "goal/admin-dashboard"

  - id: "deployment-pipeline"
    name: "Deployment Pipeline"
    description: |
      Setup automated deployment:
      - Docker containers for all services
      - GitHub Actions for CI/CD
      - Deployment to staging environment

    dependencies: ["admin-dashboard", "e2e-tests"]

    acceptance_criteria:
      - "docker-compose up works"
      - "GitHub Actions workflow passes"

    verification_commands:
      - "docker-compose build"
      - "docker-compose up -d"
      - "docker-compose down"

    max_retries: 2
    branch_name: "goal/deployment-pipeline"
```

**Step 3: Create example README**

Create `examples/fullstack-app/README.md`:

```markdown
# Full-Stack Application Example

This example demonstrates using AutoGoals to build a complete full-stack application with 5 interconnected goals.

## Goals

1. **backend-structure** - Node.js + Express + TypeScript + PostgreSQL backend
2. **frontend-app** - React + Vite + Tailwind CSS frontend (depends on backend)
3. **e2e-tests** - Playwright E2E tests (depends on backend + frontend)
4. **admin-dashboard** - Admin panel (depends on backend)
5. **deployment-pipeline** - Docker + GitHub Actions deployment (depends on admin + e2e)

## Dependency Graph

```
backend-structure
├── frontend-app
│   └── e2e-tests ─┐
│                  ├─→ deployment-pipeline
└── admin-dashboard┘
```

## Usage

1. Copy `goals.yaml` to your project root
2. Start Claude Code in your project
3. AutoGoals will activate automatically
4. Or manually run: `/autogoals:start`

## Expected Timeline

- **backend-structure**: 2-3 hours autonomous work
- **frontend-app**: 1.5-2 hours autonomous work
- **e2e-tests**: 1-2 hours autonomous work
- **admin-dashboard**: 2-3 hours autonomous work
- **deployment-pipeline**: 1-1.5 hours autonomous work

**Total**: ~8-11 hours of autonomous implementation

## Customization

Edit `goals.yaml` to match your preferences:
- Change tech stack in descriptions
- Adjust acceptance criteria
- Modify verification commands
- Add/remove goals
```

**Step 4: Commit**

```bash
git add examples/
git commit -m "docs: add fullstack app example with goals.yaml"
```

---

### Task 14: Update Main README

**Files:**
- Modify: `README.md`

**Step 1: Update README with complete documentation**

Update `README.md`:

```markdown
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
/autogoals:start
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

### /autogoals:start
Initialize and begin goal execution

### /autogoals:status
Show progress dashboard:
```
Overall Progress: 2/5 goals completed (40%)

[✓] backend         COMPLETED  (2h 15m)
[✓] frontend        COMPLETED  (1h 45m)
[→] e2e-tests      IN_PROGRESS (35m, retry 1/3)
[ ] admin          PENDING    (waiting: e2e-tests)
[ ] deployment     PENDING    (waiting: admin)
```

### /autogoals:pause
Pause autonomous execution

### /autogoals:resume
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
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: complete README with usage and examples"
```

---

## Summary

This implementation plan provides:

**Phase 1: Core Infrastructure (Tasks 1-5)**
- Complete `lib/goals-core.js` with config parsing, dependency validation, state management, goal selection
- Complete `lib/git-operations.js` with worktree management
- Comprehensive test coverage

**Phase 2: Skills Implementation (Tasks 6-9)**
- goal-orchestrator skill (master coordinator)
- goal-planning skill (interactive Socratic planning)
- goal-execution skill (autonomous TDD implementation)
- goal-verification skill (automated testing with retry logic)

**Phase 3: Session Hook & Commands (Tasks 10-11)**
- Session hook for auto-activation
- Slash commands for manual control

**Phase 4: Testing & Documentation (Tasks 12-14)**
- Test infrastructure
- Example goals.yaml
- Complete README

Each task follows TDD: write failing test → verify RED → write code → verify GREEN → commit.

Total estimated effort: ~15-20 hours of implementation work.
