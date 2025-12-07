# AutoGoals Runner - System Design

**Date:** 2025-12-07
**Status:** Draft
**Version:** 1.0

## Vision

An open-source autonomous coding agent, similar to AutoGPT, that orchestrates multiple Claude Code sessions to complete complex development goals without manual intervention. Built in Rust for reliability and performance.

## Goals

- Enable developers to define coding goals and let Claude Code autonomously complete them
- Handle session lifecycle management (Claude Code has token/time limits)
- Provide visibility into autonomous execution through a simple TUI
- Maintain compatibility with existing AutoGoals `goals.yaml` format
- Create a tool that "just works" - leverages existing Claude Code configuration

## Non-Goals

- Building a new AI model or agent protocol
- Replacing Claude Code (this orchestrates it, not replaces it)
- Web-based or GUI interfaces (CLI/TUI only)
- Custom planning/execution logic (delegates to Claude Code + AutoGoals skill)

## Architecture Overview

### High-Level Components

```
┌─────────────────────────────────────────────────────┐
│                   CLI Layer                         │
│              (clap - argument parsing)              │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Orchestrator Core                      │
│  - Goals state management (parse goals.yaml)        │
│  - Session lifecycle decisions                      │
│  - Event coordination                               │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼────────┐
│ Session Manager│   │   TUI Layer     │
│ - Spawn claude │   │  (ratatui)      │
│ - Monitor I/O  │   │  - Live output  │
│ - Detect exit  │   │  - Controls     │
└───────┬────────┘   └─────────────────┘
        │
┌───────▼────────┐
│     Logger     │
│ - JSON events  │
│ - Session logs │
└────────────────┘
```

### Technology Stack

- **Language:** Rust (stable)
- **Async Runtime:** tokio
- **CLI Framework:** clap v4
- **TUI Library:** ratatui + crossterm
- **Serialization:** serde + serde_yaml
- **Logging:** tracing + tracing-subscriber
- **Process Management:** tokio::process

## Core Workflows

### 1. Initialization (`autogoals init`)

**User Experience:**
```bash
$ autogoals init
Welcome to AutoGoals! Let's set up your project.

? Project directory: (.)
? Create example goals.yaml? (Y/n) y

✓ Created goals.yaml
✓ Created .autogoals/ directory

Next steps:
1. Edit goals.yaml to define your goals
2. Run 'autogoals start' to begin autonomous execution
```

**Implementation:**
1. Interactive prompts using dialoguer crate
2. Generate `goals.yaml` template with example goals
3. Create `.autogoals/logs/` directory structure
4. Add `.autogoals/` to `.gitignore` if exists

### 2. Autonomous Execution (`autogoals start`)

**State Machine:**

```
                  ┌─────────────┐
                  │   START     │
                  └──────┬──────┘
                         │
                  ┌──────▼──────┐
                  │ Parse Goals │
                  └──────┬──────┘
                         │
                  ┌──────▼──────────┐
              ┌───┤ Has Pending     │
              │   │ Goals?          │
              │   └──────┬──────────┘
              │          │ Yes
              │   ┌──────▼──────────┐
              │   │ Spawn Claude    │
              │   │ Code Session    │
              │   └──────┬──────────┘
              │          │
              │   ┌──────▼──────────┐
              │   │ Monitor Session │
              │   └──────┬──────────┘
              │          │
              │   ┌──────▼──────────┐
              │   │ Session Exits   │
              │   └──────┬──────────┘
              │          │
              │   ┌──────▼──────────┐
              │   │ Update Goals    │
              │   │ State           │
              │   └──────┬──────────┘
              │          │
              │   ┌──────▼──────────┐
              │   │ Goal Failed?    │
              │   └──┬───────────┬──┘
              │      │ Yes       │ No
              │   ┌──▼──────┐    │
              │   │ Retry?  │    │
              │   └──┬──┬───┘    │
              │      │  │        │
              └──────┘  └────────┘
                         │
                  ┌──────▼──────┐
                  │   COMPLETE  │
                  └─────────────┘
```

