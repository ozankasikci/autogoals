use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

#[derive(Parser)]
#[command(name = "autogoals")]
#[command(about = "Autonomous coding agent that orchestrates Claude Code sessions", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start autonomous execution of goals
    Start {
        /// Path to project directory (defaults to current directory)
        #[arg(default_value = ".")]
        path: PathBuf,
    },
}

#[derive(Debug, Deserialize, Serialize)]
struct GoalsFile {
    goals: Vec<Goal>,
}

#[derive(Debug, Deserialize, Serialize)]
struct Goal {
    id: String,
    description: String,
    status: String,
    #[serde(default)]
    plan: Option<String>,
}

impl GoalsFile {
    fn has_pending_work(&self) -> bool {
        self.goals.iter().any(|g| {
            matches!(
                g.status.as_str(),
                "pending" | "ready_for_execution" | "in_progress" | "ready_for_verification"
            )
        })
    }

    fn count_by_status(&self) -> (usize, usize, usize) {
        let mut pending = 0;
        let mut in_progress = 0;
        let mut completed = 0;

        for goal in &self.goals {
            match goal.status.as_str() {
                "completed" => completed += 1,
                "in_progress" | "ready_for_execution" | "ready_for_verification" => {
                    in_progress += 1
                }
                _ => pending += 1,
            }
        }

        (completed, in_progress, pending)
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Start { path } => start(path).await?,
    }

    Ok(())
}

async fn start(project_path: PathBuf) -> Result<()> {
    println!("🚀 AutoGoals Runner - Phase 2");
    println!("📁 Project: {}", project_path.display());
    println!();

    // Verify project path exists
    if !project_path.exists() {
        anyhow::bail!("Project path does not exist: {}", project_path.display());
    }

    // Check for goals.yaml
    let goals_file_path = project_path.join("goals.yaml");
    if !goals_file_path.exists() {
        anyhow::bail!(
            "No goals.yaml found in {}. Create one first or run 'autogoals init'.",
            project_path.display()
        );
    }

    println!("✓ Found goals.yaml");

    // Session loop - continue until all goals complete
    let mut session_num = 1;

    loop {
        // Parse goals.yaml to check current state
        let goals = parse_goals(&goals_file_path).context("Failed to parse goals.yaml")?;

        let (completed, in_progress, pending) = goals.count_by_status();
        let total = goals.goals.len();

        println!();
        println!("📊 Goal Status: {completed}/{total} completed, {in_progress} in progress, {pending} pending");

        // Check if there's work to do
        if !goals.has_pending_work() {
            println!();
            println!("🎉 All goals completed!");
            break;
        }

        // Spawn Claude Code session
        println!();
        println!("🤖 Starting Claude Code session #{session_num}...");
        println!();

        let mut child = Command::new("claude")
            .current_dir(&project_path)
            .stdin(Stdio::inherit())
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .context("Failed to spawn 'claude' command. Is Claude Code installed?")?;

        // Wait for session to complete
        let status = child
            .wait()
            .await
            .context("Failed to wait for Claude Code process")?;

        println!();
        if status.success() {
            println!("✅ Session #{session_num} completed");
        } else {
            println!(
                "⚠️  Session #{session_num} exited with code: {}",
                status.code().unwrap_or(-1)
            );
        }

        session_num += 1;

        // Re-check goals.yaml to see if we should continue
        println!("🔄 Checking for remaining work...");
    }

    println!();
    println!("✨ All goals completed successfully!");
    Ok(())
}

fn parse_goals(path: &PathBuf) -> Result<GoalsFile> {
    let content = fs::read_to_string(path).context("Failed to read goals.yaml")?;
    let goals: GoalsFile = serde_yaml::from_str(&content).context("Failed to parse YAML")?;
    Ok(goals)
}
