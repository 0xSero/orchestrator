#!/usr/bin/env node
/**
 * CLI entry point
 */
import { Command } from 'commander'
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ConfigLoader } from '../config/loader.js'
import { Orchestrator } from '../core/orchestrator.js'
import chalk from 'chalk'
import ora from 'ora'

const program = new Command()

program
  .name('orchestrator')
  .description('A modular framework for managing swarms of AI agents')
  .version('0.1.0')

/**
 * Initialize command
 */
program
  .command('init')
  .description('Initialize a new orchestrator configuration')
  .option('-o, --output <path>', 'Output path for config file', 'orchestrator.config.yml')
  .action((options) => {
    const configPath = options.output

    if (existsSync(configPath)) {
      console.error(chalk.red(`Configuration file already exists: ${configPath}`))
      process.exit(1)
    }

    const defaultConfig = `# Orchestrator Configuration

provider:
  name: anthropic
  apiKey: \${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5

agents:
  planner:
    enabled: true
    temperature: 0.7
  executor:
    enabled: true
    temperature: 0.5
  reviewer:
    enabled: true
    temperature: 0.3
  debugger:
    enabled: true
    temperature: 0.5

testHarness:
  enabled: true
  framework: vitest
  coverageThreshold: 80
  strictMode: true
  generator:
    provider: anthropic
    model: claude-sonnet-4-5

git:
  worktreeDir: ./worktrees
  autoCommit: true
  branchPrefix: task

quality:
  gates:
    - name: typecheck
      command: npm run typecheck
      required: true
    - name: lint
      command: npm run lint
      required: true
    - name: test
      command: npm test
      required: true
  standards:
    - name: complexity
      value: 10
    - name: max-function-length
      value: 50

state:
  dbPath: ./orchestrator.db
  checkpointInterval: 60000
  retentionDays: 30
`

    writeFileSync(configPath, defaultConfig)
    console.log(chalk.green(`✓ Created configuration file: ${configPath}`))
    console.log(chalk.cyan('\nNext steps:'))
    console.log('1. Edit the configuration file to set your API keys')
    console.log('2. Run: orchestrator start "<your task description>"')
  })

/**
 * Start command
 */
program
  .command('start <prompt>')
  .description('Start a new orchestration session')
  .option('-c, --config <path>', 'Path to configuration file', 'orchestrator.config.yml')
  .option('-p, --project <name>', 'Project name', 'orchestrator-project')
  .action(async (prompt, options) => {
    const spinner = ora('Loading configuration...').start()

    try {
      // Load configuration
      const loader = ConfigLoader.getInstance()
      const config = loader.load(options.config)
      spinner.succeed('Configuration loaded')

      // Create orchestrator
      spinner.start('Initializing orchestrator...')
      const orchestrator = new Orchestrator(config)
      spinner.succeed('Orchestrator initialized')

      // Start session
      console.log(chalk.cyan(`\nStarting session for: ${options.project}`))
      console.log(chalk.gray(`Prompt: ${prompt}\n`))

      await orchestrator.start(prompt, options.project)

      await orchestrator.cleanup()

      console.log(chalk.green('\n✓ Session completed successfully'))
    } catch (error) {
      spinner.fail('Error')
      console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

/**
 * Resume command
 */
program
  .command('resume <checkpoint-id>')
  .description('Resume from a checkpoint')
  .option('-c, --config <path>', 'Path to configuration file', 'orchestrator.config.yml')
  .action(async (checkpointId, options) => {
    const spinner = ora('Loading configuration...').start()

    try {
      const loader = ConfigLoader.getInstance()
      const config = loader.load(options.config)
      spinner.succeed('Configuration loaded')

      const orchestrator = new Orchestrator(config)
      await orchestrator.resume(checkpointId)

      await orchestrator.cleanup()

      console.log(chalk.green('\n✓ Resumed and completed successfully'))
    } catch (error) {
      spinner.fail('Error')
      console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

/**
 * Status command
 */
program
  .command('status')
  .description('Show current session status')
  .option('-c, --config <path>', 'Path to configuration file', 'orchestrator.config.yml')
  .action((options) => {
    console.log(chalk.cyan('Orchestrator Status'))
    console.log(chalk.gray('Not implemented yet'))
  })

/**
 * List command
 */
program
  .command('list')
  .description('List all sessions and checkpoints')
  .option('-c, --config <path>', 'Path to configuration file', 'orchestrator.config.yml')
  .action((options) => {
    console.log(chalk.cyan('Sessions and Checkpoints'))
    console.log(chalk.gray('Not implemented yet'))
  })

program.parse()
