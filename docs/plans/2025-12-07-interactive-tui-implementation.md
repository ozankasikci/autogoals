# Interactive TUI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive terminal UI using ink (React for CLIs) that displays running agents and allows drilling into their logs with keyboard navigation.

**Architecture:** SessionManager spawns and tracks multiple agents, each with a circular log buffer. TUI renders two views (agent list, log detail) using ink components, reading from shared agent state at 60fps.

**Tech Stack:** TypeScript, ink (React for CLIs), ink-spinner, Claude Agent SDK

---

## Task 1: Install Dependencies and Setup TUI Structure

**Files:**
- Modify: `package.json`
- Create: `src/tui/index.tsx`
- Create: `src/tui/types.ts`

**Step 1: Install ink dependencies**

Run:
```bash
cd /Users/ozan/Projects/autogoals-v2/.worktrees/interactive-tui
npm install ink ink-spinner react
npm install --save-dev @types/react
```

Expected: Dependencies installed successfully

**Step 2: Create TUI types file**

Create: `src/tui/types.ts`

```typescript
export interface AgentState {
  id: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  goalId: string;
  goalDescription: string;
  startedAt: Date;
  endedAt?: Date;
  logBuffer: string[];
  exitCode?: number;
}

export interface AppState {
  agents: AgentState[];
  selectedIndex: number;
  currentView: 'list' | 'detail';
  detailAgentId?: number;
}
```

**Step 3: Create basic TUI entry point**

Create: `src/tui/index.tsx`

```typescript
import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  projectPath: string;
}

export default function AutoGoalsTUI({ projectPath }: Props) {
  return (
    <Box flexDirection="column">
      <Text>AutoGoals TUI - {projectPath}</Text>
    </Box>
  );
}
```

**Step 4: Verify it compiles**

Run:
```bash
npm run build
```

Expected: TypeScript compilation successful

**Step 5: Commit**

```bash
git add package.json package-lock.json src/tui/
git commit -m "feat: add ink dependencies and TUI structure"
```

---

## Task 2: Create SessionManager to Track Agents

**Files:**
- Create: `src/session/SessionManager.ts`
- Create: `src/session/LogBuffer.ts`

**Step 1: Create LogBuffer circular buffer**

Create: `src/session/LogBuffer.ts`

```typescript
export class LogBuffer {
  private buffer: string[] = [];
  private readonly maxLines: number;

  constructor(maxLines: number = 1000) {
    this.maxLines = maxLines;
  }

  append(line: string): void {
    this.buffer.push(line);
    if (this.buffer.length > this.maxLines) {
      this.buffer.shift();
    }
  }

  getLines(): string[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}
```

**Step 2: Create SessionManager**

Create: `src/session/SessionManager.ts`

```typescript
import { AgentState } from '../tui/types.js';
import { LogBuffer } from './LogBuffer.js';

export class SessionManager {
  private agents: Map<number, AgentState> = new Map();
  private logBuffers: Map<number, LogBuffer> = new Map();
  private nextAgentId: number = 1;

  createAgent(goalId: string, goalDescription: string): number {
    const agentId = this.nextAgentId++;

    const agent: AgentState = {
      id: agentId,
      status: 'running',
      goalId,
      goalDescription,
      startedAt: new Date(),
      logBuffer: [],
    };

    this.agents.set(agentId, agent);
    this.logBuffers.set(agentId, new LogBuffer());

    return agentId;
  }

  appendLog(agentId: number, line: string): void {
    const buffer = this.logBuffers.get(agentId);
    if (buffer) {
      buffer.append(line);
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.logBuffer = buffer.getLines();
      }
    }
  }

  updateStatus(
    agentId: number,
    status: AgentState['status'],
    exitCode?: number
  ): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
      if (status === 'completed' || status === 'failed') {
        agent.endedAt = new Date();
      }
      if (exitCode !== undefined) {
        agent.exitCode = exitCode;
      }
    }
  }

  getAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: number): AgentState | undefined {
    return this.agents.get(agentId);
  }
}
```

**Step 3: Verify it compiles**

Run:
```bash
npm run build
```

Expected: TypeScript compilation successful

**Step 4: Commit**

```bash
git add src/session/
git commit -m "feat: add SessionManager and LogBuffer"
```

---

## Task 3: Create AgentListView Component

**Files:**
- Create: `src/tui/AgentListView.tsx`

**Step 1: Create AgentListView component**

Create: `src/tui/AgentListView.tsx`

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import { AgentState } from './types.js';

interface Props {
  agents: AgentState[];
  selectedIndex: number;
}