**Session Spawning:**
```rust
// Conceptual - not actual code yet
let mut cmd = Command::new("claude");
cmd.arg("--non-interactive")  // if such flag exists
   .current_dir(&project_path);

// Pass context about current state
// Could be via file, stdin, or command args
// TBD based on Claude Code capabilities
```

### 3. Goals State Management

**goals.yaml Format** (existing AutoGoals format):
```yaml
goals:
  - id: "auth-system"
    description: "Implement user authentication"
    status: "completed"
    plan: |
      [detailed implementation plan]
    verification:
      - "npm test passes"
      - "build succeeds"

  - id: "frontend-ui"
    description: "Build dashboard UI"
    status: "in_progress"
    plan: |
      [detailed implementation plan]

  - id: "api-endpoints"
    description: "Create REST API"
    status: "pending"
```

**State Transitions:**
- `pending` → `ready_for_execution` (after planning)
- `ready_for_execution` → `in_progress` (session starts)
- `in_progress` → `ready_for_verification` (implementation done)
- `ready_for_verification` → `completed` (tests pass)
- Any → `failed` (errors occur)

**Persistence:**
- Parse YAML using `serde_yaml`
- Watch for file changes (session updates it)
- Re-read after each session exit
- Atomic writes to prevent corruption

### 4. Session Management

**Monitoring Strategy:**

Phase 1 (MVP): Basic process spawning
- Spawn `claude` command
- Pipe stdout/stderr to parent
- Wait for exit, check status code

Phase 2: Session continuity
- After exit, re-parse `goals.yaml`
- Check if work remains
- Spawn new session with context

Phase 6: Proactive monitoring
- Parse Claude output for signals:
  - Token usage warnings
  - "Task X complete, moving to Y"
  - Error patterns
- Gracefully handoff before hard limits

**Context Passing Between Sessions:**
```yaml
# Potential approach - add session metadata to goals.yaml
_session_history:
  - session_id: 1
    started_at: "2025-12-07T10:00:00Z"
    ended_at: "2025-12-07T10:45:00Z"
    goals_completed: ["auth-system", "frontend-ui"]
    exit_reason: "token_limit"
```

Or simpler: just rely on goal status and let Claude Code figure it out.

### 5. Error Handling

**Failure Categories:**

1. **Session Errors**
   - Claude Code crashes
   - Network issues with API
   - Invalid API key

   **Response:** Log error, retry with backoff (3 attempts)

2. **Goal Failures**
   - Tests don't pass
   - Build fails
   - Verification steps fail

   **Response (Phase 5):**
   - First failure: Retry immediately
   - Second failure: Pause, show error in TUI, await user input
   - User can: retry, skip goal, abort all

3. **System Errors**
   - Can't read goals.yaml
   - Can't spawn claude command
   - Disk full, permissions issues

   **Response:** Abort with clear error message

**Retry Logic:**
```rust
// Conceptual
struct RetryPolicy {
    max_attempts: u32,
    backoff: Duration,
}

// Session retry: 3 attempts, exponential backoff
// Goal retry: 1 auto + manual user decision
```

## User Interface

### Phase 1-3: CLI Only
Simple command-line output, no interactivity:
```
$ autogoals start
[INFO] Parsing goals.yaml
[INFO] Found 5 goals: 2 pending, 1 in_progress, 2 completed
[INFO] Spawning Claude Code session...
[Claude output streams here...]
[INFO] Session complete. 3/5 goals done.
[INFO] Spawning new session...
```

### Phase 4+: Simple TUI

**Layout:**
```
┌─ AutoGoals Runner ─────────────────────────────────────────┐
│ Goal 3/10: Implement user authentication                   │
│ Status: in_progress | Session: 2 | Uptime: 15m             │
├────────────────────────────────────────────────────────────┤
│ [Live Claude Code Output]                                  │
│                                                             │
│ > Executing goal: frontend-auth                            │
│ > Task 1/4: Creating auth components                       │
│ > ✓ Created LoginForm.tsx                                  │
│ > ✓ Created AuthProvider.tsx                               │
│ > Task 2/4: Writing tests                                  │
│ > Running: npm test                                        │
│ > ✓ Tests passing (4/4)                                    │
│ > ...                                                       │
│                                                             │
│ [Scrollable - last 50 lines]                               │
├────────────────────────────────────────────────────────────┤
│ [p]ause [r]esume [q]uit                                    │
└────────────────────────────────────────────────────────────┘
```

