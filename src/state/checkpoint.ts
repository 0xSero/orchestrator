/**
 * Checkpoint management
 */
import { randomUUID } from 'crypto'
import type { Checkpoint, OrchestratorState, WorkflowStep } from '../types/index.js'
import { StatePersistence } from './persistence.js'
import { EventBus } from '../core/event-bus.js'
import { EventType } from '../types/index.js'

/**
 * Checkpoint manager
 */
export class CheckpointManager {
  private persistence: StatePersistence
  private eventBus: EventBus
  private autoCheckpointInterval?: NodeJS.Timeout

  constructor(persistence: StatePersistence) {
    this.persistence = persistence
    this.eventBus = EventBus.getInstance()
  }

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    sessionId: string,
    step: WorkflowStep,
    state: OrchestratorState,
    gitCommit?: string,
    metadata?: Record<string, unknown>
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: randomUUID(),
      sessionId,
      step,
      timestamp: new Date(),
      state: this.cloneState(state),
      gitCommit,
      metadata: metadata || {},
    }

    this.persistence.saveCheckpoint(checkpoint)

    await this.eventBus.emit(EventType.CHECKPOINT_CREATED, {
      checkpointId: checkpoint.id,
      sessionId,
      step,
    })

    return checkpoint
  }

  /**
   * Load checkpoint by ID
   */
  loadCheckpoint(id: string): Checkpoint | null {
    return this.persistence.loadCheckpoint(id)
  }

  /**
   * Get latest checkpoint for session
   */
  getLatest(sessionId: string): Checkpoint | null {
    return this.persistence.getLatestCheckpoint(sessionId)
  }

  /**
   * Get all checkpoints for session
   */
  getAll(sessionId: string): Checkpoint[] {
    return this.persistence.getCheckpoints(sessionId)
  }

  /**
   * Restore state from checkpoint
   */
  restore(checkpoint: Checkpoint): OrchestratorState {
    return this.cloneState(checkpoint.state)
  }

  /**
   * Start automatic checkpointing
   */
  startAutoCheckpoint(
    sessionId: string,
    getState: () => OrchestratorState,
    interval: number
  ): void {
    if (this.autoCheckpointInterval) {
      clearInterval(this.autoCheckpointInterval)
    }

    this.autoCheckpointInterval = setInterval(async () => {
      const state = getState()
      await this.createCheckpoint(sessionId, state.currentStep, state, undefined, {
        auto: true,
      })
    }, interval)
  }

  /**
   * Stop automatic checkpointing
   */
  stopAutoCheckpoint(): void {
    if (this.autoCheckpointInterval) {
      clearInterval(this.autoCheckpointInterval)
      this.autoCheckpointInterval = undefined
    }
  }

  /**
   * Clean old checkpoints
   */
  cleanOld(retentionDays: number): number {
    return this.persistence.cleanOldCheckpoints(retentionDays)
  }

  /**
   * Deep clone state object
   */
  private cloneState(state: OrchestratorState): OrchestratorState {
    return JSON.parse(JSON.stringify(state))
  }
}
