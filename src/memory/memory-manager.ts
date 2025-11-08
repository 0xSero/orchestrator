/**
 * Memory management for conversational context
 */

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  tokens?: number
  metadata?: Record<string, unknown>
}

export interface Memory {
  id: string
  messages: Message[]
  summary?: string
  metadata: Record<string, unknown>
}

/**
 * Base memory interface
 */
export abstract class BaseMemory {
  abstract add(message: Message): Promise<void>
  abstract get(): Promise<Message[]>
  abstract clear(): Promise<void>
  abstract getSummary(): Promise<string | null>
}

/**
 * Buffer window memory - keeps last N messages
 */
export class BufferWindowMemory extends BaseMemory {
  private messages: Message[] = []
  private maxMessages: number

  constructor(maxMessages: number = 10) {
    super()
    this.maxMessages = maxMessages
  }

  async add(message: Message): Promise<void> {
    this.messages.push(message)

    // Keep only last N messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages)
    }
  }

  async get(): Promise<Message[]> {
    return [...this.messages]
  }

  async clear(): Promise<void> {
    this.messages = []
  }

  async getSummary(): Promise<string | null> {
    if (this.messages.length === 0) return null

    return `Conversation with ${this.messages.length} messages`
  }
}

/**
 * Summary memory - summarizes old messages
 */
export class SummaryMemory extends BaseMemory {
  private messages: Message[] = []
  private summary: string = ''
  private maxMessages: number
  private summarizer: (messages: Message[]) => Promise<string>

  constructor(
    maxMessages: number,
    summarizer: (messages: Message[]) => Promise<string>
  ) {
    super()
    this.maxMessages = maxMessages
    this.summarizer = summarizer
  }

  async add(message: Message): Promise<void> {
    this.messages.push(message)

    // Summarize if exceeds limit
    if (this.messages.length > this.maxMessages) {
      const toSummarize = this.messages.slice(0, -this.maxMessages)
      const newSummary = await this.summarizer(toSummarize)

      this.summary = this.summary
        ? `${this.summary}\n\n${newSummary}`
        : newSummary

      this.messages = this.messages.slice(-this.maxMessages)
    }
  }

  async get(): Promise<Message[]> {
    const messages: Message[] = []

    // Add summary as system message if exists
    if (this.summary) {
      messages.push({
        role: 'system',
        content: `Previous conversation summary:\n${this.summary}`,
        timestamp: new Date(),
      })
    }

    messages.push(...this.messages)
    return messages
  }

  async clear(): Promise<void> {
    this.messages = []
    this.summary = ''
  }

  async getSummary(): Promise<string | null> {
    return this.summary || null
  }
}

/**
 * Token-based memory - manages by token count
 */
export class TokenMemory extends BaseMemory {
  private messages: Message[] = []
  private maxTokens: number
  private currentTokens: number = 0
  private tokenEstimator: (text: string) => number

  constructor(
    maxTokens: number,
    tokenEstimator: (text: string) => number
  ) {
    super()
    this.maxTokens = maxTokens
    this.tokenEstimator = tokenEstimator
  }

  async add(message: Message): Promise<void> {
    const tokens = message.tokens || this.tokenEstimator(message.content)
    message.tokens = tokens

    this.messages.push(message)
    this.currentTokens += tokens

    // Remove old messages if over budget
    while (
      this.currentTokens > this.maxTokens &&
      this.messages.length > 1
    ) {
      const removed = this.messages.shift()
      if (removed?.tokens) {
        this.currentTokens -= removed.tokens
      }
    }
  }

  async get(): Promise<Message[]> {
    return [...this.messages]
  }

  async clear(): Promise<void> {
    this.messages = []
    this.currentTokens = 0
  }

  async getSummary(): Promise<string | null> {
    return `${this.currentTokens}/${this.maxTokens} tokens used`
  }

  getTokenUsage() {
    return {
      current: this.currentTokens,
      max: this.maxTokens,
      percentage: (this.currentTokens / this.maxTokens) * 100,
    }
  }
}

/**
 * Hybrid memory - combines buffer with summary
 */
export class HybridMemory extends BaseMemory {
  private bufferMemory: BufferWindowMemory
  private summaryMemory: SummaryMemory

  constructor(
    bufferSize: number,
    summarizer: (messages: Message[]) => Promise<string>
  ) {
    super()
    this.bufferMemory = new BufferWindowMemory(bufferSize)
    this.summaryMemory = new SummaryMemory(bufferSize * 2, summarizer)
  }

  async add(message: Message): Promise<void> {
    await this.bufferMemory.add(message)
    await this.summaryMemory.add(message)
  }

  async get(): Promise<Message[]> {
    // Get summary context
    const summaryMessages = await this.summaryMemory.get()

    // Get recent buffer
    const bufferMessages = await this.bufferMemory.get()

    // Deduplicate
    const recentIds = new Set(
      bufferMessages.map((m) => m.timestamp.getTime())
    )

    const filtered = summaryMessages.filter(
      (m) => !recentIds.has(m.timestamp.getTime())
    )

    return [...filtered, ...bufferMessages]
  }

  async clear(): Promise<void> {
    await this.bufferMemory.clear()
    await this.summaryMemory.clear()
  }

  async getSummary(): Promise<string | null> {
    return await this.summaryMemory.getSummary()
  }
}
