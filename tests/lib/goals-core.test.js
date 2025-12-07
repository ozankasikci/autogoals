import { parseGoalsConfig, validateDependencies, initializeState, loadState, saveState, updateGoalStatus } from '../../lib/goals-core.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('parseGoalsConfig', () => {
  it('should parse valid goals.yaml', () => {
    const config = parseGoalsConfig('tests/fixtures/valid-goals.yaml');
    assert.strictEqual(config.version, '1.0');
    assert.strictEqual(config.goals.length, 2);
    assert.strictEqual(config.goals[0].id, 'backend');
    assert.deepStrictEqual(config.goals[0].dependencies, []);
  });

  it('should throw on invalid YAML syntax', () => {
    assert.throws(
      () => parseGoalsConfig('tests/fixtures/invalid-goals.yaml'),
      /Failed to parse goals\.yaml/
    );
  });
});

describe('validateDependencies', () => {
  it('should return execution order for valid dependencies', () => {
    const goals = [
      { id: 'backend', dependencies: [] },
      { id: 'frontend', dependencies: ['backend'] },
      { id: 'e2e', dependencies: ['backend', 'frontend'] }
    ];
    const order = validateDependencies(goals);
    assert.deepStrictEqual(order, ['backend', 'frontend', 'e2e']);
  });

  it('should detect circular dependencies', () => {
    const goals = [
      { id: 'a', dependencies: ['b'] },
      { id: 'b', dependencies: ['a'] }
    ];
    assert.throws(
      () => validateDependencies(goals),
      /Circular dependency detected.*a.*b.*a/
    );
  });

  it('should detect unknown dependencies', () => {
    const goals = [
      { id: 'backend', dependencies: ['nonexistent'] }
    ];
    assert.throws(
      () => validateDependencies(goals),
      /Unknown dependency.*nonexistent/
    );
  });
});

describe('State Management', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'autogoals-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize state from goals', () => {
    const goals = [
      { id: 'backend', dependencies: [] },
      { id: 'frontend', dependencies: ['backend'] }
    ];
    const state = initializeState(goals);

    assert.strictEqual(state.version, '1.0');
    assert.strictEqual(state.current_goal_id, 'backend');
    assert.strictEqual(state.goals_status.backend.status, 'pending');
    assert.strictEqual(state.goals_status.frontend.status, 'pending');
  });

  it('should save and load state', () => {
    const goals = [{ id: 'test', dependencies: [] }];
    const state = initializeState(goals);
    const statePath = join(tempDir, '.goals-state.json');

    saveState(statePath, state);
    const loaded = loadState(statePath);

    assert.deepStrictEqual(loaded, state);
  });

  it('should update goal status', () => {
    const state = {
      goals_status: {
        'backend': { status: 'pending' }
      },
      execution_log: []
    };

    const updated = updateGoalStatus('backend', 'in_progress', state);
    assert.strictEqual(updated.goals_status.backend.status, 'in_progress');
    assert.strictEqual(updated.execution_log.length, 1);
    assert.strictEqual(updated.execution_log[0].event, 'status_changed');
  });
});
