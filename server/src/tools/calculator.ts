/**
 * calculator 工具：安全地计算四则运算表达式。
 * 实现方式：手写词法分析 + 递归下降语法分析，绝不使用 eval / Function。
 * 支持：+ - * / % **、括号、一元正负号、小数。
 */
import type { Tool, ToolResult } from './types'
import { argString } from './types'

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1
      const text = src.slice(i, j)
      if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`非法数字: ${text}`)
      tokens.push({ type: 'num', value: Number(text) })
      i = j
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' })
      i += 1
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' })
      i += 1
      continue
    }
    if (src.startsWith('**', i)) {
      tokens.push({ type: 'op', value: '**' })
      i += 2
      continue
    }
    if ('+-*/%'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i += 1
      continue
    }
    throw new Error(`不支持的字符: "${ch}"`)
  }
  return tokens
}

/** 递归下降解析器：expr -> term -> factor -> power -> primary */
class Parser {
  private pos = 0

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    if (this.tokens.length === 0) throw new Error('表达式为空')
    const value = this.expr()
    if (this.pos !== this.tokens.length) throw new Error('表达式存在多余内容')
    return value
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private isOp(op: string): boolean {
    const t = this.peek()
    return t !== undefined && t.type === 'op' && t.value === op
  }

  private eatOp(op: string): void {
    this.pos += 1
  }

  private expr(): number {
    let value = this.term()
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.peek() as { value: string }).value
      this.eatOp(op)
      const rhs = this.term()
      value = op === '+' ? value + rhs : value - rhs
    }
    return value
  }

  private term(): number {
    let value = this.factor()
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = (this.peek() as { value: string }).value
      this.eatOp(op)
      const rhs = this.factor()
      if (op === '*') value *= rhs
      else if (op === '/') {
        if (rhs === 0) throw new Error('除数不能为 0')
        value /= rhs
      } else {
        if (rhs === 0) throw new Error('取模的除数不能为 0')
        value %= rhs
      }
    }
    return value
  }

  private factor(): number {
    if (this.isOp('-')) {
      this.eatOp('-')
      return -this.factor()
    }
    if (this.isOp('+')) {
      this.eatOp('+')
      return this.factor()
    }
    return this.power()
  }

  private power(): number {
    const base = this.primary()
    if (this.isOp('**')) {
      this.eatOp('**')
      const exponent = this.factor()
      if (Math.abs(base) ** Math.abs(exponent) > 1e308) throw new Error('结果溢出')
      return base ** exponent
    }
    return base
  }

  private primary(): number {
    const t = this.peek()
    if (!t) throw new Error('表达式不完整')
    if (t.type === 'num') {
      this.pos += 1
      return t.value
    }
    if (t.type === 'lparen') {
      this.pos += 1
      const value = this.expr()
      const close = this.peek()
      if (!close || close.type !== 'rparen') throw new Error('括号不匹配')
      this.pos += 1
      return value
    }
    throw new Error('表达式解析失败')
  }
}

/** 计算表达式并消除浮点噪声（如 0.1+0.2） */
export function evaluateExpression(src: string): number {
  const raw = new Parser(tokenize(src)).parse()
  if (!Number.isFinite(raw)) throw new Error('结果不是有限数')
  return Number(raw.toPrecision(12))
}

const calculator: Tool = {
  name: 'calculator',
  description: '计算一个数学表达式，支持 + - * / % **、括号与小数。',
  parameters: {
    expression: {
      type: 'string',
      description: '数学表达式字符串，例如 "128*7" 或 "(3+4)*2**3"',
      required: true,
    },
  },
  async run(args): Promise<ToolResult> {
    const expression = argString(args, 'expression')
    if (!expression) return { ok: false, output: '缺少参数 expression' }
    try {
      const value = evaluateExpression(expression)
      return { ok: true, output: `${expression} = ${value}` }
    } catch (err) {
      return { ok: false, output: `计算失败: ${err instanceof Error ? err.message : String(err)}` }
    }
  },
}

export default calculator
