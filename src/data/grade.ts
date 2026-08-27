/** 入学年份 → 当前年级（每年 9 月 1 日升一级，最高大四，再往后为已毕业）。 */

import { chinaToday } from './date'

const LABELS = ['大一', '大二', '大三', '大四'] as const

export function academicYear(today = chinaToday()): number {
  const y = today.getFullYear()
  const month = today.getMonth() + 1
  const day = today.getDate()
  return month > 9 || (month === 9 && day >= 1) ? y : y - 1
}

export function gradeFromEnrollYear(enrollYear: number | null | undefined, today = chinaToday()): string {
  if (!enrollYear) return ''
  const n = academicYear(today) - enrollYear
  if (n < 0) return '未入学'
  if (n < 4) return LABELS[n]
  return '已毕业'
}
