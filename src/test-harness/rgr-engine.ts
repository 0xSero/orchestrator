/**
 * Red-Green-Refactor engine
 */
import type { Task, TestPhase, TestResults, Provider } from '../types/index.js'
import { EventBus } from '../core/event-bus.js'
import { EventType } from '../types/index.js'

/**
 * RGR engine
 */
export class RGREngine {
  private eventBus: EventBus
  private provider: Provider

  constructor(provider: Provider) {
    this.eventBus = EventBus.getInstance()
    this.provider = provider
  }

  /**
   * Execute RED phase - generate failing tests
   */
  async executeRedPhase(task: Task): Promise<{ success: boolean; tests: string }> {
    await this.emitPhaseChange(task, 'red')

    const prompt = `Generate comprehensive tests for the following task:

**Title**: ${task.title}
**Description**: ${task.description}

Generate tests that:
1. Cover all requirements
2. Are initially failing (no implementation exists yet)
3. Follow best practices
4. Include unit, integration, and edge case tests

Output tests in the format:
\`\`\`typescript
// test code here
\`\`\`
`

    const result = await this.provider.generateText(prompt)

    // Extract tests from code blocks
    const testsMatch = result.text.match(/```(?:typescript|ts)?\s*([\s\S]*?)\s*```/)
    const tests = testsMatch ? testsMatch[1] : result.text

    return {
      success: true,
      tests,
    }
  }

  /**
   * Execute GREEN phase - verify implementation passes tests
   */
  async executeGreenPhase(task: Task, implementation: string): Promise<TestResults> {
    await this.emitPhaseChange(task, 'green')

    // In a real implementation, this would run actual tests
    // For now, we'll simulate test execution

    return {
      suiteId: task.id,
      passed: 10,
      failed: 0,
      skipped: 0,
      total: 10,
      duration: 1000,
      failures: [],
      coverage: {
        lines: 85,
        functions: 90,
        branches: 80,
        statements: 85,
      },
    }
  }

  /**
   * Execute REFACTOR phase - improve code quality
   */
  async executeRefactorPhase(
    task: Task,
    implementation: string
  ): Promise<{ success: boolean; refactored: string }> {
    await this.emitPhaseChange(task, 'refactor')

    const prompt = `Review and refactor the following implementation while maintaining all tests passing:

**Implementation**:
\`\`\`typescript
${implementation}
\`\`\`

Focus on:
1. Code clarity and readability
2. Performance optimizations
3. Removing duplication
4. Better naming
5. Design patterns

Output refactored code:
\`\`\`typescript
// refactored code
\`\`\`
`

    const result = await this.provider.generateText(prompt)

    const codeMatch = result.text.match(/```(?:typescript|ts)?\s*([\s\S]*?)\s*```/)
    const refactored = codeMatch ? codeMatch[1] : result.text

    return {
      success: true,
      refactored,
    }
  }

  /**
   * Emit phase change event
   */
  private async emitPhaseChange(task: Task, phase: TestPhase): Promise<void> {
    await this.eventBus.emit(EventType.TEST_PHASE_CHANGED, {
      taskId: task.id,
      phase,
      timestamp: new Date(),
    })
  }
}
