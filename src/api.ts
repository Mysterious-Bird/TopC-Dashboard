import type { Contest, Member, RoleDef } from './data/mock'
import { getToken, notifyUnauthorized } from './auth'

/* 后端返回结构 → 前端结构（snake_case → camelCase，数字 id → string） */

interface ApiMember {
  id: number
  name: string
  gender: '男' | '女'
  phone: string
  qq: string
  email: string
  roles: string[]
  grade: string
  major: string
  student_id: string
  tags: string[]
  joined_at: string | null
  color: string
}

interface ApiRole {
  id: number
  name: string
  sort: number
  color: string
  manages_all: boolean
  excludes: string[]
  manages: string[]
  member_count: number
}

interface ApiContest {
  id: number
  name: string
  short: string
  category: Contest['category']
  level: Contest['level']
  start: string
  end: string
  register_by: string | null
  location: string
  team_size: number
  color: string
  description: string
  reminder_days: number[]
  is_team: boolean
  remind_enabled: boolean
  remind_recipient_ids: number[]
  participant_ids: number[]
  teams: { id: number; name: string; member_ids: number[] }[]
  milestones: { id: number; date: string; title: string }[]
  results: { id: number; award: string; member_ids: number[]; note: string }[]
}

export interface LiveData {
  members: Member[]
  contests: Contest[]
  roles: RoleDef[]
  roleLinks: [string, string][]
}

const mapMember = (m: ApiMember): Member => ({
  id: String(m.id),
  name: m.name,
  gender: m.gender,
  phone: m.phone,
  qq: m.qq,
  email: m.email,
  roles: m.roles,
  grade: m.grade,
  major: m.major,
  studentId: m.student_id,
  tags: m.tags,
  joinedAt: m.joined_at ?? '',
  color: m.color,
})

const mapRole = (r: ApiRole): RoleDef => ({
  id: String(r.id),
  name: r.name,
  sort: r.sort,
  color: r.color,
  managesAll: r.manages_all,
  excludes: r.excludes,
  manages: r.manages,
  memberCount: r.member_count,
})

const mapContest = (c: ApiContest): Contest => ({
  id: String(c.id),
  name: c.name,
  short: c.short,
  category: c.category,
  level: c.level,
  start: c.start,
  end: c.end,
  registerBy: c.register_by ?? c.start,
  location: c.location,
  teamSize: c.team_size,
  participantIds: c.participant_ids.map(String),
  color: c.color,
  description: c.description,
  reminderDays: c.reminder_days,
  isTeam: c.is_team,
  teams: c.teams.map((t) => ({ id: String(t.id), name: t.name, memberIds: t.member_ids.map(String) })),
  remindEnabled: c.remind_enabled,
  remindRecipientIds: c.remind_recipient_ids.map(String),
  milestones: c.milestones.map((m) => ({ id: String(m.id), date: m.date, title: m.title })),
  results: c.results.map((r) => ({ id: String(r.id), award: r.award, memberIds: r.member_ids.map(String), note: r.note })),
})

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return r.json() as Promise<T>
}

/* ---------- mutations ---------- */

const toApiMember = (m: Partial<Member>) => ({
  name: m.name,
  gender: m.gender,
  phone: m.phone ?? '',
  qq: m.qq ?? '',
  email: m.email ?? '',
  roles: m.roles ?? [],
  grade: m.grade ?? '',
  major: m.major ?? '',
  student_id: m.studentId ?? '',
  tags: m.tags ?? [],
  joined_at: m.joinedAt || null,
  color: m.color ?? '#22d3ee',
})

const toApiContest = (c: Partial<Contest>) => ({
  name: c.name,
  short: c.short ?? '',
  category: c.category ?? '算法',
  level: c.level ?? '校级',
  start: c.start,
  end: c.end,
  register_by: c.registerBy || null,
  location: c.location ?? '',
  team_size: c.teamSize ?? 1,
  color: c.color ?? '#38bdf8',
  description: c.description ?? '',
  reminder_days: c.reminderDays ?? [7, 1],
  is_team: c.isTeam ?? false,
  remind_enabled: c.remindEnabled ?? true,
  remind_recipient_ids: (c.remindRecipientIds ?? []).map(Number),
  participant_ids: (c.participantIds ?? []).map(Number),
  teams: (c.teams ?? []).map((t) => ({ name: t.name, member_ids: t.memberIds.map(Number) })),
  milestones: (c.milestones ?? []).map((m) => ({ date: m.date, title: m.title })),
  results: (c.results ?? []).map((r) => ({ award: r.award, member_ids: r.memberIds.map(Number), note: r.note })),
})

