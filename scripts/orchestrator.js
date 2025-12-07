#!/usr/bin/env node
/**
 * AutoGoals Orchestrator Script
 *
 * Enforces the correct execution flow:
 * 1. Plan ALL goals upfront
 * 2. Execute goals sequentially
 * 3. Continue until all complete or failure
 */

import { parseGoalsConfig, validateDependencies, loadState, saveState, getNextGoal } from '../lib/goals-core.js';
import { existsSync } from 'fs';
import { resolve } from 'path';

const GOALS_FILE = 'goals.yaml';
const STATE_FILE = '.goals-state.json';

async function main() {
  console.log('🎯 AutoGoals Orchestrator\n');

  // Step 1: Load configuration
  if (!existsSync(GOALS_FILE)) {
    console.error('❌ Error: goals.yaml not found in current directory');
    process.exit(1);
  }

  const config = parseGoalsConfig(GOALS_FILE);
  console.log(`✓ Loaded ${config.goals.length} goals from goals.yaml`);

  // Step 2: Validate dependencies
  try {
    const executionOrder = validateDependencies(config.goals);
    console.log(`✓ Validated dependencies`);
    console.log(`  Execution order: ${executionOrder.join(' → ')}\n`);
  } catch (error) {
    console.error(`❌ Dependency validation failed: ${error.message}`);
    process.exit(1);
  }

  // Step 3: Load or initialize state
  let state;
  if (existsSync(STATE_FILE)) {
    state = loadState(STATE_FILE);
    console.log(`✓ Loaded existing state`);
  } else {
    const { initializeState } = await import('../lib/goals-core.js');
    state = initializeState(config);
    saveState(STATE_FILE, state);
    console.log(`✓ Initialized fresh state`);
  }

  // Step 4: CRITICAL - Plan ALL pending goals upfront
  const pendingGoals = config.goals.filter(
    g => state.goals_status[g.id]?.status === 'pending'
  );

  if (pendingGoals.length > 0) {
    console.log(`\n📋 Planning Phase: ${pendingGoals.length} goals need planning`);
    console.log('───────────────────────────────────────────────────────');

    for (const goal of pendingGoals) {
      console.log(`\nPlanning: ${goal.id}`);
      console.log(`Description: ${goal.description.trim()}`);

      // Signal to Claude: Use goal-planning skill for this goal
      console.log(`\n[ORCHESTRATOR] PLAN_GOAL: ${goal.id}`);
      console.log('[ORCHESTRATOR] Waiting for planning to complete...\n');

      // In practice, Claude will see this and activate goal-planning skill
      // The script will be called again after planning completes

      // Check if this goal is still pending (planning not done yet)
      const currentState = loadState(STATE_FILE);
      if (currentState.goals_status[goal.id]?.status === 'pending') {
        console.log(`⏸️  Pausing orchestrator - waiting for goal-planning skill to complete`);
        console.log(`   Resume by running this script again after planning is done.\n`);
        process.exit(0); // Exit and wait for planning
      }
    }

    console.log('\n✅ All goals planned!\n');
  }

  // Step 5: Execute goals in loop
  console.log('🚀 Execution Phase');
  console.log('───────────────────────────────────────────────────────\n');

  let iteration = 0;
  const MAX_ITERATIONS = 1000; // Safety limit

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // Reload state (might have been updated by skills)
    state = loadState(STATE_FILE);

    // Get next executable goal
    const nextGoal = getNextGoal(config.goals, state);

    if (!nextGoal) {
      // No more executable goals - check why
      const completedCount = Object.values(state.goals_status)
        .filter(s => s.status === 'completed').length;
      const failedCount = Object.values(state.goals_status)
        .filter(s => s.status === 'failed').length;

      if (completedCount === config.goals.length) {
        console.log('\n🎉 SUCCESS! All goals completed!\n');
        printSummary(config.goals, state);
        process.exit(0);
      } else if (failedCount > 0) {
        console.log('\n❌ Execution stopped due to failed goal(s)\n');
        printSummary(config.goals, state);
        process.exit(1);
      } else {
        console.log('\n⏸️  No executable goals (waiting on dependencies)\n');
        printSummary(config.goals, state);
        process.exit(0);
      }
    }

    const goalStatus = state.goals_status[nextGoal.id];
    console.log(`\n▶ Next goal: ${nextGoal.id} (${goalStatus.status})`);

    // Delegate to appropriate skill based on status
    if (goalStatus.status === 'ready_for_execution') {
      console.log(`[ORCHESTRATOR] EXECUTE_GOAL: ${nextGoal.id}`);
      console.log('[ORCHESTRATOR] Delegating to goal-execution skill...\n');

      // Signal to Claude to use goal-execution skill
      // Script will be called again after execution
      console.log(`⏸️  Pausing orchestrator - waiting for goal-execution skill to complete\n`);
      process.exit(0);

    } else if (goalStatus.status === 'ready_for_verification') {
      console.log(`[ORCHESTRATOR] VERIFY_GOAL: ${nextGoal.id}`);
      console.log('[ORCHESTRATOR] Delegating to goal-verification skill...\n');

      // Signal to Claude to use goal-verification skill
      console.log(`⏸️  Pausing orchestrator - waiting for goal-verification skill to complete\n`);
      process.exit(0);

    } else {
      console.error(`\n❌ Unexpected goal status: ${goalStatus.status}`);
      process.exit(1);
    }
  }

  console.error('\n❌ Maximum iterations reached - possible infinite loop');
  process.exit(1);
}

function printSummary(goals, state) {
  console.log('Summary:');
  console.log('────────');

  for (const goal of goals) {
    const status = state.goals_status[goal.id];
    const icon = status.status === 'completed' ? '✓' :
                 status.status === 'failed' ? '✗' :
                 status.status === 'in_progress' ? '→' : ' ';

    console.log(`[${icon}] ${goal.id.padEnd(20)} ${status.status.toUpperCase()}`);
  }
  console.log('');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`\n❌ Orchestrator error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}
