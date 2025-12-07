# Docker Container Workspace Isolation - Design Document

**Date:** 2025-12-07
**Status:** Design Approved
**Version:** 1.0

## Overview

Add Docker container support to AutoGoals, giving each workspace its own isolated, persistent container. This provides isolation, reproducibility, and safety for autonomous agent operations.

## Goals

- **Isolation** - Separate each project's dependencies and environment
- **Reproducibility** - Consistent environment across different machines
- **Safety** - Sandbox agent operations to prevent affecting host system
- **Persistence** - Reuse containers across runs to preserve dependencies

## Architecture

### Container-per-Workspace Model

When `autogoals start` runs in a directory:

1. **Generate container name** from directory path
   - Format: `autogoals-<dirname>-<hash>`
   - Hash uses absolute path for uniqueness
   - Example: `/tmp/my-project` → `autogoals-my-project-a1b2c3d4`

2. **Container lifecycle**
   - If exists and running: attach to it
   - If exists but stopped: start it, then attach
   - If doesn't exist: create new container

3. **Container configuration**
   - Base image: `autogoals/devbox:latest` (custom image with dev tools)
   - Workspace bind mount: Host directory → `/workspace` in container
   - Working directory: `/workspace`
   - Network: Full internet access
   - Entrypoint: `tail -f /dev/null` (keeps container alive)

4. **Execution flow**
   - AutoGoals runs `docker exec` to spawn Claude Code inside container
   - Claude Code reads goals.yaml, executes tasks, writes files
   - All file operations happen in `/workspace` (bind-mounted host directory)
   - Container stays running when AutoGoals exits

## Container Lifecycle Management

### Initial Setup (First Run)

```bash
docker run -d \
  --name autogoals-myproject-abc123 \
  --label autogoals.workspace=/path/to/project \
  --label autogoals.created=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
  -v /path/to/project:/workspace \
  -w /workspace \
  --env-file .env \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  autogoals/devbox:latest \
  tail -f /dev/null
```

### Subsequent Runs

1. **Lookup**: `docker ps -a --filter label=autogoals.workspace=/path/to/project`
2. **Start if stopped**: `docker start <container-name>`
3. **Verify health**: Check container is running before attaching

### Container State Tracking

AutoGoals maintains state in `.autogoals/container.json`:

```json
{
  "containerId": "abc123",
  "containerName": "autogoals-myproject-abc123",
  "createdAt": "2025-12-07T10:00:00Z",
  "lastUsed": "2025-12-07T10:30:00Z"
}
```

### Cleanup Commands

- `autogoals stop` - Stops the workspace container
- `autogoals clean` - Removes stopped containers
- `autogoals clean --all` - Removes all AutoGoals containers

## Claude Code Integration

### Base Image Setup

The `autogoals/devbox` Docker image includes:

```dockerfile
FROM node:20-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    build-essential \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code-cli

# Install Claude Agent SDK
RUN npm install -g @anthropic-ai/claude-agent-sdk

WORKDIR /workspace
```

### Execution Method

```typescript
// In src/session/AgentRunner.ts
async function runAgent(
  sessionManager: SessionManager,
  agentId: number,
  projectPath: string,
  goalId: string,
  goalDescription: string
): Promise<void> {
  // Get or create container for this workspace
  const containerName = await getOrCreateContainer(projectPath);

  // Build prompt
  const prompt = `...`;

  // Execute Claude Code inside container
  const result = await executeInContainer(containerName, {
    command: 'claude-code',
    args: ['query', '--prompt', prompt, '--cwd', '/workspace'],
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    }
  });

  // Stream output back to TUI
  for await (const message of result) {
    const output = formatMessage(message);
    if (output) {
      sessionManager.appendLog(agentId, output);
    }
  }
}
```

### Key Changes

- Current: Claude SDK `query()` runs directly on host with `cwd` option
- New: `query()` wrapped in `docker exec` to run inside container
- Agent sees filesystem from container perspective (`/workspace`)
- All tool calls (Read, Write, Edit, Bash) execute inside container
- Output streams back to host for TUI display

## Environment & Configuration

### Environment Variable Handling

**Priority order (highest to lowest):**
1. `.env` file in workspace (if exists)
2. Host environment variables
3. Default values

**Implementation:**

```typescript
function loadEnvironment(projectPath: string): Record<string, string> {
  const envFile = join(projectPath, '.env');
  const env: Record<string, string> = {};

  // Start with host environment
  if (process.env.ANTHROPIC_API_KEY) {
    env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }

  // Override with .env file if exists
  if (existsSync(envFile)) {
    const envContent = readFileSync(envFile, 'utf-8');
    const parsed = parseEnvFile(envContent);
    Object.assign(env, parsed);
  }

  return env;
}
```