function getStatusColor(status: AgentState['status']): string {
  switch (status) {
    case 'running': return 'green';
    case 'completed': return 'gray';
    case 'failed': return 'red';
    case 'paused': return 'yellow';
  }
}

function formatDuration(start: Date, end?: Date): string {
  const endTime = end || new Date();
  const diff = Math.floor((endTime.getTime() - start.getTime()) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
}

export default function AgentListView({ agents, selectedIndex }: Props) {
  const runningCount = agents.filter(a => a.status === 'running').length;
  const completedCount = agents.filter(a => a.status === 'completed').length;
  const failedCount = agents.filter(a => a.status === 'failed').length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" borderColor="cyan" flexDirection="column">
        <Box paddingX={1}>
          <Text bold>AutoGoals - Agent Monitor</Text>
        </Box>
        <Box paddingX={1} paddingY={0}>
          <Text>
            {runningCount} agents running • {completedCount} completed • {failedCount} failed
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {agents.map((agent, index) => {
          const isSelected = index === selectedIndex;
          const duration = formatDuration(agent.startedAt, agent.endedAt);

          return (
            <Box key={agent.id} flexDirection="column" marginY={0}>
              <Box>
                <Text>{isSelected ? '> ' : '  '}</Text>
                <Text bold>{agent.id}</Text>
                <Text>  </Text>
                <Text color={getStatusColor(agent.status)} bold>
                  [{agent.status.toUpperCase()}]
                </Text>
                <Text>  Goal: {agent.goalDescription}</Text>
              </Box>
              <Box paddingLeft={4}>
                <Text dimColor>
                  {agent.endedAt ? `Duration: ${duration}` : `Started: ${duration}`}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor="gray">
        <Box paddingX={1}>
          <Text dimColor>↑↓: Navigate  Enter: View logs  q: Quit</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

**Step 2: Verify it compiles**

Run:
```bash
npm run build
```

Expected: TypeScript compilation successful

**Step 3: Commit**

```bash
git add src/tui/AgentListView.tsx
git commit -m "feat: add AgentListView component"
```

---

## Task 4: Create AgentDetailView Component

**Files:**
- Create: `src/tui/AgentDetailView.tsx`

**Step 1: Create AgentDetailView component**

Create: `src/tui/AgentDetailView.tsx`

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import { AgentState } from './types.js';

interface Props {
  agent: AgentState;
  scrollOffset: number;
}

function formatDuration(start: Date, end?: Date): string {
  const endTime = end || new Date();
  const diff = Math.floor((endTime.getTime() - start.getTime()) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export default function AgentDetailView({ agent, scrollOffset }: Props) {
  const duration = formatDuration(agent.startedAt, agent.endedAt);

  // Get visible log lines (last 20 lines, accounting for scroll)
  const visibleLines = agent.logBuffer.slice(
    Math.max(0, agent.logBuffer.length - 20 + scrollOffset),
    agent.logBuffer.length + scrollOffset
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" borderColor="cyan" flexDirection="column">
        <Box paddingX={1}>
          <Text bold>Agent #{agent.id} - {agent.goalDescription}</Text>
        </Box>
        <Box paddingX={1}>
          <Text>
            Status: <Text color="green">{agent.status.toUpperCase()}</Text>
            {' • '}
            {agent.endedAt ? `Duration: ${duration}` : `Started: ${duration} ago`}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1} height="100%">
        {visibleLines.length === 0 ? (
          <Text dimColor>No output yet...</Text>
        ) : (
          visibleLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))
        )}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor="gray">
        <Box paddingX={1}>
          <Text dimColor>↑↓: Scroll  Esc/q: Back to list</Text>
        </Box>
      </Box>
    </Box>
  );
}
```

**Step 2: Verify it compiles**

Run:
```bash
npm run build
```

Expected: TypeScript compilation successful

**Step 3: Commit**

```bash
git add src/tui/AgentDetailView.tsx
git commit -m "feat: add AgentDetailView component"
```

---

## Task 5: Wire Up TUI with Keyboard Navigation

**Files:**
- Modify: `src/tui/index.tsx`

**Step 1: Add state and navigation logic**

Modify: `src/tui/index.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Box, useInput, useApp } from 'ink';
import { AppState } from './types.js';
import AgentListView from './AgentListView.js';
import AgentDetailView from './AgentDetailView.js';
import { SessionManager } from '../session/SessionManager.js';

interface Props {
  projectPath: string;
  sessionManager: SessionManager;
}

export default function AutoGoalsTUI({ projectPath, sessionManager }: Props) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>({
    agents: [],
    selectedIndex: 0,
    currentView: 'list',
  });
  const [scrollOffset, setScrollOffset] = useState(0);

  // Refresh agent state at 60fps
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        agents: sessionManager.getAgents(),
      }));
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [sessionManager]);

  // Keyboard navigation
  useInput((input, key) => {
    if (state.currentView === 'list') {
      if (key.upArrow) {
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(0, prev.selectedIndex - 1),
        }));
      } else if (key.downArrow) {
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.agents.length - 1, prev.selectedIndex + 1),
        }));
      } else if (key.return) {
        const selectedAgent = state.agents[state.selectedIndex];
        if (selectedAgent) {
          setState(prev => ({
            ...prev,
            currentView: 'detail',
            detailAgentId: selectedAgent.id,
          }));
          setScrollOffset(0);
        }
      } else if (input === 'q') {
        exit();
      }
    } else if (state.currentView === 'detail') {
      if (key.upArrow) {
        setScrollOffset(prev => Math.min(0, prev + 1));
      } else if (key.downArrow) {
        setScrollOffset(prev => Math.max(-50, prev - 1));
      } else if (key.escape || input === 'q') {
        setState(prev => ({
          ...prev,
          currentView: 'list',
          detailAgentId: undefined,
        }));
        setScrollOffset(0);
      }
    }
  });

  if (state.currentView === 'detail' && state.detailAgentId) {
    const agent = state.agents.find(a => a.id === state.detailAgentId);
    if (agent) {
      return <AgentDetailView agent={agent} scrollOffset={scrollOffset} />;
    }
  }

  return <AgentListView agents={state.agents} selectedIndex={state.selectedIndex} />;
}
```

**Step 2: Verify it compiles**

Run:
```bash
npm run build
```

Expected: TypeScript compilation successful

**Step 3: Commit**

```bash
git add src/tui/index.tsx
git commit -m "feat: add keyboard navigation and state management"
```

---

## Task 6: Integrate TUI with Main CLI

**Files:**
- Modify: `src/index.ts`
- Create: `src/session/AgentRunner.ts`

**Step 1: Create AgentRunner to wrap Claude SDK**

Create: `src/session/AgentRunner.ts`

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { SessionManager } from './SessionManager.js';

export async function runAgent(
  sessionManager: SessionManager,
  agentId: number,
  projectPath: string,
  goalId: string,
  goalDescription: string
): Promise<void> {
  const prompt = `You are an autonomous coding agent working on a project with goals defined in goals.yaml.

