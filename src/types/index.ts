/**
 * Core type definitions for the Orchestrator framework
 */

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  RED = 'red', // Test generation phase
  GREEN = 'green', // Implementation phase
  REFACTOR = 'refactor', // Refactoring phase
  REVIEW = 'review', // Under review
  DEBUG = 'debug', // Being debugged
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Agent types
 */
export enum AgentType {
  PLANNER = 'planner',
  EXECUTOR = 'executor',
  REVIEWER = 'reviewer',
  DEBUGGER = 'debugger',
}

/**
 * Workflow step types
 */
export enum WorkflowStep {
  INIT = 'init',
  PLAN = 'plan',
  TEST_GEN = 'test_gen',
  EXECUTE = 'execute',
  REVIEW = 'review',
  DEBUG = 'debug',
  INTEGRATE = 'integrate',
  COMPLETE = 'complete',
}

/**
 * Test phase for RGR cycle
 */
export enum TestPhase {
  RED = 'red',
  GREEN = 'green',
  REFACTOR = 'refactor',
}

/**
 * Task definition
 */
export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dependencies: string[] // Task IDs
  assignedAgent?: AgentType
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  metadata: Record<string, unknown>
  gitBranch?: string
  testPhase?: TestPhase
  parentTaskId?: string
}

/**
 * Context for a project or task
 */
export interface Context {
  id: string
  projectName: string
  description: string
  requirements: string[]
  constraints: string[]
  standards: string[]
  scope: Scope
  createdAt: Date
  version: string
  immutable: boolean
}

/**
 * Project scope
 */
export interface Scope {
  goals: string[]
  inScope: string[]
  outOfScope: string[]
  successCriteria: string[]
}

/**
 * Agent interface
 */
export interface Agent {
  type: AgentType
  name: string
  description: string
  capabilities: string[]
  execute(task: Task, context: Context): Promise<AgentResult>
}

/**
 * Agent execution result
 */
export interface AgentResult {
  success: boolean
  output: string
  artifacts: Artifact[]
  nextStep?: WorkflowStep
  suggestions?: string[]
  errors?: AgentError[]
}

/**
 * Agent error
 */
export interface AgentError {
  code: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, unknown>
}

/**
 * Artifact produced by agents
 */
export interface Artifact {
  id: string
  type: ArtifactType
  path: string
  content?: string
  metadata: Record<string, unknown>
}

/**
 * Artifact types
 */
export enum ArtifactType {
  CODE = 'code',
  TEST = 'test',
  DOCUMENTATION = 'documentation',
  CONFIG = 'config',
  DATA = 'data',
}

/**
 * Provider interface for AI models
 */
export interface Provider {
  name: string
  models: string[]
  supports: ProviderCapability[]

  generateText(prompt: string, options?: GenerateOptions): Promise<GenerateResult>
  generateWithTools(
    prompt: string,
    tools: Tool[],
    options?: GenerateOptions
  ): Promise<GenerateResult>
}

/**
 * Provider capabilities
 */
export enum ProviderCapability {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  TOOLS = 'tools',
  STREAMING = 'streaming',
}

/**
 * Generation options
 */
export interface GenerateOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
  systemPrompt?: string
  metadata?: Record<string, unknown>
}

/**
 * Generation result
 */
export interface GenerateResult {
  text: string
  finishReason: 'stop' | 'length' | 'tool_use' | 'error'
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  toolUses?: ToolUse[]
}

/**
 * Tool definition
 */
export interface Tool {
  name: string
  description: string
  parameters: ToolParameter[]
}

/**
 * Tool parameter
 */
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: unknown
}

/**
 * Tool use result
 */
export interface ToolUse {
  name: string
  parameters: Record<string, unknown>
  result?: unknown
}

/**
 * State checkpoint
 */
export interface Checkpoint {
  id: string
  sessionId: string
  step: WorkflowStep
  timestamp: Date
  state: OrchestratorState
  gitCommit?: string
  metadata: Record<string, unknown>
}

