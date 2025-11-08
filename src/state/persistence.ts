/**
 * State persistence using SQLite
 */
import Database from 'better-sqlite3'
import type {
  Checkpoint,
  OrchestratorState,
  Task,
  Context,
  WorkflowStep,
} from '../types/index.js'

/**
 * State persistence manager
 */
export class StatePersistence {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.initDatabase()
  }

  /**
   * Initialize database schema
   */
  private initDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        step TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        state TEXT NOT NULL,
        git_commit TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_session_id ON checkpoints(session_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON checkpoints(timestamp);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        context_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL,
        dependencies TEXT,
        assigned_agent TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        metadata TEXT,
        git_branch TEXT,
        test_phase TEXT,
        parent_task_id TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_task_session ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_task_status ON tasks(status);

      CREATE TABLE IF NOT EXISTS contexts (
        id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        constraints TEXT NOT NULL,
        standards TEXT NOT NULL,
        scope TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        version TEXT NOT NULL,
        immutable INTEGER NOT NULL
      );
    `)
  }

  /**
   * Save checkpoint
   */
  saveCheckpoint(checkpoint: Checkpoint): void {
    const stmt = this.db.prepare(`
      INSERT INTO checkpoints (
        id, session_id, step, timestamp, state, git_commit, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      checkpoint.id,
      checkpoint.sessionId,
      checkpoint.step,
      checkpoint.timestamp.getTime(),
      JSON.stringify(checkpoint.state),
      checkpoint.gitCommit || null,
      JSON.stringify(checkpoint.metadata),
      Date.now()
    )
  }

  /**
   * Load checkpoint by ID
   */
  loadCheckpoint(id: string): Checkpoint | null {
    const stmt = this.db.prepare(`
      SELECT * FROM checkpoints WHERE id = ?
    `)

    const row = stmt.get(id) as any
    if (!row) return null

    return {
      id: row.id,
      sessionId: row.session_id,
      step: row.step as WorkflowStep,
      timestamp: new Date(row.timestamp),
      state: JSON.parse(row.state),
      gitCommit: row.git_commit,
      metadata: JSON.parse(row.metadata),
    }
  }

  /**
   * Get latest checkpoint for session
   */
  getLatestCheckpoint(sessionId: string): Checkpoint | null {
    const stmt = this.db.prepare(`
      SELECT * FROM checkpoints
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `)

    const row = stmt.get(sessionId) as any
    if (!row) return null

    return {
      id: row.id,
      sessionId: row.session_id,
      step: row.step as WorkflowStep,
      timestamp: new Date(row.timestamp),
      state: JSON.parse(row.state),
      gitCommit: row.git_commit,
      metadata: JSON.parse(row.metadata),
    }
  }

  /**
   * Get all checkpoints for session
   */
  getCheckpoints(sessionId: string): Checkpoint[] {
    const stmt = this.db.prepare(`
      SELECT * FROM checkpoints
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `)

    const rows = stmt.all(sessionId) as any[]
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      step: row.step as WorkflowStep,
      timestamp: new Date(row.timestamp),
      state: JSON.parse(row.state),
      gitCommit: row.git_commit,
      metadata: JSON.parse(row.metadata),
    }))
  }

  /**
   * Save task
   */
  saveTask(sessionId: string, task: Task): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tasks (
        id, session_id, title, description, status, priority, dependencies,
        assigned_agent, created_at, updated_at, completed_at, metadata,
        git_branch, test_phase, parent_task_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      task.id,
      sessionId,
      task.title,
      task.description,
      task.status,
      task.priority,
      JSON.stringify(task.dependencies),
      task.assignedAgent || null,
      task.createdAt.getTime(),
      task.updatedAt.getTime(),
      task.completedAt?.getTime() || null,
      JSON.stringify(task.metadata),
      task.gitBranch || null,
      task.testPhase || null,
      task.parentTaskId || null
    )
  }

  /**
   * Load task by ID
   */
  loadTask(id: string): Task | null {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE id = ?
    `)

    const row = stmt.get(id) as any
    if (!row) return null

    return this.rowToTask(row)
  }

  /**
   * Get all tasks for session
   */
  getTasks(sessionId: string): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE session_id = ? ORDER BY created_at ASC
    `)

    const rows = stmt.all(sessionId) as any[]
    return rows.map((row) => this.rowToTask(row))
  }

  /**
   * Save context
   */
  saveContext(context: Context): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO contexts (
        id, project_name, description, requirements, constraints, standards,
        scope, created_at, version, immutable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      context.id,
      context.projectName,
      context.description,
      JSON.stringify(context.requirements),
      JSON.stringify(context.constraints),
      JSON.stringify(context.standards),
      JSON.stringify(context.scope),
      context.createdAt.getTime(),
      context.version,
      context.immutable ? 1 : 0
    )
  }

  /**
   * Load context by ID
   */
  loadContext(id: string): Context | null {
    const stmt = this.db.prepare(`
      SELECT * FROM contexts WHERE id = ?
    `)

    const row = stmt.get(id) as any
    if (!row) return null

    return {
      id: row.id,
      projectName: row.project_name,
      description: row.description,
      requirements: JSON.parse(row.requirements),
      constraints: JSON.parse(row.constraints),
      standards: JSON.parse(row.standards),
      scope: JSON.parse(row.scope),
      createdAt: new Date(row.created_at),
      version: row.version,
      immutable: row.immutable === 1,
    }
  }

  /**
   * Clean old checkpoints
   */
  cleanOldCheckpoints(retentionDays: number): number {
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000

    const stmt = this.db.prepare(`
      DELETE FROM checkpoints WHERE created_at < ?
    `)

    const result = stmt.run(cutoffTime)
    return result.changes
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close()
  }

  /**
   * Convert database row to Task
   */
  private rowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dependencies: JSON.parse(row.dependencies),
      assignedAgent: row.assigned_agent,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      metadata: JSON.parse(row.metadata),
      gitBranch: row.git_branch,
      testPhase: row.test_phase,
      parentTaskId: row.parent_task_id,
    }
  }
}
