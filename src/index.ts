#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { input, confirm } from '@inquirer/prompts';
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
  .action(async (projectPath: string) => {
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
    const goals: Array<{ id: string; description: string; status: string }> = [];
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

    console.log(chalk.green(`\n✓ Created ${goals.length} goal(s) in goals.yaml`));
    console.log(chalk.green('✓ Created .autogoals/ directory'));

    console.log(chalk.blue('\n📝 Next steps:'));
    console.log(chalk.gray('   Run: autogoals start'));
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
