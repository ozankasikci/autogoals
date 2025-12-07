# Interactive TUI for AutoGoals - Design Document

**Date:** 2025-12-07
**Status:** Design Approved
**Version:** 1.0

## Overview

Add an interactive terminal UI to AutoGoals that allows users to monitor multiple running agents, navigate between them, and view their logs in real-time.

## Goals

- Provide real-time visibility into all running agent sessions
- Allow users to drill into individual agent logs
- Keep the interface simple and keyboard-driven
- Maintain scrollable log history for debugging
- Show completed and failed agents alongside active ones

## User Experience

### Navigation Flow

1. User runs `autogoals start`
2. TUI launches showing list of all agents
3. User navigates with arrow keys, presses Enter to view logs
4. Log view shows scrollable output, Esc returns to list
5. Process continues until all goals complete or user quits

### Key Interactions

- **Arrow keys (↑↓)**: Navigate agent list or scroll logs
- **Enter**: View selected agent's logs
- **Esc / q**: Go back to list (from detail) or quit (from list)

## Architecture

### Component Structure

```
┌─────────────────────────────────────────────┐
│         autogoals start (main)              │
└─────────────┬───────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────────────┐  ┌────▼─────────────┐
│ Session Manager│  │   TUI Manager    │
│                │  │                  │
│ - Spawn agents │  │ - Render screens │
│ - Track state  │  │ - Handle input   │
│ - Stream logs  │◄─┤ - Update display │
└───┬────────────┘  └──────────────────┘
    │
┌───▼────────────────────────────────┐
│  Agent (Claude SDK session)        │
│  - Runs in background              │
│  - Streams output to buffer        │
│  - Updates status on completion    │
└────────────────────────────────────┘
```

### Design Decisions

1. **Session Manager** owns all agent processes and tracks their state in memory
2. **TUI Manager** reads state and renders UI (read-only, no complex sync)
3. **Agent output** buffered in memory (circular buffer, last 1000 lines per agent)
4. **Communication** via shared state (mutex-protected for simplicity)

## Data Structures

### Agent State

```typescript
interface AgentState {
  id: number;                    // Sequential: 1, 2, 3...
  status: 'running' | 'completed' | 'failed' | 'paused';
  goalId: string;                // From goals.yaml
  goalDescription: string;       // Human-readable goal
  startedAt: Date;
  endedAt?: Date;
  logBuffer: string[];           // Circular buffer, max 1000 lines
  exitCode?: number;
}

interface AppState {
  agents: AgentState[];          // All agents (current + historical)
  selectedIndex: number;         // For arrow key navigation
  currentView: 'list' | 'detail';
  detailAgentId?: number;        // Which agent's logs we're viewing
}
```

### Log Buffer Strategy

- Each agent maintains a circular buffer of last 1000 lines
- New output pushes old lines out (FIFO)
- When viewing logs, show most recent and allow scrolling up
- Keeps memory bounded even for long-running agents
- Full logs still written to `.autogoals/logs/session-NNN.log` files

### State Management

- Session Manager updates `AgentState` as agents spawn/complete
- TUI reads state at 60fps refresh rate
- Simple one-way data flow: SessionManager → TUI (read-only)
- No complex synchronization needed

## UI Design

### Screen 1: Agent List View