**Keyboard Controls:**
- `p` - Pause execution (graceful - finishes current task)
- `r` - Resume from pause
- `q` - Quit (asks for confirmation)
- `↑↓` - Scroll output
- `Ctrl-C` - Emergency stop

**Implementation:**
- `ratatui` for rendering
- `crossterm` for terminal control
- Separate thread for UI updates vs session monitoring
- Channel-based communication between threads

## Logging & Observability

### File Structure
```
.autogoals/
├── logs/
│   ├── events.jsonl           # Structured event log
│   ├── session-001.log        # Full session 1 output
│   ├── session-002.log        # Full session 2 output
│   └── summary.json           # Final execution summary
└── state/
    └── checkpoints/           # Optional: for future state snapshots
```

### Event Log Format (JSON Lines)
```jsonl
{"timestamp":"2025-12-07T10:00:00Z","event":"session_started","session_id":1}
{"timestamp":"2025-12-07T10:05:00Z","event":"goal_transition","goal_id":"auth-system","from":"pending","to":"in_progress"}
{"timestamp":"2025-12-07T10:30:00Z","event":"goal_completed","goal_id":"auth-system","duration_sec":1500}
{"timestamp":"2025-12-07T10:45:00Z","event":"session_ended","session_id":1,"reason":"token_limit","goals_completed":2}
{"timestamp":"2025-12-07T10:45:30Z","event":"session_started","session_id":2}
```

### Summary Report (generated at end)
```json
{
  "started_at": "2025-12-07T10:00:00Z",
  "completed_at": "2025-12-07T14:30:00Z",
  "total_duration_sec": 16200,
  "sessions": 4,
  "goals": {
    "total": 10,
    "completed": 8,
    "failed": 1,
    "skipped": 1
  },
  "estimated_cost_usd": 12.50
}
```

## Configuration

### User Configuration
**Location:** Uses existing Claude Code config (`~/.config/claude/`)

No separate API key or model config needed. If `claude` CLI works, AutoGoals works.

### Project Configuration
**Location:** `goals.yaml` in project root

This is the existing AutoGoals format - no new config file needed.

**Future:** Could add `.autogoals/config.toml` for advanced settings:
```toml
[execution]
max_retries = 3
session_timeout_minutes = 120

[monitoring]
enable_proactive_handoff = true
token_warning_threshold = 0.9

[tui]
refresh_rate_ms = 100
max_output_lines = 50
```

## Security & Safety

### API Key Safety
- Never log API keys
- Inherit from Claude Code's secure storage
- Don't pass keys as command-line args (visible in `ps`)

### Autonomous Execution Safety
- Always show what Claude is doing (via TUI)
- User can pause/stop at any time
- Verification steps required before marking goals complete
- Failed verifications pause for user review

### File System Safety
- All operations scoped to project directory
- Session logs written to `.autogoals/` (can be gitignored)
- No system-wide changes

## Implementation Phases

### Phase 1: Basic Runner (MVP)
**Scope:** Minimal viable execution
- `autogoals start` command
- Spawn single Claude Code session
- Wait for completion
- Exit with status

**Deliverables:**
- CLI binary with `start` command
- Process spawning logic
- Basic error handling

**Success Criteria:**
- Can execute `autogoals start` in a project with `goals.yaml`
- Claude Code runs and completes
- Program exits cleanly

---

### Phase 2: Session Continuity
**Scope:** Multi-session execution
- Parse `goals.yaml` state
- Loop: spawn session → wait → check status → repeat
- Continue until all goals complete

**Deliverables:**
- YAML parser for goals.yaml
- Session loop logic
- Goal completion detection

**Success Criteria:**
- Automatically spawns new sessions when work remains
- Stops when all goals are complete or failed
- Handles goals.yaml state correctly

---

### Phase 3: Logging & Observability
**Scope:** Track execution history
- Create `.autogoals/logs/` structure
- Write session outputs to files
- JSON event log
- Summary report generation

