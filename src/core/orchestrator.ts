/**
 * Main orchestrator
 */
import { randomUUID } from 'crypto'
import type {
  OrchestratorState,
  OrchestratorConfig,
  Context,
  Task,
  WorkflowStep,
} from '../types/index.js'
import { StateMachine } from './state-machine.js'
import { EventBus } from './event-bus.js'
import { StatePersistence } from '../state/persistence.js'
import { CheckpointManager } from '../state/checkpoint.js'
import { TaskManager } from '../tasks/task-manager.js'
import { ContextManager } from '../context/context-manager.js'
import { WorktreeManager } from '../git/worktree-manager.js'
import { BranchManager } from '../git/branch-manager.js'
import { ProviderFactory } from '../providers/index.js'
import { PlannerAgent, ExecutorAgent, ReviewerAgent, DebuggerAgent } from '../agents/index.js'
import { RGREngine } from '../test-harness/rgr-engine.js'

/**
 * Main orchestrator class
 */
export class Orchestrator {
  private config: OrchestratorConfig
  private state: OrchestratorState
  private stateMachine: StateMachine
  private eventBus: EventBus
  private persistence: StatePersistence
  private checkpointManager: CheckpointManager
  private taskManager: TaskManager
  private contextManager: ContextManager
  private worktreeManager: WorktreeManager
  private branchManager: BranchManager
  private rgrEngine: RGREngine

  private provider: any
  private plannerAgent: PlannerAgent
  private executorAgent: ExecutorAgent
  private reviewerAgent: ReviewerAgent
  private debuggerAgent: DebuggerAgent

  constructor(config: OrchestratorConfig, repoPath: string = process.cwd()) {
    this.config = config

    // Initialize state
    const sessionId = randomUUID()
    this.state = {
      sessionId,
      currentStep: WorkflowStep.INIT,
      tasks: [],
      completedTasks: [],
      failedTasks: [],
      context: {} as Context,
      metadata: {},
    }

    // Initialize core systems
    this.stateMachine = new StateMachine()
    this.eventBus = EventBus.getInstance()
    this.persistence = new StatePersistence(config.state.dbPath)
    this.checkpointManager = new CheckpointManager(this.persistence)
    this.taskManager = new TaskManager(sessionId, this.persistence)
    this.contextManager = new ContextManager(this.persistence)

    // Initialize git
    this.worktreeManager = new WorktreeManager(
      repoPath,
      config.git.worktreeDir,
      config.git.branchPrefix
    )
    this.branchManager = new BranchManager(this.worktreeManager)

    // Initialize provider
    this.provider = ProviderFactory.create(config.provider)

    // Initialize test harness
    this.rgrEngine = new RGREngine(this.provider)

    // Initialize agents
    this.plannerAgent = new PlannerAgent(this.provider, config.agents.planner)
    this.executorAgent = new ExecutorAgent(this.provider, config.agents.executor)
    this.reviewerAgent = new ReviewerAgent(this.provider, config.agents.reviewer)
    this.debuggerAgent = new DebuggerAgent(this.provider, config.agents.debugger)
  }

  /**
   * Start a new orchestration session
   */
  async start(prompt: string, projectName: string): Promise<void> {
    console.log(`Starting orchestration session for: ${projectName}`)

    // Create context
    const context = this.contextManager.createContext(projectName, prompt, [prompt])
    this.state.context = context

    // Initialize git
    await this.worktreeManager.initialize()

    // Start auto-checkpointing
    this.checkpointManager.startAutoCheckpoint(
      this.state.sessionId,
      () => this.state,
      this.config.state.checkpointInterval
    )

    // Transition to planning
    await this.stateMachine.transition(WorkflowStep.PLAN)
    this.state.currentStep = WorkflowStep.PLAN

    // Execute planning
    await this.executePlanning(prompt)

    // Main execution loop
    await this.executeLoop()

    console.log('Orchestration session completed')
  }

  /**
   * Execute planning phase
   */
  private async executePlanning(prompt: string): Promise<void> {
    console.log('Planning phase...')

    const planningTask = await this.taskManager.createTask('Initial Planning', prompt, 3)

    const result = await this.plannerAgent.execute(planningTask, this.state.context)

    if (result.success && result.artifacts.length > 0) {
      // Parse plan and create tasks
      const plan = JSON.parse(result.artifacts[0].content || '{}')

      // Update context with scope
      if (plan.scope) {
        this.contextManager.updateScope(this.state.context.id, plan.scope)
        this.contextManager.makeImmutable(this.state.context.id)
      }

      // Create tasks
      if (plan.tasks) {
        for (const taskDef of plan.tasks) {
          await this.taskManager.createTask(
            taskDef.title,
            taskDef.description,
            taskDef.priority,
            taskDef.dependencies,
            { estimatedComplexity: taskDef.estimatedComplexity }
          )
        }
      }
    }

    await this.taskManager.updateTaskStatus(planningTask.id, 'completed')
  }

  /**
   * Main execution loop
   */
  private async executeLoop(): Promise<void> {
    while (!this.taskManager.allTasksCompleted()) {
      const task = this.taskManager.getNextTask()

      if (!task) {
        console.log('No ready tasks, waiting...')
        break
      }

      console.log(`Executing task: ${task.title}`)

      await this.executeTask(task)

      // Create checkpoint after each task
      await this.checkpointManager.createCheckpoint(
        this.state.sessionId,
        this.state.currentStep,
        this.state
      )
    }
  }

  /**
   * Execute a single task through RGR cycle
   */
  private async executeTask(task: Task): Promise<void> {
    // RED phase - generate tests
    const redResult = await this.rgrEngine.executeRedPhase(task)
    task.metadata.tests = redResult.tests

    // GREEN phase - implement
    const execResult = await this.executorAgent.execute(task, this.state.context)

    if (execResult.success) {
      task.metadata.implementation = execResult.artifacts[0]?.content

      // REFACTOR phase
      const refactorResult = await this.rgrEngine.executeRefactorPhase(
        task,
        task.metadata.implementation as string
      )

      if (refactorResult.success) {
        task.metadata.implementation = refactorResult.refactored
      }

      // REVIEW phase
      const reviewResult = await this.reviewerAgent.execute(task, this.state.context)

      if (reviewResult.success) {
        await this.taskManager.updateTaskStatus(task.id, 'completed')
      } else {
        // DEBUG phase if needed
        task.metadata.reviewIssues = reviewResult.errors

        const debugResult = await this.debuggerAgent.execute(task, this.state.context)

        if (debugResult.success) {
          // Re-review after debug
          const reReviewResult = await this.reviewerAgent.execute(task, this.state.context)

          if (reReviewResult.success) {
            await this.taskManager.updateTaskStatus(task.id, 'completed')
          } else {
            await this.taskManager.updateTaskStatus(task.id, 'failed')
          }
        } else {
          await this.taskManager.updateTaskStatus(task.id, 'failed')
        }
      }
    } else {
      await this.taskManager.updateTaskStatus(task.id, 'failed')
    }
  }

  /**
   * Resume from checkpoint
   */
  async resume(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpointManager.loadCheckpoint(checkpointId)

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    this.state = this.checkpointManager.restore(checkpoint)
    this.stateMachine.reset(checkpoint.step)

    console.log(`Resumed from checkpoint: ${checkpointId}`)

    // Continue execution
    await this.executeLoop()
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return { ...this.state }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    this.checkpointManager.stopAutoCheckpoint()
    this.persistence.close()
  }
}
