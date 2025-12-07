import { parseGoalsConfig, validateDependencies } from '../../lib/goals-core.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

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
