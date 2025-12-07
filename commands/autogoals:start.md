Initialize AutoGoals system and begin executing goals defined in goals.yaml.

**Usage:**
/autogoals:start

**What it does:**
1. Validates goals.yaml exists
2. Parses and validates configuration
3. Checks dependency graph for cycles
4. Initializes .goals-state.json
5. Starts with first executable goal

**Example:**
```bash
/autogoals:start
```

**Output:**
```
🎯 AutoGoals System Initializing...

✓ Found goals.yaml
✓ Parsed configuration (5 goals)
✓ Validated dependencies (no cycles)
✓ Initialized state file

Execution order:
1. backend-structure
2. frontend-app
3. e2e-tests
4. admin-dashboard
5. deployment-pipeline

Starting with goal: backend-structure
Entering planning phase...
```
