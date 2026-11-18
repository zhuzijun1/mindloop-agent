/**
 * ReAct 风格 Agent 循环：plan(模型决策) -> tool call -> observe -> 直到产出最终回答。
 * 每轮调用 provider.stream：token 增量直接透传；出现 tool_call 则执行工具、
 * 把观察结果写回消息上下文并进入下一轮。
 */
import type { AgentEvent, AgentRunResult, ChatMessage, ToolCallRecord } from '../types'
import type { LLMProvider, ProviderMessage, ProviderToolCall } from '../provider/types'
import { getTool, toolSchemas } from '../tools'
import type { ToolResult } from '../tools/types'

const MAX_ROUNDS = 5

const SYSTEM_PROMPT = `你是 MindLoop，一个具备工具使用能力的 AI 工作台助手。
规则：需要计算、查询时间、单位换算或记录备忘时，先调用对应工具，再基于工具返回的结果回答用户。
回答保持简洁、自然、使用中文。`

/** 把持久化的历史消息还原成 Provider 可理解的上下文（含工具调用轨迹） */
function historyToProviderMessages(history: ChatMessage[]): ProviderMessage[] {
  const out: ProviderMessage[] = []
  for (const m of history) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content })
      continue
    }
    for (const step of m.steps ?? []) {
      out.push({
        role: 'assistant',
        content: '',
        toolCalls: [{ id: step.id, name: step.name, args: step.args }],
      })
      out.push({ role: 'tool', toolCallId: step.id, content: step.result ?? '' })
    }
    out.push({ role: 'assistant', content: m.content })
  }
  return out
}

export interface AgentRunOptions {
  provider: LLMProvider
  history: ChatMessage[]
  userText: string
  signal: AbortSignal
  emit: (event: AgentEvent) => void
}

export async function runReActAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  const { provider, history, userText, signal, emit } = opts
  const messages: ProviderMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historyToProviderMessages(history),
    { role: 'user', content: userText },
  ]
  const steps: ToolCallRecord[] = []
  let content = ''
  let aborted = false

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (signal.aborted) {
      aborted = true
      break
    }
    const toolChunks: ProviderToolCall[] = []
    let roundText = ''
    try {
      for await (const chunk of provider.stream({ messages, tools: toolSchemas(), signal })) {
        if (signal.aborted) break
        if (chunk.kind === 'token') {
          roundText += chunk.text
          emit({ type: 'token', data: { content: chunk.text } })
        } else {
          toolChunks.push({ id: chunk.id, name: chunk.name, args: chunk.args })
        }
      }
    } catch (err) {
      if (!signal.aborted) throw err
    }
    content += roundText
    if (signal.aborted) {
      aborted = true
      break
    }

    // 没有工具调用 => 本轮即为最终回答，循环结束
    if (toolChunks.length === 0) break

    messages.push({
      role: 'assistant',
      content: roundText,
      toolCalls: toolChunks.map((c) => ({ id: c.id, name: c.name, args: c.args })),
    })

    // 依次执行工具调用，并把观察结果写回上下文
    for (const call of toolChunks) {
      emit({ type: 'tool_call', data: { id: call.id, name: call.name, args: call.args } })
      const tool = getTool(call.name)
      let result: ToolResult
      if (!tool) {
        result = { ok: false, output: `未注册的工具: ${call.name}` }
      } else {
        try {
          result = await tool.run(call.args)
        } catch (err) {
          result = { ok: false, output: `工具执行失败: ${err instanceof Error ? err.message : String(err)}` }
        }
      }
      steps.push({ id: call.id, name: call.name, args: call.args, ok: result.ok, result: result.output })
      emit({ type: 'tool_result', data: { id: call.id, name: call.name, ok: result.ok, result: result.output } })
      messages.push({ role: 'tool', toolCallId: call.id, content: result.output })
    }
  }

  return { content, steps, aborted }
}
