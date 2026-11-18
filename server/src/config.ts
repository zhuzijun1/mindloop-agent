/** 运行时路径配置：统一提供 server/data 目录并确保存在 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

/** server/data 目录（sessions.json / notes.json 存放处） */
export const DATA_DIR = path.resolve(here, '../data')

mkdirSync(DATA_DIR, { recursive: true })
