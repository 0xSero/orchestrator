/**
 * OpenAI provider implementation
 */
import OpenAI from 'openai'
import { BaseProvider } from './base-provider.js'
import type { GenerateOptions, GenerateResult, Tool, ProviderCapability } from '../types/index.js'

/**
 * OpenAI provider
 */
export class OpenAIProvider extends BaseProvider {
  name = 'openai'
  models = ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini']
  supports: ProviderCapability[] = ['text', 'image', 'tools', 'audio']

  private client: OpenAI
  private defaultModel: string

  constructor(apiKey: string, defaultModel: string = 'gpt-4o') {
    super()
    this.client = new OpenAI({ apiKey })
    this.defaultModel = defaultModel
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    this.validateOptions(options)

    const model = options?.model || this.defaultModel

    const messages: OpenAI.ChatCompletionMessageParam[] = []

    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      })
    }

    messages.push({
      role: 'user',
      content: prompt,
    })

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        stop: options?.stopSequences,
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
    const openaiTools = this.convertTools(tools)

    const messages: OpenAI.ChatCompletionMessageParam[] = []

    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      })
    }

    messages.push({
      role: 'user',
      content: prompt,
    })

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        tools: openaiTools,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        stop: options?.stopSequences,
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
   * Format OpenAI response to standard format
   */
  private formatResponse(response: OpenAI.ChatCompletion): GenerateResult {
    const choice = response.choices[0]
    const message = choice.message

    let text = message.content || ''
    const toolUses: any[] = []

    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          toolUses.push({
            name: toolCall.function.name,
            parameters: JSON.parse(toolCall.function.arguments),
          })
        }
      }
    }

    let finishReason: GenerateResult['finishReason'] = 'stop'
    if (choice.finish_reason === 'length') {
      finishReason = 'length'
    } else if (choice.finish_reason === 'tool_calls') {
      finishReason = 'tool_use'
    }

    return {
      text,
      finishReason,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
      toolUses: toolUses.length > 0 ? toolUses : undefined,
    }
  }

  /**
   * Convert generic tools to OpenAI format
   */
  private convertTools(tools: Tool[]): OpenAI.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: this.convertParameters(tool.parameters),
          required: tool.parameters.filter((p) => p.required).map((p) => p.name),
        },
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
