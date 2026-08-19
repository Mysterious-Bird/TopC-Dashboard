import { useState } from 'react'
import type { RoleDef } from '../data/mock'
import { useData } from '../data/DataContext'
import { deleteRole, saveRole } from '../api'
import Modal, { Field, FormActions, inputCls } from './Modal'

const PALETTE = ['#22d3ee', '#a78bfa', '#f87171', '#38bdf8', '#f472b6', '#34d399', '#fbbf24', '#c084fc', '#fb923c', '#4ade80', '#e879f9', '#93c5fd', '#facc15', '#2dd4bf']

function describe(r: RoleDef): string {
  if (r.managesAll) {
    const ex = r.excludes.length ? `（排除：${r.excludes.join('、')}）` : ''
    return `管理全社成员${ex}`
  }
  if (r.manages.length) return `管理：${r.manages.join('、')}`
  return '普通职位，无管理权限'
}

export default function RoleManager({ onClose }: { onClose: () => void }) {
  const { roles, refresh } = useData()
  const [editing, setEditing] = useState<RoleDef | 'new' | null>(null)

  const remove = async (r: RoleDef) => {
    if (!window.confirm(`确定删除职位「${r.name}」吗？${r.memberCount ?? 0} 名成员的该职位将被移除。`)) return
    await deleteRole(r.id)
    refresh()
  }

  return (
    <Modal title="职位管理 · 管理规则驱动关系图谱" onClose={onClose} wide>
      {editing === null ? (
        <>
          <div className="flex flex-col gap-2">
            {roles.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-edge bg-panel-2/40 px-3.5 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium">{r.name}</span>
                    <span className="tag-chip text-ink-3">{r.memberCount ?? 0} 人</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-ink-3">{describe(r)}</div>
                </div>
                <button
                  onClick={() => setEditing(r)}
                  className="rounded-md bg-panel-2 px-2.5 py-1 text-[14px] ring-1 ring-inset ring-edge transition hover:ring-edge-2"
                >
                  编辑
                </button>
                <button
                  onClick={() => remove(r)}
                  className="rounded-md px-2.5 py-1 text-[14px] text-rose ring-1 ring-inset ring-rose/30 transition hover:bg-rose/10"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setEditing('new')}
            className="mt-4 w-full rounded-lg border border-dashed border-edge-2 py-2.5 text-[14px] text-ink-2 transition hover:border-neon/40 hover:text-neon"
          >
            + 新增职位
          </button>
        </>
      ) : (
        <RoleForm
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh()
            setEditing(null)
          }}
        />
      )}
    </Modal>
  )
}

function RoleForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: RoleDef
  onClose: () => void
  onSaved: () => void
}) {
  const { roles } = useData()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    name: initial?.name ?? '',
    sort: initial?.sort ?? 50,
    color: initial?.color ?? PALETTE[(roles.length + 2) % PALETTE.length],
    managesAll: initial?.managesAll ?? false,
    excludes: initial?.excludes ?? ([] as string[]),
    manages: initial?.manages ?? ([] as string[]),
  })

  const others = roles.filter((r) => r.id !== initial?.id)
  const toggleIn = (key: 'excludes' | 'manages', name: string) =>
    setF((p) => ({
      ...p,
      [key]: p[key].includes(name) ? p[key].filter((x) => x !== name) : [...p[key], name],
    }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await saveRole({ ...f, sort: Number(f.sort), manages: f.managesAll ? [] : f.manages }, initial?.id)
      onSaved()
    } catch (err) {
      alert('保存失败：' + String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-3.5">
        <Field label="职位名称 *">
          <input required value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
        </Field>
        <Field label="排序权重（越小越靠前）">
          <input type="number" value={f.sort} onChange={(e) => setF((p) => ({ ...p, sort: Number(e.target.value) }))} className={inputCls} />
        </Field>
        <Field label="标识色" className="col-span-2">
          <div className="flex flex-wrap gap-2 pt-1">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setF((p) => ({ ...p, color: c }))}
                className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                style={{ background: c, boxShadow: f.color === c ? `0 0 0 2px var(--color-abyss), 0 0 0 4px ${c}` : 'none' }}
              />
            ))}
          </div>
        </Field>
        <div className="col-span-2 flex items-center justify-between rounded-lg border border-edge bg-panel-2/40 px-3.5 py-2.5">
          <div>
            <div className="text-[14px]">全局管理职位</div>
            <div className="text-[11.5px] text-ink-3">开启后管理全社成员（如社长），可与下方排除名单组合</div>
          </div>
          <button
            type="button"
            onClick={() => setF((p) => ({ ...p, managesAll: !p.managesAll }))}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${f.managesAll ? 'bg-neon/40' : 'bg-panel-2 ring-1 ring-inset ring-edge'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${f.managesAll ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>
        {f.managesAll ? (
          <Field label="不管理的职位（排除名单）" className="col-span-2">
            <ChipPicker options={others.map((r) => r.name)} selected={f.excludes} onToggle={(n) => toggleIn('excludes', n)} roles={roles} />
          </Field>
        ) : (
          <Field label="管理哪些职位（显式规则，如 AC部部长 → AC部成员）" className="col-span-2">
            <ChipPicker options={others.map((r) => r.name)} selected={f.manages} onToggle={(n) => toggleIn('manages', n)} roles={roles} />
          </Field>
        )}
      </div>
      <FormActions saving={saving} onCancel={onClose} />
    </form>
  )
}

function ChipPicker({
  options,
  selected,
  onToggle,
  roles,
}: {
  options: string[]
  selected: string[]
  onToggle: (name: string) => void
  roles: RoleDef[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-edge bg-panel-2/40 p-2.5">
      {options.map((name) => {
        const on = selected.includes(name)
        const color = roles.find((r) => r.name === name)?.color ?? '#93c5fd'
        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggle(name)}
            className={`rounded-full border px-2.5 py-1 text-[14px] transition ${on ? 'text-ink' : 'text-ink-2 hover:border-edge-2'}`}
            style={
              on
                ? { borderColor: `${color}88`, background: `color-mix(in srgb, ${color} 14%, transparent)` }
                : { borderColor: 'var(--color-edge)' }
            }
          >
            {name}
          </button>
        )
      })}
      {options.length === 0 && <span className="text-[14px] text-ink-3">暂无其他职位可选</span>}
    </div>
  )
}
