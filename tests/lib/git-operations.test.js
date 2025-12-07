import { getWorktreePath, createWorktree, deleteWorktree, hasUncommittedChanges } from '../../lib/git-operations.js';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Git Operations', () => {
  let tempRepo;

  beforeEach(() => {
    tempRepo = mkdtempSync(join(tmpdir(), 'git-test-'));
    execSync('git init', { cwd: tempRepo });
    execSync('git config user.email "test@test.com"', { cwd: tempRepo });
    execSync('git config user.name "Test"', { cwd: tempRepo });
    execSync('echo "test" > README.md && git add . && git commit -m "init"', { cwd: tempRepo });
  });

  afterEach(() => {
    rmSync(tempRepo, { recursive: true, force: true });
  });

  it('should calculate worktree path', () => {
    const path = getWorktreePath('test-goal', '/Users/test/myproject');
    assert.strictEqual(path, '/Users/test/myproject-worktrees/test-goal');
  });

  it('should detect uncommitted changes', () => {
    assert.strictEqual(hasUncommittedChanges(tempRepo), false);

    execSync('echo "change" >> README.md', { cwd: tempRepo });
    assert.strictEqual(hasUncommittedChanges(tempRepo), true);
  });
});
