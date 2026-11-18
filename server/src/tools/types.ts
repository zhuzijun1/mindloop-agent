/** 统一的工具接口：name / description / parameters / run */

export interface ToolParamSchema {
  type: 'string' | 'number' | 'boolean'
  description: string
  required?: boolean
  enum?: readonly string[]
}

export interface ToolResult {
  ok: boolean
  /** 面向 Agent 的自然语言观察结果，会作为 tool_result 事件推送 */
  output: string
}

export interface Tool {
  name: string
  description: string
  parameters: Record<string, ToolParamSchema>
  run(args: Record<string, unknown>): Promise<ToolResult>
}

/** 提供给 LLM Provider 的工具 schema（不含实现） */
export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, ToolParamSchema>
}

/** 运行时校验一个未知导出是否符合 Tool 接口（用于自动发现） */
export function isTool(value: unknown): value is Tool {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.name === 'string' &&
    typeof t.description === 'string' &&
    typeof t.parameters === 'object' &&
    t.parameters !== null &&
    typeof t.run === 'function'
  )
}

/** 参数读取辅助：把 unknown args 安全地取成 string / number */
export function argString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key]
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
}

export function argNumber(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return undefined
}
