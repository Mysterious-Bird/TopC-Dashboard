import { useMemo, useState } from 'react'
import { contestStatus, durationDays } from '../data/mock'
import { QUOTES } from '../data/awards'
import { useData } from '../data/DataContext'
import { CategoryTag, PageTitle, Panel, RoleBadges, StatusPill } from '../components/ui'
import { ProgressRing, Spotlight } from '../components/fx'

type Mode = 'byContest' | 'byMember'

export default function Teams() {
  const { members, contests: allContests, memberById } = useData()
  const [mode, setMode] = useState<Mode>('byContest')
  const [onlyActive, setOnlyActive] = useState(true)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

  const contests = useMemo(
    () =>
      allContests.filter((c) => !onlyActive || contestStatus(c) !== '已结束').sort((a, b) => a.start.localeCompare(b.start)),
    [allContests, onlyActive],
  )

  const memberLoad = useMemo(() => {
    const map = new Map<string, string[]>()
    allContests.forEach((c) => {
      if (contestStatus(c) === '已结束') return
      c.participantIds.forEach((id) => {
        map.set(id, [...(map.get(id) ?? []), c.id])
      })
    })
    return map
  }, [allContests])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="参赛视图" sub={quote} />
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-ink-2">
            <button
              onClick={() => setOnlyActive(!onlyActive)}
              className={`relative h-5 w-9 rounded-full transition ${onlyActive ? 'bg-neon/40' : 'bg-edge'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-all ${onlyActive ? 'left-[18px]' : 'left-0.5'}`}
              />
            </button>
            隐藏已结束
          </label>
          <div className="flex rounded-lg border border-edge bg-panel p-1">
            {(
              [
                ['byContest', '按比赛'],
                ['byMember', '按成员'],
              ] as [Mode, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={`rounded-md px-4 py-1.5 text-[13.5px] font-medium transition ${
                  mode === v ? 'bg-neon/15 text-neon ring-1 ring-inset ring-neon/40' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'byContest' ? (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {contests.map((c) => {
            const st = contestStatus(c)
            return (
              <Panel key={c.id} className={`panel-hover rise-in p-0 ${st === '已结束' ? 'opacity-60' : ''}`}>
                <Spotlight className="p-5" color={`color-mix(in srgb, ${c.color} 10%, transparent)`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-9 w-1 rounded-full" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}66` }} />
                    <div>
                      <div className="text-[14.5px] font-medium leading-snug">{c.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <CategoryTag name={c.category} color={c.color} />
                        <span className="font-mono text-[12px] text-ink-3">
                          {c.start} → {c.end} · {durationDays(c)}d
                        </span>
                      </div>
                    </div>
                  </div>
                  <StatusPill c={c} />
                </div>

                {c.isTeam ? (
                  <div className="mt-4 space-y-2.5">
                    {c.teams.map((t) => {
                      const lack = c.teamSize - t.memberIds.length
                      return (
                        <div key={t.id} className="rounded-xl border border-edge/60 bg-panel-2/40 p-2.5">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="tag-chip rounded px-1.5 py-0.5" style={{ color: c.color, background: `color-mix(in srgb, ${c.color} 12%, transparent)` }}>
                              {t.name || '未命名队伍'}
                            </span>
                            <span className="font-mono text-[11.5px] text-ink-3">{t.memberIds.length}/{c.teamSize}</span>
                            {lack > 0 && <span className="text-[11.5px] text-amber">缺 {lack} 人</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {t.memberIds.map((id) => {
                              const m = memberById(id)
                              const load = memberLoad.get(id)?.length ?? 0
                              return (
                                <div
                                  key={id}
                                  className="flex items-center gap-2 rounded-full border border-edge bg-panel-2/60 px-2.5 py-1"
                                  title={`${m.name} · ${m.roles.join(' / ')} · 当前 ${load} 场比赛`}
                                >
                                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
                                  <span className="text-[14px]">{m.name}</span>
                                  {load > 1 && <span className="tag-chip rounded-full bg-amber/10 px-1 text-amber">×{load}</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {c.participantIds.map((id) => {
                      const m = memberById(id)
                      const load = memberLoad.get(id)?.length ?? 0
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2 rounded-full border border-edge bg-panel-2/60 px-2.5 py-1"
                          title={`${m.name} · ${m.roles.join(' / ')} · 当前 ${load} 场比赛`}
                        >
                          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
                          <span className="text-[14px]">{m.name}</span>
                          {load > 1 && (
                            <span className="tag-chip rounded-full bg-amber/10 px-1 text-amber">×{load}</span>
                          )}
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-2 rounded-full border border-dashed border-edge px-3 py-1 text-[12px] text-ink-3">
                      个人赛
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-[12px] text-ink-3">
                  <span className="flex items-center gap-2">
                    {c.isTeam ? (
                      <ProgressRing
                        value={c.teams.filter((t) => t.memberIds.length >= c.teamSize).length}
                        max={Math.max(1, c.teams.length)}
                        size={30}
                        stroke={3}
                        color={c.color}
                      >
                        <span className="font-mono text-[9px] font-semibold" style={{ color: c.color }}>
                          {c.teams.filter((t) => t.memberIds.length >= c.teamSize).length}/{c.teams.length}
                        </span>
                      </ProgressRing>
                    ) : (
                      <ProgressRing value={c.participantIds.length} max={Math.max(1, c.participantIds.length)} size={30} stroke={3} color={c.color}>
                        <span className="font-mono text-[9px] font-semibold" style={{ color: c.color }}>
                          {c.participantIds.length}
                        </span>
                      </ProgressRing>
                    )}
                    <span>{c.isTeam ? '队伍满编度' : '参赛人数'} · {c.location}</span>
                  </span>
                  <span className="font-mono">{c.remindEnabled ? `提醒: 赛前 ${c.reminderDays.join('/')} 天` : '提醒: 已关闭'}</span>
                </div>
                </Spotlight>
              </Panel>
            )
          })}
        </div>
      ) : (
        <Panel className="mt-5 overflow-hidden">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-edge text-left text-[12px] uppercase tracking-wider text-ink-3">
                <th className="px-5 py-3 font-medium">成员</th>
                <th className="px-3 py-3 font-medium">职务</th>
                <th className="px-3 py-3 font-medium">在赛数量</th>
                <th className="px-3 py-3 font-medium">当前参加的比赛</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const ids = memberLoad.get(m.id) ?? []
                return (
                  <tr key={m.id} className="border-b border-edge/60 transition last:border-0 hover:bg-panel-2/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
                        <span className="font-medium">{m.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <RoleBadges roles={m.roles} />
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`font-mono text-[14px] font-semibold ${
                          ids.length >= 3 ? 'text-amber' : ids.length > 0 ? 'text-neon' : 'text-ink-3'
                        }`}
                      >
                        {ids.length}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {ids.length === 0 && <span className="text-[14px] text-ink-3">— 空闲 —</span>}
                        {ids.map((cid) => {
                          const c = allContests.find((x) => x.id === cid)!
                          return (
                            <span
                              key={cid}
                              className="tag-chip rounded px-1.5 py-0.5"
                              style={{
                                color: c.color,
                                background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
                                border: `1px solid color-mix(in srgb, ${c.color} 35%, transparent)`,
                              }}
                            >
                              {c.short}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}
