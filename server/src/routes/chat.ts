/** /api/chat 路由：SSE 流式对话，把 Agent 循环的每一步事件推给前端 */
import { Router } from 'express'
import type { Request, Response } from 'express'
import { resolveProvider } from '../provider'
import { runReActAgent } from '../agent/react'
import { deriveTitle, getSession, touchSession } from '../store/sessions'
import type { AgentEvent, ChatMessage } from '../types'

export const chatRouter = Router()

function formatSSE(event: AgentEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

chatRouter.post('/', async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { sessionId?: string; message?: string }
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!sessionId) {
    res.status(400).json({ error: '缺少 sessionId' })
    return
  }
  if (!message) {
    res.status(400).json({ error: '消息不能为空' })
    return
  }
  const session = getSession(sessionId)
  if (!session) {
    res.status(404).json({ error: `会话 ${sessionId} 不存在` })
    return
  }

  // SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof (res as unknown as { flushHeaders?: () => void }).flushHeaders === 'function') {
    (res as { flushHeaders: () => void }).flushHeaders()
  }

  const controller = new AbortController()
  // 注意：不能用 req.on('close')——请求体被 body-parser 读完后 req 流即销毁，
  // 会误判为客户端断开。res 的 close 在响应未写完时触发才代表客户端真正断开。
  res.on('close', () => {
    if (!res.writableFinished) controller.abort()
  })

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: message,
    createdAt: Date.now(),
  }
  session.messages.push(userMsg)
  if (session.title === '新会话') session.title = deriveTitle(message)
  touchSession(session)

  const assistantMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: '',
    steps: [],
    createdAt: Date.now(),
  }

  const emit = (event: AgentEvent): void => {
    if (res.writableEnded) return
    res.write(formatSSE(event))
  }

  try {
    const result = await runReActAgent({
      provider: resolveProvider(),
      history: session.messages.slice(0, -1),
      userText: message,
      signal: controller.signal,
      emit,
    })
    assistantMsg.content = result.content
    assistantMsg.steps = result.steps
    session.messages.push(assistantMsg)
    touchSession(session)
    if (result.aborted) {
      emit({ type: 'error', data: { message: '生成已停止' } })
    } else {
      emit({ type: 'done', data: { sessionId: session.id } })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    emit({ type: 'error', data: { message: errorMessage } })
    if (assistantMsg.content || assistantMsg.steps?.length) {
      session.messages.push(assistantMsg)
      touchSession(session)
    }
  } finally {
    if (!res.writableEnded) res.end()
  }
})
