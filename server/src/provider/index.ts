/** Provider 工厂：配置了 OPENAI_API_KEY 就用 OpenAIProvider，否则自动落到 MockProvider */
import type { LLMProvider } from './types'
import { MockProvider } from './mock'
import { OpenAIProvider } from './openai'

export function resolveProvider(): LLMProvider {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey) {
    return new OpenAIProvider({
      apiKey,
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    })
  }
  return new MockProvider()
}

export type { LLMProvider, ProviderChunk, ProviderMessage, ProviderRequest } from './types'
