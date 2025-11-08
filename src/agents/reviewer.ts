/**
 * Reviewer agent - reviews code quality and correctness
 */
import { BaseAgent } from './base-agent.js'
import {
  AgentType,
  type AgentResult,
  type Task,
  type Context,
  WorkflowStep,
} from '../types/index.js'

/**
 * Reviewer agent implementation
 */
export class ReviewerAgent extends BaseAgent {
  type = AgentType.REVIEWER
  name = 'Reviewer'
  description = 'Reviews implementation against scope, runs tests, checks quality'
  capabilities = ['code-review', 'quality-assurance', 'testing', 'validation']

  protected getSystemPrompt(): string {
    return `You are a software engineering reviewer agent. Your role is to:

1. Review code against project scope and task requirements
2. Check code quality (readability, maintainability, patterns)
3. Verify tests pass
4. Validate type safety
5. Check for security vulnerabilities
6. Ensure standards compliance
7. Identify opportunities for refactoring

Output your review as:
{
  "approved": true/false,
  "summary": "Overall review summary",
  "issues": [
    {
      "severity": "low|medium|high|critical",
      "type": "bug|quality|security|style|performance",
      "description": "Issue description",
      "location": "file:line",
      "suggestion": "How to fix"
    }
  ],
  "testResults": {
    "passed": true/false,
    "coverage": 85,
    "details": "Test results"
  },
  "recommendations": ["recommendation1", "recommendation2"]
}

Be thorough but constructive. Focus on real issues that impact correctness, security, or maintainability.`
  }

  async execute(task: Task, context: Context): Promise<AgentResult> {
    await this.emitStarted(task)

    try {
      const prompt = this.buildReviewerPrompt(task, context)
      const response = await this.generate(prompt)

      // Parse the response
      const review = this.parseReviewResponse(response)

      // Determine next step based on review
      let nextStep: WorkflowStep
      if (review.approved) {
        nextStep = WorkflowStep.INTEGRATE
      } else {
        // Check if issues are critical enough for debugging
        const hasCriticalIssues = review.issues.some(
          (i: any) => i.severity === 'critical' || i.severity === 'high'
        )
        nextStep = hasCriticalIssues ? WorkflowStep.DEBUG : WorkflowStep.EXECUTE
      }

      const result: AgentResult = {
        success: review.approved,
        output: review.summary,
        artifacts: [
          {
            id: task.id + '-review',
            type: 'data',
            path: 'review.json',
            content: JSON.stringify(review, null, 2),
            metadata: {
              issueCount: review.issues.length,
              approved: review.approved,
            },
          },
        ],
        nextStep,
        suggestions: review.recommendations,
        errors: review.issues.map((issue: any) => ({
          code: issue.type.toUpperCase(),
          message: issue.description,
          severity: issue.severity,
          context: {
            location: issue.location,
            suggestion: issue.suggestion,
          },
        })),
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
            code: 'REVIEW_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'high',
          },
        ],
      }

      await this.emitCompleted(task, result)
      return result
    }
  }

  private buildReviewerPrompt(task: Task, context: Context): string {
    return `${this.formatContext(context)}

${this.formatTask(task)}

${task.metadata.implementation ? `## Implementation\n\`\`\`\n${task.metadata.implementation}\n\`\`\`` : ''}

Please review this implementation thoroughly. Check it against the scope, requirements, and quality standards.`
  }

  private parseReviewResponse(response: string): any {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Could not parse review response')
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0]
    return JSON.parse(jsonStr)
  }
}
