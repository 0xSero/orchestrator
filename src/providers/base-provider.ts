/**
 * Base provider interface
 */
import type {
  Provider,
  ProviderCapability,
  GenerateOptions,
  GenerateResult,
  Tool,
} from '../types/index.js'

/**
 * Abstract base provider class
 */
export abstract class BaseProvider implements Provider {
  abstract name: string
  abstract models: string[]
  abstract supports: ProviderCapability[]

  /**
   * Generate text from a prompt
   */
  abstract generateText(prompt: string, options?: GenerateOptions): Promise<GenerateResult>

  /**
   * Generate with tool use capability
   */
  abstract generateWithTools(
    prompt: string,
    tools: Tool[],
    options?: GenerateOptions
  ): Promise<GenerateResult>

  /**
   * Check if provider supports a capability
   */
  hasCapability(capability: ProviderCapability): boolean {
    return this.supports.includes(capability)
  }

  /**
   * Check if a model is supported
   */
  hasModel(model: string): boolean {
    return this.models.includes(model)
  }

  /**
   * Validate options before use
   */
  protected validateOptions(options?: GenerateOptions): void {
    if (!options) return

    if (options.model && !this.hasModel(options.model)) {
      throw new Error(`Model ${options.model} not supported by ${this.name}`)
    }

    if (options.temperature !== undefined && (options.temperature < 0 || options.temperature > 2)) {
      throw new Error('Temperature must be between 0 and 2')
    }

    if (options.maxTokens !== undefined && options.maxTokens < 1) {
      throw new Error('maxTokens must be positive')
    }
  }
}
