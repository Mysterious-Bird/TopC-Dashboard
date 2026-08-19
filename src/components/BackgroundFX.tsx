import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hue: 'cyan' | 'violet'
  tw: number // twinkle phase
}

const CYAN = '34,211,238'
const VIOLET = '167,139,250'

/**
 * 全局动态背景：
 *  - 点阵（ReactBits DotGrid 风格）：靠近鼠标的点被点亮
 *  - 缓慢漂移的星尘粒子
 *  - 两层极光渐变由 .bg-scene 的 CSS radial-gradient 提供
 */
export default function BackgroundFX() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let w = 0
    let h = 0
    let particles: Particle[] = []
    const DPR = Math.min(2, window.devicePixelRatio || 1)
    const GAP = 34

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * DPR
      canvas.height = h * DPR
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      const count = Math.min(90, Math.floor((w * h) / 26000))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 0.6 + Math.random() * 1.4,
        hue: Math.random() < 0.6 ? 'cyan' : 'violet',
        tw: Math.random() * Math.PI * 2,
      }))
    }

    const onMove = (e: PointerEvent) => {
      mouse.current.x = e.clientX
      mouse.current.y = e.clientY
    }
    const onLeave = () => {
      mouse.current.x = -9999
      mouse.current.y = -9999
    }

    let t = 0
    const draw = () => {
      t += 0.016
      ctx.clearRect(0, 0, w, h)

      // --- dot grid ---
      const mx = mouse.current.x
      const my = mouse.current.y
      const R = 170
      for (let gx = GAP / 2; gx < w; gx += GAP) {
        for (let gy = GAP / 2; gy < h; gy += GAP) {
          const dx = gx - mx
          const dy = gy - my
          const dist = Math.hypot(dx, dy)
          let alpha = 0.05
          let size = 1
          if (dist < R) {
            const k = 1 - dist / R
            alpha += k * 0.5
            size += k * 1.1
          }
          ctx.fillStyle = `rgba(${CYAN},${alpha})`
          ctx.beginPath()
          ctx.arc(gx, gy, size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // --- drifting particles ---
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.tw += 0.02
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10
        const twinkle = 0.35 + 0.3 * Math.sin(p.tw)
        const col = p.hue === 'cyan' ? CYAN : VIOLET
        ctx.fillStyle = `rgba(${col},${twinkle})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        // tiny glow
        ctx.fillStyle = `rgba(${col},${twinkle * 0.15})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    resize()
    if (reduced) {
      draw()
      cancelAnimationFrame(raf) // 画一帧静态即可
    } else {
      draw()
    }

    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
    />
  )
}