```
┌─ AutoGoals - Agent Monitor ────────────────────────────────┐
│ 3 agents running • 2 completed • 0 failed                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  > 1  [RUNNING]    Goal: Implement user authentication      │
│                    Started: 2m 34s ago                       │
│                                                              │
│    2  [RUNNING]    Goal: Build REST API endpoints           │
│                    Started: 1m 12s ago                       │
│                                                              │
│    3  [RUNNING]    Goal: Create database schema             │
│                    Started: 45s ago                          │
│                                                              │
│    4  [COMPLETED]  Goal: Setup project structure            │
│                    Duration: 3m 21s                          │
│                                                              │
│    5  [COMPLETED]  Goal: Install dependencies               │
│                    Duration: 1m 45s                          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ↑↓: Navigate  Enter: View logs  q: Quit                     │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Summary header showing counts by status
- Minimal info per agent: ID, status, goal, timing
- Visual indicator (>) for selected agent
- Completed/failed agents remain visible with final status

### Screen 2: Agent Log View

```
┌─ Agent #1 - Implement user authentication ─────────────────┐
│ Status: RUNNING • Started: 2m 34s ago                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Reading goals.yaml...                                        │
│ Found goal: Implement user authentication                    │
│ Updating status to in_progress...                           │
│                                                              │
│ Creating auth module structure...                           │
│ ✓ Created src/auth/login.ts                                 │
│ ✓ Created src/auth/register.ts                              │
│ ✓ Created src/auth/middleware.ts                            │
│                                                              │
│ Installing dependencies...                                   │
│ npm install bcrypt jsonwebtoken                             │
│ ✓ Dependencies installed                                    │
│                                                              │
│ Writing authentication logic...                              │
│ [Current position - auto-scrolls as new output arrives]     │
│                                                              │
│ [... scrollable buffer ...]                                 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ ↑↓: Scroll  Esc/q: Back to list                             │
└──────────────────────────────────────────────────────────────┘
```

**Features:**
- Agent info in header (ID, goal, status, timing)
- Scrollable log output (last 1000 lines)
- Auto-scrolls to bottom as new output arrives
- User can scroll up to view history

### Visual Styling

- **Running agents**: Green highlight
- **Completed**: Dim gray with ✓
- **Failed**: Red with ✗
- **Selected agent**: `>` indicator + inverted colors

## Implementation

### Technology Stack

**TUI Framework: ink** (React for CLIs)
- Familiar React patterns (components, hooks, state)
- Excellent TypeScript support
- Easy to build complex layouts
- Active maintenance and ecosystem

Alternative considered: `blessed` (more control, steeper learning curve)

### File Structure

```
src/
├── tui/
│   ├── index.tsx              # Main TUI entry point
│   ├── AgentListView.tsx      # Screen 1 component
│   ├── AgentDetailView.tsx    # Screen 2 component
│   └── useAgentState.ts       # Hook to read agent state
├── session/
│   ├── SessionManager.ts      # Spawns & tracks agents
│   ├── AgentRunner.ts         # Wraps Claude SDK query()
│   └── LogBuffer.ts           # Circular buffer for logs
└── index.ts                   # Modified to use TUI
```

### Event Flow

1. `autogoals start` spawns SessionManager
2. SessionManager reads goals.yaml, spawns first agent(s)
3. TUI renders, connects to SessionManager state
4. As agents output, logs flow into buffers
5. TUI re-renders at 60fps showing updates
6. User navigates with arrow keys, Enter switches views
7. When all agents complete, TUI shows final summary, waits for quit

### Modified CLI Command

```typescript
program
  .command('start')
  .option('--no-tui', 'Disable TUI, use plain output')
  .action(async (opts) => {
    if (opts.tui) {
      // Launch ink TUI
      render(<AutoGoalsTUI projectPath={path} />);
    } else {
      // Original plain output mode
      await runAgentSession(path, 1);
    }
  });
```

## Implementation Steps

1. Install dependencies: `ink`, `ink-spinner`, `ink-text-input`
2. Create SessionManager class to spawn and track agents
3. Implement LogBuffer circular buffer
4. Build AgentListView component
5. Build AgentDetailView component
6. Wire up navigation and state management
7. Add keyboard event handlers
8. Test with multiple concurrent agents

## Testing Strategy

- Test with 1, 5, 10 concurrent agents
- Verify log buffer doesn't leak memory
- Test scrolling with long outputs (>1000 lines)
- Verify state updates correctly when agents complete
- Test keyboard navigation edge cases (empty list, single agent)

## Future Enhancements

Not in initial scope, but potential additions:

- Pause/resume agents from TUI
- Search/filter logs
- Export logs from TUI
- Split-screen view (list + detail simultaneously)
- Agent resource usage (tokens, cost)

---

**End of Design Document**
