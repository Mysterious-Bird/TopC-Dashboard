/* 职位是动态实体（可扩展），不再是写死的枚举。
   管理关系 = managesAll 全局规则 + manages 显式规则，图谱职务连线由此推导。 */
export interface RoleDef {
  id: string
  name: string
  sort: number // 越小越靠前
  color: string
  managesAll: boolean // 管理全社（社长/副社长）
  excludes: string[] // managesAll 时排除的职位名
  manages: string[] // 显式管理的职位名
  memberCount?: number
}

export type Gender = '男' | '女'

export interface Member {
  id: string
  name: string
  gender: Gender
  phone: string
  qq: string
  email: string
  roles: string[] // 可挂多个职位
  grade: string // 年级
  major: string // 专业
  studentId: string // 学号
  tags: string[] // 技术栈
  joinedAt: string
  color: string // 头像/节点色
}

export type ContestCategory = '算法' | '开发' | '安全' | 'AI' | '建模'

export interface Team {
  id: string
  name: string
  memberIds: string[]
}

export interface Milestone {
  id: string
  date: string // ISO date，当天触发邮件提醒
  title: string
}

export interface ContestResult {
  id: string
  award: string // 如 国家级二等奖 / 银牌
  memberIds: string[] // 获奖成员（团队奖 = 全队）
  note: string
}

export interface Contest {
  id: string
  name: string
  short: string
  category: ContestCategory
  level: '国际' | '全国' | '省级' | '校级'
  start: string // ISO date
  end: string // ISO date
  registerBy: string // 报名截止
  location: string
  teamSize: number // 团队赛 = 每队上限
  isTeam: boolean // 团队赛才有队伍；个人赛用 participantIds 直选
  teams: Team[]
  participantIds: string[] // 团队赛 = 各队成员并集（派生）；个人赛 = 直接名单
  color: string
  description: string
  reminderDays: number[] // 开赛前 N 天发邮件提醒
  remindEnabled: boolean // 关闭则不发任何比赛邮件
  remindRecipientIds: string[] // 自定义收件人；空 = 默认（该比赛参赛者 + 社长）
  milestones: Milestone[] // 固定日期事项（如作品提交截止），当天提醒
  results: ContestResult[] // 成绩 / 获奖记录
}

export const ROLES: RoleDef[] = [
  { id: 'r1', name: '社长', sort: 1, color: '#22d3ee', managesAll: true, excludes: [], manages: [] },
  { id: 'r2', name: '副社长', sort: 2, color: '#a78bfa', managesAll: true, excludes: ['社长'], manages: [] },
  { id: 'r3', name: '监察部部长', sort: 3, color: '#f87171', managesAll: false, excludes: [], manages: ['AC部成员', '设计部成员'] },
  { id: 'r4', name: 'AC部部长', sort: 4, color: '#38bdf8', managesAll: false, excludes: [], manages: ['AC部成员'] },
  { id: 'r5', name: '设计部部长', sort: 5, color: '#f472b6', managesAll: false, excludes: [], manages: ['设计部成员'] },
  { id: 'r6', name: 'AC部成员', sort: 10, color: '#34d399', managesAll: false, excludes: [], manages: [] },
  { id: 'r7', name: '设计部成员', sort: 11, color: '#fbbf24', managesAll: false, excludes: [], manages: [] },
  { id: 'r8', name: 'TC部成员', sort: 12, color: '#c084fc', managesAll: false, excludes: [], manages: [] },
]

export const roleColor = (roles: RoleDef[], name: string): string =>
  roles.find((r) => r.name === name)?.color ?? '#93c5fd'

export const roleSort = (roles: RoleDef[], name: string): number =>
  roles.find((r) => r.name === name)?.sort ?? 99

/** 成员的最高职位名（用于列表排序/主徽章） */
export const primaryRole = (roles: RoleDef[], m: Member): string =>
  [...m.roles].sort((a, b) => roleSort(roles, a) - roleSort(roles, b))[0] ?? ''

/**
 * 职务连线推导（与后端 /api/graph 同规则）：
 * 管理者 M 的任一职位命中规则 → M → N 连一条职务线。
 */
export function deriveRoleLinks(members: Member[], roles: RoleDef[]): [string, string][] {
  const out: [string, string][] = []
  for (const mgr of members) {
    for (const mbr of members) {
      if (mgr.id === mbr.id) continue
      const hit = mgr.roles.some((rn) => {
        const r = roles.find((x) => x.name === rn)
        if (!r) return false
        if (r.managesAll) return !mbr.roles.some((x) => r.excludes.includes(x))
        return mbr.roles.some((x) => r.manages.includes(x))
      })
      if (hit) out.push([mgr.id, mbr.id])
    }
  }
  return out
}

