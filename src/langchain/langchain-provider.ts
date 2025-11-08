/**
 * LangChain integration for Orchestrator
 */
import { BaseProvider } from '../providers/base-provider.js'
import type {
  GenerateOptions,
  GenerateResult,
  Tool,
  ProviderCapability,
} from '../types/index.js'

/**
 * LangChain-compatible provider wrapper
 * Allows using LangChain's ChatModels with Orchestrator
 */
export class LangChainProvider extends BaseProvider {
  name = 'langchain'
  models: string[] = []
  supports: ProviderCapability[] = ['text', 'tools']

  private chatModel: any // LangChain ChatModel
  private modelName: string

  constructor(chatModel: any, modelName: string = 'langchain-model') {
    super()
    this.chatModel = chatModel
    this.modelName = modelName
    this.models = [modelName]
  }

  async generateText(
    prompt: string,
    options?: GenerateOptions
  ): Promise<GenerateResult> {
    this.validateOptions(options)

    try {
      // Build LangChain messages
      const messages = []

      if (options?.systemPrompt) {
        messages.push({
          type: 'system',
          content: options.systemPrompt,
        })
      }

      messages.push({
        type: 'human',
        content: prompt,
      })

      // Invoke LangChain model
      const response = await this.chatModel.invoke(messages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stop: options?.stopSequences,
      })

      return {
        text: response.content,
        finishReason: 'stop',
        usage: response.usage_metadata
          ? {
              inputTokens: response.usage_metadata.input_tokens || 0,
              outputTokens: response.usage_metadata.output_tokens || 0,
            }
          : undefined,
      }
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

    try {
      // Convert tools to LangChain format
      const langchainTools = this.convertToLangChainTools(tools)

      // Bind tools to model
      const modelWithTools = this.chatModel.bindTools(langchainTools)

      // Build messages
      const messages = []

      if (options?.systemPrompt) {
        messages.push({
          type: 'system',
          content: options.systemPrompt,
        })
      }

      messages.push({
        type: 'human',
        content: prompt,
      })

      // Invoke with tools
      const response = await modelWithTools.invoke(messages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stop: options?.stopSequences,
      })

      // Extract tool calls
      const toolUses = response.tool_calls
        ? response.tool_calls.map((call: any) => ({
            name: call.name,
            parameters: call.args,
          }))
        : undefined

      return {
        text: response.content,
        finishReason: toolUses ? 'tool_use' : 'stop',
        usage: response.usage_metadata
          ? {
              inputTokens: response.usage_metadata.input_tokens || 0,
              outputTokens: response.usage_metadata.output_tokens || 0,
            }
          : undefined,
        toolUses,
      }
    } catch (error) {
      return {
        text: '',
        finishReason: 'error',
        usage: { inputTokens: 0, outputTokens: 0 },
      }
    }
  }

  /**
   * Convert Orchestrator tools to LangChain format
   */
  private convertToLangChainTools(tools: Tool[]): any[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      schema: {
        type: 'object',
        properties: this.convertParameters(tool.parameters),
        required: tool.parameters
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    }))
  }

  /**
   * Convert parameters to schema
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

/**
 * Helper to create LangChain provider from different model types
 */
export class LangChainProviderFactory {
  /**
   * Create from ChatAnthropic
   */
  static fromChatAnthropic(chatModel: any): LangChainProvider {
    return new LangChainProvider(chatModel, 'langchain-anthropic')
  }

  /**
   * Create from ChatOpenAI
   */
  static fromChatOpenAI(chatModel: any): LangChainProvider {
    return new LangChainProvider(chatModel, 'langchain-openai')
  }

  /**
   * Create from any LangChain ChatModel
   */
  static fromChatModel(chatModel: any, modelName: string): LangChainProvider {
    return new LangChainProvider(chatModel, modelName)
  }
}
