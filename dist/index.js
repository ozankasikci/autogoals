#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { input, confirm } from '@inquirer/prompts';
import { parseGoals, getGoalStatus, hasPendingWork } from './goals.js';
import { runAgentSession } from './agent.js';
import { render } from 'ink';
import React from 'react';
import AutoGoalsTUI from './tui/index.js';
import { SessionManager } from './session/SessionManager.js';
import { runAgent } from './session/AgentRunner.js';
import { ContainerManager } from './docker/ContainerManager.js';
import { EnvLoader } from './docker/EnvLoader.js';
import { DockerClient } from './docker/DockerClient.js';
const program = new Command();
program
    .name('autogoals')
    .description('Autonomous coding agent using Claude Agent SDK')
    .version('2.0.0');
program
    .command('init')
    .description('Initialize a new AutoGoals project')
    .action(async () => {
    const projectPath = process.cwd();
    console.log(chalk.blue('🎯 AutoGoals - Interactive Setup\n'));
    const goalsPath = join(projectPath, 'goals.yaml');
    const autogoalsDir = join(projectPath, '.autogoals');
    // Create project directory if it doesn't exist
    if (!existsSync(projectPath)) {
        mkdirSync(projectPath, { recursive: true });
    }
    // Check if goals.yaml already exists
    if (existsSync(goalsPath)) {
        console.log(chalk.yellow('⚠️  goals.yaml already exists!'));
        console.log(chalk.gray(`   ${goalsPath}\n`));
        process.exit(1);
    }
    // Interactive goal collection
    const goals = [];
    let goalNum = 1;
    console.log(chalk.gray('Enter your goals one by one. Be specific about what you want to build.\n'));
    while (true) {
        const description = await input({
            message: `Goal ${goalNum}:`,
            validate: (value) => {
                if (!value.trim()) {
                    return 'Goal description cannot be empty';
                }
                return true;
            }
        });
        // Generate ID from description (lowercase, hyphenated)
        const id = description
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .substring(0, 50);
        goals.push({
            id: `goal-${goalNum}-${id}`,
            description: description.trim(),
            status: 'pending'
        });
        goalNum++;
        const addMore = await confirm({
            message: 'Add another goal?',
            default: true
        });
        if (!addMore) {
            break;
        }
        console.log(); // Empty line for readability
    }
    // Generate goals.yaml
    let yamlContent = 'goals:\n';
    goals.forEach((goal) => {
        yamlContent += `  - id: "${goal.id}"\n`;
        yamlContent += `    description: "${goal.description}"\n`;
        yamlContent += `    status: "${goal.status}"\n\n`;
    });
    // Add helpful comments
    yamlContent += `# Goal Status Lifecycle:\n`;
    yamlContent += `# - pending: Not started\n`;
    yamlContent += `# - ready_for_execution: Plan complete, ready to implement\n`;
    yamlContent += `# - in_progress: Currently being worked on\n`;
    yamlContent += `# - ready_for_verification: Implementation done, needs testing\n`;
    yamlContent += `# - completed: Done and verified\n`;
    yamlContent += `# - failed: Encountered errors\n`;
    writeFileSync(goalsPath, yamlContent);
    // Create .autogoals directory
    if (!existsSync(autogoalsDir)) {
        mkdirSync(autogoalsDir, { recursive: true });
        mkdirSync(join(autogoalsDir, 'logs'), { recursive: true });
    }
    // Create .env.example
    const envExample = join(projectPath, '.env.example');
    if (!existsSync(envExample)) {
        const exampleContent = `# AutoGoals Environment Variables
# Copy this file to .env and fill in your values

# Anthropic API Key (required)
ANTHROPIC_API_KEY=your_api_key_here

# Optional: Custom Docker image
# AUTOGOALS_DOCKER_IMAGE=autogoals/devbox:latest
`;
        writeFileSync(envExample, exampleContent);
        console.log(chalk.green('✓ Created .env.example'));
    }
    // Check if .env is in .gitignore
    const gitignorePath = join(projectPath, '.gitignore');
    let gitignoreContent = '';
    if (existsSync(gitignorePath)) {
        gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    }
    if (!gitignoreContent.includes('.env')) {
        const newContent = gitignoreContent + '\n# Environment\n.env\n';
        writeFileSync(gitignorePath, newContent);
        console.log(chalk.green('✓ Added .env to .gitignore'));
    }
    console.log(chalk.green(`\n✓ Created ${goals.length} goal(s) in goals.yaml`));
    console.log(chalk.green('✓ Created .autogoals/ directory'));
    console.log(chalk.blue('\n📝 Next steps:'));
    console.log(chalk.gray('   Run: autogoals start'));
    console.log();
});
program
    .command('start')
    .description('Start autonomous execution of goals')
    .option('--no-tui', 'Disable TUI, use plain output')
    .action(async (options) => {
    const projectPath = process.cwd();
    console.log(chalk.blue('🚀 AutoGoals'));
    console.log(chalk.gray(`📁 Working Directory: ${projectPath}\n`));
    // Check Docker daemon
    const dockerClient = new DockerClient();
    const dockerRunning = await dockerClient.isDockerRunning();
    if (!dockerRunning) {
        console.log(chalk.red('✗ Docker daemon not found'));
        console.log(chalk.yellow('AutoGoals requires Docker to run agents in isolated containers.'));
        console.log(chalk.gray('Install Docker: https://docs.docker.com/get-docker/'));
        console.log(chalk.gray('Or run: autogoals doctor'));
        process.exit(1);
    }
    if (options.tui === false) {
        // Original plain output mode
        const goalsPath = join(projectPath, 'goals.yaml');
        if (!existsSync(goalsPath)) {
            console.error(chalk.red(`Error: No goals.yaml found in ${projectPath}`));
            process.exit(1);
        }
        let sessionNum = 1;
        while (true) {
            const goalsFile = parseGoals(goalsPath);
            const status = getGoalStatus(goalsFile);
            console.log(chalk.cyan(`📊 Goal Status: ${status.completed}/${status.total} completed, ${status.inProgress} in progress, ${status.pending} pending\n`));
            if (!hasPendingWork(goalsFile)) {
                console.log(chalk.green('🎉 All goals completed!\n'));
                break;
            }
            console.log(chalk.yellow(`🤖 Starting Claude Agent session #${sessionNum}...\n`));
            try {
                await runAgentSession(projectPath, sessionNum);
                console.log(chalk.green(`✅ Session #${sessionNum} completed\n`));
            }
            catch (error) {
                console.error(chalk.red(`⚠️  Session #${sessionNum} error:`), error);
                break;
            }
            sessionNum++;
        }
        console.log(chalk.green('✨ All goals completed successfully!\n'));
        return;
    }
    // TUI mode
    const goalsPath = join(projectPath, 'goals.yaml');
    if (!existsSync(goalsPath)) {
        console.error(chalk.red(`Error: No goals.yaml found in ${projectPath}`));
        process.exit(1);
    }
    const sessionManager = new SessionManager();
    // Start TUI
    const { waitUntilExit } = render(React.createElement(AutoGoalsTUI, { projectPath, sessionManager }));
    // Spawn agents for pending goals
    const goalsFile = parseGoals(goalsPath);
    const pendingGoals = goalsFile.goals.filter(g => g.status === 'pending');
    // Start first agent
    if (pendingGoals.length > 0) {
        const goal = pendingGoals[0];
        const agentId = sessionManager.createAgent(goal.id, goal.description);
        runAgent(sessionManager, agentId, projectPath, goal.id, goal.description).catch(err => {
            console.error('Agent execution error:', err);
        });
    }
    await waitUntilExit();
});
program
    .command('stop')
    .description('Stop the workspace container')
    .action(async () => {
    const projectPath = process.cwd();
    console.log(chalk.blue('🛑 Stopping workspace container...'));
    try {
        const containerManager = new ContainerManager();
        await containerManager.stopContainer(projectPath);
        console.log(chalk.green('✓ Container stopped'));
    }
    catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('clean')
    .description('Remove stopped containers')
    .option('--all', 'Remove all AutoGoals containers (including running)')
    .action(async (options) => {
    const projectPath = process.cwd();
    if (options.all) {
        console.log(chalk.yellow('⚠️  This will remove all AutoGoals containers'));
        const proceed = await confirm({
            message: 'Are you sure?',
            default: false
        });
        if (!proceed) {
            console.log(chalk.gray('Cancelled'));
            return;
        }
    }
    console.log(chalk.blue('🧹 Cleaning containers...'));
    try {
        const containerManager = new ContainerManager();
        if (options.all) {
            // Remove workspace container
            await containerManager.removeContainer(projectPath, true);
            console.log(chalk.green('✓ Removed workspace container'));
        }
        else {
            // Just stop and remove if stopped
            await containerManager.stopContainer(projectPath);
            await containerManager.removeContainer(projectPath, false);
            console.log(chalk.green('✓ Cleaned workspace container'));
        }
    }
    catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('doctor')
    .description('Diagnose Docker and container issues')
    .action(async () => {
    console.log(chalk.blue('🔍 AutoGoals Doctor\n'));
    const projectPath = process.cwd();
    const containerManager = new ContainerManager();
    const dockerClient = new DockerClient();
    // Check Docker daemon
    const dockerRunning = await dockerClient.isDockerRunning();
    console.log(dockerRunning
        ? chalk.green('✓ Docker daemon is running')
        : chalk.red('✗ Docker daemon not found'));
    if (!dockerRunning) {
        console.log(chalk.yellow('  Install Docker: https://docs.docker.com/get-docker/'));
        return;
    }
    // Check .env file
    const envFile = join(projectPath, '.env');
    const hasEnv = existsSync(envFile);
    console.log(hasEnv
        ? chalk.green('✓ .env file found')
        : chalk.yellow('⚠ No .env file (will use host environment)'));
    // Check .env in .gitignore
    if (hasEnv) {
        const isIgnored = EnvLoader.isEnvIgnored(projectPath);
        console.log(isIgnored
            ? chalk.green('✓ .env is in .gitignore')
            : chalk.red('✗ .env NOT in .gitignore (security risk!)'));
    }
    // Check container state
    const stateFile = join(projectPath, '.autogoals', 'container.json');
    const hasState = existsSync(stateFile);
    console.log(hasState
        ? chalk.green('✓ Container state found')
        : chalk.gray('  No container created yet'));
    console.log(chalk.green('\n✓ Diagnosis complete'));
});
program.parse();
