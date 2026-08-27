import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CATEGORY_COLOR,
  TODAY,
  contestStatus,
  daysUntil,
  durationDays,
  type Contest,
} from '../data/mock'
import { toDateIso } from '../data/date'
import { useData } from '../data/DataContext'
import { CategoryTag, PageTitle, Panel, ParticipantChips, StatusPill } from '../components/ui'
import ContestForm from '../components/ContestForm'
import { deleteContest } from '../api'

type View = 'gantt' | 'calendar'

/* 时间轴固定像素宽度：默认每天 13px，可缩放，拖动横向滚动查看 */
const DEFAULT_PX_PER_DAY = 13
const MIN_PX = 6
const MAX_PX = 30
const LABEL_W_DESKTOP = 260
const LABEL_W_MOBILE = 112
const PAD_MONTHS = 1

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const parseIso = (iso: string) => new Date(iso + 'T00:00:00')

function useLabelWidth() {
  const [w, setW] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? LABEL_W_MOBILE
      : LABEL_W_DESKTOP,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setW(mq.matches ? LABEL_W_MOBILE : LABEL_W_DESKTOP)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return w
}

function computeTimelineRange(contests: Contest[]) {
  const dates: Date[] = [TODAY]
  for (const c of contests) {
    dates.push(parseIso(c.start))
    dates.push(parseIso(c.end))
  }
  if (contests.length === 0) {
    const s = startOfMonth(new Date(TODAY.getFullYear(), TODAY.getMonth() - 2, 1))
    const e = endOfMonth(new Date(TODAY.getFullYear(), TODAY.getMonth() + 4, 1))
    return { rangeStart: s, rangeEnd: e, totalDays: Math.round((e.getTime() - s.getTime()) / 86400000) + 1 }
  }
  const min = new Date(Math.min(...dates.map((d) => d.getTime())))
  const max = new Date(Math.max(...dates.map((d) => d.getTime())))
  const rangeStart = startOfMonth(new Date(min.getFullYear(), min.getMonth() - PAD_MONTHS, 1))
  const rangeEnd = endOfMonth(new Date(max.getFullYear(), max.getMonth() + PAD_MONTHS, 1))
  return { rangeStart, rangeEnd, totalDays: Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1 }
}

