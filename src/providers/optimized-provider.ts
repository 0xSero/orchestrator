/**
 * Optimized provider wrapper with caching, retry, and monitoring
 */
import type { Provider, GenerateOptions, GenerateResult, Tool } from '../types/index.js'
import { PromptCache } from '../optimization/prompt-cache.js'
import { TokenTracker } from '../optimization/token-tracker.js'
import { RetryHandler, RateLimiter } from '../optimization/retry-handler.js'
import { ContextOptimizer } from '../optimization/context-optimizer.js'
import { PerformanceMonitor } from '../monitoring/performance-monitor.js'
import { ModelRouter } from '../optimization/model-router.js'

export interface OptimizationOptions {
  enableCache?: boolean
  enableRetry?: boolean
  enableRateLimiting?: boolean
  enableMonitoring?: boolean
  enableModelRouting?: boolean
  cacheOptions?: {
    maxSize?: number
    ttl?: number
    strategy?: 'lru' | 'lfu' | 'fifo'
  }
  retryOptions?: {
    maxRetries?: number
    initialDelay?: number
  }
  rateLimitOptions?: {
    requestsPerSecond?: number
  }
  tokenBudget?: {
    maxTokensPerRequest?: number
    maxTokensPerDay?: number
    maxCostPerDay?: number
  }
}

/**
 * Optimized provider with comprehensive performance enhancements
 */
export class OptimizedProvider implements Provider {
  name: string
  models: string[]
  supports: any[]

  private baseProvider: Provider
  private cache?: PromptCache
  private tokenTracker?: TokenTracker
  private retryHandler?: RetryHandler
  private rateLimiter?: RateLimiter
  private contextOptimizer: ContextOptimizer
  private monitor?: PerformanceMonitor
  private router?: ModelRouter

  constructor(baseProvider: Provider, options: OptimizationOptions = {}) {
    this.baseProvider = baseProvider
    this.name = baseProvider.name + '-optimized'
    this.models = baseProvider.models
    this.supports = baseProvider.supports

    // Initialize optimizations
    if (options.enableCache !== false) {
      this.cache = new PromptCache(options.cacheOptions)
    }

    if (options.enableRetry !== false) {
      this.retryHandler = new RetryHandler(options.retryOptions)
    }

    if (options.enableRateLimiting) {
      const rps = options.rateLimitOptions?.requestsPerSecond || 10
      this.rateLimiter = new RateLimiter(rps)
    }

    if (options.enableMonitoring !== false) {
      this.monitor = new PerformanceMonitor()
      this.tokenTracker = new TokenTracker(options.tokenBudget)
    }

    if (options.enableModelRouting) {
      this.router = new ModelRouter()
    }

    this.contextOptimizer = new ContextOptimizer()
  }

  /**
   * Generate text with all optimizations
   */
  async generateText(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    // Rate limiting
    if (this.rateLimiter) {
      await this.rateLimiter.acquire()
    }

    // Model routing
    let model = options?.model
    if (this.router && !model) {
      const estimatedTokens = this.contextOptimizer.estimateTokens(prompt)
      const decision = this.router.route(prompt, {
        estimatedTokens,
        priority: 'quality',
      })
      model = decision.model
      console.log(`🎯 Routed to ${model}: ${decision.reason}`)
    }

    // Check cache
    const cacheKey = `${prompt}:${model}:${options?.temperature || 0.7}`
    if (this.cache) {
      const cached = this.cache.get(prompt, model || this.models[0], options?.temperature || 0.7)
      if (cached) {
        console.log('✅ Cache hit')
        return {
          text: cached,
          finishReason: 'stop',
          usage: { inputTokens: 0, outputTokens: 0 },
        }
      }
    }

    // Execute with retry and monitoring
    const execute = async () => {
      const result = await this.baseProvider.generateText(prompt, {
        ...options,
        model,
      })

      // Track tokens
      if (this.tokenTracker && result.usage) {
        this.tokenTracker.track({
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cachedTokens: result.usage.cachedTokens,
          model: model || this.models[0],
          operation: 'generateText',
        })
      }

      // Cache result
      if (this.cache && result.usage) {
        this.cache.set(
          prompt,
          result.text,
          model || this.models[0],
          options?.temperature || 0.7,
          result.usage.inputTokens + result.usage.outputTokens
        )
      }

      return result
    }

    if (this.monitor) {
      return await this.monitor.measure('generateText', async () => {
        if (this.retryHandler) {
          return await this.retryHandler.execute(execute)
        }
        return await execute()
      })
    }

    if (this.retryHandler) {
      return await this.retryHandler.execute(execute)
    }

    return await execute()
  }

  /**
   * Generate with tools (similar optimizations)
   */
  async generateWithTools(
    prompt: string,
    tools: Tool[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    // Rate limiting
    if (this.rateLimiter) {
      await this.rateLimiter.acquire()
    }

    const execute = async () => {
      const result = await this.baseProvider.generateWithTools(prompt, tools, options)

      // Track tokens
      if (this.tokenTracker && result.usage) {
        this.tokenTracker.track({
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          model: options?.model || this.models[0],
          operation: 'generateWithTools',
        })
      }

      return result
    }

    if (this.monitor) {
      return await this.monitor.measure('generateWithTools', async () => {
        if (this.retryHandler) {
          return await this.retryHandler.execute(execute)
        }
        return await execute()
      })
    }

    if (this.retryHandler) {
      return await this.retryHandler.execute(execute)
    }

    return await execute()
  }

  /**
   * Get optimization statistics
   */
  getStats() {
    return {
      cache: this.cache?.getStats(),
      tokens: this.tokenTracker?.exportUsage(),
      performance: this.monitor?.getSummary(),
      rateLimiting: this.rateLimiter
        ? {
            availableTokens: this.rateLimiter.getAvailableTokens(),
          }
        : undefined,
    }
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.tokenTracker) {
      recommendations.push(...this.tokenTracker.getRecommendations())
    }

    if (this.cache) {
      const stats = this.cache.getStats()
      if (stats.hitRate < 20) {
        recommendations.push(
          `Low cache hit rate (${stats.hitRate.toFixed(1)}%). Consider structuring prompts consistently.`
        )
      }
    }

    if (this.monitor) {
      const slow = this.monitor.getSlowOperations(5000)
      if (slow.length > 0) {
        recommendations.push(
          `${slow.length} slow operations detected (>5s). Consider model routing or prompt optimization.`
        )
      }
    }

    return recommendations
  }
}
