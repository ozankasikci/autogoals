---
name: goal-creator
description: Interactive wizard for creating goals.yaml files. Use when user runs /create command or asks to create a goals configuration file.
---

# Goal Creator - Interactive Wizard

## Overview

Interactive wizard that helps users create goals.yaml files through step-by-step prompts. Focuses on minimal viable goals to get users started quickly.

## When to Use

**Triggers:**
- User runs `/create` command
- User asks "create goals.yaml" or "set up goals"
- User mentions difficulty creating/writing goals configuration

**DO NOT use when:**
- goals.yaml already exists (suggest `/goals:add` instead - not implemented yet)
- User wants to edit existing goals (editing not supported yet)

## Wizard Flow

### Step 1: Introduction

```
I'll help you create a goals.yaml file for AutoGoals.

I'll ask you to describe each goal in plain language, and I'll handle all the technical details (IDs, verification commands, etc.).

How many goals do you want to define?
```

Wait for user response. Validate it's a positive number (1-20 recommended).

### Step 2: Collect Goals

For each goal (1 to N), ask **one question**:

#### The Only Question: What to Build
```
Goal {n}/{total}
-------------
What should be built for this goal?

Examples:
- "A React frontend with user authentication"
- "Node.js REST API with PostgreSQL database"
- "End-to-end tests for the critical user flows"
- "Deployment pipeline with Docker and CI/CD"

Be as specific or general as you like - I'll ask clarifying questions during the planning phase.
```

**Validation:**
- Must be at least 10 characters
- Accept any natural language description

**Generate Goal ID Automatically:**
- Extract key words from description
- Convert to kebab-case
- Examples:
  - "React frontend with authentication" → `frontend-auth`
  - "Node.js REST API" → `backend-api`
  - "End-to-end tests" → `e2e-tests`
  - "Deployment pipeline with Docker" → `deployment`
- Ensure uniqueness by appending `-2`, `-3` if needed
- Show the generated ID to user for confirmation

### Step 3: Generate YAML

After collecting all goals:

1. **Generate the YAML structure:**

```yaml
version: "1.0"
project_name: "{inferred from current directory name}"

goals:
  - id: "{goal1-id}"
    name: "{capitalize goal1-id}"
    description: |
      {user's description}
    dependencies: []
    acceptance_criteria:
      - "Goal implementation complete"
      - "Tests pass"
    verification_commands:
      - "npm test"
    max_retries: 100
    branch_name: "goal/{goal1-id}"

  - id: "{goal2-id}"
    name: "{capitalize goal2-id}"
    description: |
      {user's description}
    dependencies: []
    acceptance_criteria:
      - "Goal implementation complete"
      - "Tests pass"
    verification_commands:
      - "npm test"
    max_retries: 100
    branch_name: "goal/{goal2-id}"
```

**Defaults applied:**
- `version: "1.0"` (current schema version)
- `project_name`: basename of current directory
- `name`: Capitalize the goal ID (user only provides ID, not separate display name)
- `description`: Use exactly what the user provided
- `dependencies: []` (no dependencies by default)
- `acceptance_criteria`: Generic placeholder that Claude will refine during planning
- `verification_commands`: Simple default `["npm test"]` - Claude will determine appropriate commands during planning
- `max_retries: 100` (high retry count for autonomous debugging)
- `branch_name: "goal/{id}"` (auto-generated from ID)

**Important:** These are minimal placeholders. During the planning phase, Claude will:
- Ask clarifying questions about the implementation
- Determine appropriate verification commands
- Refine acceptance criteria based on the specific technology stack

2. **Write to goals.yaml:**

Use the Write tool to create `goals.yaml` in the current directory.

### Step 4: Validation

After writing the file:

1. **Import validation functions:**
   ```javascript
   import { parseGoalsConfig, validateDependencies } from './lib/goals-core.js'
   ```

2. **Run validation:**
   - Parse the YAML file
   - Validate dependencies (should pass - no dependencies yet)
   - Catch any errors

3. **Report results:**
   ```
   ✓ Created goals.yaml with {N} goals
   ✓ Validated configuration (no errors)
   ```

### Step 5: Show Summary

Display execution summary:

```
Execution order:
1. {goal1-id}
2. {goal2-id}
3. {goal3-id}

Dependencies: None detected (all goals are independent)

Configuration saved to: goals.yaml
```

### Step 6: Offer to Start

```
Ready to start goal execution? This will begin the planning phase for "{first-goal-id}".

[Yes - Start now] [No - I'll review the file first]
```

**If Yes:**
- Transition to goal-orchestrator skill
- Begin with first goal in execution order

**If No:**
- Exit gracefully
- Remind: "Run /start when you're ready to begin"

## Error Handling

### File Already Exists

If goals.yaml already exists:

```
⚠️ goals.yaml already exists in this directory.

Options:
1. Back up existing file and create new one
2. Cancel and manually edit the existing file

(Note: /goals:add for appending goals is not yet implemented)

What would you like to do? [Backup and create new] [Cancel]
```

### Validation Errors

If validation fails after creation:

```
⚠️ Created goals.yaml but found validation errors:
{error details}

The file has been created but may need manual fixes.
Would you like me to help fix these issues? [Yes] [No]
```

## Important Notes

- **One question at a time** - Don't ask multiple questions in one message
- **Validate input** - Check format before moving to next question
- **Be patient** - Let users think and respond
- **Show progress** - "Goal 2/5" helps users track progress
- **No dependencies** - Default to independent goals (simplifies first use)
- **Encourage starting** - Guide users to /start after creation

## Future Enhancements

NOT in current version:
- Dependency configuration during wizard
- Custom retry counts
- Custom branch naming
- Editing existing goals
- Adding goals to existing file
- Template selection

Keep it simple for v1!
