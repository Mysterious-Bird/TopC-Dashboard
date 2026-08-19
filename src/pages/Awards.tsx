import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../data/DataContext'
import { CountUp } from '../components/fx'
import { inputCls } from '../components/Modal'
import { TIER_META, RANK_ICON, QUOTES, tierOf, rankOf, type Award, type Tier } from '../data/awards'
import type { Member } from '../data/mock'

type MemberMap = Map<string, Member>

export default function Awards() {
  const { contests, memberById } = useData()
  const tlRef = useRef<HTMLDivElement>(null)
  const tlScroll = (dir: 1 | -1) => tlRef.current?.scrollBy({ left: dir * 474, behavior: 'smooth' })

  const awards: Award[] = useMemo(() => {
    const out: Award[] = []
    contests.forEach((c) => {
      c.results.forEach((r) => {
        const team = c.isTeam ? c.teams.find((t) => t.memberIds.some((id) => r.memberIds.includes(id)))?.name : undefined
        out.push({
          id: `${c.id}-${r.id}`,
          award: r.award,
          contest: c.name,
          contestId: c.id,
          date: c.end.slice(0, 7),
          tier: tierOf(`${r.award} ${c.name}`),
          memberIds: r.memberIds,
          team,
          rank: rankOf(r.award),
        })
      })
    })
    return out
  }, [contests])

  const members: MemberMap = useMemo(() => {
    const map: MemberMap = new Map()
    awards.forEach((a) => a.memberIds.forEach((id) => { try { map.set(id, memberById(id)) } catch { /* */ } }))
    return map
  }, [awards, memberById])

  useEffect(() => {
    const el = tlRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [awards.length])

  const nationals = awards.filter((a) => a.tier === 'national')
  const rest = awards.filter((a) => a.tier !== 'national')
  const people = new Set(awards.flatMap((a) => a.memberIds)).size
  const latestThree = [...awards].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

  if (awards.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-16 text-center text-ink-3">
        <div className="font-display text-2xl">暂无获奖记录</div>
        <p className="mt-2 text-[14px]">比赛录入成绩后，这里会自动生成荣誉殿堂。</p>
      </div>
    )
  }

  return (
    <div className="awd mx-auto max-w-[1200px] px-6 py-6">
      {/* ---------- HERO ---------- */}
      <section className="awd-hero panel grid-tex rise-in relative overflow-hidden p-8">
        <div className="awd-aurora" aria-hidden><i /><i /><i /></div>
        <div className="awd-beams" aria-hidden><i /><i /><i /></div>
        <div className="awd-dust" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ ['--i' as never]: i }} />)}
        </div>
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="awd-trophy-wrap">
            <div className="awd-trophy" aria-hidden><TrophySVG /></div>
            <div className="awd-floor-glow" aria-hidden />
          </div>
          <div className="min-w-[260px] flex-1">
            <div className="tag-chip text-amber">TOPC · HALL OF FAME</div>
            <h1 className="mt-2 font-display text-[40px] font-bold leading-tight tracking-tight">
              荣誉殿堂
              <span className="awd-hero-sheen ml-3 bg-gradient-to-r from-amber via-[#f5c64f] to-amber bg-clip-text text-transparent">GLORY</span>
            </h1>
            <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-ink-2">
              「{quote}」
            </p>
            <div className="mt-5 flex flex-wrap gap-6">
              <HeroStat value={awards.length} label="累计奖项" accent="#f5c64f" />
              <HeroStat value={nationals.length} label="国家级" accent="#f5c64f" />
              <HeroStat value={people} label="获奖成员" accent="#22d3ee" />
              <HeroStat value={new Set(awards.map((a) => a.contestId)).size} label="覆盖赛事" accent="#a78bfa" />
            </div>
          </div>
          <div className="awd-breakdown">
            <div className="mb-3 flex items-center gap-2.5">
              <span
                className="h-[16px] w-1 rounded-full bg-gradient-to-b from-amber to-[#f5c64f]"
                style={{ boxShadow: '0 0 10px rgba(245,198,79,.7)' }}
              />
              <span className="awd-hero-sheen bg-gradient-to-r from-amber via-[#ffe9a8] to-amber bg-clip-text font-display text-[17px] font-semibold tracking-wide text-transparent">
                战绩分布
              </span>
              <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">Tier Breakdown</span>
            </div>
            {(Object.keys(TIER_META) as Tier[]).map((t, i) => {
              const n = awards.filter((a) => a.tier === t).length
              return (
                <div key={t} className="awd-bar-row">
                  <span className="awd-bar-label" style={{ color: TIER_META[t].color }}>{TIER_META[t].label}</span>
                  <span className="awd-bar-track">
                    <span className="awd-bar-fill" style={{
                      ['--w' as never]: `${(n / awards.length) * 100}%`,
                      background: `linear-gradient(90deg, color-mix(in srgb, ${TIER_META[t].color} 35%, transparent), ${TIER_META[t].color})`,
                      animationDelay: `${0.3 + i * 0.15}s`,
                    }} />
                  </span>
                  <span className="awd-bar-n font-mono" style={{ color: TIER_META[t].color }}>{n}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="relative mt-7 flex flex-wrap items-center gap-x-7 gap-y-2.5 border-t border-edge/60 pt-5">
          <span className="flex items-center gap-2.5">
            <span
              className="h-[16px] w-1 rounded-full bg-gradient-to-b from-amber to-[#f5c64f]"
              style={{ boxShadow: '0 0 10px rgba(245,198,79,.7)' }}
            />
            <span className="awd-hero-sheen bg-gradient-to-r from-amber via-[#ffe9a8] to-amber bg-clip-text font-display text-[17px] font-semibold tracking-wide text-transparent">
              最新荣誉
            </span>
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">Recent Honors</span>
          </span>
          {latestThree.map((a) => (
            <span key={a.id} className="awd-recent" style={{ ['--tier' as never]: TIER_META[a.tier].color }}>
              <span className="awd-recent-dot" />
              <b>{a.award}</b>
              <span className="awd-recent-c">{a.contest}</span>
              <span className="font-mono text-[11.5px] text-ink-3">{a.date}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ---------- 荣誉编年 ---------- */}
      <section className="awd-timeline panel grid-tex rise-in relative mt-6 overflow-hidden p-6" style={{ animationDelay: '.15s' }}>
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <span
              className="h-[18px] w-1 rounded-full bg-gradient-to-b from-amber to-[#f5c64f]"
              style={{ boxShadow: '0 0 12px rgba(245,198,79,.7)' }}
            />
            <span className="awd-hero-sheen bg-gradient-to-r from-amber via-[#ffe9a8] to-amber bg-clip-text font-display text-[19px] font-semibold tracking-wide text-transparent">
              荣誉编年
            </span>
            <span className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-3">Glory Timeline</span>
          </div>
        </div>
        <div className="awd-tl-wrap">
          <button className="awd-tl-edge awd-tl-left" onClick={() => tlScroll(-1)} aria-label="更早">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div ref={tlRef} className="awd-tl-track">
            <div className="awd-tl-inner">
              {[...awards].sort((a, b) => a.date.localeCompare(b.date)).map((a, i) => (
                <div key={a.id} className="awd-tl-item" style={{ ['--tier' as never]: TIER_META[a.tier].color, animationDelay: `${0.25 + i * 0.09}s` }}>
                  <div className="awd-tl-date font-mono">{a.date}</div>
                  <div className="awd-tl-award">{a.award}</div>
                  <div className="awd-tl-contest">{a.contest}</div>
                </div>
              ))}
            </div>
          </div>
          <button className="awd-tl-edge awd-tl-right" onClick={() => tlScroll(1)} aria-label="更近">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-4 w-4"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </section>

      {/* ---------- 巅峰时刻（国家级） ---------- */}
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="tag-chip text-ink-3">PEAK MOMENTS</div>
            <h2 className="mt-1 font-display text-[20px] font-semibold">巅峰时刻 · 国家级</h2>
          </div>
          <span className="text-[12.5px] text-ink-3">熔金旋边 · 金尘浮动 · 扫光</span>
        </div>
        {nationals.length === 0 ? (
          <div className="panel grid-tex p-8 text-center text-[14px] text-ink-3">暂无国家级奖项</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {nationals.map((a, i) => <AwardCard key={a.id} a={a} members={members} big delay={i} />)}
          </div>
        )}
      </section>

      {/* ---------- 荣誉墙 ---------- */}
      {rest.length > 0 && (
        <section className="mt-10">
          <div className="mb-4">
            <div className="tag-chip text-ink-3">WALL OF HONOR</div>
            <h2 className="mt-1 font-display text-[20px] font-semibold">荣誉墙</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rest.map((a, i) => <AwardCard key={a.id} a={a} members={members} delay={i} />)}
          </div>
        </section>
      )}

      {/* ---------- 荣誉列表 ---------- */}
      <HonorList awards={awards} members={members} />
    </div>
  )
}

function HeroStat({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div>
      <div className="font-display text-[26px] font-bold leading-none" style={{ color: accent }}>
        <CountUp to={value} />
      </div>
      <div className="mt-1 text-[12px] text-ink-3">{label}</div>
    </div>
  )
}

function AwardCard({ a, members, big, delay }: { a: Award; members: MemberMap; big?: boolean; delay: number }) {
  const meta = TIER_META[a.tier]
  return (
    <article className={`awd-card awd-card-${a.tier} ${big ? 'awd-card-big' : ''}`} style={{ animationDelay: `${delay * 90}ms`, ['--tier' as never]: meta.color }}>
      {a.tier === 'national' && (
        <div className="awd-dust awd-dust-card" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => <i key={i} style={{ ['--i' as never]: i }} />)}
        </div>
      )}
      <div className="awd-flip">
        <div className="awd-flip-in">
          <div className="awd-face-front awd-card-in flex flex-col">
            <span className="awd-ghost" aria-hidden>{RANK_ICON[a.rank - 1]}</span>
            <div className="flex items-center gap-2">
              <span className="awd-tier-tag">{meta.label}</span>
              {a.team && <span className="awd-team-tag"><TeamIcon />{a.team}</span>}
              <span className="ml-auto font-mono text-[12px] text-ink-3">{a.date}</span>
            </div>
            <div className={`flex items-center gap-3 ${big ? 'mt-7' : 'mt-5'}`}>
              <span className={big ? 'text-[50px]' : 'text-[36px]'}>{RANK_ICON[a.rank - 1]}</span>
              <div className="min-w-0">
                <div className={`awd-award-name font-display font-bold leading-snug ${big ? 'text-[27px]' : 'text-[19px]'}`}>{a.award}</div>
                <div className={`truncate text-ink-2 ${big ? 'mt-1.5 text-[15px]' : 'mt-1 text-[13.5px]'}`}>{a.contest}</div>
              </div>
            </div>
          </div>
          <div className="awd-face-back awd-card-in flex flex-col">
            <div className="flex items-center gap-2">
              <span className="awd-back-eyebrow flex-1 truncate">{a.team ? 'TEAM MEMBERS · 队员' : 'WINNER · 获奖人'}</span>
              {a.team && <div className="awd-back-team"><TeamIcon /><b>{a.team}</b></div>}
              <span className={`flex-1 text-right ${big ? 'text-[26px]' : 'text-[22px]'}`}>{RANK_ICON[a.rank - 1]}</span>
            </div>
            <div className={`awd-back-award font-display font-bold ${big ? 'mt-1.5 text-[17px]' : 'mt-1 text-[14px]'}`}>{a.award}</div>
            <div className="awd-back-winners">
              {a.memberIds.map((id, w) => {
                const m = members.get(id)
                if (!m) return null
                return <span key={id} className="awd-winner" style={{ ['--w' as never]: w }}><b>{m.name}</b></span>
              })}
            </div>
            <div className="awd-back-foot mt-auto">
              <span className="awd-back-foot-dot" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
              {a.contest} · {a.date}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function HonorList({ awards, members }: { awards: Award[]; members: MemberMap }) {
  const [q, setQ] = useState('')
  const [tier, setTier] = useState<Tier | 'all'>('all')
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return [...awards]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((a) => tier === 'all' || a.tier === tier)
      .filter((a) => {
        if (!kw) return true
        const names = a.memberIds.map((id) => members.get(id)?.name ?? '').join(' ')
        return [a.award, a.contest, a.team ?? '', names].join(' ').toLowerCase().includes(kw)
      })
  }, [q, tier, awards, members])

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="tag-chip text-ink-3">ALL HONORS</div>
          <h2 className="mt-1 font-display text-[20px] font-semibold">荣誉列表</h2>
        </div>
        <span className="text-[12.5px] text-ink-3">共 {rows.length} 条 · 按时间倒序</span>
      </div>
      <div className="panel grid-tex p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索 人名 / 比赛 / 奖项 / 队名…" className={`${inputCls} w-[260px]`} />
          <div className="flex gap-1.5">
            {(['all', 'national', 'provincial', 'city', 'school'] as const).map((t) => (
              <button key={t} onClick={() => setTier(t)} className={`awd-hf-btn ${tier === t ? 'awd-hf-on' : ''}`} style={t !== 'all' ? { ['--tier' as never]: TIER_META[t].color } : undefined}>
                {t === 'all' ? '全部' : TIER_META[t].label}
              </button>
            ))}
          </div>
        </div>
        <div className="awd-hr awd-hr-head mt-4">
          <span>日期</span><span>奖项</span><span>比赛</span><span>队伍</span><span>获奖人</span><span className="text-right">级别</span>
        </div>
        {rows.map((a) => (
          <div key={a.id} className="awd-hr" style={{ ['--tier' as never]: TIER_META[a.tier].color }}>
            <span className="font-mono text-[12.5px] text-ink-3">{a.date}</span>
            <span className="awd-hr-award">{RANK_ICON[a.rank - 1]} {a.award}</span>
            <span className="truncate text-ink-2">{a.contest}</span>
            <span className="truncate text-ink-2">{a.team ?? <span className="text-ink-3">—</span>}</span>
            <span className="truncate">{a.memberIds.map((id) => members.get(id)?.name).filter(Boolean).join('、')}</span>
            <span className="text-right"><span className="awd-tier-tag">{TIER_META[a.tier].label}</span></span>
          </div>
        ))}
        {rows.length === 0 && <div className="py-8 text-center text-[14px] text-ink-3">无匹配结果，换个关键词试试</div>}
      </div>
    </section>
  )
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function TrophySVG() {
  return (
    <svg viewBox="0 0 120 120" className="h-[110px] w-[110px]">
      <defs>
        <linearGradient id="awd-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8e08e" />
          <stop offset="0.5" stopColor="#f5c64f" />
          <stop offset="1" stopColor="#b8860b" />
        </linearGradient>
      </defs>
      <path d="M35 18h50v22a25 25 0 0 1-50 0V18Z" fill="url(#awd-gold)" />
      <path d="M35 24H20a16 16 0 0 0 16 18M85 24h15a16 16 0 0 1-16 18" fill="none" stroke="url(#awd-gold)" strokeWidth="5" />
      <rect x="52" y="64" width="16" height="12" fill="url(#awd-gold)" />
      <rect x="40" y="78" width="40" height="8" rx="2" fill="url(#awd-gold)" />
      <rect x="34" y="90" width="52" height="10" rx="2.5" fill="#3a3f4d" stroke="#f5c64f55" />
      <path d="M60 26l3 6.5 7 .8-5.2 4.8 1.4 7L60 41.5 53.8 45l1.4-7L50 33.3l7-.8 3-6.5Z" fill="#fff8dc" opacity="0.9" />
    </svg>
  )
}
