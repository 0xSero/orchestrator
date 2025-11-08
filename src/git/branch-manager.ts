/**
 * Branch management for task workflow
 */
import type { TestPhase, BranchInfo } from '../types/index.js'
import { WorktreeManager } from './worktree-manager.js'

/**
 * Branch naming strategy for tasks
 */
export class BranchManager {
  private worktreeManager: WorktreeManager
  private branches: Map<string, BranchInfo>

  constructor(worktreeManager: WorktreeManager) {
    this.worktreeManager = worktreeManager
    this.branches = new Map()
  }

  /**
   * Create all branches for a task (main + phase branches)
   */
  async createTaskBranches(taskId: string, baseBranch: string = 'main'): Promise<BranchInfo[]> {
    const branches: BranchInfo[] = []

    // Create main task branch
    const taskBranch = await this.worktreeManager.createTaskBranch(taskId, baseBranch)
    const commit = await this.worktreeManager.getCurrentCommit()

    const mainBranch: BranchInfo = {
      name: taskBranch,
      taskId,
      phase: 'red' as TestPhase,
      commit,
      createdAt: new Date(),
    }

    this.branches.set(taskBranch, mainBranch)
    branches.push(mainBranch)

    return branches
  }

  /**
   * Create a phase branch
   */
  async createPhaseBranch(taskId: string, phase: TestPhase): Promise<BranchInfo> {
    const branchInfo = await this.worktreeManager.createPhaseBranch(taskId, phase)
    this.branches.set(branchInfo.name, branchInfo)
    return branchInfo
  }

  /**
   * Get branch for task and phase
   */
  getBranch(taskId: string, phase?: TestPhase): BranchInfo | undefined {
    const prefix = `task-${taskId}`

    if (!phase) {
      return Array.from(this.branches.values()).find((b) => b.taskId === taskId && !b.name.includes('/'))
    }

    const branchName = `${prefix}/${phase}`
    return this.branches.get(branchName)
  }

  /**
   * Get all branches for a task
   */
  getTaskBranches(taskId: string): BranchInfo[] {
    return Array.from(this.branches.values()).filter((b) => b.taskId === taskId)
  }

  /**
   * Merge phase branch to task branch
   */
  async mergePhaseBranch(taskId: string, phase: TestPhase): Promise<void> {
    const taskBranch = `task-${taskId}`
    const phaseBranch = `${taskBranch}/${phase}`

    await this.worktreeManager.merge(phaseBranch, taskBranch)
  }

  /**
   * Clean up branches for a task
   */
  async cleanupTaskBranches(taskId: string, keepMain: boolean = false): Promise<void> {
    const taskBranches = this.getTaskBranches(taskId)

    for (const branch of taskBranches) {
      if (keepMain && !branch.name.includes('/')) {
        continue
      }

      try {
        await this.worktreeManager.deleteBranch(branch.name)
        this.branches.delete(branch.name)
      } catch (error) {
        console.error(`Failed to delete branch ${branch.name}:`, error)
      }
    }
  }

  /**
   * Tag a phase completion
   */
  async tagPhaseCompletion(taskId: string, phase: TestPhase, message?: string): Promise<void> {
    const tagName = `task-${taskId}-${phase}-complete`
    await this.worktreeManager.tag(tagName, message)
  }
}
