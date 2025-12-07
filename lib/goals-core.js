import fs from 'fs';
import yaml from 'js-yaml';

/**
 * Parse and validate goals.yaml configuration
 * @param {string} configPath - Path to goals.yaml
 * @returns {Object} Parsed configuration
 */
export function parseGoalsConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(content);

    // Basic validation
    if (!config.version) {
      throw new Error('Missing required field: version');
    }
    if (!config.goals || !Array.isArray(config.goals)) {
      throw new Error('Missing or invalid goals array');
    }

    return config;
  } catch (error) {
    if (error.name === 'YAMLException') {
      throw new Error(`Failed to parse goals.yaml: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate dependency graph and return topological sort order
 * @param {Array} goals - Array of goal objects
 * @returns {Array} - Goal IDs in valid execution order
 * @throws {Error} - On circular dependencies or unknown deps
 */
export function validateDependencies(goals) {
  const goalIds = new Set(goals.map(g => g.id));

  // Check for unknown dependencies
  for (const goal of goals) {
    for (const dep of goal.dependencies || []) {
      if (!goalIds.has(dep)) {
        throw new Error(`Unknown dependency '${dep}' in goal '${goal.id}'`);
      }
    }
  }

  // Topological sort with cycle detection
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(goalId, path = []) {
    if (visiting.has(goalId)) {
      const cycle = [...path, goalId].join(' → ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }
    if (visited.has(goalId)) return;

    const goal = goals.find(g => g.id === goalId);
    visiting.add(goalId);

    for (const dep of goal.dependencies || []) {
      visit(dep, [...path, goalId]);
    }

    visiting.delete(goalId);
    visited.add(goalId);
    sorted.push(goalId);
  }

  for (const goal of goals) {
    visit(goal.id);
  }

  return sorted;
}

/**
 * Initialize fresh state from goals configuration
 * @param {Array} goals - Array of goal objects
 * @returns {Object} - Initial state object
 */
export function initializeState(goals) {
  const goalsStatus = {};

  for (const goal of goals) {
    goalsStatus[goal.id] = {
      status: 'pending'
    };
  }

  return {
    version: '1.0',
    current_goal_id: goals[0]?.id || null,
    goals_status: goalsStatus,
    execution_log: []
  };
}

/**
 * Load state from file
 * @param {string} statePath - Path to .goals-state.json
 * @returns {Object|null} - State object or null if not found
 */
export function loadState(statePath) {
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Save state to file with backup
 * @param {string} statePath - Path to .goals-state.json
 * @param {Object} state - State object to save
 */
export function saveState(statePath, state) {
  // Create backup if file exists
  if (fs.existsSync(statePath)) {
    fs.copyFileSync(statePath, `${statePath}.backup`);
  }

  // Write atomically
  const content = JSON.stringify(state, null, 2);
  fs.writeFileSync(statePath, content, 'utf8');
}

/**
 * Update goal status and log event
 * @param {string} goalId - Goal ID to update
 * @param {string} status - New status
 * @param {Object} state - Current state
 * @returns {Object} - Updated state
 */
export function updateGoalStatus(goalId, status, state) {
  const updated = JSON.parse(JSON.stringify(state)); // Deep clone

  updated.goals_status[goalId].status = status;
  updated.execution_log.push({
    timestamp: new Date().toISOString(),
    goal_id: goalId,
    event: 'status_changed',
    message: `Status changed to ${status}`
  });

  return updated;
}
