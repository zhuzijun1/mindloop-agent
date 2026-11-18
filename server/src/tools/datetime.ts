/**
 * datetime 工具：获取当前时间，支持时区换算。
 * 使用 Node 内置 Intl API，无第三方依赖。
 */
import type { Tool, ToolResult } from './types'
import { argString } from './types'

/** 常见城市/别名 -> IANA 时区 */
const TIMEZONE_ALIASES: Record<string, string> = {
  utc: 'UTC',
  gmt: 'UTC',
  本地: 'UTC',
  北京: 'Asia/Shanghai',
  上海: 'Asia/Shanghai',
  重庆: 'Asia/Shanghai',
  纽约: 'America/New_York',
  洛杉矶: 'America/Los_Angeles',
  伦敦: 'Europe/London',
  巴黎: 'Europe/Paris',
  柏林: 'Europe/Berlin',
  东京: 'Asia/Tokyo',
  悉尼: 'Australia/Sydney',
  新加坡: 'Asia/Singapore',
  莫斯科: 'Europe/Moscow',
  迪拜: 'Asia/Dubai',
}

export function resolveTimezone(input: string): string | undefined {
  const key = input.trim().toLowerCase()
  if (TIMEZONE_ALIASES[key]) return TIMEZONE_ALIASES[key]
  // 支持直接传 IANA 名称，如 Asia/Shanghai
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone: input })
    return input
  } catch {
    return undefined
  }
}

function formatInZone(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
  })
  return fmt.format(date)
}

/** 计算某时区相对 UTC 的偏移，如 +08:00 */
function zoneOffset(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  const diffMinutes = Math.round((asUtc - date.getTime()) / 60000)
  const sign = diffMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(diffMinutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}

const datetime: Tool = {
  name: 'datetime',
  description: '查询当前日期与时间，可指定时区（城市名或 IANA 时区名）。',
  parameters: {
    timezone: {
      type: 'string',
      description: '可选时区，如 "北京"、"纽约"、"UTC" 或 "Asia/Shanghai"；缺省为服务器本地时间',
    },
  },
  async run(args): Promise<ToolResult> {
    const now = new Date()
    const tzInput = argString(args, 'timezone')
    if (!tzInput) {
      const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
      return {
        ok: true,
        output: `当前本地时间（${localZone}）：${formatInZone(now, localZone)}，UTC 时间：${now.toISOString()}`,
      }
    }
    const timeZone = resolveTimezone(tzInput)
    if (!timeZone) return { ok: false, output: `无法识别的时区: ${tzInput}` }
    return {
      ok: true,
      output: `${tzInput}（${timeZone}，UTC${zoneOffset(now, timeZone)}）当前时间：${formatInZone(now, timeZone)}`,
    }
  },
}

export default datetime
