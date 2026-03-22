import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface DetectedCommand {
  name: string;
  command: string;
  source: string;
}

export function detectRunCommands(projectPath: string): DetectedCommand[] {
  const commands: DetectedCommand[] = [];

  // package.json
  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.scripts) {
        for (const [name] of Object.entries(pkg.scripts)) {
          commands.push({
            name: `npm run ${name}`,
            command: `npm run ${name}`,
            source: "package.json",
          });
        }
      }
    } catch {}
  }

  // Makefile
  const makePath = join(projectPath, "Makefile");
  if (existsSync(makePath)) {
    try {
      const content = readFileSync(makePath, "utf-8");
      const targets = content.match(/^([a-zA-Z][a-zA-Z0-9_-]*):/gm);
      if (targets) {
        for (const target of targets) {
          const name = target.replace(":", "");
          commands.push({
            name: `make ${name}`,
            command: `make ${name}`,
            source: "Makefile",
          });
        }
      }
    } catch {}
  }

  // docker-compose
  const composePath = join(projectPath, "docker-compose.yml");
  if (existsSync(composePath)) {
    commands.push({
      name: "docker compose up",
      command: "docker compose up",
      source: "docker-compose.yml",
    });
  }

  return commands;
}
