Show current AutoGoals execution status and progress.

**Usage:**
/autogoals:status

**What it shows:**
- Overall progress (X/Y goals completed)
- Status of each goal
- Current activity
- Last error (if any)
- Execution time

**Example:**
```bash
/autogoals:status
```

**Output:**
```
🎯 AutoGoals Status Report

Overall Progress: 2/5 goals completed (40%)

[✓] backend-structure    COMPLETED  (2h 15m)
[✓] frontend-app         COMPLETED  (1h 45m)
[→] e2e-tests           IN_PROGRESS (35m, retry 1/3)
[ ] admin-dashboard      PENDING    (waiting: e2e-tests)
[ ] deployment-pipeline  PENDING    (waiting: admin-dashboard)

Current Activity:
Running verification for 'e2e-tests'
Command: npm run test:e2e
Status: Running... (12 tests passed, 3 in progress)

Last Error (e2e-tests, retry 1):
Test 'user signup flow' failed: timeout waiting for element
Retrying with increased timeout configuration...
```
