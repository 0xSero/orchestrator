/**
 * Token tracking and budget management
 */

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cachedTokens?: number
  totalCost?: number
  timestamp: Date
  model: string
  operation: string
}

export interface TokenBudget {
  maxTokensPerRequest?: number
  maxTokensPerHour?: number
  maxTokensPerDay?: number
  maxCostPerDay?: number
  alertThreshold?: number // Percentage (0-100)
}

/**
 * Token tracking and budget management system
 */
export class TokenTracker {
  private usage: TokenUsage[] = []
  private budget: TokenBudget
  private modelPricing: Map<string, { input: number; output: number; cached?: number }>

  constructor(budget: TokenBudget = {}) {
    this.budget = {
      maxTokensPerRequest: budget.maxTokensPerRequest || 100000,
      maxTokensPerHour: budget.maxTokensPerHour || 1000000,
      maxTokensPerDay: budget.maxTokensPerDay || 10000000,
      maxCostPerDay: budget.maxCostPerDay || 100,
      alertThreshold: budget.alertThreshold || 80,
    }

    // Initialize model pricing (per 1M tokens)
    this.modelPricing = new Map([
      ['claude-sonnet-4-5', { input: 3.0, output: 15.0, cached: 0.3 }],
      ['claude-3-5-sonnet-20241022', { input: 3.0, output: 15.0, cached: 0.3 }],
      ['claude-3-5-haiku-20241022', { input: 1.0, output: 5.0, cached: 0.1 }],
      ['gpt-4o', { input: 2.5, output: 10.0 }],
      ['gpt-4o-mini', { input: 0.15, output: 0.6 }],
      ['gpt-4-turbo', { input: 10.0, output: 30.0 }],
    ])
  }

  /**
   * Track token usage
   */
  track(usage: Omit<TokenUsage, 'totalCost' | 'timestamp'>): void {
    const cost = this.calculateCost(
      usage.model,
      usage.inputTokens,
      usage.outputTokens,
      usage.cachedTokens
    )

    const fullUsage: TokenUsage = {
      ...usage,
      totalCost: cost,
      timestamp: new Date(),
    }

    this.usage.push(fullUsage)

    // Check budget limits
    this.checkBudget(fullUsage)
  }

  /**
   * Calculate cost for token usage
   */
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
    cachedTokens: number = 0
  ): number {
    const pricing = this.modelPricing.get(model)
    if (!pricing) return 0

    const inputCost = (inputTokens / 1_000_000) * pricing.input
    const outputCost = (outputTokens / 1_000_000) * pricing.output
    const cachedCost = cachedTokens > 0 && pricing.cached
      ? (cachedTokens / 1_000_000) * pricing.cached
      : 0

    return inputCost + outputCost + cachedCost
  }

  /**
   * Check if usage exceeds budget
   */
  private checkBudget(usage: TokenUsage): void {
    const hourlyUsage = this.getUsageForPeriod('hour')
    const dailyUsage = this.getUsageForPeriod('day')

    // Check hourly limit
    if (
      this.budget.maxTokensPerHour &&
      hourlyUsage.totalTokens > this.budget.maxTokensPerHour
    ) {
      console.warn(
        `⚠️ Hourly token limit exceeded: ${hourlyUsage.totalTokens}/${this.budget.maxTokensPerHour}`
      )
    }

    // Check daily limit
    if (
      this.budget.maxTokensPerDay &&
      dailyUsage.totalTokens > this.budget.maxTokensPerDay
    ) {
      console.warn(
        `⚠️ Daily token limit exceeded: ${dailyUsage.totalTokens}/${this.budget.maxTokensPerDay}`
      )
    }

    // Check daily cost limit
    if (this.budget.maxCostPerDay && dailyUsage.totalCost > this.budget.maxCostPerDay) {
      console.warn(
        `⚠️ Daily cost limit exceeded: $${dailyUsage.totalCost.toFixed(2)}/$${this.budget.maxCostPerDay}`
      )
    }

    // Alert threshold
    if (this.budget.alertThreshold && this.budget.maxCostPerDay) {
      const threshold = (this.budget.maxCostPerDay * this.budget.alertThreshold) / 100
      if (dailyUsage.totalCost > threshold) {
        console.warn(
          `⚠️ ${this.budget.alertThreshold}% of daily budget used: $${dailyUsage.totalCost.toFixed(2)}`
        )
      }
    }
  }

  /**
   * Get usage for a time period
   */
  getUsageForPeriod(period: 'hour' | 'day' | 'week' | 'month') {
    const now = Date.now()
    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    }[period]

    const relevantUsage = this.usage.filter(
      (u) => now - u.timestamp.getTime() < periodMs
    )

    return {
      totalTokens: relevantUsage.reduce(
        (sum, u) => sum + u.inputTokens + u.outputTokens,
        0
      ),
      inputTokens: relevantUsage.reduce((sum, u) => sum + u.inputTokens, 0),
      outputTokens: relevantUsage.reduce((sum, u) => sum + u.outputTokens, 0),
      cachedTokens: relevantUsage.reduce((sum, u) => sum + (u.cachedTokens || 0), 0),
      totalCost: relevantUsage.reduce((sum, u) => sum + (u.totalCost || 0), 0),
      requests: relevantUsage.length,
    }
  }

  /**
   * Get usage by model
   */
  getUsageByModel() {
    const byModel = new Map<string, any>()

    for (const usage of this.usage) {
      if (!byModel.has(usage.model)) {
        byModel.set(usage.model, {
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cachedTokens: 0,
          totalCost: 0,
          requests: 0,
        })
      }

      const stats = byModel.get(usage.model)
      stats.totalTokens += usage.inputTokens + usage.outputTokens
      stats.inputTokens += usage.inputTokens
      stats.outputTokens += usage.outputTokens
      stats.cachedTokens += usage.cachedTokens || 0
      stats.totalCost += usage.totalCost || 0
      stats.requests++
    }

    return Object.fromEntries(byModel)
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = []
    const dailyUsage = this.getUsageForPeriod('day')

    // Check cache efficiency
    if (dailyUsage.cachedTokens > 0) {
      const cacheRate = (dailyUsage.cachedTokens / dailyUsage.inputTokens) * 100
      if (cacheRate < 20) {
        recommendations.push(
          'Low cache hit rate. Consider structuring prompts with static content first.'
        )
      }
    } else {
      recommendations.push('Prompt caching not being used. Enable caching to reduce costs by 60-90%.')
    }

    // Check model usage
    const byModel = this.getUsageByModel()
    const expensiveModels = Object.entries(byModel).filter(
      ([model, _]) =>
        model.includes('gpt-4') || model.includes('claude-3-opus')
    )

    if (expensiveModels.length > 0) {
      recommendations.push(
        'Using expensive models. Consider using cheaper models for simple tasks (model routing).'
      )
    }

    // Check output/input ratio
    const ratio = dailyUsage.outputTokens / dailyUsage.inputTokens
    if (ratio > 2) {
      recommendations.push(
        'High output/input token ratio. Consider more specific prompts to reduce output length.'
      )
    }

    return recommendations
  }

  /**
   * Export usage data for analysis
   */
  exportUsage() {
    return {
      usage: this.usage,
      summary: {
        hour: this.getUsageForPeriod('hour'),
        day: this.getUsageForPeriod('day'),
        week: this.getUsageForPeriod('week'),
        month: this.getUsageForPeriod('month'),
      },
      byModel: this.getUsageByModel(),
      recommendations: this.getRecommendations(),
    }
  }
}
