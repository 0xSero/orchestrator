/**
 * Main exports for the Orchestrator framework
 */

// Core
export { Orchestrator } from './core/orchestrator.js'
export { StateMachine } from './core/state-machine.js'
export { EventBus } from './core/event-bus.js'

// Agents
export { BaseAgent } from './agents/base-agent.js'
export { PlannerAgent } from './agents/planner.js'
export { ExecutorAgent } from './agents/executor.js'
export { ReviewerAgent } from './agents/reviewer.js'
export { DebuggerAgent } from './agents/debugger.js'

// Providers
export { BaseProvider, ProviderFactory } from './providers/index.js'
export { AnthropicProvider } from './providers/anthropic.js'
export { OpenAIProvider } from './providers/openai.js'
export { OptimizedProvider } from './providers/optimized-provider.js'

// State
export { StatePersistence } from './state/persistence.js'
export { CheckpointManager } from './state/checkpoint.js'

// Tasks
export { TaskManager } from './tasks/task-manager.js'

// Context
export { ContextManager } from './context/context-manager.js'

// Git
export { WorktreeManager } from './git/worktree-manager.js'
export { BranchManager } from './git/branch-manager.js'

// Test Harness
export { RGREngine } from './test-harness/rgr-engine.js'

// Config
export { ConfigLoader } from './config/loader.js'
export { orchestratorConfigSchema } from './config/schema.js'

// Optimization
export { PromptCache } from './optimization/prompt-cache.js'
export { TokenTracker } from './optimization/token-tracker.js'
export { RetryHandler, RateLimiter } from './optimization/retry-handler.js'
export { ContextOptimizer } from './optimization/context-optimizer.js'
export { ModelRouter } from './optimization/model-router.js'

// Memory
export {
  BaseMemory,
  BufferWindowMemory,
  SummaryMemory,
  TokenMemory,
  HybridMemory,
} from './memory/memory-manager.js'

// LangChain
export {
  LangChainProvider,
  LangChainProviderFactory,
} from './langchain/langchain-provider.js'
export { RAGEngine, MemoryVectorStore } from './langchain/rag-engine.js'

// Monitoring
export { PerformanceMonitor } from './monitoring/performance-monitor.js'

// Types
export * from './types/index.js'
