import { useState } from 'react'
import type { ToolStep } from '../types'

const TOOL_ICONS: Record<string, string> = {
  calculator: '🧮',
  datetime: '🕐',
  unit_convert: '📏',
  notes: '📝',
}

function formatArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ')
}

interface TraceProps {
  steps: ToolStep[]
  streaming: boolean
}

/** 可折叠的 Agent 思考过程面板：展示每次工具调用的参数与观察结果 */
export function AgentTrace({ steps, streaming }: TraceProps) {
  const [open, setOpen] = useState(false)
  const running = streaming && steps.some((s) => s.result === undefined)
  return (
    <div className="trace">
      <button className="trace-toggle" onClick={() => setOpen((v) => !v)}>
        <span className={`trace-caret${open ? ' open' : ''}`}>▸</span>
        <span>⚡ Agent 思考过程 · {steps.length} 次工具调用</span>
        {running && <span className="trace-badge">执行中</span>}
      </button>
      {open && (
        <ol className="trace-list">
          {steps.map((s, i) => (
            <li key={s.id} className="trace-step">
              <span className="trace-index">{i + 1}</span>
              <div className="trace-body">
                <div className="trace-call">
                  {TOOL_ICONS[s.name] ?? '🔧'} 调用 <code>{s.name}</code>
                  <span className="trace-args">({formatArgs(s.args)})</span>
                </div>
                <div className={`trace-result${s.ok === false ? ' fail' : ''}`}>
                  {s.result ?? '等待工具返回…'}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
