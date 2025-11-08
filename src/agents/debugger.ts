/**
 * Debugger agent - fixes bugs and inefficiencies
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
 * Debugger agent implementation
 */
export class DebuggerAgent extends BaseAgent {
  type = AgentType.DEBUGGER
  name = 'Debugger'
  description = 'Analyzes and fixes bugs, performance issues, and inefficiencies'
  capabilities = ['debugging', 'bug-fixing', 'optimization', 'root-cause-analysis']

  protected getSystemPrompt(): string {
    return `You are a software engineering debugger agent. Your role is to:

1. Analyze bugs and issues identified by the reviewer
2. Perform root cause analysis
3. Fix bugs while maintaining test coverage
4. Address performance and efficiency issues
5. Ensure fixes don't introduce new problems

Output your fix as:
{
  "analysis": "Root cause analysis",
  "fixes": [
    {
      "file": "path/to/file",
      "original": "original code",
      "fixed": "fixed code",
      "explanation": "Why this fixes the issue"
    }
  ],
  "testChanges": [
    {
      "file": "path/to/test",
      "changes": "test updates if needed"
    }
  ],
  "summary": "Summary of fixes applied",
  "verified": true/false
}

Be precise and ensure your fixes actually resolve the issues without creating new ones.`
  }

  async execute(task: Task, context: Context): Promise<AgentResult> {
    await this.emitStarted(task)

    try {
      const prompt = this.buildDebuggerPrompt(task, context)
      const response = await this.generate(prompt)

      // Parse the response
      const debug = this.parseDebugResponse(response)

      // Create artifacts for fixes
      const artifacts = debug.fixes.map((fix: any) => ({
        id: randomUUID(),
        type: ArtifactType.CODE,
        path: fix.file,
        content: fix.fixed,
        metadata: {
          taskId: task.id,
          phase: 'debug',
          original: fix.original,
          explanation: fix.explanation,
        },
      }))

      const result: AgentResult = {
        success: debug.verified !== false,
        output: debug.summary,
        artifacts,
        nextStep: WorkflowStep.REVIEW,
        suggestions: [`Applied ${debug.fixes.length} fixes`, 'Ready for re-review'],
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
            code: 'DEBUG_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'high',
          },
        ],
      }

      await this.emitCompleted(task, result)
      return result
    }
  }

  private buildDebuggerPrompt(task: Task, context: Context): string {
    const issues = task.metadata.reviewIssues || []

    return `${this.formatContext(context)}

${this.formatTask(task)}

## Issues to Fix
${JSON.stringify(issues, null, 2)}

${task.metadata.implementation ? `## Current Implementation\n\`\`\`\n${task.metadata.implementation}\n\`\`\`` : ''}

Please analyze and fix these issues. Ensure your fixes resolve the problems without introducing new ones.`
  }

  private parseDebugResponse(response: string): any {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Could not parse debug response')
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0]
    return JSON.parse(jsonStr)
  }
}
