# AutoGoals

Autonomous coding agent that orchestrates Claude Code sessions to complete complex development goals.

## Status

**Phase 1 (MVP)** - Basic runner implementation complete ✅

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

## Usage

### Phase 1: Basic Runner

Run autonomous goal execution in a project with a `goals.yaml` file:

```bash
# In a project directory with goals.yaml
autogoals start

# Or specify a path
autogoals start /path/to/project
```

**What it does:**
- Verifies `goals.yaml` exists
- Spawns a Claude Code session
- Waits for completion
- Exits with status

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
- [ ] **Phase 2: Session Continuity** - Multi-session execution with state management
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

Current architecture (Phase 1):
```
CLI → Verify goals.yaml → Spawn claude → Wait → Exit
```

Future phases will add session management, TUI, logging, and more.

## Contributing

This project is in early development. Contributions welcome!

## License

MIT
