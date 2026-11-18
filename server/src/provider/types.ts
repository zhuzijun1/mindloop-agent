/** LLM Provider 抽象：Agent 循环只依赖该接口，不关心底层是真实 API 还是本地 Mock */

export interface ProviderToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

/** Agent 传给 Provider 的对话消息（比持久化格式更贴近模型侧） */
export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** role === 'tool' 时，对应的工具调用 id */
  toolCallId?: string
  /** role === 'assistant' 且本轮发起了工具调用时携带 */
  toolCalls?: ProviderToolCall[]
}

export interface ProviderRequest {
  messages: ProviderMessage[]
  tools: import('../tools/types').ToolSchema[]
  signal?: AbortSignal
}

/** Provider 流式输出的最小单元：文本 token 或一次工具调用决策 */
export type ProviderChunk =
  | { kind: 'token'; text: string }
  | { kind: 'tool_call'; id: string; name: string; args: Record<string, unknown> }

export interface LLMProvider {
  readonly name: string
  /** 以异步生成器流式产出决策；Agent 循环据此驱动 ReAct */
  stream(req: ProviderRequest): AsyncGenerator<ProviderChunk>
}
