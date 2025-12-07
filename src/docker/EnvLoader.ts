import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export class EnvLoader {
  /**
   * Parse .env file content into key-value pairs
   */
  private static parseEnvFile(content: string): Record<string, string> {
    const env: Record<string, string> = {};

    content.split('\n').forEach(line => {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      // Parse KEY=VALUE format
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        env[key] = value;
      }
    });

    return env;
  }

  /**
   * Load environment variables for workspace
   * Priority: .env file > host environment
   */
  static loadEnvironment(workspacePath: string): Record<string, string> {
    const env: Record<string, string> = {};

    // Start with host ANTHROPIC_API_KEY if exists
    if (process.env.ANTHROPIC_API_KEY) {
      env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    }

    // Override with .env file if exists
    const envFile = join(workspacePath, '.env');
    if (existsSync(envFile)) {
      const content = readFileSync(envFile, 'utf-8');
      const fileEnv = this.parseEnvFile(content);
      Object.assign(env, fileEnv);
    }

    return env;
  }

  /**
   * Check if .env file is in .gitignore
   */
  static isEnvIgnored(workspacePath: string): boolean {
    const gitignore = join(workspacePath, '.gitignore');

    if (!existsSync(gitignore)) {
      return false;
    }

    const content = readFileSync(gitignore, 'utf-8');
    return content.split('\n').some(line => {
      const trimmed = line.trim();
      return trimmed === '.env' || trimmed === '/.env';
    });
  }
}
