import type { ReactNode } from 'react'
import type { Contest } from '../data/mock'
import { contestStatus } from '../data/mock'
import { useData } from '../data/DataContext'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="tag-chip mb-1.5 flex items-center gap-2 uppercase text-ink-3">
      <span className="inline-block h-px w-5 bg-edge-2" />
      {children}
    </div>
  )
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <Eyebrow>TopC / Console</Eyebrow>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      {sub && <p className="mt-1 text-[15px] text-ink-2">{sub}</p>}
    </div>
  )
}

const STATUS_STYLE: Record<string, { fg: string; bg: string; label: string }> = {
  进行中: { fg: '#34d399', bg: 'rgba(52,211,153,0.12)', label: '进行中' },
  未开始: { fg: '#22d3ee', bg: 'rgba(34,211,238,0.12)', label: '未开始' },
  已结束: { fg: '#5b6b84', bg: 'rgba(91,107,132,0.15)', label: '已结束' },
}

export function StatusPill({ c }: { c: Contest }) {
  const st = contestStatus(c)
  const s = STATUS_STYLE[st]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color: s.fg, background: s.bg, border: `1px solid ${s.fg}33` }}
    >
      <span className="glow-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.fg, color: s.fg }} />
      {s.label}
    </span>
  )
}

export function CategoryTag({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="tag-chip rounded px-1.5 py-0.5"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}
    >
      {name}
    </span>
  )
}

/* 职位徽章：颜色取自动态职位表 */
export function RoleBadge({ role }: { role: string }) {
  const { roles } = useData()
  const color = roles.find((r) => r.name === role)?.color ?? '#93c5fd'
  return (
    <span
      className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-medium"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      {role}
    </span>
  )
}

export function RoleBadges({ roles: names, className = '' }: { roles: string[]; className?: string }) {
  const { roles } = useData()
  const sorted = [...names].sort(
    (a, b) => (roles.find((r) => r.name === a)?.sort ?? 99) - (roles.find((r) => r.name === b)?.sort ?? 99),
  )
  return (
    <span className={`flex flex-wrap items-center gap-1 ${className}`}>
      {sorted.map((r) => (
        <RoleBadge key={r} role={r} />
      ))}
    </span>
  )
}

/* 参赛者胶囊：成员色点+名字并排，互不重叠 */
export function ParticipantChips({ ids }: { ids: string[]; size?: number }) {
  const { memberById } = useData()
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const m = memberById(id)
        return (
          <span
            key={id}
            className="flex items-center gap-1.5 rounded-full border border-edge bg-panel-2/70 px-2 py-0.5"
            title={`${m.name} · ${m.roles.join(' / ') || '无职位'}`}
          >
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }}
            />
            <span className="text-[14px] leading-none">{m.name}</span>
          </span>
        )
      })}
    </div>
  )
}
