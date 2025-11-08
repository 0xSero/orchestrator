/**
 * Event bus for orchestrator events
 */
import type { Event, EventType, EventHandler } from '../types/index.js'

/**
 * Event bus implementation
 */
export class EventBus {
  private static instance: EventBus
  private handlers: Map<EventType, Set<EventHandler>>

  private constructor() {
    this.handlers = new Map()
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus()
    }
    return EventBus.instance
  }

  /**
   * Subscribe to an event type
   */
  on<T = unknown>(eventType: EventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }

    this.handlers.get(eventType)!.add(handler as EventHandler)

    // Return unsubscribe function
    return () => {
      this.off(eventType, handler)
    }
  }

  /**
   * Subscribe to an event type once
   */
  once<T = unknown>(eventType: EventType, handler: EventHandler<T>): void {
    const wrappedHandler: EventHandler<T> = async (event) => {
      await handler(event)
      this.off(eventType, wrappedHandler)
    }
    this.on(eventType, wrappedHandler)
  }

  /**
   * Unsubscribe from an event type
   */
  off<T = unknown>(eventType: EventType, handler: EventHandler<T>): void {
    const handlersSet = this.handlers.get(eventType)
    if (handlersSet) {
      handlersSet.delete(handler as EventHandler)
    }
  }

  /**
   * Emit an event
   */
  async emit<T = unknown>(eventType: EventType, payload: T, metadata?: Record<string, unknown>) {
    const event: Event<T> = {
      type: eventType,
      timestamp: new Date(),
      payload,
      metadata,
    }

    const handlersSet = this.handlers.get(eventType)
    if (!handlersSet || handlersSet.size === 0) {
      return
    }

    // Execute all handlers
    const promises = Array.from(handlersSet).map((handler) => {
      try {
        return Promise.resolve(handler(event as Event<unknown>))
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error)
        return Promise.resolve()
      }
    })

    await Promise.all(promises)
  }

  /**
   * Remove all handlers for an event type
   */
  removeAllListeners(eventType?: EventType): void {
    if (eventType) {
      this.handlers.delete(eventType)
    } else {
      this.handlers.clear()
    }
  }

  /**
   * Get count of handlers for an event type
   */
  listenerCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.size ?? 0
  }
}
