/* 荣誉相关共享类型与工具：Awards 页面与成员详情卡复用 */

export type Tier = 'national' | 'provincial' | 'city' | 'school'

export interface Award {
  id: string
  award: string
  contest: string
  contestId: string
  date: string
  tier: Tier
  memberIds: string[]
  team?: string
  rank: 1 | 2 | 3
}

export const TIER_META: Record<Tier, { label: string; en: string; color: string }> = {
  national: { label: '国家级', en: 'NATIONAL', color: '#f5c64f' },
  provincial: { label: '省级', en: 'PROVINCIAL', color: '#c9d6e8' },
  city: { label: '市级', en: 'CITY', color: '#d9905f' },
  school: { label: '校级', en: 'SCHOOL', color: '#22d3ee' },
}

export const RANK_ICON = ['🥇', '🥈', '🥉'] as const

/** 从奖项文本推断级别：国家级/全国/国际 > 省 > 市 > 校 */
export function tierOf(text: string): Tier {
  if (/国家|全国|国际|亚洲|ICPC|CCPC/i.test(text)) return 'national'
  if (/省/.test(text)) return 'provincial'
  if (/市/.test(text)) return 'city'
  return 'school'
}

/** 从奖项文本推断名次：一等奖/金牌=1，二等奖/银牌=2，三/铜=3，其余=1 */
export function rankOf(text: string): 1 | 2 | 3 {
  if (/一等|金牌|金奖|冠军|特等/.test(text)) return 1
  if (/二等|银牌|银奖|亚军|优胜/.test(text)) return 2
  if (/三等|铜牌|铜奖|季军/.test(text)) return 3
  return 1
}

/* 励志语录：页面随机展示一条 */
export const QUOTES = [
  '代码是写给未来的诗，赛场是检验热爱的舞台。',
  '每一次 AC，都是千百次调试之后迎来的破晓。',
  '不是因为厉害才站上赛场，而是因为站上赛场才变得厉害。',
  '把不可能编译成可能，把热爱运行成习惯。',
  '奖项会过期，但一起熬过的夜不会。',
  '下一个赛季，从这一行代码开始。',
]
