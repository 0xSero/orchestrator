/**
 * State machine for orchestrator workflow
 */
import { WorkflowStep, EventType } from '../types/index.js'
import { EventBus } from './event-bus.js'

/**
 * Valid state transitions
 */
const TRANSITIONS: Record<WorkflowStep, WorkflowStep[]> = {
  [WorkflowStep.INIT]: [WorkflowStep.PLAN],
  [WorkflowStep.PLAN]: [WorkflowStep.TEST_GEN, WorkflowStep.COMPLETE],
  [WorkflowStep.TEST_GEN]: [WorkflowStep.EXECUTE],
  [WorkflowStep.EXECUTE]: [WorkflowStep.REVIEW],
  [WorkflowStep.REVIEW]: [WorkflowStep.INTEGRATE, WorkflowStep.DEBUG],
  [WorkflowStep.DEBUG]: [WorkflowStep.REVIEW],
  [WorkflowStep.INTEGRATE]: [WorkflowStep.PLAN, WorkflowStep.COMPLETE],
  [WorkflowStep.COMPLETE]: [],
}

/**
 * State machine for workflow management
 */
export class StateMachine {
  private currentState: WorkflowStep
  private eventBus: EventBus
  private history: WorkflowStep[]

  constructor(initialState: WorkflowStep = WorkflowStep.INIT) {
    this.currentState = initialState
    this.eventBus = EventBus.getInstance()
    this.history = [initialState]
  }

  /**
   * Get current state
   */
  getState(): WorkflowStep {
    return this.currentState
  }

  /**
   * Get state history
   */
  getHistory(): readonly WorkflowStep[] {
    return Object.freeze([...this.history])
  }

  /**
   * Check if transition is valid
   */
  canTransition(to: WorkflowStep): boolean {
    const allowedTransitions = TRANSITIONS[this.currentState]
    return allowedTransitions.includes(to)
  }

  /**
   * Transition to new state
   */
  async transition(to: WorkflowStep): Promise<void> {
    if (!this.canTransition(to)) {
      throw new Error(
        `Invalid transition from ${this.currentState} to ${to}. ` +
          `Allowed transitions: ${TRANSITIONS[this.currentState].join(', ')}`
      )
    }

    const from = this.currentState
    this.currentState = to
    this.history.push(to)

    // Emit event
    await this.eventBus.emit(EventType.WORKFLOW_STEP_CHANGED, {
      from,
      to,
      timestamp: new Date(),
    })
  }

  /**
   * Reset to initial state
   */
  reset(initialState: WorkflowStep = WorkflowStep.INIT): void {
    this.currentState = initialState
    this.history = [initialState]
  }

  /**
   * Check if in final state
   */
  isComplete(): boolean {
    return this.currentState === WorkflowStep.COMPLETE
  }

  /**
   * Get next possible steps
   */
  getNextSteps(): WorkflowStep[] {
    return [...TRANSITIONS[this.currentState]]
  }
}
