/**
 * unit_convert 工具：长度 / 重量 / 温度单位换算。
 * 长度与重量换算到基准单位（米 / 千克）后按比例转换；温度使用公式换算。
 */
import type { Tool, ToolResult } from './types'
import { argNumber, argString } from './types'

type Category = 'length' | 'weight' | 'temperature'
type TempUnit = 'c' | 'f' | 'k'

/** 单位别名 -> 规范键；数值为该单位到基准单位的倍数 */
const LENGTH: Record<string, number> = {
  m: 1,
  km: 1000,
  dm: 0.1,
  cm: 0.01,
  mm: 0.001,
  mi: 1609.344,
  nmi: 1852,
  yd: 0.9144,
  ft: 0.3048,
  in: 0.0254,
}
const LENGTH_ALIASES: Record<string, string> = {
  米: 'm',
  公尺: 'm',
  千米: 'km',
  公里: 'km',
  分米: 'dm',
  厘米: 'cm',
  公分: 'cm',
  毫米: 'mm',
  英里: 'mi',
  海里: 'nmi',
  码: 'yd',
  英尺: 'ft',
  吋: 'in',
  英寸: 'in',
}

const WEIGHT: Record<string, number> = {
  kg: 1,
  g: 0.001,
  mg: 1e-6,
  t: 1000,
  lb: 0.45359237,
  oz: 0.02834949,
  jin: 0.5,
}
const WEIGHT_ALIASES: Record<string, string> = {
  千克: 'kg',
  公斤: 'kg',
  克: 'g',
  毫克: 'mg',
  吨: 't',
  磅: 'lb',
  盎司: 'oz',
  斤: 'jin',
}

const TEMPERATURE_ALIASES: Record<string, TempUnit> = {
  c: 'c',
  '℃': 'c',
  '°c': 'c',
  摄氏度: 'c',
  centigrade: 'c',
  f: 'f',
  '℉': 'f',
  '°f': 'f',
  华氏度: 'f',
  fahrenheit: 'f',
  k: 'k',
  开尔文: 'k',
  kelvin: 'k',
}

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '')
}

function lookupUnit(input: string): { category: Category; key: string } | undefined {
  const n = normalize(input)
  if (n in LENGTH) return { category: 'length', key: n }
  if (n in LENGTH_ALIASES) return { category: 'length', key: LENGTH_ALIASES[n] }
  if (n in WEIGHT) return { category: 'weight', key: n }
  if (n in WEIGHT_ALIASES) return { category: 'weight', key: WEIGHT_ALIASES[n] }
  if (n in TEMPERATURE_ALIASES) return { category: 'temperature', key: TEMPERATURE_ALIASES[n] }
  return undefined
}

function convertTemperature(value: number, from: string, to: string): number {
  let celsius: number
  if (from === 'c') celsius = value
  else if (from === 'f') celsius = ((value - 32) * 5) / 9
  else celsius = value - 273.15
  if (to === 'c') return celsius
  if (to === 'f') return (celsius * 9) / 5 + 32
  return celsius + 273.15
}

export function convertUnit(value: number, fromInput: string, toInput: string): string {
  const from = lookupUnit(fromInput)
  const to = lookupUnit(toInput)
  if (!from) throw new Error(`无法识别源单位: ${fromInput}`)
  if (!to) throw new Error(`无法识别目标单位: ${toInput}`)
  if (from.category !== to.category) {
    throw new Error(`${fromInput} 与 ${toInput} 不属于同一物理量，无法换算`)
  }
  let result: number
  if (from.category === 'temperature') {
    result = convertTemperature(value, from.key, to.key)
  } else {
    const table = from.category === 'length' ? LENGTH : WEIGHT
    result = (value * table[from.key]) / table[to.key]
  }
  const rounded = Number(result.toPrecision(8))
  return `${value} ${fromInput} = ${rounded} ${toInput}`
}

const unitConvert: Tool = {
  name: 'unit_convert',
  description: '在同类单位之间换算数值，支持长度（米/公里/英里/英尺等）、重量（千克/斤/磅等）、温度（摄氏/华氏/开尔文）。',
  parameters: {
    value: { type: 'number', description: '待换算的数值', required: true },
    from: { type: 'string', description: '源单位，如 "公里"、"kg"、"℃"', required: true },
    to: { type: 'string', description: '目标单位，如 "英里"、"斤"、"℉"', required: true },
  },
  async run(args): Promise<ToolResult> {
    const value = argNumber(args, 'value')
    const from = argString(args, 'from')
    const to = argString(args, 'to')
    if (value === undefined || !from || !to) {
      return { ok: false, output: '缺少参数 value / from / to' }
    }
    try {
      return { ok: true, output: convertUnit(value, from, to) }
    } catch (err) {
      return { ok: false, output: `换算失败: ${err instanceof Error ? err.message : String(err)}` }
    }
  },
}

export default unitConvert
