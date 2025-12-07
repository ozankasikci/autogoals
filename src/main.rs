use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
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

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Start { path } => start(path).await?,
    }

    Ok(())
}

async fn start(project_path: PathBuf) -> Result<()> {
    println!("🚀 AutoGoals Runner - Phase 1");
    println!("📁 Project: {}", project_path.display());
    println!();

    // Verify project path exists
    if !project_path.exists() {
        anyhow::bail!("Project path does not exist: {}", project_path.display());
    }

    // Check for goals.yaml
    let goals_file = project_path.join("goals.yaml");
    if !goals_file.exists() {
        anyhow::bail!(
            "No goals.yaml found in {}. Create one first or run 'autogoals init'.",
            project_path.display()
        );
    }

    println!("✓ Found goals.yaml");
    println!("🤖 Spawning Claude Code session...");
    println!();

    // Spawn Claude Code process
    let mut child = Command::new("claude")
        .current_dir(&project_path)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .context("Failed to spawn 'claude' command. Is Claude Code installed?")?;

    // Wait for Claude Code to complete
    let status = child
        .wait()
        .await
        .context("Failed to wait for Claude Code process")?;

    println!();
    if status.success() {
        println!("✅ Session completed successfully");
        Ok(())
    } else {
        anyhow::bail!(
            "Claude Code exited with error: {}",
            status.code().unwrap_or(-1)
        )
    }
}
