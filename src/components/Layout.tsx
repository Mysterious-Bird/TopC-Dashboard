import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { daysUntil, contestStatus } from '../data/mock'
import { useData } from '../data/DataContext'
import { LiveCountdown } from './fx'
import BackgroundFX from './BackgroundFX'
import LoginModal from './LoginModal'

const NAV = [
  { to: '/', label: '总览', icon: IconDash, end: true },
  { to: '/members', label: '成员', icon: IconUsers },
  { to: '/contests', label: '比赛', icon: IconTrophy },
  { to: '/teams', label: '参赛', icon: IconGrid },
  { to: '/graph', label: '关系图谱', icon: IconGraph },
  { to: '/reminders', label: '提醒', icon: IconBell },
  { to: '/awards', label: '荣誉', icon: IconMedal },
  { to: '/mcp', label: 'MCP', icon: IconKey, adminOnly: true },
]

const TITLES: Record<string, string> = {
  '/': '总览',
  '/members': '成员管理',
  '/contests': '比赛安排',
  '/teams': '参赛视图',
  '/graph': '人物关系图谱',
  '/reminders': '提醒中心',
  '/awards': '荣誉殿堂',
  '/mcp': 'MCP 服务',
}

export default function Layout() {
  const { pathname } = useLocation()
  const { contests, authed, logout } = useData()
  const [showLogin, setShowLogin] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!navOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [navOpen])

  const next = useMemo(() => {
    const upcoming = contests.filter((c) => contestStatus(c) === '未开始').sort(
      (a, b) => daysUntil(a.start) - daysUntil(b.start),
    )
    return upcoming[0]
  }, [contests])

  const sidebar = (
    <>
      <div className="flex items-center gap-3 px-5 pb-5 pt-5 md:pb-6 md:pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge-2 bg-panel-2 font-display text-sm font-bold tracking-tight">
          <span className="bg-gradient-to-br from-neon to-violet bg-clip-text text-transparent">T/</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[15px] font-semibold leading-tight tracking-tight">TopC</div>
          <div className="tag-chip text-ink-3">CLUB CONSOLE</div>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge text-ink-3 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-label="关闭菜单"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-col gap-1 overflow-y-auto px-3 pb-3">
        {NAV.filter((n) => !('adminOnly' in n && n.adminOnly) || authed).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `nav-item flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors ${
                isActive ? 'active bg-panel-2 text-ink' : 'text-ink-2 hover:bg-panel-2/60 hover:text-ink'
              }`
            }
          >
            <n.icon className="h-[17px] w-[17px] shrink-0" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-4 pb-5 pt-2" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        {next && (
          <div className="panel grid-tex breathe p-3.5">
            <div className="tag-chip text-ink-3">NEXT UP</div>
            <div className="mt-1.5 text-[14px] font-medium leading-snug">{next.short}</div>
            <div className="mt-2 text-[14px] text-neon">
              <LiveCountdown to={new Date(next.start + 'T09:00:00')} compact />
            </div>
            <div className="mt-1 text-[11.5px] text-ink-3">
              {daysUntil(next.start)} 天后开赛 · 提醒已排期
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="bg-scene relative flex h-dvh max-h-dvh overflow-hidden">
      <BackgroundFX />

      {/* 移动端遮罩 */}
      {navOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-abyss/70 backdrop-blur-sm md:hidden"
          aria-label="关闭菜单"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* sidebar：桌面常驻；手机抽屉 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(280px,86vw)] flex-col border-r border-edge bg-panel/95 backdrop-blur-md transition-transform duration-200 ease-out md:relative md:z-10 md:w-[212px] md:translate-x-0 md:bg-panel/60 md:backdrop-blur ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {sidebar}
      </aside>

      {/* main */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-edge bg-abyss/40 px-3 backdrop-blur-sm sm:h-[57px] sm:px-6"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-edge bg-panel text-ink-2 md:hidden"
              onClick={() => setNavOpen(true)}
              aria-label="打开菜单"
            >
              <IconMenu className="h-4 w-4" />
            </button>
            <span className="hidden font-mono text-[12px] text-ink-3 sm:inline">topc://</span>
            <span className="truncate text-[14px] text-ink-2 sm:text-[15px]">{TITLES[pathname] ?? ''}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                if (authed) {
                  if (window.confirm('退出管理员登录？退出后回到只读访客模式。')) logout()
                } else {
                  setShowLogin(true)
                }
              }}
              title={authed ? '已登录 · 点击退出管理员模式' : '管理员登录'}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                authed
                  ? 'border-neon/50 bg-neon/12 text-neon shadow-[0_0_12px_-4px_var(--color-neon)]'
                  : 'border-edge bg-panel text-ink-3 hover:border-edge-2 hover:text-ink-2'
              }`}
            >
              {authed ? <IconUnlock className="h-4 w-4" /> : <IconLock className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}

function IconMenu({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}
function IconClose({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
function IconDash({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}
function IconUsers({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S13.9 16 14.5 19" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16.5 14.6c2.1.3 3.5 1.7 4 4.4" />
    </svg>
  )
}
function IconTrophy({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4.5a2.5 2.5 0 0 0 2.6 4.5M17 5h2.5a2.5 2.5 0 0 1-2.6 4.5" />
      <path d="M12 14v3M8.5 20h7M10 17h4" />
    </svg>
  )
}
function IconGrid({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M8.2 6h7.6M8.2 18h7.6M6 8.2v7.6M18 8.2v7.6" />
    </svg>
  )
}
function IconGraph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5" cy="18" r="2.2" />
      <circle cx="19" cy="18" r="2.2" />
      <circle cx="12" cy="13" r="1.6" />
      <path d="M12 7.2v4.2M10.9 14.2l-4 2.6M13.1 14.2l4 2.6" />
    </svg>
  )
}
function IconBell({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
      <path d="M10 19a2.2 2.2 0 0 0 4 0" />
    </svg>
  )
}
function IconMedal({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M9 3h6l-2 6h-2L9 3Z" />
      <path d="M8.5 9 5 4.5M15.5 9 19 4.5" />
      <circle cx="12" cy="15.5" r="5" />
      <path d="M10 15.4l1.5 1.5 2.5-3" />
    </svg>
  )
}
function IconKey({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="8" cy="15.5" r="4" />
      <path d="M11 12.5 20 3.5M16 7.5l3 3M13 10.5l2.2 2.2" />
    </svg>
  )
}
function IconLock({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
function IconUnlock({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 7.8-1.3" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