export const MEMBERS: Member[] = [
  { id: 'm01', name: '林亦风', gender: '男', phone: '138****2201', qq: '821034556', email: 'linyf@topc.dev', roles: ['社长'], grade: '大三', major: '计算机科学与技术', studentId: '2023****01', tags: ['全栈', 'Rust', '架构'], joinedAt: '2023-09-01', color: '#22d3ee' },
  { id: 'm02', name: '苏晚星', gender: '女', phone: '137****8842', qq: '790123884', email: 'suwx@topc.dev', roles: ['副社长', 'TC部成员'], grade: '大三', major: '软件工程', studentId: '2023****02', tags: ['算法', 'C++', '竞赛'], joinedAt: '2023-09-01', color: '#a78bfa' },
  { id: 'm03', name: '赵擎苍', gender: '男', phone: '139****9024', qq: '417766230', email: 'zhaoqc@topc.dev', roles: ['监察部部长', 'AC部成员'], grade: '大二', major: '网络空间安全', studentId: '2024****05', tags: ['CTF', 'Pwn', '逆向'], joinedAt: '2024-09-02', color: '#f87171' },
  { id: 'm04', name: '许青梧', gender: '女', phone: '188****5567', qq: '552019376', email: 'xuqw@topc.dev', roles: ['AC部部长'], grade: '大二', major: '人工智能', studentId: '2024****04', tags: ['DP', '图论', 'Python'], joinedAt: '2024-09-02', color: '#fbbf24' },
  { id: 'm05', name: '顾清让', gender: '女', phone: '136****7743', qq: '905512847', email: 'guqr@topc.dev', roles: ['设计部部长'], grade: '大二', major: '数字媒体技术', studentId: '2024****06', tags: ['设计', '视频', '运营'], joinedAt: '2024-09-02', color: '#f472b6' },
  { id: 'm06', name: '陈砚舟', gender: '男', phone: '150****3310', qq: '630288145', email: 'chenyz@topc.dev', roles: ['TC部成员'], grade: '大二', major: '计算机科学与技术', studentId: '2024****03', tags: ['前端', 'React', 'Three.js'], joinedAt: '2024-09-02', color: '#34d399' },
  { id: 'm07', name: '何思源', gender: '男', phone: '155****4419', qq: '308844961', email: 'hesy@topc.dev', roles: ['TC部成员'], grade: '大一', major: '计算机科学与技术', studentId: '2025****07', tags: ['Go', '后端'], joinedAt: '2025-09-01', color: '#38bdf8' },
  { id: 'm08', name: '沈知夏', gender: '女', phone: '152****6680', qq: '223019458', email: 'shenzx@topc.dev', roles: ['AC部成员'], grade: '大一', major: '软件工程', studentId: '2025****08', tags: ['Vue', 'TypeScript'], joinedAt: '2025-09-01', color: '#4ade80' },
  { id: 'm09', name: '韩景行', gender: '男', phone: '187****2255', qq: '774120693', email: 'hanjx@topc.dev', roles: ['AC部成员'], grade: '大一', major: '人工智能', studentId: '2025****09', tags: ['数论', '组合数学'], joinedAt: '2025-09-01', color: '#facc15' },
  { id: 'm10', name: '唐雨桐', gender: '女', phone: '135****8874', qq: '661337209', email: 'tangyt@topc.dev', roles: ['设计部成员'], grade: '大一', major: '数据科学', studentId: '2025****10', tags: ['机器学习', 'PyTorch'], joinedAt: '2025-09-01', color: '#c084fc' },
  { id: 'm11', name: '罗亦凡', gender: '男', phone: '186****1102', qq: '149885730', email: 'luoyf@topc.dev', roles: ['AC部成员'], grade: '大二', major: '网络空间安全', studentId: '2024****11', tags: ['Web安全', '渗透'], joinedAt: '2024-09-02', color: '#fb923c' },
  { id: 'm12', name: '纪云舒', gender: '女', phone: '158****3346', qq: '330671284', email: 'jiys@topc.dev', roles: ['AC部成员'], grade: '大二', major: '信息安全', studentId: '2024****12', tags: ['Crypto', 'Misc'], joinedAt: '2024-09-02', color: '#2dd4bf' },
  { id: 'm13', name: '温以凡', gender: '男', phone: '177****9921', qq: '518203947', email: 'wenyf@topc.dev', roles: ['设计部成员'], grade: '大一', major: '数字媒体技术', studentId: '2025****13', tags: ['摄影', '剪辑'], joinedAt: '2025-09-01', color: '#e879f9' },
  { id: 'm14', name: '白露白', gender: '女', phone: '133****5578', qq: '882914630', email: '', roles: ['设计部成员'], grade: '大一', major: '视觉传达', studentId: '2025****14', tags: ['海报', 'UI'], joinedAt: '2025-09-01', color: '#93c5fd' },
]

