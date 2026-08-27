/* 荣誉相关共享类型与工具：Awards 页面与成员详情卡复用 */

export type Tier = 'national' | 'provincial' | 'city' | 'school'

export interface Award {
  id: string
  award: string
  contest: string
  contestId: string
  date: string // YYYY-MM，展示用
  dateFull: string // YYYY-MM-DD，排序用
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

/** 级别权重：越大越重要 */
export const TIER_WEIGHT: Record<Tier, number> = {
  national: 4,
  provincial: 3,
  city: 2,
  school: 1,
}

/**
 * 推断奖项级别。优先看奖项文案本身（省二不应因赛事名含「全国」被抬成国家级）；
 * 奖项无级别词时（如「银牌」）再参考比赛名（ICPC/CCPC 等）。
 */
export function tierOf(award: string, contestName = ''): Tier {
  if (/国家|全国|国际/.test(award)) return 'national'
  if (/省/.test(award)) return 'provincial'
  if (/市/.test(award)) return 'city'
  if (/校/.test(award)) return 'school'
  const hint = `${award} ${contestName}`
  if (/国家|全国|国际|亚洲|ICPC|CCPC/i.test(hint)) return 'national'
  if (/省/.test(hint)) return 'provincial'
  if (/市/.test(hint)) return 'city'
  return 'school'
}

/** 从奖项文本推断名次：一等奖/金牌=1，二等奖/银牌=2，三/铜=3，其余=1 */
export function rankOf(text: string): 1 | 2 | 3 {
  if (/一等|金牌|金奖|冠军|特等/.test(text)) return 1
  if (/二等|银牌|银奖|亚军|优胜/.test(text)) return 2
  if (/三等|铜牌|铜奖|季军/.test(text)) return 3
  return 1
}

/** 重要程度比较：级别高优先，同级名次更好优先（1>2>3），再新优先。返回 <0 表示 a 更重要。 */
export function compareImportance(a: Award, b: Award): number {
  const tw = TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier]
  if (tw !== 0) return tw
  if (a.rank !== b.rank) return a.rank - b.rank
  return b.dateFull.localeCompare(a.dateFull)
}

/** 同一场比赛只保留最好成绩（用于编年） */
export function bestAwardPerContest(awards: Award[]): Award[] {
  const best = new Map<string, Award>()
  for (const a of awards) {
    const cur = best.get(a.contestId)
    if (!cur || compareImportance(a, cur) < 0) best.set(a.contestId, a)
  }
  return [...best.values()]
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
