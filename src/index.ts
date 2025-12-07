#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
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
  .command('init')
  .description('Initialize a new AutoGoals project')
  .argument('[path]', 'Project directory', '.')
  .action((projectPath: string) => {
    console.log(chalk.blue('🎯 Initializing AutoGoals project...\n'));

    const goalsPath = join(projectPath, 'goals.yaml');
    const autogoalsDir = join(projectPath, '.autogoals');

    // Check if goals.yaml already exists
    if (existsSync(goalsPath)) {
      console.log(chalk.yellow('⚠️  goals.yaml already exists!'));
      console.log(chalk.gray(`   ${goalsPath}\n`));
      process.exit(1);
    }

    // Create goals.yaml template
    const template = `goals:
  - id: "example-goal-1"
    description: "Your first goal - describe what you want to build"
    status: "pending"

  - id: "example-goal-2"
    description: "Another goal - AutoGoals will work through these sequentially"
    status: "pending"

# Goal Status Lifecycle:
# - pending: Not started
# - ready_for_execution: Plan complete, ready to implement
# - in_progress: Currently being worked on
# - ready_for_verification: Implementation done, needs testing
# - completed: Done and verified
# - failed: Encountered errors

# Tips:
# 1. Be specific in your goal descriptions
# 2. Break large features into smaller goals
# 3. AutoGoals will update this file as it completes goals
# 4. You can edit this file anytime to add/modify goals
`;

    writeFileSync(goalsPath, template);
    console.log(chalk.green('✓ Created goals.yaml'));

    // Create .autogoals directory
    if (!existsSync(autogoalsDir)) {
      mkdirSync(autogoalsDir, { recursive: true });
      mkdirSync(join(autogoalsDir, 'logs'), { recursive: true });
      console.log(chalk.green('✓ Created .autogoals/ directory'));
    }

    console.log(chalk.blue('\n📝 Next steps:'));
    console.log(chalk.gray('   1. Edit goals.yaml to define your goals'));
    console.log(chalk.gray('   2. Run: autogoals start'));
    console.log();
  });

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
