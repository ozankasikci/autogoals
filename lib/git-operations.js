import { execSync } from 'child_process';
import { dirname, join, basename } from 'path';
import fs from 'fs';

/**
 * Escape shell argument to prevent command injection
 * @param {string} arg - Argument to escape
 * @returns {string} - Escaped argument
 */
function escapeShellArg(arg) {
  if (typeof arg !== 'string') {
    throw new Error('Argument must be a string');
  }
  // Use single quotes and escape any single quotes in the argument
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Validate git reference (branch/tag name)
 * @param {string} ref - Git reference to validate
 * @returns {string} - Validated reference
 */
function validateGitRef(ref) {
  if (typeof ref !== 'string') {
    throw new Error('Git reference must be a string');
  }
  if (ref.length === 0) {
    throw new Error('Git reference cannot be empty');
  }
  // Allow alphanumeric, hyphens, underscores, slashes, and dots
  if (!/^[a-zA-Z0-9/_.-]+$/.test(ref)) {
    throw new Error(`Invalid git reference: ${ref}`);
  }
  return ref;
}

/**
 * Calculate worktree path for a goal
 * @param {string} goalId - Goal ID
 * @param {string} projectPath - Absolute path to project
 * @returns {string} - Worktree path
 */
export function getWorktreePath(goalId, projectPath) {
  return join(projectPath, '.autogoals-worktrees', goalId);
}

/**
 * Create git worktree for a goal
 * @param {string} goalId - Goal ID
 * @param {string} branchName - Branch name
 * @param {string} projectPath - Project root path
 * @returns {string} - Worktree path
 */
export function createWorktree(goalId, branchName, projectPath) {
  // Validate inputs
  validateGitRef(branchName);

  const worktreePath = getWorktreePath(goalId, projectPath);

  // Create worktree directory structure if needed
  const worktreesDir = dirname(worktreePath);
  if (!fs.existsSync(worktreesDir)) {
    fs.mkdirSync(worktreesDir, { recursive: true });
  }

  try {
    const command = `git worktree add ${escapeShellArg(worktreePath)} -b ${escapeShellArg(branchName)}`;
    execSync(command, {
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
  // Validate inputs
  validateGitRef(branchName);

  try {
    const removeCommand = `git worktree remove ${escapeShellArg(worktreePath)}`;
    execSync(removeCommand, {
      cwd: projectPath,
      stdio: 'pipe'
    });

    const deleteCommand = `git branch -D ${escapeShellArg(branchName)}`;
    execSync(deleteCommand, {
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
    const addCommand = `git add ${escapeShellArg(files)}`;
    execSync(addCommand, { cwd: repoPath, stdio: 'pipe' });

    const commitCommand = `git commit -m ${escapeShellArg(message)}`;
    execSync(commitCommand, { cwd: repoPath, stdio: 'pipe' });

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
  // Validate inputs
  validateGitRef(branchName);
  validateGitRef(mainBranch);

  try {
    const checkoutCommand = `git checkout ${escapeShellArg(mainBranch)}`;
    execSync(checkoutCommand, { cwd: projectPath, stdio: 'pipe' });

    const mergeCommand = `git merge ${escapeShellArg(branchName)} --no-ff`;
    execSync(mergeCommand, { cwd: projectPath, stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Failed to merge branch: ${error.message}`);
  }
}
