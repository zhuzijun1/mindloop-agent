/**
 * OpenAIProvider：对接 OpenAI 兼容的 /chat/completions 流式接口。
 * 由 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL 环境变量配置。
 * 工具以 function calling schema 传给模型，流式增量中的 tool_calls 会被聚合还原。
 */
import type { LLMProvider, ProviderChunk, ProviderMessage, ProviderRequest } from './types'
import type { ToolSchema } from '../tools/types'

export interface OpenAIConfig {
  apiKey: string
  baseUrl: string
  model: string
}

interface StreamedCall {
  id: string
  name: string
  args: string
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}') as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function toApiMessages(messages: ProviderMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId ?? '', content: m.content }
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      }
    }
    return { role: m.role, content: m.content }
  })
}

function toApiTools(tools: ToolSchema[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([key, p]) => [
            key,
            { type: p.type, description: p.description, ...(p.enum ? { enum: [...p.enum] } : {}) },
          ]),
        ),
        required: Object.entries(t.parameters)
          .filter(([, p]) => p.required)
          .map(([key]) => key),
      },
    },
  }))
}

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai'

  constructor(private readonly config: OpenAIConfig) {}

  async *stream(req: ProviderRequest): AsyncGenerator<ProviderChunk> {
    const { messages, tools, signal } = req
    const url = `${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        stream: true,
        messages: toApiMessages(messages),
        tools: tools.length > 0 ? toApiTools(tools) : undefined,
      }),
      signal,
    })
    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '')
      throw new Error(`OpenAI 接口错误 (${res.status}): ${detail.slice(0, 300)}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const pendingCalls = new Map<number, StreamedCall>()
    let buffer = ''

    const flushCalls = (): ProviderChunk[] =>
      [...pendingCalls.values()]
        .filter((c) => c.name)
        .map((c) => ({
          kind: 'tool_call' as const,
          id: c.id || crypto.randomUUID(),
          name: c.name,
          args: safeParseArgs(c.args),
        }))

    try {
      for (;;) {
        if (signal?.aborted) {
          yield* flushCalls()
          return
        }
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let newlineIndex: number
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim()
          buffer = buffer.slice(newlineIndex + 1)
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') {
            yield* flushCalls()
            return
          }
          let json: unknown
          try {
            json = JSON.parse(payload)
          } catch {
            continue
          }
          const delta = (json as { choices?: { delta?: Record<string, unknown> }[] }).choices?.[0]?.delta
          if (!delta) continue
          if (typeof delta.content === 'string' && delta.content.length > 0) {
            yield { kind: 'token', text: delta.content }
          }
          const toolCalls = delta.tool_calls as
            | { index?: number; id?: string; function?: { name?: string; arguments?: string } }[]
            | undefined
          if (toolCalls) {
            for (const tc of toolCalls) {
              const index = tc.index ?? 0
              const current = pendingCalls.get(index) ?? { id: '', name: '', args: '' }
              if (tc.id) current.id = tc.id
              if (tc.function?.name) current.name += tc.function.name
              if (tc.function?.arguments) current.args += tc.function.arguments
              pendingCalls.set(index, current)
            }
          }
        }
      }
      yield* flushCalls()
    } finally {
      reader.releaseLock()
    }
  }
}
