import fs from 'fs';
import yaml from 'js-yaml';

/**
 * Parse and validate goals.yaml configuration
 * @param {string} configPath - Path to goals.yaml
 * @returns {Object} Parsed configuration
 */
export function parseGoalsConfig(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(content);

    // Basic validation
    if (!config.version) {
      throw new Error('Missing required field: version');
    }
    if (!config.goals || !Array.isArray(config.goals)) {
      throw new Error('Missing or invalid goals array');
    }

    return config;
  } catch (error) {
    if (error.name === 'YAMLException') {
      throw new Error(`Failed to parse goals.yaml: ${error.message}`);
    }
    throw error;
  }
}
