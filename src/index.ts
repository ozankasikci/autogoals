#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { parseGoals, getGoalStatus, hasPendingWork } from './goals.js';
import { runAgentSession } from './agent.js';

const program = new Command();

program
  .name('autogoals')
  .description('Autonomous coding agent using Claude Agent SDK')
  .version('2.0.0');

program
  .command('start')
  .description('Start autonomous execution of goals')
  .argument('[path]', 'Project directory', '.')
  .action(async (projectPath: string) => {
    console.log(chalk.blue('🚀 AutoGoals Runner - TypeScript + Claude SDK'));
    console.log(chalk.gray(`📁 Project: ${projectPath}\n`));

    // Verify project exists
    if (!existsSync(projectPath)) {
      console.error(chalk.red(`Error: Project path does not exist: ${projectPath}`));
      process.exit(1);
    }

    // Check for goals.yaml
    const goalsPath = join(projectPath, 'goals.yaml');
    if (!existsSync(goalsPath)) {
      console.error(chalk.red(`Error: No goals.yaml found in ${projectPath}`));
      process.exit(1);
    }

    console.log(chalk.green('✓ Found goals.yaml\n'));

    // Session loop
    let sessionNum = 1;

    while (true) {
      // Parse goals
      const goalsFile = parseGoals(goalsPath);
      const status = getGoalStatus(goalsFile);

      console.log(chalk.cyan(`📊 Goal Status: ${status.completed}/${status.total} completed, ${status.inProgress} in progress, ${status.pending} pending\n`));

      // Check if done
      if (!hasPendingWork(goalsFile)) {
        console.log(chalk.green('🎉 All goals completed!\n'));
        break;
      }

      // Run Claude Agent SDK session
      console.log(chalk.yellow(`🤖 Starting Claude Agent session #${sessionNum}...\n`));

      try {
        await runAgentSession(projectPath, sessionNum);
        console.log(chalk.green(`✅ Session #${sessionNum} completed\n`));
      } catch (error) {
        console.error(chalk.red(`⚠️  Session #${sessionNum} error:`), error);
        break;
      }

      sessionNum++;
    }

    console.log(chalk.green('✨ All goals completed successfully!\n'));
  });

program.parse();
