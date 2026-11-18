/** API 客户端：会话 CRUD + 手写 SSE 解析（fetch + ReadableStream，支持 AbortController） */
import type { AgentEvent, ChatPayload, Session } from '../types'

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    const message = (detail as { error?: string }).error ?? `请求失败 (${res.status})`
    throw new Error(message)
  }
  return (await res.json()) as T
}

export async function fetchSessions(): Promise<Session[]> {
  const data = await jsonOrThrow<{ sessions: Session[] }>(await fetch('/api/sessions'))
  return data.sessions
}

export async function createSession(): Promise<Session> {
  const data = await jsonOrThrow<{ session: Session }>(
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  )
  return data.session
}

export async function removeSession(id: string): Promise<void> {
  await jsonOrThrow<{ ok: boolean }>(await fetch(`/api/sessions/${id}`, { method: 'DELETE' }))
}

export interface StreamHandlers {
  onToken: (text: string) => void
  onToolCall: (step: { id: string; name: string; args: Record<string, unknown> }) => void
  onToolResult: (id: string, ok: boolean, result: string) => void
  onDone: () => void
  onError: (message: string) => void
}

/** 解析一个 SSE 事件块（event: xxx / data: {...}） */
function dispatchBlock(block: string, handlers: StreamHandlers): void {
  let dataLine = ''
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) dataLine += line.slice(5).trim()
  }
  if (!dataLine) return
  let event: AgentEvent
  try {
    event = JSON.parse(dataLine) as AgentEvent
  } catch {
    return
  }
  switch (event.type) {
    case 'token':
      handlers.onToken(event.data.content)
      break
    case 'tool_call':
      handlers.onToolCall({ id: event.data.id, name: event.data.name, args: event.data.args })
      break
    case 'tool_result':
      handlers.onToolResult(event.data.id, event.data.ok, event.data.result)
      break
    case 'done':
      handlers.onDone()
      break
    case 'error':
      handlers.onError(event.data.message)
      break
  }
}

/** 发起流式对话；signal 取消时 fetch 与读取都会中断 */
export async function streamChat(
  payload: ChatPayload,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
  } catch (err) {
    if (signal.aborted) return
    handlers.onError(err instanceof Error ? err.message : String(err))
    return
  }
  if (!res.ok || !res.body) {
    const detail = await res.json().catch(() => ({}))
    handlers.onError((detail as { error?: string }).error ?? `请求失败 (${res.status})`)
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        dispatchBlock(block, handlers)
      }
    }
    if (buffer.trim()) dispatchBlock(buffer, handlers)
  } catch (err) {
    if (!signal.aborted) handlers.onError(err instanceof Error ? err.message : String(err))
  } finally {
    reader.releaseLock()
  }
}
