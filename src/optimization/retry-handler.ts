/**
 * Retry logic with exponential backoff for LLM requests
 */

export interface RetryOptions {
  maxRetries: number
  initialDelay: number // milliseconds
  maxDelay: number // milliseconds
  backoffMultiplier: number
  retryableErrors: string[] // Error codes/messages to retry
  onRetry?: (attempt: number, error: Error) => void
}

/**
 * Smart retry handler with exponential backoff
 */
export class RetryHandler {
  private options: RetryOptions

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialDelay || 1000,
      maxDelay: options.maxDelay || 30000,
      backoffMultiplier: options.backoffMultiplier || 2,
      retryableErrors: options.retryableErrors || [
        'rate_limit',
        'timeout',
        'network_error',
        'overloaded',
        '429',
        '500',
        '502',
        '503',
        '504',
      ],
      onRetry: options.onRetry,
    }
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null
    let delay = this.options.initialDelay

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if error is retryable
        if (!this.isRetryable(lastError) || attempt === this.options.maxRetries) {
          throw lastError
        }

        // Calculate delay with jitter
        const jitter = Math.random() * 0.3 * delay // 0-30% jitter
        const currentDelay = Math.min(delay + jitter, this.options.maxDelay)

        // Call retry callback
        if (this.options.onRetry) {
          this.options.onRetry(attempt + 1, lastError)
        }

        console.warn(
          `Retry attempt ${attempt + 1}/${this.options.maxRetries} after ${Math.round(currentDelay)}ms. Error: ${lastError.message}`
        )

        // Wait before retrying
        await this.sleep(currentDelay)

        // Increase delay for next attempt
        delay *= this.options.backoffMultiplier
      }
    }

    throw lastError
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error): boolean {
    const errorString = error.message.toLowerCase()
    return this.options.retryableErrors.some((retryable) =>
      errorString.includes(retryable.toLowerCase())
    )
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Rate limiter for API requests
 */
export class RateLimiter {
  private tokens: number
  private maxTokens: number
  private refillRate: number // tokens per second
  private lastRefill: number

  constructor(requestsPerSecond: number, burstSize?: number) {
    this.maxTokens = burstSize || requestsPerSecond
    this.tokens = this.maxTokens
    this.refillRate = requestsPerSecond
    this.lastRefill = Date.now()
  }

  /**
   * Wait for available token
   */
  async acquire(): Promise<void> {
    while (true) {
      this.refill()

      if (this.tokens >= 1) {
        this.tokens -= 1
        return
      }

      // Calculate wait time
      const tokensNeeded = 1 - this.tokens
      const waitMs = (tokensNeeded / this.refillRate) * 1000

      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000 // seconds

    const tokensToAdd = elapsed * this.refillRate
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
    this.lastRefill = now
  }

  /**
   * Get current token count
   */
  getAvailableTokens(): number {
    this.refill()
    return this.tokens
  }
}
