/**
 * Executor agent - implements tasks
 */
import { BaseAgent } from './base-agent.js'
import {
  AgentType,
  type AgentResult,
  type Task,
  type Context,
  WorkflowStep,
  ArtifactType,
} from '../types/index.js'
import { randomUUID } from 'crypto'

/**
 * Executor agent implementation
 */
export class ExecutorAgent extends BaseAgent {
  type = AgentType.EXECUTOR
  name = 'Executor'
  description = 'Implements tasks by writing code to pass tests (GREEN phase of RGR)'
  capabilities = ['code-generation', 'implementation', 'problem-solving']

  protected getSystemPrompt(): string {
    return `You are a software engineering executor agent. Your role is to:

1. Implement code that passes the failing tests (GREEN phase of RGR)
2. Write minimal, clean code that satisfies requirements
3. Follow the project's coding standards and constraints
4. Focus on making tests pass, not on optimization (that comes in REFACTOR)
5. Document your code appropriately

You will receive:
- Project context with standards and constraints
- Task description
- Failing tests that need to pass

Output your implementation as:
{
  "implementation": "Your code implementation",
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "content": "file content"
    }
  ],
  "summary": "Brief summary of what you implemented",
  "testsPassing": true/false
}

Write production-quality code that is correct, maintainable, and follows best practices.`
  }

  async execute(task: Task, context: Context): Promise<AgentResult> {
    await this.emitStarted(task)

    try {
      const prompt = this.buildExecutorPrompt(task, context)
      const response = await this.generate(prompt)

      // Parse the response
      const implementation = this.parseImplementationResponse(response)

      // Create artifacts for each file
      const artifacts = implementation.files.map((file: any) => ({
        id: randomUUID(),
        type: ArtifactType.CODE,
        path: file.path,
        content: file.content,
        metadata: {
          taskId: task.id,
          phase: 'green',
        },
      }))

      const result: AgentResult = {
        success: implementation.testsPassing !== false,
        output: implementation.summary,
        artifacts,
        nextStep: WorkflowStep.REVIEW,
        suggestions: ['Code implemented', 'Ready for review'],
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
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'high',
          },
        ],
      }

      await this.emitCompleted(task, result)
      return result
    }
  }

  private buildExecutorPrompt(task: Task, context: Context): string {
    return `${this.formatContext(context)}

${this.formatTask(task)}

${task.metadata.tests ? `## Tests to Pass\n\`\`\`\n${task.metadata.tests}\n\`\`\`` : ''}

Please implement the code to complete this task and pass the tests. Follow the GREEN phase of Red-Green-Refactor: write minimal code to make tests pass.`
  }

  private parseImplementationResponse(response: string): any {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Could not parse implementation response')
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0]
    return JSON.parse(jsonStr)
  }
}
