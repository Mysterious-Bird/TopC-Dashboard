import { useCallback, useEffect, useMemo, useState } from 'react'
import { TODAY, contestStatus, type Contest } from '../data/mock'
import { useData } from '../data/DataContext'
import { PageTitle, Panel } from '../components/ui'
import { fetchReminderLogs, runReminderScan, type ReminderLogItem } from '../api'

const fmtDate = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return fmtDate(d)
}

interface ScheduleItem {
  key: string
  date: string // 计划发送日
  contest: Contest
  kind: 'race' | 'register' | 'milestone'
  label: string // 如「赛前 7 天」「报名剩 3 天」
  recipientsDesc: string
  sentLog?: ReminderLogItem
}

export default function Reminders() {
  const { contests, authed } = useData()
  const [logs, setLogs] = useState<ReminderLogItem[]>([])
  const [scanning, setScanning] = useState(false)

  const loadLogs = useCallback(() => {
    fetchReminderLogs()
      .then(setLogs)
      .catch(() => setLogs([]))
  }, [])

  useEffect(loadLogs, [loadLogs])

  const scan = async () => {
    setScanning(true)
    try {
      await runReminderScan()
      loadLogs()
    } catch (err) {
      alert(String(err))
    } finally {
      setScanning(false)
    }
  }

  // 排期预览：赛前节点（窗口规则，发送日 = 开赛日 - N）+ 报名催办（发送日 = 截止日 - 3）
  const schedule = useMemo<ScheduleItem[]>(() => {
    const today = fmtDate(TODAY)
    const out: ScheduleItem[] = []
    for (const c of contests) {
      const st = contestStatus(c)
      if (st === '已结束') continue
      if (c.remindEnabled) {
        const raceDesc =
          c.remindRecipientIds.length > 0
            ? `指定 ${c.remindRecipientIds.length} 人`
            : `参赛者 ${c.participantIds.length} 人 + 社长`
        for (const n of [...c.reminderDays].sort((a, b) => b - a)) {
          const date = addDays(c.start, -n)
          if (date < today) continue
          out.push({
            key: `${c.id}-race-${n}`,
            date,
            contest: c,
            kind: 'race',
            label: `赛前 ${n} 天`,
            recipientsDesc: raceDesc,
            sentLog: logs.find((l) => l.contest_id === Number(c.id) && l.kind === 'race' && l.days_before === n),
          })
        }
        // 固定日期事项：当天发送；已过的显示发送状态
        for (const m of c.milestones) {
          const sentLog = logs.find(
            (l) => l.contest_id === Number(c.id) && l.kind === 'milestone' && l.milestone_id === Number(m.id),
          )
          if (m.date < today && !sentLog) continue
          out.push({
            key: `${c.id}-ms-${m.id}`,
            date: m.date,
            contest: c,
            kind: 'milestone',
            label: m.title,
            recipientsDesc: raceDesc,
            sentLog,
          })
        }
      }
      if (c.registerBy) {
        const date = addDays(c.registerBy, -3)
        if (date >= today || logs.some((l) => l.contest_id === Number(c.id) && l.kind === 'register')) {
          out.push({
            key: `${c.id}-reg`,
            date,
            contest: c,
            kind: 'register',
            label: '报名催办',
            recipientsDesc: '社长 / 副社长',
            sentLog: logs.find((l) => l.contest_id === Number(c.id) && l.kind === 'register'),
          })
        }
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [contests, logs])

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="提醒中心" sub="赛前节点自动邮件 · 固定日期事项提醒" />
        {authed && (
          <button
            onClick={scan}
            disabled={scanning}
            className="rounded-lg bg-neon/15 px-4 py-2 text-[14px] font-medium text-neon ring-1 ring-inset ring-neon/40 transition hover:bg-neon/25 disabled:opacity-50"
          >
            {scanning ? '扫描中…' : '立即扫描并发送'}
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* schedule */}
        <Panel className="rise-in overflow-hidden xl:col-span-3">
          <div className="border-b border-edge px-5 py-3.5">
            <div className="tag-chip text-ink-3">SCHEDULE · 发送排期</div>
          </div>
          <div className="flex max-h-[560px] flex-col overflow-y-auto">
            {schedule.map((s) => {
              const sent = !!s.sentLog
              const isToday = s.date === fmtDate(TODAY)
              return (
                <div key={s.key} className={`flex items-center gap-3 border-b border-edge/50 px-5 py-3 last:border-0 ${sent ? 'opacity-55' : ''}`}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.contest.color, boxShadow: `0 0 8px ${s.contest.color}` }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{s.contest.short}</span>
                      <span
                        className="tag-chip rounded px-1.5 py-0.5"
                        style={
                          s.kind === 'race'
                            ? { color: '#22d3ee', background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.3)' }
                            : s.kind === 'milestone'
                              ? { color: '#c084fc', background: 'rgba(192,132,252,0.10)', border: '1px solid rgba(192,132,252,0.3)' }
                              : { color: '#fbbf24', background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.3)' }
                        }
                      >
                        {s.kind === 'milestone' ? `事项 · ${s.label}` : s.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-ink-3">
                      收件人：{s.recipientsDesc}
                      {sent && s.sentLog && ` · ${s.sentLog.recipients.split(',').filter(Boolean).length} 封${s.sentLog.mocked ? '（模拟）' : ''}`}
                      {sent && !!s.sentLog?.skipped && <span className="text-amber"> · 跳过 {s.sentLog.skipped} 人（无邮箱）</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {sent ? (
                      <span className="text-[12.5px] text-mint">已发送</span>
                    ) : (
                      <>
                        <div className={`font-mono text-[14px] ${isToday ? 'font-semibold text-amber' : 'text-ink-2'}`}>
                          {s.date.slice(5)}
                        </div>
                        <div className="text-[11.5px] text-ink-3">{isToday ? '今日窗口' : '计划发送'}</div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {schedule.length === 0 && <div className="p-8 text-center text-[15px] text-ink-3">暂无待发送的提醒。</div>}
          </div>
        </Panel>

        {/* history */}
        <Panel className="rise-in rise-in-1 overflow-hidden xl:col-span-2">
          <div className="border-b border-edge px-5 py-3.5">
            <div className="tag-chip text-ink-3">HISTORY · 发送记录</div>
          </div>
          <div className="flex max-h-[560px] flex-col overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="border-b border-edge/50 px-5 py-3 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium">{l.contest_short || `比赛 #${l.contest_id}`}</span>
                  <span
                    className="tag-chip rounded px-1.5 py-0.5"
                    style={
                      l.kind === 'race'
                        ? { color: '#22d3ee', background: 'rgba(34,211,238,0.10)' }
                        : l.kind === 'milestone'
                          ? { color: '#c084fc', background: 'rgba(192,132,252,0.10)' }
                          : { color: '#fbbf24', background: 'rgba(251,191,36,0.10)' }
                    }
                  >
                    {l.kind === 'race' ? `赛前 ${l.days_before} 天` : l.kind === 'milestone' ? `事项 · ${l.note || '提醒'}` : '报名催办'}
                  </span>
                  <span className={`tag-chip ml-auto rounded px-1.5 py-0.5 ${l.mocked ? 'text-ink-3 ring-1 ring-inset ring-edge' : 'text-mint ring-1 ring-inset ring-mint/40'}`}>
                    {l.mocked ? '模拟' : '真实'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[12px] text-ink-3">
                  <span className="font-mono">{l.sent_at.replace('T', ' ')}</span>
                  <span>
                    {l.recipients.split(',').filter(Boolean).length} 位收件人
                    {l.skipped > 0 && <span className="text-amber"> · 跳过 {l.skipped} 人无邮箱</span>}
                  </span>
                </div>
              </div>
            ))}
            {logs.length === 0 && <div className="p-8 text-center text-[15px] text-ink-3">还没有发送记录。</div>}
          </div>
        </Panel>
      </div>
    </div>
  )
}
