import { useEffect, type ReactNode } from 'react'

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`panel rise-in grid-tex relative max-h-[88vh] w-full overflow-y-auto p-6 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-[16px] font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition hover:bg-panel-2 hover:text-ink"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[12px] text-ink-3">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-lg border border-edge bg-panel-2/60 px-3 py-2 text-[14px] text-ink placeholder:text-ink-3 focus:border-neon/50 focus:outline-none focus:ring-1 focus:ring-neon/30'

export function FormActions({
  saving,
  onCancel,
  submitLabel = '保存',
}: {
  saving: boolean
  onCancel: () => void
  submitLabel?: string
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-edge px-4 py-2 text-[14px] text-ink-2 transition hover:bg-panel-2"
      >
        取消
      </button>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-neon/15 px-4 py-2 text-[14px] font-medium text-neon ring-1 ring-inset ring-neon/40 transition hover:bg-neon/25 disabled:opacity-50"
      >
        {saving ? '保存中…' : submitLabel}
      </button>
    </div>
  )
}
