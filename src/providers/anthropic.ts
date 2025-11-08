/**
 * Anthropic provider implementation
 */
import Anthropic from '@anthropic-ai/sdk'
import { BaseProvider } from './base-provider.js'
import type { GenerateOptions, GenerateResult, Tool, ProviderCapability } from '../types/index.js'

/**
 * Anthropic Claude provider
 */
export class AnthropicProvider extends BaseProvider {
  name = 'anthropic'
  models = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-sonnet-4-5',
  ]
  supports: ProviderCapability[] = ['text', 'image', 'tools']

  private client: Anthropic
  private defaultModel: string

  constructor(apiKey: string, defaultModel: string = 'claude-sonnet-4-5') {
    super()
    this.client = new Anthropic({ apiKey })
    this.defaultModel = defaultModel
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    this.validateOptions(options)

    const model = options?.model || this.defaultModel
    const systemPrompt = options?.systemPrompt

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature,
        system: systemPrompt,
        messages,
        stop_sequences: options?.stopSequences,
      })

      return this.formatResponse(response)
    } catch (error) {
      return {
        text: '',
        finishReason: 'error',
        usage: { inputTokens: 0, outputTokens: 0 },
      }
    }
  }

  async generateWithTools(
    prompt: string,
    tools: Tool[],
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    this.validateOptions(options)

    const model = options?.model || this.defaultModel
    const systemPrompt = options?.systemPrompt

    const anthropicTools = this.convertTools(tools)

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: prompt,
      },
    ]

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature,
        system: systemPrompt,
        messages,
        tools: anthropicTools,
        stop_sequences: options?.stopSequences,
      })

      return this.formatResponse(response)
    } catch (error) {
      return {
        text: '',
        finishReason: 'error',
        usage: { inputTokens: 0, outputTokens: 0 },
      }
    }
  }

  /**
   * Format Anthropic response to standard format
   */
  private formatResponse(response: Anthropic.Message): GenerateResult {
    let text = ''
    const toolUses: any[] = []

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text
      } else if (block.type === 'tool_use') {
        toolUses.push({
          name: block.name,
          parameters: block.input,
        })
      }
    }

    let finishReason: GenerateResult['finishReason'] = 'stop'
    if (response.stop_reason === 'max_tokens') {
      finishReason = 'length'
    } else if (response.stop_reason === 'tool_use') {
      finishReason = 'tool_use'
    }

    return {
      text,
      finishReason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      toolUses: toolUses.length > 0 ? toolUses : undefined,
    }
  }

  /**
   * Convert generic tools to Anthropic format
   */
  private convertTools(tools: Tool[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties: this.convertParameters(tool.parameters),
        required: tool.parameters.filter((p) => p.required).map((p) => p.name),
      },
    }))
  }

  /**
   * Convert parameters to JSON schema properties
   */
  private convertParameters(parameters: any[]): Record<string, any> {
    const properties: Record<string, any> = {}

    for (const param of parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description,
      }

      if (param.default !== undefined) {
        properties[param.name].default = param.default
      }
    }

    return properties
  }
}