CRITICAL INSTRUCTIONS - Follow these steps exactly:

1. READ goals.yaml to see all goals and their current status
2. FIND the goal with id "${goalId}"
3. WORK on that goal:
   - Update status to "in_progress" in goals.yaml
   - Implement the goal, write code, run tests, verify it works
4. UPDATE goals.yaml:
   - When complete, change status to "completed"
   - Use the Edit tool to update the status field

Goal to work on: ${goalDescription}

Start by reading goals.yaml now.`;

  try {
    const result = query({
      prompt,
      options: {
        cwd: projectPath,
        model: 'claude-sonnet-4-5-20250929',
        settingSources: ['project', 'local'],
      },
    });

    // Stream output to SessionManager
    for await (const message of result) {
      const output = JSON.stringify(message);
      sessionManager.appendLog(agentId, output);
    }

    sessionManager.updateStatus(agentId, 'completed', 0);
  } catch (error) {
    sessionManager.appendLog(agentId, `Error: ${error}`);
    sessionManager.updateStatus(agentId, 'failed', 1);
  }
}
```

**Step 2: Modify main CLI to use TUI**

Modify: `src/index.ts`

Add imports at top:
```typescript
import { render } from 'ink';
import AutoGoalsTUI from './tui/index.js';
import { SessionManager } from './session/SessionManager.js';
import { runAgent } from './session/AgentRunner.js';
```

