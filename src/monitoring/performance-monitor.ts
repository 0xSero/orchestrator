/**
 * Performance monitoring and analytics
 */

export interface PerformanceMetrics {
  operation: string
  duration: number // milliseconds
  tokens?: {
    input: number
    output: number
    cached?: number
  }
  cost?: number
  success: boolean
  error?: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface PerformanceStats {
  totalRequests: number
  successRate: number
  avgDuration: number
  p50Duration: number
  p95Duration: number
  p99Duration: number
  totalCost: number
  totalTokens: number
  cachedTokensRate: number
}

/**
 * Performance monitoring system
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = []
  private maxMetrics: number

  constructor(maxMetrics: number = 10000) {
    this.maxMetrics = maxMetrics
  }

  /**
   * Record a metric
   */
  record(metric: PerformanceMetrics): void {
    this.metrics.push(metric)

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }
  }

  /**
   * Measure operation duration
   */
  async measure<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now()
    let success = true
    let error: string | undefined

    try {
      const result = await fn()
      return result
    } catch (err) {
      success = false
      error = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      const duration = Date.now() - start

      this.record({
        operation,
        duration,
        success,
        error,
        timestamp: new Date(),
        metadata,
      })
    }
  }

  /**
   * Get statistics for an operation
   */
  getStats(operation?: string): PerformanceStats {
    const filtered = operation
      ? this.metrics.filter((m) => m.operation === operation)
      : this.metrics

    if (filtered.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        avgDuration: 0,
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
        totalCost: 0,
        totalTokens: 0,
        cachedTokensRate: 0,
      }
    }

    const successful = filtered.filter((m) => m.success).length
    const durations = filtered.map((m) => m.duration).sort((a, b) => a - b)

    return {
      totalRequests: filtered.length,
      successRate: (successful / filtered.length) * 100,
      avgDuration:
        filtered.reduce((sum, m) => sum + m.duration, 0) / filtered.length,
      p50Duration: this.percentile(durations, 0.5),
      p95Duration: this.percentile(durations, 0.95),
      p99Duration: this.percentile(durations, 0.99),
      totalCost: filtered.reduce((sum, m) => sum + (m.cost || 0), 0),
      totalTokens: filtered.reduce(
        (sum, m) =>
          sum +
          (m.tokens ? m.tokens.input + m.tokens.output : 0),
        0
      ),
      cachedTokensRate: this.calculateCacheRate(filtered),
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    const byOperation = new Map<string, PerformanceMetrics[]>()

    for (const metric of this.metrics) {
      if (!byOperation.has(metric.operation)) {
        byOperation.set(metric.operation, [])
      }
      byOperation.get(metric.operation)!.push(metric)
    }

    const summary: Record<string, PerformanceStats> = {}

    for (const [operation, metrics] of byOperation.entries()) {
      summary[operation] = this.getStats(operation)
    }

    return {
      overall: this.getStats(),
      byOperation: summary,
    }
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(thresholdMs: number = 5000): PerformanceMetrics[] {
    return this.metrics.filter((m) => m.duration > thresholdMs)
  }

  /**
   * Get failed operations
   */
  getFailures(): PerformanceMetrics[] {
    return this.metrics.filter((m) => !m.success)
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheRate(metrics: PerformanceMetrics[]): number {
    const withTokens = metrics.filter((m) => m.tokens)
    if (withTokens.length === 0) return 0

    const totalInput = withTokens.reduce(
      (sum, m) => sum + (m.tokens?.input || 0),
      0
    )
    const totalCached = withTokens.reduce(
      (sum, m) => sum + (m.tokens?.cached || 0),
      0
    )

    return totalInput > 0 ? (totalCached / totalInput) * 100 : 0
  }

  /**
   * Export metrics
   */
  export() {
    return {
      metrics: this.metrics,
      summary: this.getSummary(),
      slowOps: this.getSlowOperations(),
      failures: this.getFailures(),
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = []
  }
}
