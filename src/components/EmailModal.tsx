import { useState } from 'react'
import type { Member } from '../data/mock'
import { sendMemberEmail } from '../api'
import Modal, { Field, FormActions, inputCls } from './Modal'

export default function EmailModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [subject, setSubject] = useState('[TopC] ')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await sendMemberEmail(member.id, subject, body)
      alert(r.mocked ? `已进入模拟发送模式（未配置 SMTP）：日志可见，未真实投递到 ${member.email}` : `已发送至 ${member.email}`)
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : '发送失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`发送邮件 · ${member.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-4 text-[12.5px] text-ink-3">
          收件人：<span className="font-mono text-ink-2">{member.email || '未填写邮箱'}</span>
        </p>
        <Field label="主题">
          <input required value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
        </Field>
        <Field label="正文" className="mt-3.5">
          <textarea required rows={6} value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} placeholder="邮件正文…" />
        </Field>
        <FormActions saving={busy} onCancel={onClose} submitLabel="发送" />
      </form>
    </Modal>
  )
}
