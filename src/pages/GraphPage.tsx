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
  const wrapRef = useRef<HTMLDivElement>(null)
  const [showRole, setShowRole] = useState(true)
  const [showContest, setShowContest] = useState(true)
  const { members, contests, roles, roleLinks, memberById } = useData()
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [groupSel, setGroupSel] = useState<GroupSel>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })
  const nodePositionsRef = useRef(new Map<string, { x?: number; y?: number; fx?: number; fy?: number }>())

  useEffect(() => {
    return () => nodePositionsRef.current.clear()
  }, [])

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
    const n = members.length
    // 环形初值，落在默认视口中心附近，避免从屏幕外飞入
    const radius = n <= 1 ? 0 : 50 + Math.sqrt(n) * 32
    return members.map((m, i) => {
      const angle = (2 * Math.PI * i) / Math.max(n, 1) - Math.PI / 2
      const saved = nodePositionsRef.current.get(m.id)
      const base = {
        id: m.id,
        member: m,
        degree: deg.get(m.id) ?? 0,
      }
      if (saved?.x != null && saved?.y != null && isFinite(saved.x) && isFinite(saved.y)) {
        return { ...base, x: saved.x, y: saved.y, fx: saved.fx, fy: saved.fy }
      }
      return {
        ...base,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      }
    })
  }, [links, members])

  // 关键：graphData 对象必须保持引用稳定。
  // force-graph 的 graphData setter 每次被调用都会 warmup + 重启引擎，
  // 若内联传新对象，任何重渲染（如悬停）都会让全图重新模拟、节点乱跳。
  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])

  /** 适应视图；缩放加上限，防止包围盒过小时 zoomToFit 把节点拉到失真 */
  const fitView = useCallback((ms = 0) => {
    const fg = fgRef.current
    const { w, h } = canvasSize
    if (!fg || members.length === 0 || w < 40 || h < 40) return
    fg.zoomToFit(ms, 48)
    const z = fg.zoom()
    if (z > 2.5) fg.zoom(2.5, ms)
    const zNow = fg.zoom()
    const c = fg.centerAt()
    fg.centerAt(c.x + 28 / zNow, c.y + 18 / zNow, ms)
  }, [canvasSize.w, canvasSize.h, members.length])

  // 力场调参：强斥力 + 碰撞半径（给标签留空）。
  // 必须在图实例挂载的 callback ref 里应用——图是条件渲染的（等容器尺寸），
  // 若改用 effect + fgRef 读取，SPA 导航时 effect 首次执行于挂载前，之后
  // links 引用稳定不再重跑，调参会静默丢失，力场退回 d3 默认值、布局挤作一团。
  const initForces = useCallback((fg: ForceGraphMethods | undefined) => {
    fgRef.current = fg
    if (!fg) return
    fg.d3Force('charge')?.strength(-700)
    ;(fg.d3Force('link') as any)?.distance((l: any) => (l.kind === 'role' ? 115 : 160))
    fg.d3Force(
      'collide',
      forceCollide((n: any) => 34 + Math.min((n as GNode).degree, 8) * 1.5).strength(1),
    )
  }, [])

  // 数据就绪后按包围盒适配一次视图（warmup 在挂载后约两帧完成）。
  // 不做的话只能落到 force-graph 内置的固定缩放 4/cbrt(n)，与节点分布无关。
  const didAutoFit = useRef(false)
  useEffect(() => {
    if (didAutoFit.current) return
    if (canvasSize.w < 40 || canvasSize.h < 40 || nodes.length === 0) return
    didAutoFit.current = true
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => fitView(0))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [canvasSize.w, canvasSize.h, nodes.length, fitView])

  // 按容器真实尺寸驱动画布
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => {
      const w = Math.max(0, Math.floor(el.clientWidth))
      const h = Math.max(0, Math.floor(el.clientHeight))
      setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
      const k = Math.max(globalScale, 0.08)
      const dim = isDim(n.id)
      const isAnchor = (hoverId ?? focusId) === n.id
      const inGroup = groupMembers?.has(n.id) ?? false
      const r = 2.8 + Math.min(n.degree, 8) * 0.5 + (isAnchor ? 0.9 : 0) + (inGroup && !dim ? 0.5 : 0)

      ctx.save()
      ctx.globalAlpha = dim ? 0.18 : 1

      const glowR = r * 1.25
      const grad = ctx.createRadialGradient(n.x!, n.y!, r * 0.3, n.x!, n.y!, glowR)
      grad.addColorStop(0, m.color + '40')
      grad.addColorStop(1, 'transparent')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, glowR, 0, Math.PI * 2)
      ctx.fill()

      // body
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2)
      ctx.fillStyle = m.color + '22'
      ctx.fill()
      ctx.lineWidth = (isAnchor ? 1.4 : inGroup && !dim ? 1.2 : 0.8) / k
      ctx.strokeStyle = m.color
      ctx.stroke()

      // inner core
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, r * 0.38, 0, Math.PI * 2)
      ctx.fillStyle = m.color
      ctx.fill()

      // label：屏幕像素恒定字号，避免缩放后圈/字比例失调
      const showLabel = k > 0.85 || isAnchor || (!dim && hoverId != null)
      if (showLabel) {
        const fontSize = 10.5 / k
        ctx.font = `${isAnchor ? 600 : 400} ${fontSize}px "Noto Sans SC", sans-serif`
        const tw = ctx.measureText(m.name).width
        const padX = 4.5 / k + 2.5
        const padY = 2 / k + 1.2
        const lx = n.x! - tw / 2 - padX
        const ly = n.y! + r + 2.5
        ctx.fillStyle = dim ? 'rgba(7,11,18,0.35)' : 'rgba(7,11,18,0.78)'
        ctx.beginPath()
        ctx.roundRect(lx, ly, tw + padX * 2, fontSize + padY * 2, 4 / k + 2)
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

  const paintNodePointerArea = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GNode
      if (n.x == null || n.y == null || !isFinite(n.x) || !isFinite(n.y)) return
      const k = Math.max(globalScale, 0.08)
      const r = 2.8 + Math.min(n.degree, 8) * 0.5 + 8 / k
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
      ctx.fill()
    },
    [],
  )

  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const l = link as GLink & { source: GNode; target: GNode }
      const s = l.source as any
      const t = l.target as any
      if (s.x == null || t.x == null || !isFinite(s.x) || !isFinite(t.x)) return
      const k = Math.max(globalScale, 0.08)
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
      ctx.lineWidth = (active ? 1.6 : 0.8) / k
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
    <div className="mx-auto flex h-full min-h-0 max-w-[1400px] flex-col px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle title="人物关系图谱" />
        <div className="flex items-center gap-2">
          <Toggle on={showRole} onClick={() => setShowRole(!showRole)} color="#a78bfa" label="职务关系" />
          <Toggle on={showContest} onClick={() => setShowContest(!showContest)} color="#22d3ee" label="同队队友" />
          <button
            onClick={() => fitView(400)}
            className="rounded-lg border border-edge px-3 py-1.5 text-[13.5px] text-ink-2 transition hover:bg-panel-2 hover:text-ink"
          >
            适应视图
          </button>
        </div>
      </div>

      {/* xl 下用 minmax(0,1fr) 钉住行高，否则右列内容会把行撑高、图区溢出视口 */}
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-4 xl:grid-rows-[minmax(0,1fr)]">
        <div
          ref={wrapRef}
          className="graph-wrap panel relative min-h-[320px] w-full overflow-hidden sm:min-h-[480px] xl:col-span-3 xl:min-h-0 xl:h-full"
        >
          {canvasSize.w > 0 && canvasSize.h > 0 && (
          <ForceGraph2D
            ref={initForces as any}
            width={canvasSize.w}
            height={canvasSize.h}
            graphData={graphData as any}
            backgroundColor="rgba(0,0,0,0)"
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            nodePointerAreaPaint={paintNodePointerArea}
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => 'replace'}
            nodeRelSize={1}
            enableNodeDrag
            onNodeHover={(n: any) => setHoverId(n?.id ?? null)}
            onNodeClick={(n: any) => setFocusId(n.id === focusId ? null : n.id)}
            onBackgroundClick={() => setFocusId(null)}
            // 拖拽结束不写 fx/fy：保留库默认的松手释放行为，
            // 节点重新参与力布局（之前覆写 onNodeDragEnd 钉住节点导致“失去斥力”）
            warmupTicks={100}
            cooldownTime={4000}
            d3AlphaDecay={0.04}
            d3VelocityDecay={0.35}
            onEngineStop={() => {
              graphData.nodes.forEach((n) => {
                if (n.x != null && n.y != null) {
                  nodePositionsRef.current.set(n.id, {
                    x: n.x,
                    y: n.y,
                    fx: (n as any).fx,
                    fy: (n as any).fy,
                  })
                }
              })
            }}
          />
          )}
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

        <div className="flex max-h-full min-h-0 flex-col gap-4 overflow-hidden">
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
        <Panel className="grid-tex min-h-0 flex-1 overflow-y-auto p-5">
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
