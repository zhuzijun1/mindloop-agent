/** 与 server/src/types.ts 对应的前端类型 */

export interface ToolStep {
  id: string
  name: string
  args: Record<string, unknown>
  ok?: boolean
  result?: string
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  steps?: ToolStep[]
  createdAt: number
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: StoredMessage[]
}

/** 前端渲染用的消息（含流式状态） */
export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  steps: ToolStep[]
  streaming: boolean
}

export interface ChatPayload {
  sessionId: string
  message: string
}

/** 后端 SSE 事件（data 字段即完整事件对象） */
export type AgentEvent =
  | { type: 'token'; data: { content: string } }
  | { type: 'tool_call'; data: { id: string; name: string; args: Record<string, unknown> } }
  | { type: 'tool_result'; data: { id: string; name: string; ok: boolean; result: string } }
  | { type: 'done'; data: { sessionId: string } }
  | { type: 'error'; data: { message: string } }