const team = (id: string, name: string, memberIds: string[]): Team => ({ id, name, memberIds })
const union = (teams: Team[]): string[] => [...new Set(teams.flatMap((t) => t.memberIds))]

const C01_TEAMS = [team('t01', 'TopC 一队', ['m01', 'm02', 'm09']), team('t02', 'TopC 二队', ['m08', 'm11', 'm12'])]
const C02_TEAMS = [team('t03', 'CCPC 队', ['m02', 'm04', 'm09'])]
const C03_TEAMS = [team('t04', '信安队', ['m03', 'm11', 'm12'])]
const C04_TEAMS = [team('t05', '强网队', ['m03', 'm11', 'm12', 'm01'])]
const C05_TEAMS = [team('t06', '天梯一队', ['m02', 'm04', 'm07', 'm08', 'm09']), team('t07', '天梯二队', ['m10', 'm03', 'm11', 'm12', 'm06'])]
const C06_TEAMS = [team('t08', '黑客松队', ['m06', 'm07', 'm08', 'm14'])]
const C07_TEAMS = [team('t09', 'Kaggle 队', ['m10', 'm04'])]
const C08_TEAMS = [team('t10', '建模队', ['m09', 'm10', 'm04'])]
const C10_TEAMS = [team('t11', '小程序队', ['m06', 'm08'])]

