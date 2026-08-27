/** 全站日期/时间统一按中国（Asia/Shanghai）处理，避免 toISOString() 造成差一天 */

const CN_TZ = 'Asia/Shanghai'

/** 中国时区「此刻」对应的年月日部件 */
export function chinaParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  }
}

/** 中国时区今天 0 点（本地 Date，仅用于比较年月日） */
export function chinaToday(): Date {
  const { year, month, day } = chinaParts()
  return new Date(year, month - 1, day)
}

/** 中国时区今天的 YYYY-MM-DD */
export function chinaTodayIso(): string {
  const { year, month, day } = chinaParts()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Date → YYYY-MM-DD（按本地年月日，不走 UTC） */
export function toDateIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** YYYY-MM-DD → 本地 0 点 Date */
export function parseDateIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** YYYY-MM-DD 加减天数，返回 YYYY-MM-DD */
export function addDaysIso(iso: string, days: number): string {
  const d = parseDateIso(iso)
  d.setDate(d.getDate() + days)
  return toDateIso(d)
}

/** 展示用：中国时区日期时间字符串 */
export function formatChinaDateTime(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input.includes('T') || input.includes(' ') ? input : input + 'T00:00:00') : input
  if (Number.isNaN(d.getTime())) return String(input)
  return d.toLocaleString('zh-CN', { timeZone: CN_TZ, hour12: false })
}
