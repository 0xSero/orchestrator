/**
 * Provider factory and exports
 */
import { AnthropicProvider } from './anthropic.js'
import { OpenAIProvider } from './openai.js'
import type { Provider, ProviderConfig } from '../types/index.js'

export { BaseProvider } from './base-provider.js'
export { AnthropicProvider } from './anthropic.js'
export { OpenAIProvider } from './openai.js'

/**
 * Provider factory
 */
export class ProviderFactory {
  private static providers: Map<string, new (apiKey: string, model: string) => Provider> = new Map([
    ['anthropic', AnthropicProvider as any],
    ['openai', OpenAIProvider as any],
  ])

  /**
   * Create a provider from configuration
   */
  static create(config: ProviderConfig): Provider {
    const ProviderClass = this.providers.get(config.name)

    if (!ProviderClass) {
      throw new Error(`Unknown provider: ${config.name}`)
    }

    if (!config.apiKey) {
      throw new Error(`API key required for provider: ${config.name}`)
    }

    return new ProviderClass(config.apiKey, config.model)
  }

  /**
   * Register a custom provider
   */
  static register(
    name: string,
    providerClass: new (apiKey: string, model: string) => Provider
  ): void {
    this.providers.set(name, providerClass)
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): string[] {
    return Array.from(this.providers.keys())
  }
}
