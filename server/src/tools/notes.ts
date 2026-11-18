/**
 * notes 工具：把内容追加写入 server/data/notes.json，作为最简单的"外部世界"副作用工具。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from '../config'
import type { Tool, ToolResult } from './types'
import { argString } from './types'

interface NoteEntry {
  id: string
  content: string
  createdAt: number
}

const NOTES_FILE = path.join(DATA_DIR, 'notes.json')

function readNotes(): NoteEntry[] {
  if (!existsSync(NOTES_FILE)) return []
  try {
    const parsed = JSON.parse(readFileSync(NOTES_FILE, 'utf-8')) as unknown
    return Array.isArray(parsed) ? (parsed as NoteEntry[]) : []
  } catch {
    return []
  }
}

const notes: Tool = {
  name: 'notes',
  description: '把一段内容作为备忘追加保存到本地 notes.json 文件。',
  parameters: {
    content: { type: 'string', description: '要记录的备忘内容', required: true },
  },
  async run(args): Promise<ToolResult> {
    const content = argString(args, 'content')
    if (!content) return { ok: false, output: '缺少参数 content' }
    const entry: NoteEntry = { id: crypto.randomUUID(), content, createdAt: Date.now() }
    const all = readNotes()
    all.push(entry)
    writeFileSync(NOTES_FILE, JSON.stringify(all, null, 2), 'utf-8')
    return { ok: true, output: `已保存备忘（当前共 ${all.length} 条）：${content}` }
  },
}

export default notes
