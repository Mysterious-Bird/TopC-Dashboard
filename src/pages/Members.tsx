import { useEffect, useMemo, useState } from 'react'
import { primaryRole, roleSort, type Member } from '../data/mock'
import { useData } from '../data/DataContext'
import { PageTitle, Panel, RoleBadges } from '../components/ui'
import { Spotlight } from '../components/fx'
import MemberForm from '../components/MemberForm'
import RoleManager from '../components/RoleManager'
import EmailModal from '../components/EmailModal'
import { deleteMember } from '../api'
import { RANK_ICON, TIER_META, rankOf, tierOf } from '../data/awards'

export default function Members() {
  const { members, roles, contests, refresh, authed } = useData()
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('全部')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sel, setSel] = useState<Member | null>(null)
  const [editing, setEditing] = useState<Member | null | 'new'>(null)
  const [showRoles, setShowRoles] = useState(false)
  const [emailTo, setEmailTo] = useState<Member | null>(null)

  useEffect(() => {
    setSel((prev) => {
      if (!prev) return null
      return members.find((m) => m.id === prev.id) ?? null
    })
  }, [members])

  const remove = async (m: Member) => {
    if (!window.confirm(`确定删除成员「${m.name}」吗？其参赛记录会一并移除。`)) return
    await deleteMember(m.id)
    setSel(null)
    refresh()
  }

  const list = useMemo(
    () =>
      members
        .filter(
          (m) =>
            (roleFilter === '全部' || m.roles.includes(roleFilter)) &&
            (q === '' || m.name.includes(q) || m.major.includes(q) || m.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))),
        )
        .sort((a, b) => roleSort(roles, primaryRole(roles, a)) - roleSort(roles, primaryRole(roles, b))),
    [q, roleFilter, members, roles],
  )

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
        <PageTitle title="成员管理" sub={`共 ${members.length} 名成员`} />
        {authed && (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              onClick={() => setShowRoles(true)}
              className="flex-1 rounded-lg border border-edge px-4 py-2 text-[14px] text-ink-2 transition hover:bg-panel-2 hover:text-ink sm:flex-none"
            >
              职位管理
            </button>
            <button
              onClick={() => setEditing('new')}
              className="flex-1 rounded-lg bg-neon/15 px-4 py-2 text-[14px] font-medium text-neon ring-1 ring-inset ring-neon/40 transition hover:bg-neon/25 sm:flex-none"
            >
              + 添加成员
            </button>
          </div>
        )}
      </div>

      {/* filters */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-edge bg-panel px-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-ink-3">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="姓名 / 专业 / 技术栈"
            className="w-44 bg-transparent text-[14px] focus:outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setFilterOpen((o) => !o)}
            className="flex h-9 items-center gap-2 rounded-lg border border-edge bg-panel px-3.5 text-[14px] text-ink-2 transition hover:bg-panel-2 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-ink-3">
              <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" strokeLinejoin="round" />
            </svg>
            {roleFilter !== '全部' && (
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: roles.find((x) => x.name === roleFilter)?.color ?? '#22d3ee',
                  boxShadow: `0 0 6px ${roles.find((x) => x.name === roleFilter)?.color ?? '#22d3ee'}`,
                }}
              />
            )}
            {roleFilter === '全部' ? '筛选职位' : roleFilter}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-3 w-3 text-ink-3 transition-transform ${filterOpen ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
              <div className="absolute left-0 top-10 z-40 w-44 overflow-hidden rounded-lg border border-edge bg-panel py-1 shadow-xl shadow-black/50">
                {['全部', ...roles.map((r) => r.name)].map((r) => {
                  const rc = roles.find((x) => x.name === r)?.color
                  const on = roleFilter === r
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        setRoleFilter(r)
                        setFilterOpen(false)
                      }}
                      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] transition ${
                        on ? 'bg-panel-2 text-ink' : 'text-ink-2 hover:bg-panel-2/60 hover:text-ink'
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: rc ?? '#5b6b84', boxShadow: rc ? `0 0 6px ${rc}` : 'none' }}
                      />
                      {r}
                      {on && <span className="ml-auto text-neon">✓</span>}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* table */}
        <Panel className="rise-in overflow-hidden xl:col-span-2">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[14px] md:min-w-0">
            <thead>
              <tr className="border-b border-edge text-left font-display text-[13.5px] tracking-wider text-neon/80">
                <th className="w-[100px] px-3 py-3 font-medium sm:w-[120px] sm:px-5">成员</th>
                <th className="px-3 py-3 font-medium">职位</th>
                <th className="px-3 py-3 font-medium">年级 / 专业</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">电话</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">QQ</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">技术栈</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setSel(m)}
                  className={`cursor-pointer border-b border-edge/60 transition last:border-0 ${
                    sel?.id === m.id ? 'bg-panel-2/80' : 'hover:bg-panel-2/40'
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-3 sm:px-5">
                    <span className="font-medium">{m.name}</span>
                  </td>
                  <td className="px-3 py-3">
                    <RoleBadges roles={m.roles} />
                  </td>
                  <td className="px-3 py-3 text-ink-2">
                    <span className="whitespace-nowrap">{m.grade}</span>
                    {m.enrollYear != null && <span className="text-ink-3"> · {m.enrollYear}级</span>}
                    <span className="text-ink-3"> · </span>
                    <span className="text-[13px] sm:text-[14px]">{m.major}</span>
                  </td>
                  <td className="hidden px-3 py-3 font-mono text-[14px] text-ink-2 md:table-cell">{m.phone}</td>
                  <td className="hidden px-3 py-3 font-mono text-[14px] text-ink-2 lg:table-cell">{m.qq}</td>
                  <td className="hidden px-3 py-3 lg:table-cell">
                    <div className="flex max-w-[130px] flex-wrap gap-1">
                      {m.tags.slice(0, 2).map((t) => (
                        <span key={t} className="tag-chip rounded bg-panel-2 px-1.5 py-0.5 text-ink-2 ring-1 ring-inset ring-edge">
                          {t}
                        </span>
                      ))}
                      {m.tags.length > 2 && <span className="tag-chip px-1 py-0.5 text-ink-3">+{m.tags.length - 2}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {list.length === 0 && <div className="p-8 text-center text-[15px] text-ink-3">没有匹配的成员。</div>}
        </Panel>

        {/* detail card */}
        <Panel className="grid-tex h-fit p-0 xl:sticky xl:top-0">
          <Spotlight className="p-5" color={`color-mix(in srgb, ${sel?.color ?? '#22d3ee'} 10%, transparent)`}>
          {sel ? (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: sel.color, boxShadow: `0 0 12px ${sel.color}` }}
                />
                <div>
                  <div className="font-display text-lg font-semibold">{sel.name}</div>
                  <div className="mt-1">
                    <RoleBadges roles={sel.roles} />
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    {sel.gender} · {sel.grade}
                    {sel.enrollYear != null ? ` · ${sel.enrollYear}级` : ''}
                  </div>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
                <Field k="电话" v={sel.phone} mono />
                <Field k="QQ" v={sel.qq} mono />
                <Field k="邮箱" v={sel.email} mono className="col-span-2" />
                <Field k="学号" v={sel.studentId} mono />
                <Field k="入学年份" v={sel.enrollYear != null ? `${sel.enrollYear}（${sel.grade}）` : '—'} mono />
                <Field k="入社时间" v={sel.joinedAt} mono />
                <Field k="专业" v={sel.major} className="col-span-2" />
              </dl>
              {!sel.email && (
                <p className="mt-3 rounded-lg border border-amber/30 bg-amber/5 px-3 py-2 text-[12.5px] text-amber">
                  未填写邮箱：该成员不会收到任何提醒邮件，编辑资料补充后恢复。
                </p>
              )}
              {(() => {
                const awards = contests.flatMap((c) =>
                  c.results.filter((r) => r.memberIds.includes(sel.id)).map((r) => ({ contest: c.short, award: r.award, tier: tierOf(r.award, c.name), rank: rankOf(r.award) })),
                )
                if (awards.length === 0) return null
                return (
                  <div className="mt-5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <span
                        className="h-[15px] w-1 rounded-full bg-gradient-to-b from-amber to-[#f5c64f]"
                        style={{ boxShadow: '0 0 8px rgba(245,198,79,.7)' }}
                      />
                      <span className="awd-hero-sheen bg-gradient-to-r from-amber via-[#ffe9a8] to-amber bg-clip-text font-display text-[14.5px] font-semibold tracking-wide text-transparent">
                        获奖记录
                      </span>
                      <span className="font-mono text-[10.5px] text-ink-3">×{awards.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {awards.map((a, i) => (
                        <div key={i} className={`awd-mini awd-mini-${a.tier}`} style={{ ['--tier' as never]: TIER_META[a.tier].color }}>
                          <span className="awd-mini-rank">{RANK_ICON[a.rank - 1]}</span>
                          <span className="awd-mini-award">{a.award}</span>
                          <span className="awd-mini-contest">{a.contest}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="h-[15px] w-1 rounded-full"
                    style={{ background: sel.color, boxShadow: `0 0 8px ${sel.color}` }}
                  />
                  <span className="font-display text-[14.5px] font-semibold tracking-wide" style={{ color: sel.color }}>
                    技术栈
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sel.tags.map((t) => (
                    <span
                      key={t}
                      className="tag-chip rounded-md px-2 py-1"
                      style={{ color: sel.color, background: `color-mix(in srgb, ${sel.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${sel.color} 30%, transparent)` }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {authed && (
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => setEditing(sel)}
                    className="flex-1 rounded-lg bg-panel-2 py-2 text-[13.5px] ring-1 ring-inset ring-edge transition hover:ring-edge-2"
                  >
                    编辑资料
                  </button>
                  <button
                    onClick={() => setEmailTo(sel)}
                    disabled={!sel.email}
                    title={sel.email ? `发送至 ${sel.email}` : '该成员未填写邮箱'}
                    className="flex-1 rounded-lg bg-neon/15 py-2 text-[13.5px] font-medium text-neon ring-1 ring-inset ring-neon/40 transition hover:bg-neon/25 disabled:opacity-40"
                  >
                    发送邮件
                  </button>
                  <button
                    onClick={() => remove(sel)}
                    className="rounded-lg px-3 py-2 text-[13.5px] text-rose ring-1 ring-inset ring-rose/30 transition hover:bg-rose/10"
                  >
                    删除
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-10 text-center text-[15px] text-ink-3">点击左侧成员查看详情</div>
          )}
          </Spotlight>
        </Panel>
      </div>

      {editing && (
        <MemberForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      {showRoles && <RoleManager onClose={() => setShowRoles(false)} />}
      {emailTo && <EmailModal member={emailTo} onClose={() => setEmailTo(null)} />}
    </div>
  )
}

function Field({ k, v, mono, className = '' }: { k: string; v: string; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[12px] text-ink-3">{k}</dt>
      <dd className={`mt-0.5 ${mono ? 'font-mono text-[14px]' : ''}`}>{v}</dd>
    </div>
  )
}