### Configuration Files

- `.env` - Environment variables (API keys, tokens)
- `.autogoals/config.json` - AutoGoals settings
- `Dockerfile.autogoals` - Custom base image (optional override)

**Example `.autogoals/config.json`:**

```json
{
  "docker": {
    "baseImage": "autogoals/devbox:latest",
    "memory": "2g",
    "cpus": "2.0",
    "network": "bridge"
  }
}
```

### Security Considerations

- `.env` should be in `.gitignore` (AutoGoals warns if not)
- API keys never logged or displayed in TUI
- Container isolation prevents access to host filesystem outside workspace

## Error Handling & Edge Cases

### Common Error Scenarios

**1. Docker Not Running**
```
Error: Docker daemon not found
AutoGoals requires Docker to run agents in isolated containers.
Please start Docker Desktop or install Docker Engine.
```

**2. Container Creation Fails**
```
Error: Failed to create container autogoals-myproject-abc123
Reason: Insufficient memory available
Try: docker system prune or increase Docker memory limit
```

**3. Container Becomes Unresponsive**
```
Warning: Container not responding after 30s
Actions:
  [1] Restart container
  [2] Remove and recreate
  [3] Continue anyway
```

**4. Port Conflicts**
- If agent starts services, ports might conflict
- Solution: Use dynamic port allocation, log to `.autogoals/ports.json`

**5. Workspace Path Changes**
- If directory moved/renamed, container lookup fails
- Solution: Check Docker labels, offer to update or recreate

### Recovery Mechanisms

- Preserve `.autogoals/` directory with state
- Log all docker commands to `.autogoals/logs/docker.log`
- `autogoals doctor` command to diagnose issues

## Implementation Steps

### Phase 1: Docker Infrastructure (Foundation)

1. **Create `autogoals/devbox` Docker image**
   - Dockerfile with node, python, git, build-essential
   - Pre-install Claude Code CLI and Agent SDK
   - Publish to Docker Hub or GitHub Container Registry

2. **Build Docker manager module** (`src/docker/ContainerManager.ts`)
   - `getOrCreateContainer(projectPath)` - Main entry point
   - `createContainer(name, config)` - Create new container
   - `startContainer(name)` - Start stopped container
   - `executeInContainer(name, command)` - Run commands inside
   - `listContainers()` - List all AutoGoals containers
   - `removeContainer(name)` - Remove container

### Phase 2: Integration with AutoGoals

3. **Update `AgentRunner.ts` to use containers**
   - Replace direct `query()` calls with containerized execution
   - Stream output from container back to SessionManager

4. **Update CLI commands**
   - `autogoals init` - Creates `.autogoals/` and `.env.example`
   - `autogoals start` - Uses container execution
   - Add `autogoals stop` - Stops workspace container
   - Add `autogoals clean [--all]` - Cleanup unused containers
   - Add `autogoals doctor` - Diagnose Docker issues

### Phase 3: Configuration & Polish

5. Environment variable loading from `.env`
6. Container state tracking (`.autogoals/container.json`)
7. Configuration file support (`.autogoals/config.json`)
8. Error handling and recovery mechanisms

### Phase 4: Testing & Documentation

9. Test with multiple concurrent containers
10. Test container persistence across runs
11. Update README with Docker requirements
12. Add troubleshooting guide

## File Structure

```
src/
├── docker/
│   ├── ContainerManager.ts      # Container lifecycle management
│   ├── DockerClient.ts           # Docker API wrapper
│   └── ImageBuilder.ts           # Build autogoals/devbox image
├── session/
│   ├── AgentRunner.ts            # Updated to use containers
│   ├── SessionManager.ts         # Unchanged
│   └── LogBuffer.ts              # Unchanged
└── index.ts                      # Add new CLI commands

docker/
└── Dockerfile                    # autogoals/devbox image definition
```

## Testing Strategy

- Test container creation and reuse
- Test with multiple concurrent workspaces
- Test container persistence across AutoGoals restarts
- Test error scenarios (Docker not running, insufficient resources)
- Test environment variable loading from .env
- Test cleanup commands

## Future Enhancements

Not in initial scope, but potential additions:

- Custom Dockerfile per workspace (`Dockerfile.autogoals`)
- Resource limits per container (memory, CPU)
- Docker Compose integration for multi-container setups
- Container snapshots/checkpoints
- Cross-platform support (Windows, macOS, Linux variations)

---

**End of Design Document**
