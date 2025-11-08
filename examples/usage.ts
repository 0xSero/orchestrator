/**
 * Example usage of the Orchestrator framework
 */
import { Orchestrator, ConfigLoader } from '../src/index.js'

async function main() {
  // Load configuration
  const loader = ConfigLoader.getInstance()
  const config = loader.load('./orchestrator.config.yml')

  // Create orchestrator
  const orchestrator = new Orchestrator(config)

  try {
    // Start a new session
    await orchestrator.start(
      'Build a REST API for user management with CRUD operations, authentication, and authorization',
      'user-management-api'
    )

    console.log('Session completed!')

    // Get final state
    const state = orchestrator.getState()
    console.log('Tasks completed:', state.completedTasks.length)
  } finally {
    // Cleanup
    await orchestrator.cleanup()
  }
}

main().catch(console.error)
