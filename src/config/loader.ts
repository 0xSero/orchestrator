/**
 * Configuration loader
 */
import { readFileSync, existsSync } from 'fs'
import { parse } from 'yaml'
import { config as loadEnv } from 'dotenv'
import { orchestratorConfigSchema, type OrchestratorConfigOutput } from './schema.js'
import type { OrchestratorConfig } from '../types/index.js'

/**
 * Load configuration from file and environment
 */
export class ConfigLoader {
  private static instance: ConfigLoader
  private config?: OrchestratorConfig

  private constructor() {
    // Load environment variables
    loadEnv()
  }

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader()
    }
    return ConfigLoader.instance
  }

  /**
   * Load configuration from file
   */
  load(configPath: string): OrchestratorConfig {
    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`)
    }

    const fileContent = readFileSync(configPath, 'utf-8')
    const rawConfig = this.parseConfigFile(configPath, fileContent)

    // Substitute environment variables
    const substituted = this.substituteEnvVars(rawConfig)

    // Validate configuration
    const validated = orchestratorConfigSchema.parse(substituted)

    this.config = validated as OrchestratorConfig
    return this.config
  }

  /**
   * Get current configuration
   */
  getConfig(): OrchestratorConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.')
    }
    return this.config
  }

  /**
   * Parse configuration file based on extension
   */
  private parseConfigFile(path: string, content: string): unknown {
    if (path.endsWith('.yml') || path.endsWith('.yaml')) {
      return parse(content)
    } else if (path.endsWith('.json')) {
      return JSON.parse(content)
    } else {
      throw new Error(`Unsupported configuration file format: ${path}`)
    }
  }

  /**
   * Substitute environment variables in configuration
   */
  private substituteEnvVars(obj: unknown): unknown {
    if (typeof obj === 'string') {
      // Replace ${VAR_NAME} with environment variable value
      return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
        const value = process.env[varName]
        if (value === undefined) {
          throw new Error(`Environment variable not found: ${varName}`)
        }
        return value
      })
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.substituteEnvVars(item))
    }

    if (obj !== null && typeof obj === 'object') {
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteEnvVars(value)
      }
      return result
    }

    return obj
  }

  /**
   * Create default configuration
   */
  static createDefault(): OrchestratorConfig {
    return {
      provider: {
        name: 'anthropic',
        model: 'claude-sonnet-4-5',
      },
      agents: {
        planner: { enabled: true },
        executor: { enabled: true },
        reviewer: { enabled: true },
        debugger: { enabled: true },
      },
      testHarness: {
        enabled: true,
        framework: 'vitest',
        coverageThreshold: 80,
        strictMode: true,
        generator: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
        },
      },
      git: {
        worktreeDir: './worktrees',
        autoCommit: true,
        branchPrefix: 'task',
      },
      quality: {
        gates: [
          {
            name: 'typecheck',
            command: 'npm run typecheck',
            required: true,
          },
          {
            name: 'lint',
            command: 'npm run lint',
            required: true,
          },
          {
            name: 'test',
            command: 'npm test',
            required: true,
          },
        ],
        standards: [
          {
            name: 'complexity',
            value: 10,
          },
          {
            name: 'max-function-length',
            value: 50,
          },
        ],
      },
      state: {
        dbPath: './orchestrator.db',
        checkpointInterval: 60000,
        retentionDays: 30,
      },
    }
  }
}
