import { useState } from 'react'
import Modal, { Field, FormActions, inputCls } from './Modal'
import { useData } from '../data/DataContext'
import { saveContest } from '../api'
import type { Contest, Team } from '../data/mock'

const CATEGORIES = ['算法', '开发', '安全', 'AI', '建模']
const LEVELS = ['国际', '全国', '省级', '校级']

let teamSeq = 0
const newTeam = (): Team => ({ id: `new-${Date.now()}-${++teamSeq}`, name: '', memberIds: [] })

const chipCls = (on: boolean) =>
  `flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-[12.5px] transition-colors ${
    on ? 'border-neon/50 bg-neon/10 text-neon' : 'border-edge text-ink-2 hover:border-edge-2 hover:text-ink'
  }`

export default function ContestForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Contest
  onClose: () => void
  onSaved: () => void
}) {
  const { members, roles, contests } = useData()
  const [d, setD] = useState<Contest>(
    initial ?? {
      id: '',
      name: '',
      short: '',
      category: '算法',
      level: '校级',
      start: '',
      end: '',
      registerBy: '',
      location: '',
      teamSize: 3,
      isTeam: true,
      teams: [newTeam()],
      participantIds: [],
      color: '#22d3ee',
      description: '',
      reminderDays: [7, 1],
      remindEnabled: true,
      remindRecipientIds: [],
      milestones: [],
      results: [],
    },
  )
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof Contest>(k: K, v: Contest[K]) => setD((p) => ({ ...p, [k]: v }))

  const addRecipients = (ids: string[]) =>
    set('remindRecipientIds', [...new Set([...d.remindRecipientIds, ...ids])])
  const removeRecipient = (id: string) =>
    set('remindRecipientIds', d.remindRecipientIds.filter((x) => x !== id))

  const setTeam = (idx: number, patch: Partial<Team>) =>
    set('teams', d.teams.map((t, i) => (i === idx ? { ...t, ...patch } : t)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!d.name.trim()) return alert('请填写比赛名称')
    if (!d.start || !d.end) return alert('请填写起止日期')
    if (d.end < d.start) return alert('结束日期不能早于开始日期')
    if (d.isTeam && d.teams.some((t) => t.memberIds.length === 0))
      return alert('存在空队伍：请为每支队伍选择成员，或删除该队伍')
    const participantIds = d.isTeam
      ? [...new Set(d.teams.flatMap((t) => t.memberIds))]
      : d.participantIds
    setSaving(true)
    try {
      await saveContest(
        {
          ...d,
          name: d.name.trim(),
          short: (d.short || d.name).trim(),
          participantIds,
          milestones: d.milestones.filter((m) => m.date && m.title.trim()),
          results: d.results.filter((r) => r.award.trim()),
        },
        initial?.id,
      )
      onSaved()
      onClose()
    } catch (err) {
      alert('保存失败：' + String(err))
    } finally {
      setSaving(false)
    }
  }

  const participants = d.isTeam ? [...new Set(d.teams.flatMap((t) => t.memberIds))] : d.participantIds

  return (
    <Modal title={initial ? `编辑比赛 · ${initial.short}` : '添加比赛'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="比赛名称 *" className="col-span-2">
            <input required value={d.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="如 ICPC 亚洲区域赛 · 南京站" />
          </Field>
          <Field label="简称（图谱 / 日历中显示）">
            <input value={d.short} onChange={(e) => set('short', e.target.value)} className={inputCls} placeholder="默认同名称" />
          </Field>
          <Field label="比赛地点">
            <input value={d.location} onChange={(e) => set('location', e.target.value)} className={inputCls} placeholder="线上 / 城市" />
          </Field>
          <Field label="类别">
            <select value={d.category} onChange={(e) => set('category', e.target.value as Contest['category'])} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="级别">
            <select value={d.level} onChange={(e) => set('level', e.target.value as Contest['level'])} className={inputCls}>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="开始日期 *">
            <input type="date" value={d.start} onChange={(e) => set('start', e.target.value)} className={inputCls} />
          </Field>
          <Field label="结束日期 *">
            <input type="date" value={d.end} onChange={(e) => set('end', e.target.value)} className={inputCls} />
          </Field>
          <Field label="报名截止">
            <input type="date" value={d.registerBy} onChange={(e) => set('registerBy', e.target.value)} className={inputCls} />
          </Field>
          <Field label={d.isTeam ? '每队人数上限' : '人数上限'}>
            <input type="number" min={1} value={d.teamSize} onChange={(e) => set('teamSize', Math.max(1, Number(e.target.value) || 1))} className={inputCls} />
          </Field>

          <Field label="赛制" className="col-span-2">
            <div className="flex gap-2">
              {([['true', '团队赛 · 按队伍参赛'], ['false', '个人赛 · 无队伍']] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('isTeam', v === 'true')}
                  className={`rounded-lg border px-3.5 py-1.5 text-[14px] transition-colors ${
                    d.isTeam === (v === 'true')
                      ? 'border-neon/50 bg-neon/10 text-neon'
                      : 'border-edge text-ink-2 hover:border-edge-2 hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          {d.isTeam ? (
            <Field label={`参赛队伍（${d.teams.length} 支）`} className="col-span-2">
              <div className="space-y-3">
                {d.teams.map((t, i) => (
                  <div key={t.id} className="rounded-xl border border-edge/70 bg-abyss/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <input
                        value={t.name}
                        onChange={(e) => setTeam(i, { name: e.target.value })}
                        placeholder={`队伍 ${i + 1} 名称`}
                        className="w-44 rounded-lg border border-edge bg-panel-2/60 px-3 py-1.5 text-[14px] text-ink placeholder:text-ink-3 focus:border-neon/50 focus:outline-none"
                      />
                      <span className="font-mono text-[12px] text-ink-3">{t.memberIds.length}/{d.teamSize} 人</span>
                      <button
                        type="button"
                        onClick={() => set('teams', d.teams.filter((_, j) => j !== i))}
                        className="ml-auto rounded-md px-2 py-1 text-[12px] text-ink-3 transition-colors hover:bg-rose/10 hover:text-rose"
                      >
                        删除队伍
                      </button>
                    </div>
                    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                      {members.map((m) => {
                        const on = t.memberIds.includes(m.id)
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              setTeam(i, { memberIds: on ? t.memberIds.filter((x) => x !== m.id) : [...t.memberIds, m.id] })
                            }
                            className={chipCls(on)}
                          >
                            {m.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set('teams', [...d.teams, newTeam()])}
                  className="w-full rounded-lg border border-dashed border-edge py-2 text-[14px] text-ink-2 transition-colors hover:border-neon/40 hover:text-neon"
                >
                  + 添加队伍
                </button>
              </div>
            </Field>
          ) : (
            <Field label={`参赛成员（${d.participantIds.length} 人）`} className="col-span-2">
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-edge bg-abyss/30 p-2.5">
                {members.map((m) => {
                  const on = d.participantIds.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => set('participantIds', on ? d.participantIds.filter((x) => x !== m.id) : [...d.participantIds, m.id])}
                      className={chipCls(on)}
                    >
                      {m.name}
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          <Field label="赛前提醒" className="col-span-2">
            <div className="rounded-xl border border-edge/70 bg-abyss/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-ink-2">
                  {d.remindEnabled ? '已开启：按提醒节点发送邮件' : '已关闭：本次比赛不发送任何赛前提醒'}
                </span>
                <button
                  type="button"
                  onClick={() => set('remindEnabled', !d.remindEnabled)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${d.remindEnabled ? 'bg-neon/70' : 'bg-edge'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${d.remindEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </div>
              {d.remindEnabled && (
                <div className="mt-3 border-t border-edge/60 pt-3">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] text-ink-3">快选：</span>
                    <QuickBtn onClick={() => set('remindRecipientIds', members.map((m) => m.id))}>全体成员</QuickBtn>
                    <QuickBtn onClick={() => addRecipients(participants)}>本场比赛参赛者</QuickBtn>
                    <QuickBtn onClick={() => set('remindRecipientIds', [])}>恢复默认</QuickBtn>
                    <select
                      value=""
                      onChange={(e) => {
                        const name = e.target.value
                        if (name) addRecipients(members.filter((m) => m.roles.includes(name)).map((m) => m.id))
                      }}
                      className="rounded-full border border-edge bg-panel-2/60 px-2.5 py-1 text-[12px] text-ink-2 focus:border-neon/50 focus:outline-none"
                    >
                      <option value="">按职位添加…</option>
                      {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                    <select
                      value=""
                      onChange={(e) => {
                        const c = contests.find((x) => x.id === e.target.value)
                        if (c) addRecipients(c.participantIds)
                      }}
                      className="rounded-full border border-edge bg-panel-2/60 px-2.5 py-1 text-[12px] text-ink-2 focus:border-neon/50 focus:outline-none"
                    >
                      <option value="">按比赛添加…</option>
                      {contests.filter((c) => c.id !== d.id).map((c) => <option key={c.id} value={c.id}>{c.short}</option>)}
                    </select>
                  </div>
                  {d.remindRecipientIds.length === 0 ? (
                    <p className="rounded-lg bg-panel-2/60 px-3 py-2 text-[12.5px] text-ink-3">
                      未指定收件人：默认提醒 <span className="text-neon">本场比赛参赛者 + 社长</span>
                    </p>
                  ) : (
                    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {d.remindRecipientIds.map((id) => {
                      const m = members.find((x) => x.id === id)
                      if (!m) return null
                      return (
                        <span
                          key={id}
                          title={m.email ? m.email : '该成员未填写邮箱，发送时将被跳过'}
                          className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-[12.5px] ${
                            m.email
                              ? 'border-neon/40 bg-neon/10 text-neon'
                              : 'border-dashed border-amber/50 bg-amber/5 text-amber'
                          }`}
                        >
                          {m.name}
                          {!m.email && <span className="text-[10px]">无邮箱</span>}
                          <button type="button" onClick={() => removeRecipient(id)} className="ml-0.5 opacity-60 hover:text-rose">✕</button>
                        </span>
                      )
                    })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Field>

          <Field label="固定日期事项提醒（当天向收件人发邮件，适合作品提交等节点）" className="col-span-2">
            <div className="space-y-2">
              {d.milestones.map((m, i) => (
                <div key={m.id || i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={m.date}
                    onChange={(e) => set('milestones', d.milestones.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))}
                    className="w-40 rounded-lg border border-edge bg-panel-2/60 px-3 py-1.5 text-[14px] text-ink focus:border-neon/50 focus:outline-none"
                  />
                  <input
                    value={m.title}
                    onChange={(e) => set('milestones', d.milestones.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="事项名称，如：作品提交截止"
                    className="flex-1 rounded-lg border border-edge bg-panel-2/60 px-3 py-1.5 text-[14px] text-ink placeholder:text-ink-3 focus:border-neon/50 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => set('milestones', d.milestones.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] text-ink-3 transition-colors hover:bg-rose/10 hover:text-rose"
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set('milestones', [...d.milestones, { id: `new-ms-${Date.now()}`, date: '', title: '' }])}
                className="w-full rounded-lg border border-dashed border-edge py-1.5 text-[14px] text-ink-2 transition-colors hover:border-neon/40 hover:text-neon"
              >
                + 添加事项
              </button>
            </div>
          </Field>

          <Field label="成绩 / 获奖记录（完赛后填写，可选）" className="col-span-2">
            <div className="space-y-2.5">
              {d.results.map((r, i) => (
                <div key={r.id || i} className="rounded-xl border border-edge/70 bg-abyss/30 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      value={r.award}
                      onChange={(e) => set('results', d.results.map((x, j) => (j === i ? { ...x, award: e.target.value } : x)))}
                      placeholder="奖项，如：国家级二等奖"
                      className="w-52 rounded-lg border border-edge bg-panel-2/60 px-3 py-1.5 text-[14px] text-ink placeholder:text-ink-3 focus:border-neon/50 focus:outline-none"
                    />
                    <span className="text-[12px] text-ink-3">{r.memberIds.length} 人获奖</span>
                    <button
                      type="button"
                      onClick={() => set('results', d.results.filter((_, j) => j !== i))}
                      className="ml-auto rounded-md px-2 py-1 text-[12px] text-ink-3 transition-colors hover:bg-rose/10 hover:text-rose"
                    >
                      删除
                    </button>
                  </div>
                  <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                    {members.map((m) => {
                      const on = r.memberIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            set('results', d.results.map((x, j) =>
                              j === i ? { ...x, memberIds: on ? x.memberIds.filter((y) => y !== m.id) : [...x.memberIds, m.id] } : x,
                            ))
                          }
                          className={chipCls(on)}
                        >
                          {m.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set('results', [...d.results, { id: `new-r-${Date.now()}`, award: '', memberIds: [], note: '' }])}
                className="w-full rounded-lg border border-dashed border-edge py-1.5 text-[14px] text-ink-2 transition-colors hover:border-neon/40 hover:text-neon"
              >
                + 添加成绩
              </button>
            </div>
          </Field>

          <Field label="比赛简介" className="col-span-2">
            <input value={d.description} onChange={(e) => set('description', e.target.value)} className={inputCls} placeholder="一句话说明（可选）" />
          </Field>
        </div>

        <FormActions saving={saving} onCancel={onClose} submitLabel={initial ? '保存修改' : '创建比赛'} />
      </form>
    </Modal>
  )
}

function QuickBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-edge px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-neon/40 hover:text-neon"
    >
      {children}
    </button>
  )
}
