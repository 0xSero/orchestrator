/**
 * Context management
 */
import { randomUUID } from 'crypto'
import type { Context, Scope } from '../types/index.js'
import { StatePersistence } from '../state/persistence.js'

/**
 * Context manager
 */
export class ContextManager {
  private persistence: StatePersistence
  private contexts: Map<string, Context>

  constructor(persistence: StatePersistence) {
    this.persistence = persistence
    this.contexts = new Map()
  }

  /**
   * Create a new context
   */
  createContext(
    projectName: string,
    description: string,
    requirements: string[],
    constraints: string[] = [],
    standards: string[] = [],
    scope?: Partial<Scope>
  ): Context {
    const context: Context = {
      id: randomUUID(),
      projectName,
      description,
      requirements,
      constraints,
      standards,
      scope: {
        goals: scope?.goals || [],
        inScope: scope?.inScope || [],
        outOfScope: scope?.outOfScope || [],
        successCriteria: scope?.successCriteria || [],
      },
      createdAt: new Date(),
      version: '1.0.0',
      immutable: false,
    }

    this.contexts.set(context.id, context)
    this.persistence.saveContext(context)

    return context
  }

  /**
   * Get context by ID
   */
  getContext(id: string): Context | undefined {
    let context = this.contexts.get(id)

    if (!context) {
      // Try loading from persistence
      const loaded = this.persistence.loadContext(id)
      if (loaded) {
        this.contexts.set(id, loaded)
        context = loaded
      }
    }

    return context
  }

  /**
   * Update context scope
   */
  updateScope(contextId: string, scope: Partial<Scope>): void {
    const context = this.getContext(contextId)
    if (!context) {
      throw new Error(`Context not found: ${contextId}`)
    }

    if (context.immutable) {
      throw new Error('Cannot update immutable context')
    }

    context.scope = {
      ...context.scope,
      ...scope,
    }

    this.persistence.saveContext(context)
  }

  /**
   * Make context immutable
   */
  makeImmutable(contextId: string): void {
    const context = this.getContext(contextId)
    if (!context) {
      throw new Error(`Context not found: ${contextId}`)
    }

    context.immutable = true
    this.persistence.saveContext(context)
  }

  /**
   * Validate context
   */
  validate(context: Context): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!context.projectName) {
      errors.push('Project name is required')
    }

    if (!context.description) {
      errors.push('Description is required')
    }

    if (context.requirements.length === 0) {
      errors.push('At least one requirement is required')
    }

    if (context.scope.goals.length === 0) {
      errors.push('At least one goal is required')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
