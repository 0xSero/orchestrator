/**
 * Base agent class
 */
import type {
  Agent,
  AgentType,
  AgentResult,
  Task,
  Context,
  Provider,
  GenerateOptions,
} from '../types/index.js'
import { EventBus } from '../core/event-bus.js'
import { EventType } from '../types/index.js'

/**
 * Abstract base agent
 */
export abstract class BaseAgent implements Agent {
  abstract type: AgentType
  abstract name: string
  abstract description: string
  abstract capabilities: string[]

  protected provider: Provider
  protected eventBus: EventBus
  protected options?: GenerateOptions

  constructor(provider: Provider, options?: GenerateOptions) {
    this.provider = provider
    this.eventBus = EventBus.getInstance()
    this.options = options
  }

  /**
   * Execute the agent's task
   */
  abstract execute(task: Task, context: Context): Promise<AgentResult>

  /**
   * Generate a system prompt for this agent
   */
  protected abstract getSystemPrompt(): string

  /**
   * Call the provider with a prompt
   */
  protected async generate(userPrompt: string, customSystemPrompt?: string): Promise<string> {
    const systemPrompt = customSystemPrompt || this.getSystemPrompt()

    const result = await this.provider.generateText(userPrompt, {
      ...this.options,
      systemPrompt,
    })

    return result.text
  }

  /**
   * Emit agent started event
   */
  protected async emitStarted(task: Task): Promise<void> {
    await this.eventBus.emit(EventType.AGENT_STARTED, {
      agentType: this.type,
      taskId: task.id,
      timestamp: new Date(),
    })
  }

  /**
   * Emit agent completed event
   */
  protected async emitCompleted(task: Task, result: AgentResult): Promise<void> {
    await this.eventBus.emit(EventType.AGENT_COMPLETED, {
      agentType: this.type,
      taskId: task.id,
      success: result.success,
      timestamp: new Date(),
    })
  }

  /**
   * Format context for the agent
   */
  protected formatContext(context: Context): string {
    return `
# Project Context

**Project**: ${context.projectName}

**Description**: ${context.description}

## Goals
${context.scope.goals.map((g) => `- ${g}`).join('\n')}

## Requirements
${context.requirements.map((r) => `- ${r}`).join('\n')}

## Constraints
${context.constraints.map((c) => `- ${c}`).join('\n')}

## Standards
${context.standards.map((s) => `- ${s}`).join('\n')}

## In Scope
${context.scope.inScope.map((s) => `- ${s}`).join('\n')}

## Out of Scope
${context.scope.outOfScope.map((s) => `- ${s}`).join('\n')}

## Success Criteria
${context.scope.successCriteria.map((c) => `- ${c}`).join('\n')}
`.trim()
  }

  /**
   * Format task for the agent
   */
  protected formatTask(task: Task): string {
    return `
# Task

**ID**: ${task.id}
**Title**: ${task.title}
**Description**: ${task.description}
**Priority**: ${task.priority}
**Status**: ${task.status}
${task.dependencies.length > 0 ? `**Dependencies**: ${task.dependencies.join(', ')}` : ''}
`.trim()
  }
}
