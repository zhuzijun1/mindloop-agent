import { useCallback, useEffect, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { EmptyState } from './components/EmptyState'
import { MessageBubble } from './components/MessageBubble'
import { Composer } from './components/Composer'
import { createSession, fetchSessions, removeSession, streamChat } from './api/client'
import type { Session, UIMessage } from './types'

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async (): Promise<Session[]> => {
    try {
      const list = await fetchSessions()
      setSessions(list)
      return list
    } catch {
      setError('无法连接后端服务，请确认 `npm run dev` 已启动')
      return []
    }
  }, [])

  const openSession = useCallback((session: Session) => {
    setActiveId(session.id)
    setMessages(
      session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        steps: m.steps ?? [],
        streaming: false,
      })),
    )
    setError(null)
  }, [])

  useEffect(() => {
    void (async () => {
      const list = await refresh()
      if (list.length > 0) openSession(list[0])
    })()
  }, [refresh, openSession])

  // 消息更新后自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, error])

  const handleNew = useCallback(async () => {
    const session = await createSession()
    setSessions((prev) => [session, ...prev])
    openSession(session)
  }, [openSession])

  const handleDelete = useCallback(
    async (id: string) => {
      if (streaming && id === activeId) abortRef.current?.abort()
      await removeSession(id).catch(() => undefined)
      const list = await refresh()
      if (id === activeId) {
        if (list.length > 0) openSession(list[0])
        else {
          setActiveId(null)
          setMessages([])
        }
      }
    },
    [activeId, streaming, refresh, openSession],
  )

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || streaming) return

      let sessionId = activeId
      if (!sessionId) {
        const session = await createSession()
        setSessions((prev) => [session, ...prev])
        sessionId = session.id
        setActiveId(sessionId)
      }

      const assistantId = crypto.randomUUID()
      const userMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        steps: [],
        streaming: false,
      }
      const assistantMessage: UIMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        steps: [],
        streaming: true,
      }
      setMessages((prev) => [...prev, userMessage, assistantMessage])
      setError(null)
      setStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller
      const patch = (fn: (m: UIMessage) => UIMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)))

      await streamChat(
        { sessionId, message: text },
        {
          onToken: (t) => patch((m) => ({ ...m, content: m.content + t })),
          onToolCall: (call) =>
            patch((m) => ({ ...m, steps: [...m.steps, { ...call, result: undefined }] })),
          onToolResult: (id, ok, result) =>
            patch((m) => ({
              ...m,
              steps: m.steps.map((s) => (s.id === id ? { ...s, ok, result } : s)),
            })),
          onDone: () => patch((m) => ({ ...m, streaming: false })),
          onError: (message) => {
            setError(message)
            patch((m) => ({ ...m, streaming: false }))
          },
        },
        controller.signal,
      )

      patch((m) => ({ ...m, streaming: false }))
      setStreaming(false)
      abortRef.current = null
      await refresh()
    },
    [activeId, streaming, refresh],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const activeSession = sessions.find((s) => s.id === activeId)

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={openSession}
        onNew={() => void handleNew()}
        onDelete={(id) => void handleDelete(id)}
      />
      <main className="chat">
        <header className="chat-header">
          <div className="brand">
            <span className="brand-dot" />
            MindLoop
          </div>
          <div className="chat-subtitle">{activeSession ? activeSession.title : 'AI Agent 工作台'}</div>
        </header>
        <div className="messages" ref={scrollRef}>
          {messages.length === 0 ? (
            <EmptyState onPick={(q) => void send(q)} />
          ) : (
            messages.map((m) => <MessageBubble key={m.id} msg={m} />)
          )}
          {error && <div className="error-banner">{error}</div>}
        </div>
        <Composer streaming={streaming} onSend={(text) => void send(text)} onStop={stop} />
      </main>
    </div>
  )
}
