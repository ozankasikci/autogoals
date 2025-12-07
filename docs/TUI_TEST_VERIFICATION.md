# TUI Test Verification Document

This document outlines the manual testing procedure for the interactive TUI implementation. Since the TUI requires user interaction via keyboard controls, these tests must be performed manually.

## Build Status

- **Build Command**: `npm run build`
- **Build Status**: ✅ PASSED
- **Build Date**: 2025-12-07
- **All TypeScript files compiled successfully**

## Manual Test Procedures

### Test 1: TUI Launch

**Command**:
```bash
node dist/index.js start /Users/ozan/Projects/autogoals-v2/examples/1-hello-world
```

**Expected Behavior**:
- TUI launches without errors
- Agent Monitor header displays with cyan border
- Status summary shows: "X agents running • Y completed • Z failed"
- Bottom navigation bar shows: "↑↓: Navigate  Enter: View logs  q: Quit"

**Pass Criteria**:
- No error messages or exceptions
- UI renders cleanly without visual artifacts
- All UI elements are properly aligned and formatted

---

### Test 2: Agent List Navigation

**Prerequisites**: At least one agent is running or has completed

**Actions**:
1. Press ↓ (down arrow) to move selection down
2. Press ↑ (up arrow) to move selection up
3. Verify selection wraps/stops at boundaries

**Expected Behavior**:
- Selected agent is highlighted with "> " prefix
- Selection moves smoothly between agents
- Selection indicator updates immediately on keypress
- Cannot select beyond first/last agent

**Pass Criteria**:
- Selection moves correctly with arrow keys
- Visual indicator clearly shows selected agent
- No rendering glitches or delays

---

### Test 3: Agent Detail View

**Prerequisites**: At least one agent exists in the list

**Actions**:
1. Navigate to an agent using ↑↓
2. Press Enter to view agent logs
3. Verify detail view appears

**Expected Behavior**:
- View switches from list to detail view
- Agent header shows: "Agent #X - [Goal Description]"
- Status line shows current status and duration
- Log output appears in the main area (or "No output yet..." if empty)
- Bottom bar shows: "↑↓: Scroll  Esc/q: Back to list"

**Pass Criteria**:
- Smooth transition from list to detail view
- All agent information displays correctly
- Logs are readable and properly formatted

---

### Test 4: Log Scrolling

**Prerequisites**: Agent has generated log output (at least 20+ lines)

**Actions**:
1. Enter detail view for an agent with logs
2. Press ↓ to scroll down through logs
3. Press ↑ to scroll up through logs
4. Test scroll boundaries

**Expected Behavior**:
- Logs scroll smoothly with arrow keys
- Last 20 lines are visible at any time
- Scroll offset allows viewing earlier logs
- Cannot scroll beyond log buffer boundaries

**Pass Criteria**:
- Scrolling works in both directions
- Log content updates correctly
- No visual tearing or rendering issues

---

### Test 5: Navigation Between Views

**Actions**:
1. From list view, press Enter on an agent
2. From detail view, press Esc
3. Verify return to list view
4. From detail view, press 'q'
5. Verify return to list view

**Expected Behavior**:
- Enter key switches from list to detail
- Esc key returns from detail to list
- 'q' key returns from detail to list
- State is preserved when returning to list (same agent selected)

**Pass Criteria**:
- Both Esc and 'q' work to return to list
- Selection state is maintained
- No lag or rendering issues during transition

---

### Test 6: Quit Functionality

**Actions**:
1. From list view, press 'q'
2. Verify application exits cleanly

**Expected Behavior**:
- Application terminates immediately
- Terminal returns to normal state
- No error messages or warnings
- No zombie processes left running

**Pass Criteria**:
- Clean exit with exit code 0
- Terminal state restored properly

---

### Test 7: Real-time Updates

**Prerequisites**: At least one agent is actively running

**Actions**:
1. Launch TUI with a running agent
2. Observe status updates
3. Watch for log output appearing in real-time

**Expected Behavior**:
- Agent status updates automatically (~60fps)
- New log lines appear as agent produces output
- Duration counters update in real-time
- UI remains responsive during updates

**Pass Criteria**:
- Smooth, real-time updates visible
- No flickering or visual glitches
- Keyboard input remains responsive

---

### Test 8: Multiple Agents

**Prerequisites**: Multiple agents have been spawned

**Actions**:
1. Navigate between different agents in list view
2. View logs for multiple agents
3. Verify each agent's state is independent

**Expected Behavior**:
- Each agent shows correct status (running/completed/failed)
- Each agent has independent log buffer
- Navigation works correctly across all agents
- Status colors are correct (green=running, gray=completed, red=failed)

**Pass Criteria**:
- All agents display correctly
- Individual agent states are isolated
- Can view any agent's logs without interference

---

### Test 9: --no-tui Flag

**Command**:
```bash
node dist/index.js start /Users/ozan/Projects/autogoals-v2/examples/1-hello-world --no-tui
```

**Expected Behavior**:
- TUI does not launch
- Plain text output appears instead
- Original console-based progress display works
- All functionality works without TUI

**Pass Criteria**:
- Flag successfully disables TUI
- Fallback to plain output works correctly
- No TUI-related errors appear

---

## Status Colors Verification

Verify the following status color mappings:

- **Running**: Green text
- **Completed**: Gray text
- **Failed**: Red text
- **Paused**: Yellow text

---

## Edge Cases to Test

1. **No agents**: TUI launches with empty agent list
2. **Agent with no output**: Detail view shows "No output yet..."
3. **Very long goal descriptions**: Text wraps or truncates properly
4. **Rapid agent spawning**: UI updates correctly with quick changes
5. **Long-running agents**: Duration formatting works for hours/minutes/seconds

---

## Known Limitations

- Log buffer capped at 1000 lines (by design, prevents memory leaks)
- Detail view shows last 20 lines of logs
- Scroll offset limited to -50 lines in detail view

---

## Test Sign-off

**Tester**: ___________________
**Date**: ___________________
**Build Version**: ___________________

**Overall Status**: [ ] PASS  [ ] FAIL  [ ] PARTIAL

**Notes**:
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________

