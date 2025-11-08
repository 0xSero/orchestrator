/**
 * Planner agent - analyzes requirements and creates tasks
 */
import { BaseAgent } from './base-agent.js'
import {
  AgentType,
  type AgentResult,
  type Task,
  type Context,
  WorkflowStep,
  TaskStatus,
  TaskPriority,
} from '../types/index.js'
import { randomUUID } from 'crypto'

/**
 * Planner agent implementation
 */
export class PlannerAgent extends BaseAgent {
  type = AgentType.PLANNER
  name = 'Planner'
  description = 'Analyzes requirements, creates project scope, and breaks down work into tasks'
  capabilities = ['requirement-analysis', 'task-decomposition', 'scope-definition', 'planning']

  protected getSystemPrompt(): string {
    return `You are a software engineering planner agent. Your role is to:

1. Analyze user requirements thoroughly
2. Define clear project scope (goals, in-scope, out-of-scope, success criteria)
3. Break down work into atomic, manageable tasks
4. Identify task dependencies
5. Prioritize tasks appropriately
6. Ensure all requirements are covered

Output your plan in the following JSON format:
{
  "analysis": "Your analysis of the requirements",
  "scope": {
    "goals": ["goal1", "goal2"],
    "inScope": ["item1", "item2"],
    "outOfScope": ["item1", "item2"],
    "successCriteria": ["criteria1", "criteria2"]
  },
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description",
      "priority": 0-3,
      "dependencies": ["task-id"],
      "estimatedComplexity": "low|medium|high"
    }
  ]
}

Be thorough, specific, and ensure tasks are testable and well-defined.`
  }

  async execute(task: Task, context: Context): Promise<AgentResult> {
    await this.emitStarted(task)

    try {
      const prompt = this.buildPlannerPrompt(task, context)
      const response = await this.generate(prompt)

      // Parse the response
      const plan = this.parsePlanResponse(response)

      // Create task objects
      const tasks = this.createTasks(plan.tasks, task.id)

      const result: AgentResult = {
        success: true,
        output: plan.analysis,
        artifacts: [
          {
            id: randomUUID(),
            type: 'data',
            path: 'plan.json',
            content: JSON.stringify(plan, null, 2),
            metadata: {
              taskCount: tasks.length,
              scope: plan.scope,
            },
          },
        ],
        nextStep: WorkflowStep.TEST_GEN,
        suggestions: [
          `Created ${tasks.length} tasks from requirements`,
          'Ready to generate tests for the first task',
        ],
      }

      await this.emitCompleted(task, result)
      return result
    } catch (error) {
      const result: AgentResult = {
        success: false,
        output: '',
        artifacts: [],
        errors: [
          {
            code: 'PLANNING_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'high',
          },
        ],
      }

      await this.emitCompleted(task, result)
      return result
    }
  }

  private buildPlannerPrompt(task: Task, context: Context): string {
    return `${this.formatContext(context)}

${this.formatTask(task)}

Please analyze these requirements and create a comprehensive plan. Break down the work into specific, testable tasks with clear acceptance criteria.`
  }

  private parsePlanResponse(response: string): any {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Could not parse plan response')
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0]
    return JSON.parse(jsonStr)
  }

  private createTasks(taskDefinitions: any[], parentTaskId: string): Task[] {
    const tasks: Task[] = []
    const now = new Date()

    for (let i = 0; i < taskDefinitions.length; i++) {
      const def = taskDefinitions[i]
      const taskId = `task-${randomUUID().slice(0, 8)}`

      tasks.push({
        id: taskId,
        title: def.title,
        description: def.description,
        status: TaskStatus.PENDING,
        priority: this.mapPriority(def.priority),
        dependencies: def.dependencies || [],
        createdAt: now,
        updatedAt: now,
        metadata: {
          estimatedComplexity: def.estimatedComplexity,
          order: i,
        },
        parentTaskId,
      })
    }

    return tasks
  }

  private mapPriority(priority: number | string): TaskPriority {
    if (typeof priority === 'number') {
      return priority as TaskPriority
    }

    const map: Record<string, TaskPriority> = {
      low: TaskPriority.LOW,
      medium: TaskPriority.MEDIUM,
      high: TaskPriority.HIGH,
      critical: TaskPriority.CRITICAL,
    }

    return map[priority.toLowerCase()] || TaskPriority.MEDIUM
  }
}