export default function Contests() {
  const { contests, refresh, authed } = useData()
  const [view, setView] = useState<View>('gantt')
  const [hover, setHover] = useState<Contest | null>(null)
  const [selected, setSelected] = useState<Contest | null>(null)
  const [editing, setEditing] = useState<Contest | null | 'new'>(null)
  const LABEL_W = useLabelWidth()
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => computeTimelineRange(contests), [contests])

  const dayIndex = (iso: string) =>
    Math.round((parseIso(iso).getTime() - rangeStart.getTime()) / 86400000)

  const remove = async (c: Contest) => {
    if (!window.confirm(`确定删除比赛「${c.name}」吗？`)) return
    await deleteContest(c.id)
    setSelected(null)
    refresh()
  }

  const sorted = useMemo(() => [...contests].sort((a, b) => a.start.localeCompare(b.start)), [contests])
  const todayIdx = dayIndex(toDateIso(TODAY))

  /* 时间轴拖动滚动 + 缩放 */
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ down: false, startX: 0, startScroll: 0, moved: false })
  const [pxPerDay, setPxPerDay] = useState(DEFAULT_PX_PER_DAY)
  const pendingCenter = useRef<number | null>(null)
  const chartW = totalDays * pxPerDay

  const zoom = (dir: 1 | -1) => {
    const el = scrollRef.current
    const next = Math.min(MAX_PX, Math.max(MIN_PX, Math.round(pxPerDay * (dir > 0 ? 1.3 : 1 / 1.3))))
    if (next === pxPerDay) return
    if (el) pendingCenter.current = (el.scrollLeft + el.clientWidth / 2 - LABEL_W) / pxPerDay
    setPxPerDay(next)
  }

  const onDragStart = (e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el || e.button !== 0) return
    dragState.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false }
  }
  const onDragMove = (e: React.MouseEvent) => {
    const st = dragState.current
    const el = scrollRef.current
    if (!st.down || !el) return
    const dx = e.clientX - st.startX
    if (Math.abs(dx) > 4) st.moved = true
    el.scrollLeft = st.startScroll - dx
  }
  const onDragEnd = () => {
    dragState.current.down = false
  }

  /* 默认滚动到「今天」居中；比赛数据到位后范围变化时再对齐一次 */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, LABEL_W + (todayIdx + 0.5) * pxPerDay - el.clientWidth / 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDays])

  /* 缩放后保持可视中心对应的日期不变 */
  useEffect(() => {
    const el = scrollRef.current
    if (!el || pendingCenter.current == null) return
    el.scrollLeft = Math.max(0, LABEL_W + pendingCenter.current * pxPerDay - el.clientWidth / 2)
    pendingCenter.current = null
  }, [pxPerDay])

  const months = useMemo(() => {
    const list: { label: string; days: number }[] = []
    const cur = new Date(rangeStart)
    while (cur <= rangeEnd) {
      const y = cur.getFullYear()
      const m = cur.getMonth()
      const days = new Date(y, m + 1, 0).getDate() - cur.getDate() + 1
      list.push({ label: `${y}-${String(m + 1).padStart(2, '0')}`, days })
      cur.setMonth(m + 1, 1)
    }
    return list
  }, [rangeStart, rangeEnd])

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="比赛安排" sub="甘特图查看时间跨度与冲突 · 日历查看月度分布" />
        <div className="flex items-center gap-3">
          {authed && (
            <button
              onClick={() => setEditing('new')}
              className="rounded-lg bg-neon/15 px-4 py-2 text-[14px] font-medium text-neon ring-1 ring-inset ring-neon/40 transition hover:bg-neon/25"
            >
              + 添加比赛
            </button>
          )}
          <div className="flex rounded-lg border border-edge bg-panel p-1">
            {(['gantt', 'calendar'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-4 py-1.5 text-[13.5px] font-medium transition ${
                  view === v ? 'bg-neon/15 text-neon ring-1 ring-inset ring-neon/40' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {v === 'gantt' ? '甘特图' : '日历'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'gantt' ? (
        <Panel className="rise-in relative mt-5 overflow-hidden">
          {/* 缩放控件 */}
          <div className="absolute right-3 top-2.5 z-40 flex items-center gap-1 rounded-lg border border-edge bg-panel-2/90 px-1.5 py-1 backdrop-blur-sm">
            <button
              onClick={() => zoom(-1)}
              disabled={pxPerDay <= MIN_PX}
              title="缩小时间轴"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[15px] leading-none text-ink-2 transition hover:bg-edge/60 hover:text-ink disabled:opacity-30"
            >
              −
            </button>
            <span className="w-11 text-center font-mono text-[11px] tabular-nums text-ink-2">
              {Math.round((pxPerDay / DEFAULT_PX_PER_DAY) * 100)}%
            </span>
            <button
              onClick={() => zoom(1)}
              disabled={pxPerDay >= MAX_PX}
              title="放大时间轴"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[15px] leading-none text-ink-2 transition hover:bg-edge/60 hover:text-ink disabled:opacity-30"
            >
              +
            </button>
          </div>
          <div
            ref={scrollRef}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            className="gantt-scroll cursor-grab select-none overflow-x-auto active:cursor-grabbing"
          >
            <div style={{ width: LABEL_W + chartW }}>
              {/* month header */}
              <div className="flex border-b border-edge">
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-center justify-between gap-1 border-r border-edge bg-panel px-2 py-3 text-[11px] uppercase tracking-wider text-ink-3 sm:gap-2 sm:px-5 sm:text-[12px]"
                  style={{ width: LABEL_W }}
                >
                  <span className="truncate">比赛</span>
                  <span className="hidden font-mono normal-case tracking-normal text-ink-3/70 sm:inline">⇠ 拖动 ⇢</span>
                </div>
                <div className="flex">
                  {months.map((mo) => (
                    <div
                      key={mo.label}
                      className="shrink-0 border-r border-edge/60 px-2 py-3 font-mono text-[12px] text-ink-3"
                      style={{ width: mo.days * pxPerDay }}
                    >
                      {mo.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* rows */}
              <div className="relative">
                {/* vertical month grid lines */}
                <div
                  className="pointer-events-none absolute bottom-0 top-0 flex"
                  style={{ left: LABEL_W, width: chartW }}
                >
                  {months.map((mo) => (
                    <div
                      key={mo.label}
                      className="h-full shrink-0 border-r border-edge/40"
                      style={{ width: mo.days * pxPerDay }}
                    />
                  ))}
                </div>

                {/* today line */}
                <div
                  className="today-line pointer-events-none absolute bottom-0 top-0 z-10 w-px"
                  style={{
                    left: LABEL_W + (todayIdx + 0.5) * pxPerDay,
                    background: 'linear-gradient(180deg, transparent, #22d3ee 15%, #22d3ee 85%, transparent)',
                    boxShadow: '0 0 10px rgba(34,211,238,0.8)',
                  }}
                >
                  <span className="absolute -left-[26px] top-1.5 rounded bg-neon/90 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-abyss">
                    TODAY
                  </span>
                </div>

                {sorted.map((c) => {
                  const s = dayIndex(c.start)
                  const e = dayIndex(c.end)
                  const st = contestStatus(c)
                  const isSel = selected?.id === c.id
                  return (
                    <div key={c.id}>
                      <div
                        onClick={() => {
                          if (dragState.current.moved) return
                          setSelected(isSel ? null : c)
                        }}
                        onMouseEnter={() => setHover(c)}
                        onMouseLeave={() => setHover(null)}
                        className={`relative flex cursor-pointer items-center border-b border-edge/60 transition last:border-0 ${
                          isSel ? 'bg-panel-2/70' : 'hover:bg-panel-2/40'
                        }`}
                      >
                        <div
                          className="sticky left-0 z-20 flex shrink-0 items-center gap-2 self-stretch border-r border-edge bg-panel px-2 py-3 sm:gap-3 sm:px-5 sm:py-3.5"
                          style={{ width: LABEL_W }}
                        >
                          <span className="h-7 w-1 shrink-0 rounded-full" style={{ background: c.color }} />
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium sm:text-[14px]">{c.short}</div>
                            <div className="mt-0.5 hidden text-[12px] text-ink-3 sm:block">
                              {c.level} · {c.isTeam ? `${c.teams.length} 队·每队 ${c.teamSize} 人` : '个人赛'}
                            </div>
                          </div>
                        </div>
                        <div className="relative h-[52px] shrink-0" style={{ width: chartW }}>
                          {/* bar：最短 30px 保证 “1d” 这类短标签完整落在条内 */}
                          {(() => {
                            const days = Math.max(1, e - s + 1)
                            return (
                              <div
                                className={`absolute top-1/2 flex h-[26px] -translate-y-1/2 items-center justify-center overflow-hidden rounded-md ${
                                  st === '进行中' ? 'bar-shimmer' : ''
                                }`}
                                style={{
                                  left: s * pxPerDay,
                                  width: days * pxPerDay,
                                  minWidth: 30,
                                  background:
                                    st === '已结束'
                                      ? `color-mix(in srgb, ${c.color} 22%, transparent)`
                                      : `linear-gradient(90deg, ${c.color}55, ${c.color}99)`,
                                  border: `1px solid ${c.color}${st === '已结束' ? '44' : 'aa'}`,
                                  boxShadow: st === '进行中' ? `0 0 16px -2px ${c.color}` : 'none',
                                  opacity: st === '已结束' ? 0.55 : 1,
                                }}
                              >
                                <span className="whitespace-nowrap font-mono text-[10px] font-medium text-ink">
                                  {days}d
                                </span>
                              </div>
                            )
                          })()}
                          {/* register deadline tick */}
                          <div
                            className="absolute top-1/2 h-[14px] w-px -translate-y-1/2 bg-amber/70"
                            style={{ left: (dayIndex(c.registerBy) + 0.5) * pxPerDay }}
                            title={`报名截止 ${c.registerBy}`}
                          />
                        </div>
                      </div>

                      {/* expanded detail */}
                      {isSel && (
                        <div className="grid-tex sticky left-0 flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-edge/60 bg-panel-2/50 px-6 py-4" style={{ width: 'min(100%, 1140px)' }}>
                          <Detail label="时间" mono>
                            {c.start} → {c.end}（{durationDays(c)} 天）
                          </Detail>
                          <Detail label="报名截止" mono>
                            <span className="text-amber">{c.registerBy}</span>
                          </Detail>
                          <Detail label="地点">{c.location}</Detail>
                          <Detail label="状态">
                            <StatusPill c={c} />
                          </Detail>
                          <Detail label="邮件提醒" mono>
                            开赛前 {c.reminderDays.join(' / ')} 天
                          </Detail>
                          <div>
                            <div className="mb-1 text-[12px] text-ink-3">
                              {c.isTeam ? `参赛队伍（${c.teams.length} 队 · ${c.participantIds.length} 人）` : `参赛成员（${c.participantIds.length}）`}
                            </div>
                            {c.isTeam ? (
                              <div className="space-y-1.5">
                                {c.teams.map((t) => (
                                  <div key={t.id} className="flex items-center gap-2">
                                    <span className="w-20 shrink-0 truncate rounded border border-edge bg-panel-2/60 px-1.5 py-0.5 text-center text-[10px] text-ink-2">
                                      {t.name || '未命名'}
                                    </span>
                                    <ParticipantChips ids={t.memberIds} size={20} />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <ParticipantChips ids={c.participantIds} size={22} />
                            )}
                          </div>
                          <Detail label="提醒">
                            {c.remindEnabled
                              ? c.remindRecipientIds.length > 0
                                ? `指定 ${c.remindRecipientIds.length} 人`
                                : '参赛者 + 社长'
                              : <span className="text-ink-3">已关闭</span>}
                          </Detail>
                          {c.milestones.length > 0 && (
                            <div>
                              <div className="mb-1 text-[12px] text-ink-3">事项提醒（{c.milestones.length}）</div>
                              <div className="flex flex-wrap gap-1.5">
                                {c.milestones.map((m) => (
                                  <span
                                    key={m.id}
                                    className="tag-chip rounded border border-violet/30 bg-violet/5 px-2 py-0.5 text-violet"
                                    title={`${m.date} 当天发送提醒邮件`}
                                  >
                                    {m.date.slice(5)} {m.title}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {c.results.length > 0 && (
                            <div>
                              <div className="mb-1 text-[12px] text-ink-3">成绩（{c.results.length} 项）</div>
                              <div className="space-y-1">
                                {c.results.map((r) => (
                                  <div key={r.id} className="flex items-center gap-2">
                                    <span className="tag-chip rounded border border-amber/40 bg-amber/10 px-2 py-0.5 text-amber">
                                      🏅 {r.award}
                                    </span>
                                    <ParticipantChips ids={r.memberIds} size={18} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="min-w-[220px] flex-1 text-[14px] leading-relaxed text-ink-2">{c.description}</div>
                          {authed && (
                            <div className="ml-auto flex shrink-0 gap-2 self-start">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditing(c)
                                }}
                                className="rounded-lg bg-panel-2 px-3 py-1.5 text-[14px] ring-1 ring-inset ring-edge transition hover:ring-edge-2"
                              >
                                编辑
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  remove(c)
                                }}
                                className="rounded-lg px-3 py-1.5 text-[14px] text-rose ring-1 ring-inset ring-rose/30 transition hover:bg-rose/10"
                              >
                                删除
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Panel>
      ) : (
        <CalendarView contests={contests} onPick={setSelected} />
      )}

      {/* hover / selected summary */}
      <div className="mt-4 grid grid-cols-1 gap-4">
        <Panel className="rise-in rise-in-2 p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="tag-chip text-ink-3">
              {selected ? 'SELECTED' : hover ? 'HOVER PREVIEW' : 'LEGEND'}
            </div>
            {selected && (
              <button
                onClick={() => setSelected(null)}
                className="text-[12px] text-ink-3 transition hover:text-neon"
              >
                取消锁定 ✕
              </button>
            )}
          </div>
          {(selected ?? hover) ? (
            (() => {
              const shown = (selected ?? hover)!
              return (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: shown.color }} />
                    <span className="text-[14px] font-medium">{shown.name}</span>
                    <StatusPill c={shown} />
                  </div>
                  <div className="mt-2 font-mono text-[14px] text-ink-2">
                    {shown.start} → {shown.end} · {durationDays(shown)} 天
                    {contestStatus(shown) === '未开始' && (
                      <span className="text-neon"> · {daysUntil(shown.start)} 天后开赛</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[14px] text-ink-3">{shown.description}</div>
                </div>
              )
            })()
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              {Object.entries(CATEGORY_COLOR).map(([k, v]) => (
                <CategoryTag key={k} name={k} color={v} />
              ))}
              <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <span className="inline-block h-[14px] w-px bg-amber/70" /> 报名截止
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <span className="today-line inline-block h-[14px] w-px bg-neon" /> 今天
              </span>
            </div>
          )}
        </Panel>
      </div>

      {editing && (
        <ContestForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  )
}

function Detail({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[12px] text-ink-3">{label}</div>
      <div className={`text-[13.5px] ${mono ? 'font-mono' : ''}`}>{children}</div>
    </div>
  )
}

/* ---------------- Calendar view ---------------- */

function CalendarView({ contests, onPick }: { contests: Contest[]; onPick: (c: Contest) => void }) {
  const [cursor, setCursor] = useState(() => {
    const t = TODAY
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const y = cursor.getFullYear()
  const m = cursor.getMonth()
  const first = new Date(y, m, 1)
  const startOffset = (first.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const weeks: (Date | null)[][] = []
  let cur: (Date | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cur.push(new Date(y, m, d))
    if (cur.length === 7) {
      weeks.push(cur)
      cur = []
    }
  }
  if (cur.length) {
    while (cur.length < 7) cur.push(null)
    weeks.push(cur)
  }

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayIso = iso(TODAY)

  return (
    <Panel className="mt-5 overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between border-b border-edge px-5 py-3">
        <div className="font-display text-[15px] font-semibold">
          {y} 年 {m + 1} 月
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setCursor(new Date(y, m - 1, 1))}
            className="rounded-md border border-edge px-2.5 py-1 text-ink-2 transition hover:bg-panel-2 hover:text-ink"
          >
            ←
          </button>
          <button
            onClick={() => setCursor(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))}
            className="rounded-md border border-edge px-2.5 py-1 text-[14px] text-ink-2 transition hover:bg-panel-2 hover:text-ink"
          >
            今天
          </button>
          <button
            onClick={() => setCursor(new Date(y, m + 1, 1))}
            className="rounded-md border border-edge px-2.5 py-1 text-ink-2 transition hover:bg-panel-2 hover:text-ink"
          >
            →
          </button>
        </div>
      </div>

      {/* weekday header */}
      <div className="grid grid-cols-7 border-b border-edge">
        {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[12px] text-ink-3">
            {d}
          </div>
        ))}
      </div>

      {/* weeks */}
      {weeks.map((week, wi) => {
        // compute spanning bars for contests overlapping this week
        const weekStart = week.find(Boolean) as Date
        const weekEndDate = [...week].reverse().find(Boolean) as Date
        const ws = iso(weekStart)
        const we = iso(weekEndDate)
        const overlapping = contests.filter((c) => c.start <= we && c.end >= ws)
        const lanes: { c: Contest; col: number; span: number; lane: number; startHere: boolean; endHere: boolean }[] = []
        const laneEnds: number[] = []
        overlapping
          .sort((a, b) => a.start.localeCompare(b.start))
          .forEach((c) => {
            const colStart = c.start < ws ? 0 : week.findIndex((d) => d && iso(d) === c.start)
            const colEnd = c.end > we ? 6 : week.findIndex((d) => d && iso(d) === c.end)
            let lane = laneEnds.findIndex((end) => end < colStart)
            if (lane === -1) {
              lane = laneEnds.length
              laneEnds.push(colEnd)
            } else {
              laneEnds[lane] = colEnd
            }
            if (lane < 3) {
              lanes.push({ c, col: colStart, span: colEnd - colStart + 1, lane, startHere: c.start >= ws, endHere: c.end <= we })
            }
          })
        const overflow = laneEnds.length - 3

        return (
          <div key={wi} className="relative grid grid-cols-7 border-b border-edge/60 last:border-0">
            {week.map((d, di) => {
              const dIso = d ? iso(d) : ''
              const isToday = dIso === todayIso
              const isRegDeadline = d && contests.some((c) => c.registerBy === dIso)
              return (
                <div
                  key={di}
                  className={`min-h-[86px] border-r border-edge/40 p-1.5 last:border-0 ${d ? '' : 'bg-panel-2/30'} ${
                    isToday ? 'bg-neon/5' : ''
                  }`}
                >
                  {d && (
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full font-mono text-[12px] ${
                          isToday ? 'bg-neon font-semibold text-abyss' : 'text-ink-2'
                        }`}
                      >
                        {d.getDate()}
                      </span>
                      {isRegDeadline && <span className="h-1.5 w-1.5 rounded-full bg-amber" title="报名截止日" />}
                    </div>
                  )}
                </div>
              )
            })}
            {/* bars overlay */}
            <div className="pointer-events-none absolute inset-x-0 top-[30px]">
              {lanes.map((l) => (
                <div
                  key={l.c.id + l.lane}
                  className="pointer-events-auto absolute flex h-[18px] cursor-pointer items-center overflow-hidden px-1.5 transition hover:brightness-125"
                  style={{
                    left: `calc(${(l.col / 7) * 100}% + 2px)`,
                    width: `calc(${(l.span / 7) * 100}% - 4px)`,
                    top: l.lane * 20,
                    background: `color-mix(in srgb, ${l.c.color} 22%, transparent)`,
                    borderLeft: `2px solid ${l.c.color}`,
                    borderRadius: l.startHere ? '4px' : '2px',
                  }}
                  onClick={() => onPick(l.c)}
                  title={l.c.name}
                >
                  <span className="truncate font-mono text-[10px]" style={{ color: l.c.color }}>
                    {l.c.short}
                  </span>
                </div>
              ))}
              {overflow > 0 && (
                <div className="absolute left-1 text-[10px] text-ink-3" style={{ top: 3 * 20 }}>
                  +{overflow} 更多
                </div>
              )}
            </div>
          </div>
        )
      })}
    </Panel>
  )
}
