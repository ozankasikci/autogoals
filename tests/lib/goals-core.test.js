import { parseGoalsConfig } from '../../lib/goals-core.js';
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