Modify the `start` command action:
```typescript
program
  .command('start')
  .description('Start autonomous execution of goals')
  .argument('[path]', 'Project directory', '.')
  .option('--no-tui', 'Disable TUI, use plain output')
  .action(async (projectPath: string, options: { tui: boolean }) => {
    if (options.tui === false) {
      // Original plain output mode
      console.log(chalk.blue('🚀 AutoGoals Runner - TypeScript + Claude SDK'));
      console.log(chalk.gray(`📁 Project: ${projectPath}\n`));

      const goalsPath = join(projectPath, 'goals.yaml');
      if (!existsSync(goalsPath)) {
        console.error(chalk.red(`Error: No goals.yaml found in ${projectPath}`));
        process.exit(1);
      }

      let sessionNum = 1;
      while (true) {
        const goalsFile = parseGoals(goalsPath);
        const status = getGoalStatus(goalsFile);

        console.log(chalk.cyan(`📊 Goal Status: ${status.completed}/${status.total} completed, ${status.inProgress} in progress, ${status.pending} pending\n`));

        if (!hasPendingWork(goalsFile)) {
          console.log(chalk.green('🎉 All goals completed!\n'));
          break;
        }

        console.log(chalk.yellow(`🤖 Starting Claude Agent session #${sessionNum}...\n`));

        try {
          await runAgentSession(projectPath, sessionNum);
          console.log(chalk.green(`✅ Session #${sessionNum} completed\n`));
        } catch (error) {
          console.error(chalk.red(`⚠️  Session #${sessionNum} error:`), error);
          break;
        }

        sessionNum++;
      }

      console.log(chalk.green('✨ All goals completed successfully!\n'));
      return;
    }

    // TUI mode
    const goalsPath = join(projectPath, 'goals.yaml');
    if (!existsSync(goalsPath)) {
      console.error(chalk.red(`Error: No goals.yaml found in ${projectPath}`));
      process.exit(1);
    }

    const sessionManager = new SessionManager();

    // Start TUI
    const { waitUntilExit } = render(
      <AutoGoalsTUI projectPath={projectPath} sessionManager={sessionManager} />
    );

    // Spawn agents for pending goals
    const goalsFile = parseGoals(goalsPath);
    const pendingGoals = goalsFile.goals.filter(g => g.status === 'pending');

    // Start first agent
    if (pendingGoals.length > 0) {
      const goal = pendingGoals[0];
      const agentId = sessionManager.createAgent(goal.id, goal.description);
      runAgent(sessionManager, agentId, projectPath, goal.id, goal.description);
    }

    await waitUntilExit();
  });
```

**Step 3: Verify it compiles**

Run:
```bash
npm run build
```

Expected: TypeScript compilation successful

**Step 4: Commit**

```bash
git add src/index.ts src/session/AgentRunner.ts
git commit -m "feat: integrate TUI with main CLI"
```

---

## Task 7: Test TUI with Example Project

**Files:**
- Test in existing example project

**Step 1: Build the project**

Run:
```bash
npm run build
```

Expected: Build successful

**Step 2: Test with example project**

Run:
```bash
node dist/index.js start /Users/ozan/Projects/autogoals-v2/examples/1-hello-world
```

Expected: TUI launches, shows agent list, allows navigation

**Step 3: Test keyboard controls**

Actions:
1. Press ↑↓ to navigate agents
2. Press Enter to view logs
3. Press ↑↓ to scroll logs
4. Press Esc to go back to list
5. Press q to quit

Expected: All navigation works correctly

**Step 4: Verify and commit if all works**

```bash
git add .
git commit -m "test: verify TUI works with example project"
```

---

## Task 8: Add --no-tui Flag Documentation

**Files:**
- Modify: `README.md`

**Step 1: Update README with TUI documentation**

Add section to README.md:

```markdown
## Interactive TUI

AutoGoals now includes an interactive terminal UI (TUI) for monitoring agents in real-time.

### Usage

```bash
# Start with TUI (default)
autogoals start

# Start without TUI (plain output)
autogoals start --no-tui
```

### TUI Features

- **Agent List**: View all running, completed, and failed agents
- **Log Detail**: Drill into individual agent logs
- **Keyboard Navigation**:
  - `↑↓`: Navigate agents or scroll logs
  - `Enter`: View selected agent's logs
  - `Esc`/`q`: Go back or quit

### Visual States

- **Running**: Green highlight
- **Completed**: Gray with ✓
- **Failed**: Red with ✗
```

**Step 2: Commit documentation**

```bash
git add README.md
git commit -m "docs: add TUI documentation to README"
```

---

## Verification Checklist

After completing all tasks:

- [ ] TUI launches without errors
- [ ] Agent list displays correctly
- [ ] Keyboard navigation works (↑↓, Enter, Esc, q)
- [ ] Log detail view shows output
- [ ] Scrolling works in log view
- [ ] Can switch between agents
- [ ] --no-tui flag works for plain output
- [ ] Build passes: `npm run build`
- [ ] All code committed

## Notes

- Each agent runs independently with Claude Agent SDK
- Log buffer is capped at 1000 lines to prevent memory leaks
- TUI refreshes at 60fps for smooth updates
- Full logs still written to `.autogoals/logs/session-NNN.log`

---

**End of Implementation Plan**
