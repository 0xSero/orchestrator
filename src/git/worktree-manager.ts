/**
 * Git worktree management
 */
import { simpleGit, SimpleGit } from 'simple-git'
import { mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import type { TestPhase, BranchInfo } from '../types/index.js'

/**
 * Git worktree manager
 */
export class WorktreeManager {
  private git: SimpleGit
  private worktreeDir: string
  private branchPrefix: string

  constructor(repoPath: string, worktreeDir: string, branchPrefix: string = 'task') {
    this.git = simpleGit(repoPath)
    this.worktreeDir = worktreeDir
    this.branchPrefix = branchPrefix
  }

  /**
   * Initialize worktree directory
   */
  async initialize(): Promise<void> {
    if (!existsSync(this.worktreeDir)) {
      await mkdir(this.worktreeDir, { recursive: true })
    }
  }

  /**
   * Create a new branch for a task
   */
  async createTaskBranch(taskId: string, baseBranch: string = 'main'): Promise<string> {
    const branchName = `${this.branchPrefix}-${taskId}`

    // Ensure we're on the base branch and it's up to date
    await this.git.checkout(baseBranch)
    await this.git.pull('origin', baseBranch).catch(() => {
      // Ignore pull errors (e.g., if remote doesn't exist)
    })

    // Create new branch
    await this.git.checkoutLocalBranch(branchName)

    return branchName
  }

  /**
   * Create a phase branch for RGR cycle
   */
  async createPhaseBranch(
    taskId: string,
    phase: TestPhase,
    baseBranch?: string
  ): Promise<BranchInfo> {
    const branchName = `${this.branchPrefix}-${taskId}/${phase}`

    if (!baseBranch) {
      baseBranch = `${this.branchPrefix}-${taskId}`
    }

    // Checkout base branch
    await this.git.checkout(baseBranch)

    // Create phase branch
    await this.git.checkoutLocalBranch(branchName)

    // Get current commit
    const log = await this.git.log({ maxCount: 1 })
    const commit = log.latest?.hash || ''

    return {
      name: branchName,
      taskId,
      phase,
      commit,
      createdAt: new Date(),
    }
  }

  /**
   * Create a worktree for a branch
   */
  async createWorktree(branchName: string): Promise<string> {
    const worktreePath = join(this.worktreeDir, branchName.replace(/\//g, '-'))

    // Remove existing worktree if it exists
    if (existsSync(worktreePath)) {
      await this.removeWorktree(worktreePath)
    }

    // Create worktree
    await this.git.raw(['worktree', 'add', worktreePath, branchName])

    return worktreePath
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(worktreePath: string): Promise<void> {
    if (!existsSync(worktreePath)) {
      return
    }

    try {
      // Remove worktree
      await this.git.raw(['worktree', 'remove', worktreePath, '--force'])
    } catch (error) {
      // If git worktree remove fails, manually delete the directory
      await rm(worktreePath, { recursive: true, force: true })
    }
  }

  /**
   * List all worktrees
   */
  async listWorktrees(): Promise<string[]> {
    const output = await this.git.raw(['worktree', 'list', '--porcelain'])
    const worktrees: string[] = []

    const lines = output.split('\n')
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        worktrees.push(line.substring(9))
      }
    }

    return worktrees
  }

  /**
   * Commit changes with a message
   */
  async commit(message: string, files?: string[]): Promise<string> {
    if (files && files.length > 0) {
      await this.git.add(files)
    } else {
      await this.git.add('.')
    }

    const result = await this.git.commit(message)
    return result.commit
  }

  /**
   * Merge a branch into another
   */
  async merge(sourceBranch: string, targetBranch: string): Promise<void> {
    await this.git.checkout(targetBranch)
    await this.git.merge([sourceBranch])
  }

  /**
   * Tag a commit
   */
  async tag(tagName: string, message?: string): Promise<void> {
    if (message) {
      await this.git.addTag(tagName, ['-a', '-m', message])
    } else {
      await this.git.addTag(tagName)
    }
  }

  /**
   * Get current branch
   */
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status()
    return status.current || ''
  }

  /**
   * Get commit hash
   */
  async getCurrentCommit(): Promise<string> {
    const log = await this.git.log({ maxCount: 1 })
    return log.latest?.hash || ''
  }

  /**
   * Check if branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    const branches = await this.git.branch()
    return branches.all.includes(branchName)
  }

  /**
   * Delete a branch
   */
  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    if (force) {
      await this.git.deleteLocalBranch(branchName, true)
    } else {
      await this.git.deleteLocalBranch(branchName)
    }
  }

  /**
   * Get diff between branches
   */
  async getDiff(branch1: string, branch2: string): Promise<string> {
    return await this.git.diff([`${branch1}..${branch2}`])
  }

  /**
   * Checkout a branch
   */
  async checkout(branchName: string): Promise<void> {
    await this.git.checkout(branchName)
  }

  /**
   * Get status
   */
  async getStatus(): Promise<{
    modified: string[]
    added: string[]
    deleted: string[]
    untracked: string[]
  }> {
    const status = await this.git.status()
    return {
      modified: status.modified,
      added: status.created,
      deleted: status.deleted,
      untracked: status.not_added,
    }
  }

  /**
   * Push branch to remote
   */
  async push(branchName: string, remote: string = 'origin', force: boolean = false): Promise<void> {
    if (force) {
      await this.git.push(remote, branchName, ['--force'])
    } else {
      await this.git.push(remote, branchName)
    }
  }

  /**
   * Pull from remote
   */
  async pull(branchName: string, remote: string = 'origin'): Promise<void> {
    await this.git.pull(remote, branchName)
  }
}
