import { useState } from 'react'
import { type Member } from '../data/mock'
import { gradeFromEnrollYear } from '../data/grade'
import { useData } from '../data/DataContext'
import { saveMember } from '../api'
import Modal, { Field, FormActions, inputCls } from './Modal'

const PALETTE = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#38bdf8', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#2dd4bf', '#e879f9', '#93c5fd']

export default function MemberForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Member
  onClose: () => void
  onSaved: () => void
}) {
  const { roles } = useData()
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({
    name: initial?.name ?? '',
    gender: initial?.gender ?? '男',
    roles: initial?.roles ?? ([] as string[]),
    phone: initial?.phone ?? '',
    qq: initial?.qq ?? '',
    email: initial?.email ?? '',
    enrollYear: initial?.enrollYear != null ? String(initial.enrollYear) : String(new Date().getFullYear()),
    major: initial?.major ?? '',
    studentId: initial?.studentId ?? '',
    tags: (initial?.tags ?? []).join(', '),
    joinedAt: initial?.joinedAt ?? '',
    color: initial?.color ?? PALETTE[0],
  })

  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }))
  const toggleRole = (name: string) =>
    setF((p) => ({ ...p, roles: p.roles.includes(name) ? p.roles.filter((x) => x !== name) : [...p.roles, name] }))

  const enrollYearNum = f.enrollYear.trim() ? Number(f.enrollYear) : null
  const previewGrade =
    enrollYearNum != null && Number.isFinite(enrollYearNum) ? gradeFromEnrollYear(enrollYearNum) : ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const year = f.enrollYear.trim() ? Number(f.enrollYear) : null
      if (year != null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
        alert('入学年份请填写 2000–2100 的整数')
        return
      }
      await saveMember(
        {
          name: f.name,
          gender: f.gender as Member['gender'],
          roles: f.roles,
          phone: f.phone,
          qq: f.qq,
          email: f.email,
          enrollYear: year,
          major: f.major,
          studentId: f.studentId,
          tags: f.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
          joinedAt: f.joinedAt,
          color: f.color,
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

  return (
    <Modal title={initial ? `编辑成员 · ${initial.name}` : '添加成员'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="姓名 *">
            <input required value={f.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
          </Field>
          <Field label="性别">
            <select value={f.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
              <option>男</option>
              <option>女</option>
            </select>
          </Field>
          <Field label={`职位（可多选，已选 ${f.roles.length} 个）`} className="col-span-2">
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-edge bg-panel-2/40 p-2.5">
              {roles.map((r) => {
                const on = f.roles.includes(r.name)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRole(r.name)}
                    className={`rounded-full border px-2.5 py-1 text-[14px] transition ${on ? 'text-ink' : 'text-ink-2 hover:border-edge-2'}`}
                    style={
                      on
                        ? { borderColor: `${r.color}88`, background: `color-mix(in srgb, ${r.color} 14%, transparent)` }
                        : { borderColor: 'var(--color-edge)' }
                    }
                  >
                    {r.name}
                  </button>
                )
              })}
              {roles.length === 0 && <span className="text-[14px] text-ink-3">暂无职位，请先在「职位管理」中创建</span>}
            </div>
            <p className="mt-1 text-[14px] text-ink-3">关系图谱的职务连线由职位管理规则自动推导，无需手动指定上级</p>
          </Field>
          <Field label="电话">
            <input value={f.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
          </Field>
          <Field label="QQ">
            <input value={f.qq} onChange={(e) => set('qq', e.target.value)} className={inputCls} />
          </Field>
          <Field label="邮箱（用于赛前提醒）" className="col-span-2">
            <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
          </Field>
          <Field label="入学年份">
            <div className="flex items-center gap-2">
              <input
                required
                type="number"
                min={2000}
                max={2100}
                value={f.enrollYear}
                onChange={(e) => set('enrollYear', e.target.value)}
                className={inputCls}
                placeholder="如 2025"
              />
              {previewGrade && (
                <span className="shrink-0 text-[12px] text-ink-3 whitespace-nowrap">→ {previewGrade}</span>
              )}
            </div>
          </Field>
          <Field label="专业">
            <input value={f.major} onChange={(e) => set('major', e.target.value)} className={inputCls} />
          </Field>
          <Field label="学号">
            <input value={f.studentId} onChange={(e) => set('studentId', e.target.value)} className={inputCls} />
          </Field>
          <Field label="入社时间">
            <input type="date" value={f.joinedAt} onChange={(e) => set('joinedAt', e.target.value)} className={inputCls} />
          </Field>
          <Field label="技术栈（逗号分隔）" className="col-span-2">
            <input value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="如：React, Go, 图论" className={inputCls} />
          </Field>
          <Field label="标识色" className="col-span-2">
            <div className="flex flex-wrap gap-2 pt-1">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    background: c,
                    boxShadow: f.color === c ? `0 0 0 2px var(--color-abyss), 0 0 0 4px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          </Field>
        </div>
        <FormActions saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
