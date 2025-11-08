/**
 * Context optimization and compression
 */

export interface ContextWindow {
  maxTokens: number
  currentTokens: number
  segments: ContextSegment[]
}

export interface ContextSegment {
  id: string
  content: string
  tokens: number
  priority: number // 0-10, higher is more important
  type: 'system' | 'static' | 'dynamic' | 'result'
  timestamp: Date
}

/**
 * Smart context management and compression
 */
export class ContextOptimizer {
  private maxContextTokens: number

  constructor(maxContextTokens: number = 100000) {
    this.maxContextTokens = maxContextTokens
  }

  /**
   * Optimize context to fit within token limit
   */
  optimize(segments: ContextSegment[]): ContextSegment[] {
    const totalTokens = segments.reduce((sum, s) => sum + s.tokens, 0)

    if (totalTokens <= this.maxContextTokens) {
      return segments
    }

    // Sort by priority (descending)
    const sorted = [...segments].sort((a, b) => b.priority - a.priority)

    const optimized: ContextSegment[] = []
    let currentTokens = 0

    // Always include system segments
    for (const segment of sorted) {
      if (segment.type === 'system') {
        optimized.push(segment)
        currentTokens += segment.tokens
      }
    }

    // Add remaining segments by priority
    for (const segment of sorted) {
      if (segment.type === 'system') continue

      if (currentTokens + segment.tokens <= this.maxContextTokens) {
        optimized.push(segment)
        currentTokens += segment.tokens
      } else {
        // Try to compress this segment
        const compressed = this.compressSegment(
          segment,
          this.maxContextTokens - currentTokens
        )
        if (compressed) {
          optimized.push(compressed)
          currentTokens += compressed.tokens
        }
        break
      }
    }

    return optimized
  }

  /**
   * Compress a segment to fit within token budget
   */
  private compressSegment(
    segment: ContextSegment,
    maxTokens: number
  ): ContextSegment | null {
    if (segment.tokens <= maxTokens) {
      return segment
    }

    // Simple compression: truncate to fit
    // In production, you'd use more sophisticated compression
    const ratio = maxTokens / segment.tokens
    const truncateAt = Math.floor(segment.content.length * ratio)

    return {
      ...segment,
      content: segment.content.substring(0, truncateAt) + '...[truncated]',
      tokens: maxTokens,
    }
  }

  /**
   * Structure context for caching
   * Places static content first to maximize cache hits
   */
  structureForCaching(segments: ContextSegment[]): ContextSegment[] {
    // Order: system -> static -> dynamic -> results
    const typeOrder: Record<string, number> = {
      system: 0,
      static: 1,
      dynamic: 2,
      result: 3,
    }

    return [...segments].sort((a, b) => {
      const orderDiff = typeOrder[a.type] - typeOrder[b.type]
      if (orderDiff !== 0) return orderDiff
      return b.priority - a.priority
    })
  }

  /**
   * Estimate token count (approximate)
   */
  estimateTokens(text: string): number {
    // Rough estimate: ~0.75 tokens per word, or ~4 chars per token
    const words = text.split(/\s+/).length
    const chars = text.length
    return Math.ceil(Math.max(words * 0.75, chars / 4))
  }

  /**
   * Create context window
   */
  createWindow(segments: ContextSegment[]): ContextWindow {
    const optimized = this.optimize(segments)
    const structured = this.structureForCaching(optimized)

    return {
      maxTokens: this.maxContextTokens,
      currentTokens: structured.reduce((sum, s) => sum + s.tokens, 0),
      segments: structured,
    }
  }

  /**
   * Summarize old context
   */
  async summarizeContext(
    oldSegments: ContextSegment[],
    summarizer: (text: string) => Promise<string>
  ): Promise<ContextSegment> {
    const combined = oldSegments.map((s) => s.content).join('\n\n')
    const summary = await summarizer(combined)

    return {
      id: 'summary-' + Date.now(),
      content: summary,
      tokens: this.estimateTokens(summary),
      priority: 5,
      type: 'static',
      timestamp: new Date(),
    }
  }
}
