/** Express 入口：挂载 API 路由，并在存在 client/dist 时作为静态服务器 */
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { resolveProvider } from './provider'
import { chatRouter } from './routes/chat'
import { sessionsRouter } from './routes/sessions'
import { listToolNames } from './tools'

const here = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.json({ limit: '1mb' }))
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  if (_req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

app.use('/api/sessions', sessionsRouter)
app.use('/api/chat', chatRouter)

// 当 client 已构建时，直接作为静态站点服务，便于单进程部署
const clientDist = path.resolve(here, '../../client/dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

const PORT = Number(process.env.PORT) || 3001
const provider = resolveProvider()
app.listen(PORT, () => {
  console.log(`[mindloop] 服务端已启动，监听 http://localhost:${PORT}`)
  console.log(`[mindloop] Provider: ${provider.name} | 已注册工具: ${listToolNames().join(', ') || '(无)'}`)
})
