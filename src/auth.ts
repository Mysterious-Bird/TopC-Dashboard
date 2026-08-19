/* 管理员登录态：token 存 localStorage，写操作经 api.ts 自动附带 */

const KEY = 'topc_admin_token'

export const getToken = (): string | null => localStorage.getItem(KEY)

export function setToken(token: string | null) {
  if (token) localStorage.setItem(KEY, token)
  else localStorage.removeItem(KEY)
}

/** 登录成功返回 true；密码错误抛错 */
export async function apiLogin(password: string): Promise<void> {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!r.ok) {
    let detail = '登录失败'
    try {
      detail = (await r.json()).detail ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(r.status === 401 ? '密码错误' : detail)
  }
  const { token } = await r.json()
  setToken(token)
}

/** token 被后端拒绝（401）时广播，DataContext 监听后自动退回访客态 */
export function notifyUnauthorized() {
  setToken(null)
  window.dispatchEvent(new Event('topc-unauthorized'))
}
