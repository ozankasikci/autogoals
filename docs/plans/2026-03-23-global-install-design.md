# Global Install Design

## Goal

Make AutoGoals installable with a single command:

```bash
npm install -g autogoals
autogoals start
# Open http://localhost:17891
```

## Decisions

- **Port**: 17891 (fixed, avoids collisions with common dev ports like 5173, 4000, 3000)
- **Architecture**: Single process — one Express server serves both the API and the pre-built dashboard
- **Package name**: `autogoals` on npm (published from `packages/cli`)
- **Install UX**: `npm install -g autogoals` → `autogoals start`

## Package & Build

`packages/cli` becomes the published `autogoals` package.

`packages/cli/package.json`:
```json
{
  "name": "autogoals",
  "bin": { "autogoals": "dist/index.js" },
  "files": ["dist/"]
}
```

The publish build sequence (`build:publish` in root `package.json`):

1. Build dashboard with API URL baked in:
   `VITE_API_URL=http://localhost:17891 npm run build --workspace=packages/dashboard`
2. Copy dashboard static files into CLI package:
   `cp -r packages/dashboard/dist packages/cli/dist/public`
3. Bundle CLI + API with esbuild into single file:
   `esbuild packages/cli/src/index.ts --bundle --platform=node --outfile=packages/cli/dist/index.js`

Publishing:
```bash
cd packages/cli && npm publish
```

## Runtime — `autogoals start`

Single Express process on port **17891**:

| Route | Handler |
|-------|---------|
| `GET /` | Serves pre-built dashboard static files (`dist/public/`) |
| `POST /graphql` | GraphQL API |
| `WS /graphql` | WebSocket subscriptions (real-time agent output, chat) |
| `GET /health` | Health check |

Terminal output:
```
AutoGoals running at http://localhost:17891
Press Ctrl+C to stop.
```

## Constraints

- `better-sqlite3` has native bindings — cannot be bundled with esbuild. Stays as an external runtime dependency. Users need a compatible Node version (>=18).
- Claude Code CLI must be installed and authenticated separately (unchanged requirement).
