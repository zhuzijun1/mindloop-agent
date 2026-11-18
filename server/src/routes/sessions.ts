/** /api/sessions 路由：会话 CRUD */
import { Router } from 'express'
import {
  createSession,
  deleteSession,
  listSessions,
} from '../store/sessions'

export const sessionsRouter = Router()

sessionsRouter.get('/', (_req, res) => {
  res.json({ sessions: listSessions() })
})

sessionsRouter.post('/', (req, res) => {
  const body = (req.body ?? {}) as { title?: string }
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '新会话'
  const session = createSession(title)
  res.status(201).json({ session })
})

sessionsRouter.delete('/:id', (req, res) => {
  const { id } = req.params
  const ok = deleteSession(id)
  if (!ok) {
    res.status(404).json({ error: `会话 ${id} 不存在` })
    return
  }
  res.json({ ok: true })
})
