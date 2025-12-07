# Full-Stack Application Example

This example demonstrates using AutoGoals to build a complete full-stack application with 5 interconnected goals.

## Goals

1. **backend-structure** - Node.js + Express + TypeScript + PostgreSQL backend
2. **frontend-app** - React + Vite + Tailwind CSS frontend (depends on backend)
3. **e2e-tests** - Playwright E2E tests (depends on backend + frontend)
4. **admin-dashboard** - Admin panel (depends on backend)
5. **deployment-pipeline** - Docker + GitHub Actions deployment (depends on admin + e2e)

## Dependency Graph

```
backend-structure
├── frontend-app
│   └── e2e-tests ─┐
│                  ├─→ deployment-pipeline
└── admin-dashboard┘
```

## Usage

1. Copy `goals.yaml` to your project root
2. Start Claude Code in your project
3. AutoGoals will activate automatically
4. Or manually run: `/autogoals:start`

## Expected Timeline

- **backend-structure**: 2-3 hours autonomous work
- **frontend-app**: 1.5-2 hours autonomous work
- **e2e-tests**: 1-2 hours autonomous work
- **admin-dashboard**: 2-3 hours autonomous work
- **deployment-pipeline**: 1-1.5 hours autonomous work

**Total**: ~8-11 hours of autonomous implementation

## Customization

Edit `goals.yaml` to match your preferences:
- Change tech stack in descriptions
- Adjust acceptance criteria
- Modify verification commands
- Add/remove goals