export const CONTESTS: Contest[] = [
  { id: 'c01', name: 'ICPC 亚洲区域赛 · 南京站', short: 'ICPC 南京', category: '算法', level: '国际', start: '2026-10-17', end: '2026-10-18', registerBy: '2026-09-25', location: '南京', teamSize: 3, isTeam: true, teams: C01_TEAMS, participantIds: union(C01_TEAMS), color: '#22d3ee', description: 'ACM-ICPC 亚洲区域赛，三人一队，5 小时 13 题。', reminderDays: [14, 7, 1], remindEnabled: true, remindRecipientIds: [], milestones: [], results: [] },
  { id: 'c02', name: 'CCPC 中国大学生程序设计竞赛 · 哈尔滨站', short: 'CCPC 哈尔滨', category: '算法', level: '全国', start: '2026-09-19', end: '2026-09-20', registerBy: '2026-09-01', location: '哈尔滨', teamSize: 3, isTeam: true, teams: C02_TEAMS, participantIds: union(C02_TEAMS), color: '#38bdf8', description: 'CCPC 分站赛，强校云集，目标银牌以上。', reminderDays: [14, 7, 1], remindEnabled: true, remindRecipientIds: [], milestones: [], results: [] },
  { id: 'c03', name: '全国大学生信息安全竞赛 · 作品赛', short: '信安作品赛', category: '安全', level: '全国', start: '2026-08-05', end: '2026-08-28', registerBy: '2026-06-30', location: '线上', teamSize: 4, isTeam: true, teams: C03_TEAMS, participantIds: union(C03_TEAMS), color: '#f87171', description: '作品赛阶段，提交安全工具原型并答辩。', reminderDays: [7, 3, 1], remindEnabled: true, remindRecipientIds: [], milestones: [{ id: 'ms1', date: '2026-08-19', title: '中期进度检查' }, { id: 'ms2', date: '2026-08-26', title: '作品提交截止' }], results: [] },
  { id: 'c04', name: '强网杯 CTF 线上选拔赛', short: '强网杯', category: '安全', level: '全国', start: '2026-08-22', end: '2026-08-23', registerBy: '2026-08-18', location: '线上', teamSize: 4, isTeam: true, teams: C04_TEAMS, participantIds: union(C04_TEAMS), color: '#fb923c', description: '36 小时线上 CTF，晋级线下决赛。', reminderDays: [7, 3, 1], remindEnabled: true, remindRecipientIds: ['m01', 'm03', 'm11', 'm12'], milestones: [], results: [] },
  { id: 'c05', name: '中国高校计算机大赛 · 团体程序设计天梯赛', short: '天梯赛', category: '算法', level: '全国', start: '2026-11-21', end: '2026-11-21', registerBy: '2026-11-01', location: '线上', teamSize: 5, isTeam: true, teams: C05_TEAMS, participantIds: union(C05_TEAMS), color: '#a78bfa', description: '10 人团体赛，分级计分，考察整体厚度。', reminderDays: [14, 7, 1], remindEnabled: true, remindRecipientIds: [], milestones: [], results: [] },
  { id: 'c06', name: '校级黑客松 · 智慧校园', short: '校黑客松', category: '开发', level: '校级', start: '2026-09-05', end: '2026-09-06', registerBy: '2026-08-22', location: '本校创新楼', teamSize: 4, isTeam: true, teams: C06_TEAMS, participantIds: union(C06_TEAMS), color: '#34d399', description: '48 小时极限开发，主题为智慧校园应用。', reminderDays: [7, 2, 1], remindEnabled: true, remindRecipientIds: [], milestones: [], results: [] },
  { id: 'c07', name: 'Kaggle · LLM 科学推理赛', short: 'Kaggle LLM', category: 'AI', level: '国际', start: '2026-08-10', end: '2026-10-10', registerBy: '2026-09-30', location: '线上', teamSize: 3, isTeam: true, teams: C07_TEAMS, participantIds: union(C07_TEAMS), color: '#c084fc', description: '大模型科学推理，线上长期赛，按周迭代提交。', reminderDays: [7, 3], remindEnabled: true, remindRecipientIds: [], milestones: [{ id: 'ms3', date: '2026-09-01', title: '阶段提交' }, { id: 'ms4', date: '2026-10-05', title: '最终提交截止' }], results: [] },
  { id: 'c08', name: '全国大学生数学建模竞赛', short: '数学建模', category: '建模', level: '全国', start: '2026-09-10', end: '2026-09-13', registerBy: '2026-09-03', location: '本校机房', teamSize: 3, isTeam: true, teams: C08_TEAMS, participantIds: union(C08_TEAMS), color: '#fbbf24', description: '三天三夜，建模 + 编程 + 论文。', reminderDays: [7, 3, 1], remindEnabled: true, remindRecipientIds: [], milestones: [], results: [] },
  { id: 'c09', name: '蓝桥杯全国总决赛 · 软件类', short: '蓝桥杯国赛', category: '算法', level: '全国', start: '2026-07-11', end: '2026-07-11', registerBy: '2026-06-20', location: '线上', teamSize: 1, isTeam: false, teams: [], participantIds: ['m07', 'm08', 'm11'], color: '#60a5fa', description: '已完赛：本社获国二 1 项、国三 2 项。', reminderDays: [7, 1], remindEnabled: true, remindRecipientIds: [], milestones: [], results: [{ id: 'r1', award: '国家级二等奖', memberIds: ['m08'], note: '' }, { id: 'r2', award: '国家级三等奖', memberIds: ['m07', 'm11'], note: '' }] },
  { id: 'c10', name: '微信小程序应用开发赛', short: '小程序赛', category: '开发', level: '全国', start: '2026-11-27', end: '2026-12-05', registerBy: '2026-10-30', location: '线上', teamSize: 4, isTeam: true, teams: C10_TEAMS, participantIds: union(C10_TEAMS), color: '#2dd4bf', description: '作品提交制，含路演视频与文档。', reminderDays: [14, 7, 2], remindEnabled: true, remindRecipientIds: [], milestones: [], results: [] },
]

export const CATEGORY_COLOR: Record<ContestCategory, string> = {
  算法: '#38bdf8',
  安全: '#f87171',
  开发: '#34d399',
  AI: '#c084fc',
  建模: '#fbbf24',
}

export const TODAY = new Date('2026-08-19T00:00:00')

export function contestStatus(c: Contest, now: Date = TODAY): '已结束' | '进行中' | '未开始' {
  const s = new Date(c.start + 'T00:00:00')
  const e = new Date(c.end + 'T23:59:59')
  if (now > e) return '已结束'
  if (now >= s) return '进行中'
  return '未开始'
}

export function daysUntil(iso: string, now: Date = TODAY): number {
  const d = new Date(iso + 'T00:00:00').getTime()
  return Math.ceil((d - now.getTime()) / 86400000)
}

export function durationDays(c: Contest): number {
  return Math.round((new Date(c.end).getTime() - new Date(c.start).getTime()) / 86400000) + 1
}

export function memberById(id: string): Member {
  return MEMBERS.find((m) => m.id === id)!
}
