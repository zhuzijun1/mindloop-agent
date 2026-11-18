/**
 * 工具注册表：自动发现 src/tools 下的所有工具模块。
 * 约定：每个工具文件默认导出一个符合 Tool 接口的对象；
 * 新增工具只需放入本目录一个文件，无需改动注册表代码。
 */
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isTool, type Tool, type ToolSchema } from './types'

const here = path.dirname(fileURLToPath(import.meta.url))

async function discoverTools(): Promise<Tool[]> {
  const files = readdirSync(here).filter(
    (f) => /\.(ts|js)$/.test(f) && !f.startsWith('index.') && !f.endsWith('.d.ts'),
  )
  const tools: Tool[] = []
  for (const file of files) {
    const modulePath = pathToFileURL(path.join(here, file)).href
    const mod = (await import(modulePath)) as { default?: unknown }
    if (isTool(mod.default)) {
      tools.push(mod.default)
    } else {
      console.warn(`[tools] 跳过 ${file}：默认导出不符合 Tool 接口`)
    }
  }
  return tools.sort((a, b) => a.name.localeCompare(b.name))
}

const tools = await discoverTools()
const registry = new Map<string, Tool>(tools.map((t) => [t.name, t]))

export function getTool(name: string): Tool | undefined {
  return registry.get(name)
}

/** 暴露给 Provider 的工具 schema 列表 */
export function toolSchemas(): ToolSchema[] {
  return tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
}

export function listToolNames(): string[] {
  return [...registry.keys()]
}
