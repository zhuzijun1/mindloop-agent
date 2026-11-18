/** 会话持久化：server/data/sessions.json，内存缓存 + 写穿（write-through） */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from '../config'
import type { Session } from '../types'

const FILE = path.join(DATA_DIR, 'sessions.json')

let cache: Session[] | null = null

function load(): Session[] {
  if (cache) return cache
  if (existsSync(FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(FILE, 'utf-8')) as unknown
      cache = Array.isArray(parsed) ? (parsed as Session[]) : []
    } catch {
      cache = []
    }
  } else {
    cache = []
  }
  return cache
}

function persist(): void {
  writeFileSync(FILE, JSON.stringify(load(), null, 2), 'utf-8')
}

export function listSessions(): Session[] {
  return [...load()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getSession(id: string): Session | undefined {
  return load().find((s) => s.id === id)
}

export function createSession(title = '新会话'): Session {
  const now = Date.now()
  const session: Session = { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now, messages: [] }
  load().push(session)
  persist()
  return session
}

export function deleteSession(id: string): boolean {
  const sessions = load()
  const index = sessions.findIndex((s) => s.id === id)
  if (index < 0) return false
  sessions.splice(index, 1)
  persist()
  return true
}

/** 更新会话（追加消息 / 改标题），并刷新 updatedAt */
export function touchSession(session: Session): void {
  session.updatedAt = Date.now()
  persist()
}

/** 用首条用户消息生成会话标题 */
export function deriveTitle(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim()
  return clean.length > 20 ? `${clean.slice(0, 20)}…` : clean || '新会话'
}
