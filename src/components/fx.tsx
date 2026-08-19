import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'

/* ---------- CountUp：数字滚动（ReactBits 风格） ---------- */
export function CountUp({ to, duration = 1100, className = '' }: { to: number; duration?: number; className?: string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(to * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, duration])
  return <span className={className}>{val}</span>
}

/* ---------- DecryptedText：字符乱码后解码（ReactBits 风格） ---------- */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#01█▓▒░ΞΦΨΩ'

export function DecryptedText({
  text,
  className = '',
  speed = 28,
  replayOnHover = true,
}: {
  text: string
  className?: string
  speed?: number
  replayOnHover?: boolean
}) {
  const [display, setDisplay] = useState(text)
  const timer = useRef<number | null>(null)

  const play = () => {
    if (timer.current) window.clearInterval(timer.current)
    let frame = 0
    const total = text.length
    timer.current = window.setInterval(() => {
      frame++
      const settled = Math.floor(frame * 0.8)
      const out = text
        .split('')
        .map((ch, i) => {
          if (ch === ' ' || ch === '，') return ch
          if (i < settled) return ch
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        })
        .join('')
      setDisplay(out)
      if (settled >= total && timer.current) {
        window.clearInterval(timer.current)
        timer.current = null
        setDisplay(text)
      }
    }, speed)
  }

  useEffect(() => {
    play()
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <span className={className} onMouseEnter={replayOnHover ? play : undefined}>
      {display}
    </span>
  )
}

/* ---------- Spotlight：鼠标聚光灯卡片（Aceternity 风格） ---------- */
export function Spotlight({
  children,
  className = '',
  color = 'rgba(34,211,238,0.10)',
}: {
  children: ReactNode
  className?: string
  color?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: -400, y: -400 })
  const [on, setOn] = useState(false)

  return (
    <div
      ref={ref}
      className={`group/spot relative overflow-hidden ${className}`}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: on ? 1 : 0,
          background: `radial-gradient(320px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 65%)`,
        }}
      />
      {children}
    </div>
  )
}

/* ---------- Meteors：流星雨背景（Aceternity 风格） ---------- */
export function Meteors({ count = 14, className = '' }: { count?: number; className?: string }) {
  const meteors = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 6,
        duration: 3 + Math.random() * 5,
        size: Math.random() < 0.3 ? 2 : 1,
        key: i,
      })),
    [count],
  )
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {meteors.map((m) => (
        <span
          key={m.key}
          className="meteor"
          style={
            {
              left: `${m.left}%`,
              animationDelay: `${m.delay}s`,
              animationDuration: `${m.duration}s`,
              '--meteor-size': `${m.size}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/* ---------- ProgressRing：SVG 环形进度（uiverse 风格） ---------- */
export function ProgressRing({
  value,
  max,
  size = 44,
  stroke = 4,
  color = '#22d3ee',
  children,
}: {
  value: number
  max: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max === 0 ? 0 : Math.min(1, value / max)
  const [anim, setAnim] = useState(0)
  useEffect(() => {
    const t = window.setTimeout(() => setAnim(pct), 60)
    return () => window.clearTimeout(t)
  }, [pct])
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-edge)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - anim)}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)', filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

/* ---------- LiveCountdown：秒级实时倒计时 ---------- */
export function LiveCountdown({ to, className = '', compact = false }: { to: Date; className?: string; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const ms = Math.max(0, to.getTime() - now)
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')

  if (compact) {
    return (
      <span className={`whitespace-nowrap font-mono tabular-nums ${className}`}>
        {d > 0 && <b className="font-semibold">{d}d </b>}
        <b className="font-semibold">
          {pad(h)}:{pad(m)}:{pad(s)}
        </b>
      </span>
    )
  }

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {d > 0 && (
        <>
          <b className="font-semibold">{d}</b>
          <span className="mx-0.5 text-[0.72em] opacity-60">天</span>
        </>
      )}
      <b className="font-semibold">{pad(h)}</b>
      <span className="mx-0.5 animate-pulse opacity-60">:</span>
      <b className="font-semibold">{pad(m)}</b>
      <span className="mx-0.5 animate-pulse opacity-60">:</span>
      <b className="font-semibold">{pad(s)}</b>
    </span>
  )
}

/* ---------- BorderBeam：已移除（直角积光效果不佳） ---------- */
