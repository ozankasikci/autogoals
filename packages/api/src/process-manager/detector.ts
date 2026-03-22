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

export function detectEnvVars(projectPath: string): { key: string; value: string; source: string }[] {
  const vars: { key: string; value: string; source: string }[] = [];

  // Check .env, .env.local, .env.example, .env.development
  const envFiles = [".env", ".env.local", ".env.example", ".env.development"];
  for (const file of envFiles) {
    const filePath = join(projectPath, file);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
            // Don't override if already found from a higher-priority file
            if (!vars.some(v => v.key === key)) {
              vars.push({ key, value, source: file });
            }
          }
        }
      } catch {}
    }
  }

  // Also check package.json for common port configs
  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      // Check for port in scripts
      if (pkg.scripts) {
        for (const [, cmd] of Object.entries(pkg.scripts)) {
          const portMatch = String(cmd).match(/--port\s+(\d+)|-p\s+(\d+)|PORT=(\d+)/);
          if (portMatch) {
            const port = portMatch[1] || portMatch[2] || portMatch[3];
            if (!vars.some(v => v.key === "PORT")) {
              vars.push({ key: "PORT", value: port, source: "package.json" });
            }
          }
        }
      }
    } catch {}
  }

  return vars;
}
