# Orchestrator

A modular, extensible framework for managing swarms of AI agents on long-term tasks.

## Overview

Orchestrator is a CLI framework that enables you to coordinate multiple AI agents to work on complex, long-running software development tasks. It implements a rigorous Red-Green-Refactor (RGR) workflow with built-in quality gates, git-based versioning, and comprehensive state management.

## Features

### Core Features
- 🤖 **Multi-Agent System**: Planner, Executor, Reviewer, and Debugger agents working in harmony
- 🔄 **RGR Workflow**: Test-driven development with Red-Green-Refactor cycles
- 🌳 **Git Integration**: Automatic worktree and branch management for each task step
- 💾 **State Persistence**: Resume long-running tasks from any checkpoint
- 🔌 **Provider Agnostic**: Support for Anthropic, OpenAI, and local models
- 🎨 **Multi-Modal**: Support for text, images, and video
- 🧩 **Extensible**: Plugin-based architecture for custom agents and providers
- 📊 **Quality Gates**: Automated testing, linting, type-checking, and security scanning
- 🔧 **MCP Support**: Integration with Model Context Protocol for tool access

### 🚀 LLM Optimization Features (NEW!)
- ⚡ **Prompt Caching**: 60-90% cost reduction, 80-85% latency improvement
- 💰 **Token Tracking**: Real-time usage monitoring and budget enforcement
- 🎯 **Model Routing**: Intelligent model selection for cost/speed/quality optimization
- 🔄 **Smart Retry**: Exponential backoff with jitter for transient failures
- 📈 **Performance Monitoring**: Comprehensive analytics and recommendations
- 🧠 **Memory Systems**: Buffer, summary, and token-based conversation memory
- 🔗 **LangChain Integration**: Use any LangChain model with Orchestrator
- 📚 **RAG Support**: Retrieval-augmented generation with vector stores
- 🎛️ **Context Optimization**: Smart pruning and compression for large contexts
- 🚦 **Rate Limiting**: Prevent API throttling with token bucket algorithm

**[See Full Optimization Guide →](docs/OPTIMIZATION.md)**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Core                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ State Machine│  │  Event Bus   │  │ Checkpointer │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌─────────▼────────┐
│  Agent System  │  │Task Manager │  │  Git Worktree    │
│  - Planner     │  │- Queue      │  │  Manager         │
│  - Executor    │  │- Dependencies│  │                  │
│  - Reviewer    │  │- Tracking   │  │                  │
│  - Debugger    │  └─────────────┘  └──────────────────┘
└────────────────┘
        │
┌───────▼────────────────────────────┐
│    Provider Abstraction Layer      │
│  - Anthropic  - OpenAI  - Custom   │
└────────────────────────────────────┘
```

## Workflow

The framework follows a strict workflow loop:

1. **Human Input**: Provide context and requirements
2. **Planning**: Agent analyzes, scopes, and creates tasks
3. **Test Generation**: Generate test harness using RGR principles
4. **Execution**: Each task executed by an agent
5. **Review**: Compare against scope, run tests, type-checks, lints
6. **Debug**: If issues found, debug agent fixes and loops back
7. **Integration**: Successful tasks merged to main branch
8. **Iteration**: Repeat for next task

## Installation

```bash
npm install -g @orchestrator/core
```

Or for development:

```bash
git clone <repository>
cd orchestrator
npm install
npm run build
npm link
```

## Quick Start

1. Create a configuration file:

```bash
orchestrator init
```

2. Edit `orchestrator.config.yml`:

```yaml
provider:
  name: anthropic
  apiKey: ${ANTHROPIC_API_KEY}
  model: claude-sonnet-4-5

agents:
  planner:
    model: claude-sonnet-4-5
  executor:
    model: claude-sonnet-4-5
  reviewer:
    model: claude-sonnet-4-5
  debugger:
    model: claude-sonnet-4-5

testHarness:
  enabled: true
  framework: vitest
  coverageThreshold: 80
```

3. Start a task:

```bash
orchestrator start "Build a REST API for user management"
```

## Usage

### Commands

- `orchestrator init` - Initialize configuration
- `orchestrator start <task>` - Start a new task
- `orchestrator resume <id>` - Resume a checkpoint
- `orchestrator status` - Show current status
- `orchestrator list` - List all tasks
- `orchestrator config` - Manage configuration

### Configuration

See [Configuration Guide](docs/configuration.md) for detailed configuration options.

### Extending

See [Extension Guide](docs/extending.md) for creating custom agents and providers.

## Requirements

- Node.js >= 18.0.0
- Git >= 2.20
- API keys for your chosen provider (Anthropic, OpenAI, etc.)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Type checking
npm run typecheck

# Linting
npm run lint

# Build
npm run build
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
