import { execSync } from 'child_process';
import { dirname, join, basename } from 'path';
import fs from 'fs';

/**
 * Calculate worktree path for a goal
 * @param {string} goalId - Goal ID
 * @param {string} projectPath - Absolute path to project
 * @returns {string} - Worktree path
 */
export function getWorktreePath(goalId, projectPath) {
  const projectName = basename(projectPath);
  const parentDir = dirname(projectPath);
  return join(parentDir, `${projectName}-worktrees`, goalId);
}

/**
 * Create git worktree for a goal
 * @param {string} goalId - Goal ID
 * @param {string} branchName - Branch name
 * @param {string} projectPath - Project root path
 * @returns {string} - Worktree path
 */
export function createWorktree(goalId, branchName, projectPath) {
  const worktreePath = getWorktreePath(goalId, projectPath);

  // Create worktree directory structure if needed
  const worktreesDir = dirname(worktreePath);
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  try {
    execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, {
      cwd: projectPath,
      stdio: 'pipe'
    });
  } catch (error) {
    throw new Error(`Failed to create worktree: ${error.message}`);
  }

  return worktreePath;
}

/**
 * Delete git worktree
 * @param {string} worktreePath - Path to worktree
 * @param {string} branchName - Branch name to delete
 * @param {string} projectPath - Project root path
 */
export function deleteWorktree(worktreePath, branchName, projectPath) {
  try {
    execSync(`git worktree remove "${worktreePath}"`, {
      cwd: projectPath,
      stdio: 'pipe'
    });

    execSync(`git branch -D "${branchName}"`, {
      cwd: projectPath,
      stdio: 'pipe'
    });
  } catch (error) {
    throw new Error(`Failed to delete worktree: ${error.message}`);
  }
}

/**
 * Check for uncommitted changes
 * @param {string} repoPath - Repository path
 * @returns {boolean} - True if uncommitted changes exist
 */
export function hasUncommittedChanges(repoPath) {
  try {
    const output = execSync('git status --porcelain', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return output.trim().length > 0;
  } catch (error) {
    throw new Error(`Failed to check git status: ${error.message}`);
  }
}

/**
 * Commit changes
 * @param {string} message - Commit message
 * @param {string} repoPath - Repository path
 * @param {string} files - Files to add (default: '.')
 * @returns {string} - Commit hash
 */
export function commitChanges(message, repoPath, files = '.') {
  try {
    execSync(`git add ${files}`, { cwd: repoPath, stdio: 'pipe' });
    execSync(`git commit -m "${message}"`, { cwd: repoPath, stdio: 'pipe' });

    const hash = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();

    return hash;
  } catch (error) {
    throw new Error(`Failed to commit: ${error.message}`);
  }
}

/**
 * Merge branch to main
 * @param {string} branchName - Branch to merge
 * @param {string} projectPath - Project root path
 * @param {string} mainBranch - Main branch name (default: 'main')
 */
export function mergeBranch(branchName, projectPath, mainBranch = 'main') {
  try {
    execSync(`git checkout ${mainBranch}`, { cwd: projectPath, stdio: 'pipe' });
    execSync(`git merge ${branchName} --no-ff`, { cwd: projectPath, stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Failed to merge branch: ${error.message}`);
  }
}
