/**
 * Intelligent model routing for cost optimization
 */

export interface ModelCapability {
  name: string
  cost: number // Cost per 1M tokens (combined)
  speed: number // Tokens per second
  quality: number // 0-10 quality score
  maxTokens: number
  specialties: string[] // e.g., ['code', 'reasoning', 'creative']
}

export interface RoutingDecision {
  model: string
  reason: string
  estimatedCost: number
  estimatedTime: number
}

/**
 * Model router for intelligent model selection
 */
export class ModelRouter {
  private models: Map<string, ModelCapability>

  constructor() {
    this.models = new Map()
    this.initializeModels()
  }

  /**
   * Initialize model capabilities
   */
  private initializeModels(): void {
    const models: ModelCapability[] = [
      {
        name: 'claude-sonnet-4-5',
        cost: 9.0, // (3 + 15) / 2
        speed: 50,
        quality: 10,
        maxTokens: 200000,
        specialties: ['reasoning', 'code', 'analysis'],
      },
      {
        name: 'claude-3-5-haiku-20241022',
        cost: 3.0,
        speed: 100,
        quality: 7,
        maxTokens: 200000,
        specialties: ['speed', 'simple-tasks'],
      },
      {
        name: 'gpt-4o',
        cost: 6.25,
        speed: 60,
        quality: 9,
        maxTokens: 128000,
        specialties: ['general', 'multimodal'],
      },
      {
        name: 'gpt-4o-mini',
        cost: 0.375,
        speed: 150,
        quality: 6,
        maxTokens: 128000,
        specialties: ['speed', 'cost', 'simple-tasks'],
      },
      {
        name: 'gpt-4-turbo',
        cost: 20.0,
        speed: 40,
        quality: 10,
        maxTokens: 128000,
        specialties: ['reasoning', 'complex-tasks'],
      },
    ]

    for (const model of models) {
      this.models.set(model.name, model)
    }
  }

  /**
   * Route request to optimal model
   */
  route(
    task: string,
    requirements: {
      priority?: 'cost' | 'speed' | 'quality'
      estimatedTokens?: number
      complexity?: 'low' | 'medium' | 'high'
      specialty?: string
    }
  ): RoutingDecision {
    const {
      priority = 'quality',
      estimatedTokens = 1000,
      complexity = 'medium',
      specialty,
    } = requirements

    // Filter models by requirements
    let candidates = Array.from(this.models.values())

    // Filter by specialty if specified
    if (specialty) {
      candidates = candidates.filter((m) => m.specialties.includes(specialty))
    }

    // Filter by token limit
    candidates = candidates.filter((m) => m.maxTokens >= estimatedTokens)

    // Score each model
    const scored = candidates.map((model) => {
      let score = 0

      switch (priority) {
        case 'cost':
          score = 100 - model.cost * 5 // Lower cost = higher score
          break
        case 'speed':
          score = model.speed
          break
        case 'quality':
          score = model.quality * 10
          break
      }

      // Adjust for complexity
      if (complexity === 'high' && model.quality < 8) {
        score *= 0.5 // Penalize low-quality models for complex tasks
      } else if (complexity === 'low' && model.cost > 5) {
        score *= 0.7 // Penalize expensive models for simple tasks
      }

      return { model, score }
    })

    // Sort by score
    scored.sort((a, b) => b.score - a.score)

    const selected = scored[0].model

    return {
      model: selected.name,
      reason: this.generateReason(selected, priority, complexity),
      estimatedCost: (estimatedTokens / 1_000_000) * selected.cost,
      estimatedTime: estimatedTokens / selected.speed,
    }
  }

  /**
   * Generate routing reason
   */
  private generateReason(
    model: ModelCapability,
    priority: string,
    complexity: string
  ): string {
    const reasons: string[] = []

    if (priority === 'cost' && model.cost < 5) {
      reasons.push('low cost')
    } else if (priority === 'speed' && model.speed > 80) {
      reasons.push('high speed')
    } else if (priority === 'quality' && model.quality >= 9) {
      reasons.push('high quality')
    }

    if (complexity === 'high' && model.quality >= 9) {
      reasons.push('suitable for complex tasks')
    } else if (complexity === 'low' && model.cost < 5) {
      reasons.push('cost-effective for simple tasks')
    }

    if (model.specialties.length > 0) {
      reasons.push(`specialized in ${model.specialties.join(', ')}`)
    }

    return reasons.join(', ') || 'best overall match'
  }

  /**
   * Compare models
   */
  compare(modelNames: string[]): Array<{
    name: string
    capability: ModelCapability
  }> {
    return modelNames
      .map((name) => ({
        name,
        capability: this.models.get(name)!,
      }))
      .filter((m) => m.capability)
  }

  /**
   * Get model info
   */
  getModel(name: string): ModelCapability | undefined {
    return this.models.get(name)
  }

  /**
   * Add custom model
   */
  addModel(capability: ModelCapability): void {
    this.models.set(capability.name, capability)
  }
}