async function send(path: string, method: string, body?: unknown): Promise<void> {
  const token = getToken()
  const r = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (r.status === 401) {
    notifyUnauthorized()
    throw new Error('需要管理员登录')
  }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`)
}

export const saveMember = (m: Partial<Member>, id?: string) =>
  send(id ? `/api/members/${id}` : '/api/members', id ? 'PUT' : 'POST', toApiMember(m))

export const deleteMember = (id: string) => send(`/api/members/${id}`, 'DELETE')

export const saveRole = (r: Partial<RoleDef>, id?: string) =>
  send(id ? `/api/roles/${id}` : '/api/roles', id ? 'PUT' : 'POST', {
    name: r.name,
    sort: r.sort ?? 99,
    color: r.color ?? '#93c5fd',
    manages_all: r.managesAll ?? false,
    excludes: r.excludes ?? [],
    manages: r.manages ?? [],
  })

export const deleteRole = (id: string) => send(`/api/roles/${id}`, 'DELETE')

export const saveContest = (c: Partial<Contest>, id?: string) =>
  send(id ? `/api/contests/${id}` : '/api/contests', id ? 'PUT' : 'POST', toApiContest(c))

export const deleteContest = (id: string) => send(`/api/contests/${id}`, 'DELETE')

/* ---------- reminders & email ---------- */

export interface ReminderLogItem {
  id: number
  contest_id: number
  contest_short: string
  days_before: number
  kind: 'race' | 'register' | 'milestone'
  milestone_id: number
  note: string
  skipped: number
  sent_at: string
  recipients: string
  mocked: boolean
}

export const fetchReminderLogs = () => getJson<ReminderLogItem[]>('/api/reminders')

export const runReminderScan = () => send('/api/reminders/run', 'POST')

export const sendMemberEmail = (id: string, subject: string, body: string) =>
  sendJson<{ ok: boolean; mocked: boolean }>(`/api/members/${id}/email`, 'POST', { subject, body })

/* ---------- MCP API Keys ---------- */

export interface ApiKeyItem {
  id: number
  name: string
  prefix: string
  enabled: boolean
  created_at: string
  last_used_at: string | null
}

export const fetchApiKeys = () => authFetch<ApiKeyItem[]>('/api/keys', 'GET')

export const createApiKey = (name: string) =>
  authFetch<ApiKeyItem & { key: string }>('/api/keys', 'POST', { name })

export const updateApiKey = (id: number, patch: { name?: string; enabled?: boolean }) =>
  authFetch<ApiKeyItem>(`/api/keys/${id}`, 'PUT', patch)

export const deleteApiKey = (id: number) => authFetch<void>(`/api/keys/${id}`, 'DELETE')

async function authFetch<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getToken()
  const r = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (r.status === 401) {
    notifyUnauthorized()
    throw new Error('需要管理员登录')
  }
  if (!r.ok) {
    let detail = `${method} ${path} -> ${r.status}`
    try {
      detail = (await r.json()).detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (r.status === 204) return undefined as T
  return r.json() as Promise<T>
}

async function sendJson<T>(path: string, method: string, body: unknown): Promise<T> {
  const token = getToken()
  const r = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (r.status === 401) {
    notifyUnauthorized()
    throw new Error('需要管理员登录')
  }
  if (!r.ok) {
    let detail = `${method} ${path} -> ${r.status}`
    try {
      detail = (await r.json()).detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return r.json() as Promise<T>
}

export async function fetchLiveData(): Promise<LiveData> {
  const [members, contests, roles, graph] = await Promise.all([
    getJson<ApiMember[]>('/api/members'),
    getJson<ApiContest[]>('/api/contests'),
    getJson<ApiRole[]>('/api/roles'),
    getJson<{ links: { source: number; target: number; kind: string }[] }>('/api/graph'),
  ])
  return {
    members: members.map(mapMember),
    contests: contests.map(mapContest),
    roles: roles.map(mapRole),
    roleLinks: graph.links
      .filter((l) => l.kind === 'role')
      .map((l) => [String(l.source), String(l.target)]),
  }
}
