import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { forceCollide } from 'd3-force'
import { type Member } from '../data/mock'
import { useData } from '../data/DataContext'
import { PageTitle, Panel, RoleBadges } from '../components/ui'

interface GNode {
  id: string
  member: Member
  degree: number
  x?: number
  y?: number
}

interface GLink {
  source: string
  target: string
  kind: 'role' | 'contest'
  label: string
  contestId?: string
}

type GroupSel = { kind: 'role' | 'contest'; key: string } | null

export default function GraphPage() {
  const fgRef = useRef<ForceGraphMethods>()
  const [showRole, setShowRole] = useState(true)
  const [showContest, setShowContest] = useState(true)
  const { members, contests, roles, roleLinks, memberById } = useData()
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [groupSel, setGroupSel] = useState<GroupSel>(null)
  const fittedOnce = useRef(false)

  // 分组高亮：选中职位/比赛后，组内成员保持高亮，其余淡出
  const groupMembers = useMemo(() => {
    if (!groupSel) return null
    if (groupSel.kind === 'role')
      return new Set(members.filter((m) => m.roles.includes(groupSel.key)).map((m) => m.id))
    const c = contests.find((x) => x.id === groupSel.key)
    return new Set(c?.participantIds ?? [])
  }, [groupSel, members, contests])

  const roleCounts = useMemo(() => {
    const map = new Map<string, number>()
    members.forEach((m) => m.roles.forEach((r) => map.set(r, (map.get(r) ?? 0) + 1)))
    return map
  }, [members])

  const sortedContests = useMemo(
    () => [...contests].sort((a, b) => b.start.localeCompare(a.start)),
    [contests],
  )

  // 构建连线：职务管理规则 + 同队成员（同场不同队不连线，个人赛不产生连线）
  const links = useMemo(() => {
    const out: GLink[] = []
    if (showRole) {
      roleLinks.forEach(([a, b]) => out.push({ source: a, target: b, kind: 'role', label: '职务管理' }))
    }
    if (showContest) {
      contests.forEach((c) => {
        if (!c.isTeam) return
        c.teams.forEach((t) => {
          t.memberIds.forEach((a, i) => {
            t.memberIds.slice(i + 1).forEach((b) => {
              out.push({ source: a, target: b, kind: 'contest', label: `${c.short}·${t.name}`, contestId: c.id })
            })
          })
        })
      })
    }
    return out
  }, [showRole, showContest, roleLinks, contests])

  const nodes = useMemo<GNode[]>(() => {
    const deg = new Map<string, number>()
    links.forEach((l) => {
      deg.set(l.source, (deg.get(l.source) ?? 0) + 1)
      deg.set(l.target, (deg.get(l.target) ?? 0) + 1)
    })
    return members.map((m) => ({ id: m.id, member: m, degree: deg.get(m.id) ?? 0 }))
  }, [links, members])

  // 关键：graphData 对象必须保持引用稳定。
  // force-graph 的 graphData setter 每次被调用都会 warmup + 重启引擎，
  // 若内联传新对象，任何重渲染（如悬停）都会让全图重新模拟、节点乱跳。
  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])

  // 力场调参：强斥力 + 大碰撞半径（连标签的空间一起占住）
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    fg.d3Force('charge')?.strength(-700)
    ;(fg.d3Force('link') as any)?.distance((l: any) => (l.kind === 'role' ? 115 : 160))
    // 碰撞半径按“节点 + 姓名牌宽度”占位：3 字名约 34px，半径取 38 起步
    fg.d3Force(
      'collide',
      forceCollide((n: any) => 38 + Math.min((n as GNode).degree, 8) * 1.6).strength(1),
    )
  }, [links])

  const neighbors = useMemo(() => {
    const map = new Map<string, Set<string>>()
    links.forEach((l) => {
      map.get(l.source)?.add(l.target) ?? map.set(l.source, new Set([l.target]))
      map.get(l.target)?.add(l.source) ?? map.set(l.target, new Set([l.source]))
    })
    return map
  }, [links])

  const isDim = useCallback(
    (id: string) => {
      const anchor = hoverId ?? focusId
      if (anchor) return id !== anchor && !neighbors.get(anchor)?.has(id)
      if (groupMembers) return !groupMembers.has(id)
      return false
    },
    [hoverId, focusId, neighbors, groupMembers],
  )

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GNode
      if (n.x == null || n.y == null || !isFinite(n.x) || !isFinite(n.y)) return
      const m = n.member
      const dim = isDim(n.id)
      const isAnchor = (hoverId ?? focusId) === n.id
      const inGroup = groupMembers?.has(n.id) ?? false
      const r = 3.2 + Math.min(n.degree, 8) * 0.55 + (isAnchor ? 1.4 : 0) + (inGroup && !dim ? 0.8 : 0)

      ctx.save()
      ctx.globalAlpha = dim ? 0.18 : 1

      // glow
      const grad = ctx.createRadialGradient(n.x!, n.y!, r * 0.4, n.x!, n.y!, r * 2.6)
      grad.addColorStop(0, m.color + '55')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, r * 2.6, 0, Math.PI * 2)
      ctx.fill()

      // body
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2)
      ctx.fillStyle = m.color + '26'
      ctx.fill()
      ctx.lineWidth = isAnchor ? 2.2 : inGroup && !dim ? 1.8 : 1.2
      ctx.strokeStyle = m.color
      ctx.stroke()

      // inner core
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, r * 0.38, 0, Math.PI * 2)
      ctx.fillStyle = m.color
      ctx.fill()

      // label：带底板的姓名牌，缩小时隐藏次要标签
      const showLabel = globalScale > 0.85 || isAnchor || (!dim && (hoverId ?? focusId) != null)
      if (showLabel) {
        const fontSize = Math.max(10 / globalScale, 3)
        ctx.font = `${isAnchor ? 600 : 400} ${fontSize}px "Noto Sans SC", sans-serif`
        const tw = ctx.measureText(m.name).width
        const padX = 3.5 / globalScale + 2
        const padY = 1.5 / globalScale + 1
        const lx = n.x! - tw / 2 - padX
        const ly = n.y! + r + 2
        ctx.fillStyle = dim ? 'rgba(7,11,18,0.35)' : 'rgba(7,11,18,0.78)'
        ctx.beginPath()
        ctx.roundRect(lx, ly, tw + padX * 2, fontSize + padY * 2, 3 / globalScale + 2)
        ctx.fill()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = dim ? 'rgba(147,161,184,0.4)' : isAnchor ? m.color : 'rgba(230,236,245,0.95)'
        ctx.fillText(m.name, n.x!, ly + padY)
      }

      ctx.restore()
    },
    [isDim, hoverId, focusId, groupMembers],
  )

  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D) => {
      const l = link as GLink & { source: GNode; target: GNode }
      const s = l.source as any
      const t = l.target as any
      if (s.x == null || t.x == null || !isFinite(s.x) || !isFinite(t.x)) return
      const anchor = hoverId ?? focusId
      let active: boolean
      let dim: boolean
      if (anchor) {
        active = s.id === anchor || t.id === anchor
        dim = !active
      } else if (groupSel && groupMembers) {
        // 比赛：只亮该比赛的队内连线；职位：只亮指向该职位成员的管理线
        active =
          groupSel.kind === 'contest'
            ? l.kind === 'contest' && l.contestId === groupSel.key
            : l.kind === 'role' && groupMembers.has(t.id)
        dim = !active
      } else {
        active = false
        dim = false
      }

      ctx.save()
      ctx.globalAlpha = dim ? 0.06 : active ? 0.95 : l.kind === 'role' ? 0.28 : 0.32
      ctx.strokeStyle = l.kind === 'role' ? '#a78bfa' : '#22d3ee'
      ctx.lineWidth = active ? 1.6 : 0.8
      if (l.kind === 'contest') ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
      ctx.restore()
    },
    [hoverId, focusId, groupSel, groupMembers],
  )

  const focus = focusId ? memberById(focusId) : null
  const focusContests = focusId ? contests.filter((c) => c.participantIds.includes(focusId)) : []

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="人物关系图谱" />
        <div className="flex items-center gap-2">
          <Toggle on={showRole} onClick={() => setShowRole(!showRole)} color="#a78bfa" label="职务关系" />
          <Toggle on={showContest} onClick={() => setShowContest(!showContest)} color="#22d3ee" label="同队队友" />
          <button
            onClick={() => fgRef.current?.zoomToFit(600, 60)}
            className="rounded-lg border border-edge px-3 py-1.5 text-[13.5px] text-ink-2 transition hover:bg-panel-2 hover:text-ink"
          >
            适应视图
          </button>
        </div>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="graph-wrap panel relative min-h-[480px] overflow-hidden xl:col-span-3">
          <ForceGraph2D
            ref={fgRef as any}
            graphData={graphData as any}
            backgroundColor="rgba(0,0,0,0)"
            nodeCanvasObject={paintNode}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => 'replace'}
            nodeRelSize={6}
            enableNodeDrag
            onNodeHover={(n: any) => setHoverId(n?.id ?? null)}
            onNodeClick={(n: any) => setFocusId(n.id === focusId ? null : n.id)}
            onBackgroundClick={() => setFocusId(null)}
            onNodeDragEnd={(n: any) => {
              // 拖拽后钉住节点（Obsidian 行为），双击可解锁
              n.fx = n.x
              n.fy = n.y
            }}
            onNodeRightClick={(n: any) => {
              n.fx = undefined
              n.fy = undefined
            }}
            warmupTicks={100}
            cooldownTime={4000}
            d3AlphaDecay={0.04}
            d3VelocityDecay={0.35}
            onEngineStop={() => {
              if (!fittedOnce.current) {
                fittedOnce.current = true
                fgRef.current?.zoomToFit(500, 70)
              }
            }}
          />
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1.5 rounded-lg border border-edge bg-abyss/70 px-3 py-2.5 backdrop-blur">
            <div className="tag-chip text-ink-3">LEGEND</div>
            <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <span className="inline-block h-px w-6 bg-violet" /> 职务管理关系
            </div>
            <div className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <span className="inline-block h-px w-6 border-t border-dashed border-neon" /> 同队队友
            </div>
          </div>
        </div>

        <div className="flex max-h-full min-h-0 flex-col gap-4">
        {/* group highlight */}
        <Panel className="grid-tex shrink-0 overflow-y-auto p-4" >
          <div className="flex items-center justify-between">
            <div className="tag-chip text-ink-3">HIGHLIGHT · 职位</div>
            {groupSel && (
              <button
                onClick={() => setGroupSel(null)}
                className="text-[12px] text-ink-3 transition hover:text-ink"
              >
                清除高亮 ✕
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roles.map((r) => {
              const on = groupSel?.kind === 'role' && groupSel.key === r.name
              return (
                <button
                  key={r.id}
                  onClick={() => setGroupSel(on ? null : { kind: 'role', key: r.name })}
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[14px] transition"
                  style={
                    on
                      ? { borderColor: `${r.color}aa`, background: `color-mix(in srgb, ${r.color} 16%, transparent)`, color: r.color }
                      : { borderColor: 'var(--color-edge)', color: 'var(--color-ink-2)' }
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
                  {r.name}
                  <span className="font-mono text-[11.5px] opacity-70">{roleCounts.get(r.name) ?? 0}</span>
                </button>
              )
            })}
          </div>
          <div className="tag-chip mt-3.5 text-ink-3">HIGHLIGHT · 比赛</div>
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
            {sortedContests.map((c) => {
              const on = groupSel?.kind === 'contest' && groupSel.key === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setGroupSel(on ? null : { kind: 'contest', key: c.id })}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[14px] transition"
                  style={
                    on
                      ? { borderColor: `${c.color}aa`, background: `color-mix(in srgb, ${c.color} 12%, transparent)` }
                      : { borderColor: 'transparent' }
                  }
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{c.short}</span>
                  <span className="font-mono text-[11.5px] text-ink-3">{c.participantIds.length}人</span>
                </button>
              )
            })}
          </div>
        </Panel>

        {/* focus panel */}
        <Panel className="grid-tex h-fit max-h-full overflow-y-auto p-5">
          {focus ? (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full"
                  style={{ background: focus.color, boxShadow: `0 0 14px ${focus.color}` }}
                />
                <div>
                  <div className="font-display text-[16px] font-semibold">{focus.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <RoleBadges roles={focus.roles} />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="tag-chip mb-2 text-ink-3">CONNECTED · {neighbors.get(focus.id)?.size ?? 0}</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...(neighbors.get(focus.id) ?? [])].map((id) => {
                    const m = memberById(id)
                    return (
                      <button
                        key={id}
                        onClick={() => setFocusId(id)}
                        className="flex items-center gap-1.5 rounded-full border border-edge bg-panel-2/60 px-2 py-0.5 text-[12.5px] transition hover:border-edge-2"
                      >
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="mt-4">
                <div className="tag-chip mb-2 text-ink-3">CONTESTS · {focusContests.length}</div>
                <div className="flex flex-col gap-1.5">
                  {focusContests.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-[14px]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                      <span className="flex-1 truncate">{c.short}</span>
                      <span className="font-mono text-[11.5px] text-ink-3">{c.start.slice(5)}</span>
                    </div>
                  ))}
                  {focusContests.length === 0 && <div className="text-[14px] text-ink-3">暂无比赛</div>}
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="font-display text-[15px] font-medium text-ink-2">点击任意节点</div>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
                查看该成员的关系网络与参赛记录；
                <br />
                悬停可高亮其直接连接。
              </p>
            </div>
          )}
        </Panel>
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onClick, color, label }: { on: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13.5px] transition ${
        on ? 'border-transparent text-ink' : 'border-edge text-ink-3 hover:text-ink-2'
      }`}
      style={on ? { background: `color-mix(in srgb, ${color} 14%, transparent)`, boxShadow: `inset 0 0 0 1px ${color}55`, color } : {}}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? color : '#5b6b84' }} />
      {label}
    </button>
  )
}