/**
 * Orchestrator state
 */
export interface OrchestratorState {
  sessionId: string
  currentStep: WorkflowStep
  currentTask?: Task
  context: Context
  tasks: Task[]
  completedTasks: string[]
  failedTasks: string[]
  metadata: Record<string, unknown>
}

/**
 * Test suite
 */
export interface TestSuite {
  id: string
  name: string
  taskId: string
  phase: TestPhase
  tests: Test[]
  createdAt: Date
}

/**
 * Individual test
 */
export interface Test {
  id: string
  name: string
  description: string
  type: 'unit' | 'integration' | 'e2e' | 'property'
  code: string
  expectedToFail?: boolean
}

/**
 * Test results
 */
export interface TestResults {
  suiteId: string
  passed: number
  failed: number
  skipped: number
  total: number
  coverage?: Coverage
  duration: number
  failures: TestFailure[]
}

/**
 * Test failure
 */
export interface TestFailure {
  testId: string
  message: string
  stack?: string
}

/**
 * Code coverage
 */
export interface Coverage {
  lines: number
  functions: number
  branches: number
  statements: number
}

/**
 * Quality gate
 */
export interface QualityGate {
  name: string
  description: string
  required: boolean
  check(): Promise<GateResult>
}

/**
 * Quality gate result
 */
export interface GateResult {
  passed: boolean
  message: string
  details?: Record<string, unknown>
}

/**
 * Git branch info
 */
export interface BranchInfo {
  name: string
  taskId: string
  phase: TestPhase
  commit: string
  createdAt: Date
}

/**
 * Configuration schema
 */
export interface OrchestratorConfig {
  provider: ProviderConfig
  agents: AgentsConfig
  testHarness: TestHarnessConfig
  git: GitConfig
  quality: QualityConfig
  state: StateConfig
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: string
  apiKey?: string
  baseUrl?: string
  model: string
  options?: Record<string, unknown>
}

/**
 * Agents configuration
 */
export interface AgentsConfig {
  planner: AgentConfig
  executor: AgentConfig
  reviewer: AgentConfig
  debugger: AgentConfig
}

/**
 * Individual agent configuration
 */
export interface AgentConfig {
  model?: string
  temperature?: number
  maxTokens?: number
  customPrompt?: string
  enabled?: boolean
}

/**
 * Test harness configuration
 */
export interface TestHarnessConfig {
  enabled: boolean
  framework: 'vitest' | 'jest' | 'mocha'
  coverageThreshold: number
  strictMode: boolean
  generator: {
    provider: string
    model: string
  }
}

/**
 * Git configuration
 */
export interface GitConfig {
  worktreeDir: string
  autoCommit: boolean
  branchPrefix: string
}

/**
 * Quality configuration
 */
export interface QualityConfig {
  gates: QualityGateConfig[]
  standards: StandardConfig[]
}

/**
 * Quality gate configuration
 */
export interface QualityGateConfig {
  name: string
  command: string
  required: boolean
  timeout?: number
  [key: string]: unknown
}

/**
 * Standard configuration
 */
export interface StandardConfig {
  name: string
  value: number | string | boolean
}

/**
 * State configuration
 */
export interface StateConfig {
  dbPath: string
  checkpointInterval: number
  retentionDays: number
}

/**
 * Event types
 */
export enum EventType {
  TASK_CREATED = 'task.created',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  WORKFLOW_STEP_CHANGED = 'workflow.step.changed',
  TEST_PHASE_CHANGED = 'test.phase.changed',
  AGENT_STARTED = 'agent.started',
  AGENT_COMPLETED = 'agent.completed',
  CHECKPOINT_CREATED = 'checkpoint.created',
  ERROR = 'error',
}

/**
 * Event payload
 */
export interface Event<T = unknown> {
  type: EventType
  timestamp: Date
  payload: T
  metadata?: Record<string, unknown>
}

/**
 * Event handler
 */
export type EventHandler<T = unknown> = (event: Event<T>) => void | Promise<void>
