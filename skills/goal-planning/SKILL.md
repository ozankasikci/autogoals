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
