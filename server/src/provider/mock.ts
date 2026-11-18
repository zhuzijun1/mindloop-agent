/**
 * MockProvider：无需任何 API key 的本地规则引擎。
 * - 能从用户消息中识别"计算 / 时间 / 换算 / 记一下"等意图并真实触发对应工具；
 * - 工具观察结果返回后，生成模板化的最终回答；
 * - 其余输入返回引导性模板回答，逐 token 流式输出（20-40ms 间隔）。
 */
import type { LLMProvider, ProviderChunk, ProviderMessage, ProviderRequest } from './types'
import { resolveTimezone } from '../tools/datetime'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Intent {
  tool: string
  args: Record<string, unknown>
}

/** 从文本里抽取纯算术表达式（× ÷ 会归一化为 * /） */
function extractExpression(text: string): string | undefined {
  const normalized = text.replace(/×/g, '*').replace(/÷/g, '/')
  const expr = normalized
    .replace(/[^0-9+\-*/%().^]/g, ' ')
    .replace(/\*\*/g, '§')
    .replace(/\s+/g, ' ')
    .replace(/§/g, '**')
    .trim()
  if (!expr) return undefined
  if (!/[+\-*/%^]/.test(expr)) return undefined
  if (!/^\d[\d\s+\-*/%^().]*$/.test(expr)) return undefined
  return expr
}

function extractTimezone(text: string): string | undefined {
  for (const city of ['北京', '上海', '纽约', '伦敦', '巴黎', '柏林', '东京', '悉尼', '新加坡', '莫斯科', '迪拜', '洛杉矶', 'UTC', 'GMT']) {
    if (text.includes(city) && resolveTimezone(city)) return city
  }
  const iana = text.match(/\b[A-Z][a-z]+\/[A-Z][a-z_]+\b/)
  if (iana && resolveTimezone(iana[0])) return iana[0]
  return undefined
}

const UNIT_WORD = String.raw`[0-9a-zA-Z°℃℉]{1,8}|(?:千米|公里|厘米|毫米|分米|英寸|英尺|英里|海里|千克|公斤|盎司|华氏度|摄氏度|开尔文|米|克|吨|磅|斤|码)`
const UNIT_RE = new RegExp(
  String.raw`(-?\d+(?:\.\d+)?)\s*(${UNIT_WORD})\s*(?:换算成|换算为|换算到|转换成|转成|化成|等于|变成|to)\s*(${UNIT_WORD})`,
  'i',
)

function detectIntent(text: string): Intent | undefined {
  // 备忘优先：避免"记一下明天要算账"误触发 calculator
  const noteMatch = text.match(/(?:记一下|记录一下|帮我记|备忘|记住|记：|note[:：])\s*[:：,，]?\s*([\s\S]+)/i)
  if (noteMatch?.[1]) return { tool: 'notes', args: { content: noteMatch[1].trim() } }

  const unitMatch = text.match(UNIT_RE)
  if (unitMatch) {
    return {
      tool: 'unit_convert',
      args: { value: Number(unitMatch[1]), from: unitMatch[2], to: unitMatch[3] },
    }
  }

  if (/(几点|时间|日期|星期|今天|现在|时区)/.test(text)) {
    const timezone = extractTimezone(text)
    return { tool: 'datetime', args: timezone ? { timezone } : {} }
  }

  if (/(计算|算一下|帮我算|等于|多少|\d\s*[+\-*/×÷%]\s*\d)/.test(text)) {
    const expression = extractExpression(text)
    if (expression) return { tool: 'calculator', args: { expression } }
  }

  return undefined
}

/** 工具执行完成后的最终回答模板 */
function finalAnswer(toolName: string, observation: string): string {
  switch (toolName) {
    case 'calculator':
      return `算好了：${observation}。还需要计算别的吗？`
    case 'datetime':
      return observation
    case 'unit_convert':
      return `换算结果：${observation}`
    case 'notes':
      return `好的，${observation}。随时可以让我再记新的内容。`
    default:
      return `工具 ${toolName} 返回：${observation}`
  }
}

function fallbackAnswer(userText: string): string {
  const echo = userText.trim().slice(0, 30) || '（空消息）'
  return (
    `你好，我是 MindLoop 内置的 Mock 模型（当前没有配置 OPENAI_API_KEY，所以由本地规则引擎驱动）。` +
    `你说的是：「${echo}」。我可以现场演示完整的 ReAct Agent 流程，试试这些：` +
    `「帮我算 128*7」「现在纽约几点」「5公里换算成英里」「记一下：周五前投简历」。`
  )
}

/** 找到某次工具调用对应的工具名（用于观察后的最终回答模板） */
function toolNameForCall(messages: ProviderMessage[], callId?: string): string {
  if (!callId) return ''
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    const call = m.toolCalls?.find((c) => c.id === callId)
    if (call) return call.name
  }
  return ''
}

/** 轻量分词：CJK 单字成 token，其余按连续非 CJK 片段成 token */
function tokenize(text: string): string[] {
  const matches = text.match(/[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]|[^\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]+/g)
  return matches ?? []
}

export class MockProvider implements LLMProvider {
  readonly name = 'mock'

  async *stream(req: ProviderRequest): AsyncGenerator<ProviderChunk> {
    const { messages, signal } = req
    const last = messages[messages.length - 1]

    // 观察阶段：上一条是工具结果 -> 产出最终回答（token 流）
    if (last?.role === 'tool') {
      const toolName = toolNameForCall(messages, last.toolCallId)
      yield* this.emitText(finalAnswer(toolName, last.content), signal)
      return
    }

    // 决策阶段：识别意图 -> 产出一个 tool_call；否则直接流式回答
    const userText = last?.role === 'user' ? last.content : ''
    const intent = userText ? detectIntent(userText) : undefined
    if (intent) {
      yield { kind: 'tool_call', id: crypto.randomUUID(), name: intent.tool, args: intent.args }
      return
    }
    yield* this.emitText(fallbackAnswer(userText), signal)
  }

  /** 逐 token 异步产出文本，模拟真实模型的流式输出节奏 */
  private async *emitText(text: string, signal?: AbortSignal): AsyncGenerator<ProviderChunk> {
    for (const token of tokenize(text)) {
      if (signal?.aborted) return
      yield { kind: 'token', text: token }
      await sleep(20 + Math.random() * 20)
    }
  }
}
