# Small Singularity — Design Spec

An autonomous project agent. You point it at a directory, describe what you want, and it interviews you, writes a spec, builds it, and stays around for follow-ups.

## Agent Lifecycle

### Phase 1: Interview
- Conversational question loop — one question at a time
- Reads the project directory first to understand existing state
- Uses web search when it needs domain knowledge
- Stops when it has enough info to write a spec

### Phase 2: Spec Generation
- Produces a structured spec document (`specs/project-spec.md`)
- Contains: project overview, formalized goals with acceptance criteria, execution order, technical decisions
- Presents to user for approval — revises until approved
- User's rough goals get turned into concrete, verifiable acceptance criteria

### Phase 3: Execution
- Processes goals sequentially in dependency order
- For each goal: plan → implement → verify (tests + self-review)
- Fully autonomous — no user interaction needed
- Failed goals get 2 retry attempts with different approaches, then marked `skipped`
- Full Claude Code toolset available (code, web, shell, services)
- Budget guardrails per goal and total

### Phase 4: Standby
- Agent stays alive after all goals complete (or fail)
- Waits for new instructions — add goals, ask questions, request changes
- Can loop back to interview or execution phases

## Architecture

### Project Structure

```
small-singularity/
├── src/
│   ├── index.ts                          # Entry point
│   │
│   ├── core/
│   │   ├── agent.ts                      # Phase transitions, lifecycle
│   │   ├── session.ts                    # Session create, resume, persist
│   │   └── types.ts                      # Shared types
│   │
│   ├── modules/
│   │   ├── interview/
│   │   │   ├── index.ts
│   │   │   ├── interview.phase.ts        # Question loop logic
│   │   │   ├── question-builder.ts       # Context-aware questions
│   │   │   └── types.ts
│   │   │
│   │   ├── spec/
│   │   │   ├── index.ts
│   │   │   ├── spec.phase.ts             # Generates spec, approval loop
│   │   │   ├── spec-writer.ts            # Renders spec to markdown
│   │   │   ├── spec-parser.ts            # Parses spec from markdown
│   │   │   └── types.ts
│   │   │
│   │   ├── execution/
│   │   │   ├── index.ts
│   │   │   ├── execution.phase.ts        # Goal-by-goal execution loop
│   │   │   ├── planner.ts               # Plans implementation for a single goal
│   │   │   ├── verifier.ts              # Tests + self-review verification
│   │   │   └── types.ts
│   │   │
│   │   ├── standby/
│   │   │   ├── index.ts
│   │   │   ├── standby.phase.ts          # Waits for new instructions
│   │   │   └── types.ts
│   │   │
│   │   ├── goals/
│   │   │   ├── index.ts
│   │   │   ├── tracker.ts               # Goal state machine
│   │   │   ├── store.ts                 # Persists goal state (pure functions)
│   │   │   └── types.ts
│   │   │
│   │   ├── logging/
│   │   │   ├── index.ts
│   │   │   ├── logger.ts                # Structured event emitter
│   │   │   ├── filters.ts              # Importance filtering
│   │   │   ├── formatters.ts           # Terminal formatting
│   │   │   └── types.ts
│   │   │
│   │   └── state/
│   │       ├── index.ts
│   │       ├── store.ts                 # Reads/writes state.json
│   │       └── types.ts
│   │
│   ├── sdk/
│   │   ├── index.ts
│   │   ├── client.ts                    # Wrapper around claude-agent-sdk
│   │   ├── message-handler.ts           # Processes SDK message stream
│   │   └── tool-config.ts              # Tool permissions config
│   │
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands.ts                  # CLI commands: start, resume, status
│   │   ├── prompts.ts                   # User input handling
│   │   └── output.ts                    # Terminal output helpers
│   │
│   └── config/
│       ├── index.ts
│       ├── defaults.ts
│       ├── loader.ts                    # Loads from file, env, CLI args
│       └── types.ts
│
├── specs/                               # Generated specs per project
├── logs/
├── tests/
│   ├── unit/                            # Mirrors src/modules/ structure
│   ├── integration/
│   └── fixtures/                        # Sample specs, mock SDK responses
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Module Dependency Rules

```
cli/ → core/ → modules/*
                  ↓
              sdk/ (only sdk/ talks to claude-agent-sdk)
```

No module imports another module's internals — only through `index.ts` barrels.

## Core Interfaces

### Phase Interface

```typescript
interface Phase {
  name: string;
  execute(context: AgentContext): Promise<PhaseResult>;
}

interface PhaseResult {
  next: 'interview' | 'spec' | 'execution' | 'standby' | 'done';
  data?: Record<string, unknown>;
}
```

### Agent Context

```typescript
interface AgentContext {
  config: AgentConfig;
  session: SessionManager;
  goals: GoalTracker;
  state: StateStore;
  logger: Logger;
  projectPath: string;
  spec: Spec | null;
}
```

### Goal Lifecycle

```
pending → active → verifying → done
                       ↓
                    failed → retrying → verifying
                                           ↓
                                        skipped
```

Max 2 retry attempts per goal before marking as `skipped`.

## SDK Integration

### Session Strategy

Each phase gets its own SDK session:

- **Interview** — single session, multi-turn with user
- **Spec** — new session, seeded with interview output
- **Execution** — one session per goal (focused context)
- **Standby** — new session, seeded with spec + completion summary

Sessions persist automatically via SDK. Crash recovery by resuming the last session.

### System Prompts Per Phase

- **Interview** → "You are gathering requirements. Ask one question at a time. Do not write code."
- **Spec** → "Write a project specification based on these requirements: ..."
- **Execution** → "Implement this goal: [goal]. Acceptance criteria: [criteria]. Full tool access."
- **Standby** → "You are an assistant for this project. The user may give you new tasks."

### Budget Management

```typescript
interface BudgetConfig {
  maxPerGoal: number;      // e.g., $2.00
  maxTotal: number;        // e.g., $20.00
  warningThreshold: number; // e.g., 0.8
}
```

Tracked in `state.json`. Goals exceeding budget are marked `failed` with reason `budget_exceeded`.

## Logging

### Filter Rules

| Event Type | Show? |
|---|---|
| Phase transition | Always |
| Goal start/complete/fail | Always |
| Package install | Always |
| File created | Always |
| Tests run | Always |
| Shell command failure | Always |
| File edited | Never |
| File read / grep / glob | Never |
| Shell command success | Only if meaningful output |

Filters are composable functions `(event: LogEvent) => boolean`.

## Tech Stack

- TypeScript, Node.js 18+
- `@anthropic-ai/claude-agent-sdk` for agent execution
- `vitest` for testing
- CLI-first interface (terminal stdin/stdout)

## Design Principles

- Phases implement a common interface — easy to add/reorder
- SDK is wrapped — never imported directly outside `sdk/`
- State is pure functions — easy to test
- Modules are self-contained with barrel exports
- YAGNI — start CLI-only, web UI can replace `cli/` module later
