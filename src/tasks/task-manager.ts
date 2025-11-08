/**
 * Task management system
 */
import { randomUUID } from 'crypto'
import type { Task, TaskStatus, TaskPriority, AgentType } from '../types/index.js'
import { EventBus } from '../core/event-bus.js'
import { EventType } from '../types/index.js'
import { StatePersistence } from '../state/persistence.js'

/**
 * Task manager
 */
export class TaskManager {
  private tasks: Map<string, Task>
  private eventBus: EventBus
  private persistence: StatePersistence
  private sessionId: string

  constructor(sessionId: string, persistence: StatePersistence) {
    this.sessionId = sessionId
    this.tasks = new Map()
    this.eventBus = EventBus.getInstance()
    this.persistence = persistence

    // Load existing tasks
    this.loadTasks()
  }

  /**
   * Create a new task
   */
  async createTask(
    title: string,
    description: string,
    priority: TaskPriority = 1,
    dependencies: string[] = [],
    metadata: Record<string, unknown> = {}
  ): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      title,
      description,
      status: 'pending',
      priority,
      dependencies,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    }

    this.tasks.set(task.id, task)
    this.persistence.saveTask(this.sessionId, task)

    await this.eventBus.emit(EventType.TASK_CREATED, task)

    return task
  }

  /**
   * Get task by ID
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === status)
  }

  /**
   * Update task status
   */
  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) {
      throw new Error(`Task not found: ${id}`)
    }

    const oldStatus = task.status
    task.status = status
    task.updatedAt = new Date()

    if (status === 'completed') {
      task.completedAt = new Date()
    }

    this.persistence.saveTask(this.sessionId, task)

    if (oldStatus !== status) {
      if (status === 'completed') {
        await this.eventBus.emit(EventType.TASK_COMPLETED, task)
      } else if (status === 'failed') {
        await this.eventBus.emit(EventType.TASK_FAILED, task)
      }
    }
  }

  /**
   * Assign agent to task
   */
  async assignAgent(taskId: string, agentType: AgentType): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    task.assignedAgent = agentType
    task.updatedAt = new Date()
    this.persistence.saveTask(this.sessionId, task)
  }

  /**
   * Get next task to execute
   */
  getNextTask(): Task | undefined {
    const pendingTasks = this.getTasksByStatus('pending')

    // Filter tasks with all dependencies completed
    const readyTasks = pendingTasks.filter((task) => {
      return task.dependencies.every((depId) => {
        const dep = this.tasks.get(depId)
        return dep?.status === 'completed'
      })
    })

    // Sort by priority (highest first)
    readyTasks.sort((a, b) => b.priority - a.priority)

    return readyTasks[0]
  }

  /**
   * Check if all tasks are completed
   */
  allTasksCompleted(): boolean {
    return Array.from(this.tasks.values()).every(
      (t) => t.status === 'completed' || t.status === 'failed'
    )
  }

  /**
   * Get task statistics
   */
  getStatistics() {
    const all = this.getAllTasks()
    return {
      total: all.length,
      pending: all.filter((t) => t.status === 'pending').length,
      inProgress: all.filter((t) =>
        ['red', 'green', 'refactor', 'review', 'debug'].includes(t.status)
      ).length,
      completed: all.filter((t) => t.status === 'completed').length,
      failed: all.filter((t) => t.status === 'failed').length,
    }
  }

  /**
   * Load tasks from persistence
   */
  private loadTasks(): void {
    const tasks = this.persistence.getTasks(this.sessionId)
    for (const task of tasks) {
      this.tasks.set(task.id, task)
    }
  }
}
