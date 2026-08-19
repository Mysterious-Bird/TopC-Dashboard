import { useState } from 'react'
import { useData } from '../data/DataContext'
import Modal, { Field, FormActions, inputCls } from './Modal'

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useData()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(password)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="管理员登录" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-3">
          访客可浏览全部内容；新增 / 编辑 / 删除成员、职位与比赛需要管理员权限。
        </p>
        <Field label="管理密码">
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="输入管理员密码"
          />
        </Field>
        {error && <p className="mt-2 text-[12px] text-rose">{error}</p>}
        <FormActions saving={busy} onCancel={onClose} submitLabel="登录" />
      </form>
    </Modal>
  )
}
