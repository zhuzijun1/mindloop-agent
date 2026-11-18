/** 服务端共享类型定义 */

/** 一次工具调用的完整记录（含参数与观察结果） */
export interface ToolCallRecord {
  id: string
  name: string
  args: Record<string, unknown>
  ok?: boolean
  result?: string
}

/** 会话中的一条消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** assistant 消息附带的 Agent 工具调用过程，前端可折叠展示 */
  steps?: ToolCallRecord[]
  createdAt: number
}

/** 会话（持久化到 server/data/sessions.json） */
export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

/** SSE 推送给客户端的事件（判别联合） */
export type AgentEvent =
  | { type: 'token'; data: { content: string } }
  | { type: 'tool_call'; data: { id: string; name: string; args: Record<string, unknown> } }
  | { type: 'tool_result'; data: { id: string; name: string; ok: boolean; result: string } }
  | { type: 'done'; data: { sessionId: string } }
  | { type: 'error'; data: { message: string } }

/** Agent 循环的运行结果 */
export interface AgentRunResult {
  content: string
  steps: ToolCallRecord[]
  aborted: boolean
}
