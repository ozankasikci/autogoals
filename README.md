# AutoGoals

Autonomous coding agent that orchestrates Claude Code sessions to complete complex development goals.

## Status

**Phase 2: Session Continuity** - Complete ✅

## What is AutoGoals?

AutoGoals is an open-source tool inspired by AutoGPT, specifically designed to work with Claude Code. It enables autonomous execution of development goals by:

- Reading goals from a `goals.yaml` file
- Spawning Claude Code sessions to work on those goals
- Managing session lifecycle and continuity
- Providing visibility into autonomous execution

## Installation

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Claude Code](https://docs.anthropic.com/claude-code) installed and configured

### Build from source

```bash
git clone https://github.com/yourusername/autogoals.git
cd autogoals
cargo build --release
```

The binary will be available at `./target/release/autogoals`.

### Install locally

```bash
cargo install --path .
```

## Requirements

- **Docker Desktop** or **Docker Engine** - Required for container isolation
  - Install: https://docs.docker.com/get-docker/
  - AutoGoals runs agents in isolated Docker containers for safety and reproducibility

- **Node.js 18+** - For running AutoGoals CLI

## Docker Setup

AutoGoals uses Docker containers to isolate agent workspaces. Each workspace gets its own persistent container.

**First-time setup:**

```bash
# Build the base image (or pull from registry)
cd docker
docker build -t autogoals/devbox:latest .
```

**Container lifecycle:**

- `autogoals start` - Creates/reuses container for current workspace
- `autogoals stop` - Stops the workspace container
- `autogoals clean` - Removes stopped containers
- `autogoals doctor` - Diagnose Docker and container issues

**Environment variables:**

Create a `.env` file in your workspace with:

```
ANTHROPIC_API_KEY=your_api_key_here
```

AutoGoals automatically loads `.env` and passes variables to the container.

## Usage

Run autonomous goal execution in a project with a `goals.yaml` file:

```bash
# In a project directory with goals.yaml
autogoals start

# Or specify a path
autogoals start /path/to/project
```

**What it does (Phase 2):**
- Parses `goals.yaml` to check goal status
- Shows progress: X/Y goals completed
- Spawns Claude Code sessions automatically
- After each session, re-checks goals.yaml
- Continues spawning new sessions until all goals are complete
- Handles multi-session execution seamlessly

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

- **Running**: Green `[RUNNING]` status indicator
- **Completed**: Gray `[COMPLETED]` status indicator
- **Failed**: Red `[FAILED]` status indicator

## Goals File Format

AutoGoals uses the same `goals.yaml` format as the AutoGoals skill:

```yaml
goals:
  - id: "auth-system"
    description: "Implement user authentication"
    status: "pending"

  - id: "frontend-ui"
    description: "Build dashboard UI"
    status: "pending"
```

## Development Roadmap

- [x] **Phase 1: Basic Runner** - Single session execution
- [x] **Phase 2: Session Continuity** - Multi-session execution with state management
- [ ] **Phase 3: Logging** - Structured logs and session outputs
- [ ] **Phase 4: TUI** - Real-time terminal interface
- [ ] **Phase 5: Error Handling** - Smart retry and failure recovery
- [ ] **Phase 6: Proactive Sessions** - Intelligent session transitions

See [design document](docs/plans/2025-12-07-autogoals-runner-design.md) for complete details.

## Architecture

AutoGoals is built in Rust with:
- `clap` for CLI
- `tokio` for async runtime
- `anyhow` for error handling
- `serde` + `serde_yaml` for goals.yaml parsing

Current architecture (Phase 2):
```
CLI → Parse goals.yaml → Loop {
  Check goal status
  If work remains: Spawn claude session
  Wait for completion
  Re-parse goals.yaml
} → All goals complete
```

Future phases will add logging, TUI, error handling, and more.

## Contributing

This project is in early development. Contributions welcome!

## License

MIT
