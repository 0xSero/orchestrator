/**
 * Configuration schema validation using Zod
 */
import { z } from 'zod'

export const providerConfigSchema = z.object({
  name: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string(),
  options: z.record(z.unknown()).optional(),
})

export const agentConfigSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  customPrompt: z.string().optional(),
  enabled: z.boolean().optional().default(true),
})

export const agentsConfigSchema = z.object({
  planner: agentConfigSchema,
  executor: agentConfigSchema,
  reviewer: agentConfigSchema,
  debugger: agentConfigSchema,
})

export const testHarnessConfigSchema = z.object({
  enabled: z.boolean().default(true),
  framework: z.enum(['vitest', 'jest', 'mocha']).default('vitest'),
  coverageThreshold: z.number().min(0).max(100).default(80),
  strictMode: z.boolean().default(true),
  generator: z.object({
    provider: z.string(),
    model: z.string(),
  }),
})

export const gitConfigSchema = z.object({
  worktreeDir: z.string().default('./worktrees'),
  autoCommit: z.boolean().default(true),
  branchPrefix: z.string().default('task'),
})

export const qualityGateConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  required: z.boolean().default(true),
  timeout: z.number().positive().optional(),
})

export const standardConfigSchema = z.object({
  name: z.string(),
  value: z.union([z.number(), z.string(), z.boolean()]),
})

export const qualityConfigSchema = z.object({
  gates: z.array(qualityGateConfigSchema).default([]),
  standards: z.array(standardConfigSchema).default([]),
})

export const stateConfigSchema = z.object({
  dbPath: z.string().default('./orchestrator.db'),
  checkpointInterval: z.number().positive().default(60000), // 1 minute
  retentionDays: z.number().positive().default(30),
})

export const orchestratorConfigSchema = z.object({
  provider: providerConfigSchema,
  agents: agentsConfigSchema,
  testHarness: testHarnessConfigSchema,
  git: gitConfigSchema,
  quality: qualityConfigSchema,
  state: stateConfigSchema,
})

export type OrchestratorConfigInput = z.input<typeof orchestratorConfigSchema>
export type OrchestratorConfigOutput = z.output<typeof orchestratorConfigSchema>