**Deliverables:**
- File-based logging system
- Event structs and serialization
- Summary report generation

**Success Criteria:**
- Session outputs saved to individual log files
- events.jsonl captures all state transitions
- summary.json generated at completion

---

### Phase 4: Simple TUI
**Scope:** Real-time visibility
- Basic ratatui interface
- Live output streaming
- Progress display
- Simple keyboard controls

**Deliverables:**
- TUI rendering loop
- Terminal event handling
- UI layout with 3 panels

**Success Criteria:**
- Shows current goal and progress
- Displays live Claude output
- Keyboard controls work (pause/resume/quit)

---

### Phase 5: Error Handling & Smart Retry
**Scope:** Graceful failure handling
- Detect goal failures
- Smart retry logic (1 auto + user decision)
- TUI error dialogs
- Retry/skip/abort controls

**Deliverables:**
- Failure detection from session output
- Retry counter in goals.yaml metadata
- Error UI in TUI
- User input handling for decisions

**Success Criteria:**
- Auto-retries once on goal failure
- Pauses and asks user on second failure
- Properly tracks retry counts
- Can skip failed goals and continue

---

### Phase 6: Proactive Session Management
**Scope:** Intelligent session transitions
- Parse Claude output for signals
- Detect token warnings
- Graceful task completion before handoff
- Pre-emptive new session spawning

**Deliverables:**
- Output parser for Claude signals
- Token usage tracking
- Graceful handoff logic
- Session transition coordinator

**Success Criteria:**
- Detects approaching token limits
- Allows current task to complete
- Spawns new session before crash
- No data/context loss in transitions

---

## Future Enhancements (Not in Scope)

### Parallel Goal Execution
- Execute independent goals concurrently
- Multiple Claude sessions running simultaneously
- Dependency graph between goals

### Cost Tracking & Budgets
- Track API costs per session
- Budget limits (stop if exceeds)
- Cost estimates before starting

### Distributed Execution
- Run sessions on different machines
- Cloud execution support
- Remote monitoring

### Advanced TUI Features
- Multiple tabs (one per active session)
- Log search and filtering
- Goal dependency visualization

## Open Questions

1. **Claude Code API Surface:**
   - Does Claude Code support `--non-interactive` mode?
   - How to pass initial context/instructions?
   - Can we get structured output about progress?

   **Resolution:** Test with Claude Code CLI to discover capabilities

2. **Context Passing:**
   - What's the best way to tell new session what was just completed?
   - Pass via stdin? File? Command args?

   **Resolution:** Start simple (rely on goals.yaml state), iterate based on results

3. **Goal Verification:**
   - Should we run verification commands ourselves, or trust Claude?
   - What if verification is expensive (long test suite)?

   **Resolution:** Phase 1: Trust Claude. Phase 5+: Add verification step

4. **Session Affinity:**
   - Should certain goals stick to same session?
   - How to handle if goal needs context from previous?

   **Resolution:** Start with sequential execution, add affinity if needed

## References

- [AutoGPT Project](https://github.com/Significant-Gravitas/AutoGPT)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [AutoGoals Skill](../../../superpowers/skills/collaboration/autogoals/)
- Existing goals.yaml format from Superpowers project

## Appendix: Example Session Flow

```
User: autogoals start

System:
1. Parse goals.yaml
   - Found 5 goals: 3 pending, 0 in_progress, 2 completed
2. Spawn Claude Code session #1
   - Pass project path: /Users/dev/myproject
   - Claude reads goals.yaml via AutoGoals skill
   - Claude starts working on first pending goal
3. Monitor session
   - Stream output to TUI
   - Log to session-001.log
   - Watch for completion/errors
4. Session exits (token limit after 2 goals)
5. Re-parse goals.yaml
   - Now 1 pending, 0 in_progress, 4 completed
6. Spawn Claude Code session #2
   - Same process, continues from state
7. Session completes (all goals done)
8. Generate summary report
9. Exit successfully

Total time: 45 minutes
Sessions: 2
Goals completed: 3/5
Goals previously completed: 2/5
```

---

**End of Design Document**
