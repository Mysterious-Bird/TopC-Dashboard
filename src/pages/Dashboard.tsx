import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TODAY, contestStatus, daysUntil, durationDays } from '../data/mock'
import type { Contest } from '../data/mock'
import { useData } from '../data/DataContext'
import { CategoryTag, Eyebrow, Panel, ParticipantChips, StatusPill } from '../components/ui'
import { CountUp, DecryptedText, LiveCountdown, Meteors, Spotlight } from '../components/fx'

export default function Dashboard() {
  const { members, contests } = useData()
  const ongoing = contests.filter((c) => contestStatus(c) === '进行中')
  const upcoming = contests.filter((c) => contestStatus(c) === '未开始').sort(
    (a, b) => daysUntil(a.start) - daysUntil(b.start),
  )
  const doneCount = contests.filter((c) => contestStatus(c) === '已结束').length

  // 即将触发邮件提醒的比赛（任一提醒节点在未来 7 天内，或距开赛 ≤7 天）
  const reminders = upcoming
    .filter((c) => daysUntil(c.start) <= 14)
    .map((c) => {
      const d = daysUntil(c.start)
      const hit = c.reminderDays.filter((r) => d <= r).sort((a, b) => a - b)[0]
      return { c, d, nextReminder: hit }
    })

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      {/* hero strip */}
      <div className="panel grid-tex rise-in relative overflow-hidden p-6">
        <Meteors count={10} />
        <div
          className="float-y pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.5), transparent 70%)' }}
        />
        <Eyebrow>Dashboard</Eyebrow>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">
              <DecryptedText text="下午好，TopC 控制台" />
            </h1>
            <p className="mt-1 text-[15px] text-ink-2">
              当前 <span className="text-jade">{ongoing.length} 场比赛进行中</span>
              {upcoming[0] && (
                <>
                  ，距 <span className="text-ink">{upcoming[0].short}</span> 开赛还有{' '}
                  <LiveCountdown to={new Date(upcoming[0].start + 'T09:00:00')} className="text-neon" />
                </>
              )}
              。
            </p>
          </div>
          <HeroSide contests={contests} />
        </div>
      </div>

      {/* stats */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="社团成员" value={members.length} unit="人" accent="#22d3ee" foot="本学期新增 8 人" />
        <Stat label="进行中比赛" value={ongoing.length} unit="场" accent="#34d399" foot="信安作品赛 / Kaggle 等" />
        <Stat label="待开赛" value={upcoming.length} unit="场" accent="#a78bfa" foot={`最近：${upcoming[0]?.short ?? '-'}`} />
        <Stat
          label="已完赛"
          value={doneCount}
          unit="场"
          accent="#fbbf24"
          foot={(() => {
            const n = contests.reduce((acc, c) => acc + c.results.length, 0)
            return n > 0 ? `累计获奖 ${n} 项` : '暂无获奖记录'
          })()}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* ongoing contests */}
        <Panel className="rise-in rise-in-2 p-5 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <Eyebrow>Live</Eyebrow>
              <h2 className="font-display text-[16px] font-semibold">正在进行的比赛</h2>
            </div>
            <Link to="/contests" className="text-xs text-ink-3 transition hover:text-neon">
              全部比赛 →
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {ongoing.map((c) => {
              const total = durationDays(c)
              const passed = Math.min(total, Math.max(0, daysUntil(c.end) * -1) + 1)
              const pct = Math.round((passed / total) * 100)
              const left = daysUntil(c.end)
              return (
                <div key={c.id} className="panel panel-hover grid-tex p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-8 w-1 rounded-full" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium">{c.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-[12px] text-ink-3">
                          <CategoryTag name={c.category} color={c.color} />
                          <span className="font-mono">
                            {c.start} → {c.end}
                          </span>
                          <span>· {total} 天</span>
                        </div>
                      </div>
                    </div>
                    <StatusPill c={c} />
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 overflow-hidden rounded-full bg-edge">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c.color}88, ${c.color})` }}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[12px] text-ink-3">
                      <span>已进行 {pct}%</span>
                      <span className={left <= 3 ? 'text-amber' : ''}>
                        {left > 0 ? `剩余 ${left} 天` : '今日截止'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    {c.isTeam ? (
                      <div className="flex min-w-0 flex-col gap-1.5">
                        {c.teams.map((t) => (
                          <div key={t.id} className="flex items-center gap-2">
                            <span
                              className="w-16 shrink-0 truncate rounded px-1.5 py-0.5 text-center text-[10px]"
                              style={{ color: c.color, background: `color-mix(in srgb, ${c.color} 12%, transparent)` }}
                              title={t.name}
                            >
                              {t.name || '未命名'}
                            </span>
                            <ParticipantChips ids={t.memberIds} size={18} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ParticipantChips ids={c.participantIds} size={20} />
                    )}
                    <span className="shrink-0 text-[12px] text-ink-3">
                      {c.isTeam ? `${c.teams.length} 队 · ${c.participantIds.length} 人` : `${c.participantIds.length} 人参赛`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        {/* right column: reminders + busy members */}
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Panel className="rise-in rise-in-3 p-5">
            <Eyebrow>Reminders</Eyebrow>
            <h2 className="font-display text-[16px] font-semibold">邮件提醒队列</h2>
            <div className="mt-4 flex flex-col gap-2.5">
              {reminders.map(({ c, d, nextReminder }) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-edge bg-panel-2/50 px-3 py-2.5">
                  <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md border border-amber/30 bg-amber/10 font-mono">
                    <span className="text-[15px] font-semibold leading-none text-amber">{d}</span>
                    <span className="mt-0.5 text-[8.5px] text-amber/70">天后</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{c.short}</div>
                    <div className="mt-0.5 text-[12px] text-ink-3">
                      开赛前 {nextReminder ?? c.reminderDays[c.reminderDays.length - 1]} 天节点 → 邮件{' '}
                      {c.participantIds.length} 名参赛成员
                    </div>
                  </div>
                  <span className="tag-chip shrink-0 rounded border border-amber/30 bg-amber/10 px-1.5 py-0.5 text-amber">
                    AUTO
                  </span>
                </div>
              ))}
              {reminders.length === 0 && <div className="text-[15px] text-ink-3">暂无待发送的提醒。</div>}
            </div>
          </Panel>

          <Panel className="rise-in rise-in-4 p-5">
            <Eyebrow>On Duty</Eyebrow>
            <h2 className="font-display text-[16px] font-semibold">正在参赛的成员</h2>
            <div className="mt-4 flex flex-col gap-3.5">
              {ongoing.map((c) => (
                <div key={c.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="glow-dot h-1.5 w-1.5 rounded-full" style={{ background: c.color, color: c.color }} />
                    <span className="text-[14px] font-medium" style={{ color: c.color }}>{c.short}</span>
                    <span className="text-[11.5px] text-ink-3">
                      {c.isTeam ? `${c.teams.length} 队` : '个人赛'} · 剩余 {daysUntil(c.end)} 天
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {c.isTeam ? (
                      c.teams.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-panel-2/60">
                          <span className="w-16 shrink-0 truncate rounded bg-panel-2 px-1.5 py-0.5 text-center text-[10px] text-ink-2" title={t.name}>
                            {t.name || '未命名'}
                          </span>
                          <ParticipantChips ids={t.memberIds} size={22} />
                        </div>
                      ))
                    ) : (
                      <div className="px-2 py-1.5">
                        <ParticipantChips ids={c.participantIds} size={22} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {ongoing.length === 0 && <div className="text-[14px] text-ink-3">当前没有进行中的比赛。</div>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function HeroSide({ contests }: { contests: Contest[] }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const pad = (n: number) => String(n).padStart(2, '0')
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  const latest = contests
    .flatMap((c) => c.results.map((r) => ({ c, r })))
    .sort((a, b) => b.c.end.localeCompare(a.c.end))[0]

  return (
    <div className="shrink-0 rounded-xl border border-edge bg-panel-2/40 px-5 py-4 text-right backdrop-blur-sm">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-ink-3">Local Time</div>
      <div
        className="mt-1 font-mono text-[32px] font-semibold leading-none tabular-nums text-neon"
        style={{ textShadow: '0 0 18px rgba(34,211,238,.35)' }}
      >
        {pad(now.getHours())}
        <span className="animate-pulse">:</span>
        {pad(now.getMinutes())}
        <span className="animate-pulse">:</span>
        {pad(now.getSeconds())}
      </div>
      <div className="mt-1.5 font-mono text-[12px] text-ink-2">
        {now.getFullYear()}-{pad(now.getMonth() + 1)}-{pad(now.getDate())} · {week}
      </div>
      {latest && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-edge/60 pt-3">
          <span className="glow-dot h-1.5 w-1.5 shrink-0 rounded-full bg-amber text-amber" />
          <span
            className="max-w-[260px] truncate text-[12px] text-ink-2"
            title={`${latest.c.short} · ${latest.r.award}`}
          >
            最新荣誉 <span className="font-medium text-amber">{latest.r.award}</span> · {latest.c.short}
          </span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, unit, accent, foot }: { label: string; value: number; unit: string; accent: string; foot: string }) {
  return (
    <Panel className="panel-hover rise-in p-0">
      <Spotlight color={`color-mix(in srgb, ${accent} 12%, transparent)`} className="h-full p-4">
        <div className="flex items-center gap-2 text-[14px] text-ink-2">
          <span className="glow-dot h-1.5 w-1.5 rounded-full" style={{ background: accent, color: accent }} />
          {label}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-display text-[30px] font-semibold leading-none tracking-tight" style={{ color: accent }}>
            <CountUp to={value} />
          </span>
          <span className="text-xs text-ink-3">{unit}</span>
        </div>
        <div className="mt-2 truncate text-[12px] text-ink-3">{foot}</div>
      </Spotlight>
    </Panel>
  )
}
