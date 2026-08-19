import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CONTESTS, MEMBERS, ROLES, deriveRoleLinks, type Contest, type Member, type RoleDef } from './mock'
import { fetchLiveData } from '../api'
import { apiLogin, getToken, setToken } from '../auth'

interface DataValue {
  members: Member[]
  contests: Contest[]
  roles: RoleDef[]
  roleLinks: [string, string][]
  live: boolean // true = 数据来自后端 API
  authed: boolean // true = 已管理员登录（可写）
  login: (password: string) => Promise<void>
  logout: () => void
  memberById: (id: string) => Member
  refresh: () => void
}

const DataContext = createContext<DataValue>(null as unknown as DataValue)

const MOCK_ROLE_LINKS = deriveRoleLinks(MEMBERS, ROLES)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState({
    members: MEMBERS,
    contests: CONTESTS,
    roles: ROLES,
    roleLinks: MOCK_ROLE_LINKS,
    live: false,
  })

  const load = useCallback(() => {
    fetchLiveData()
      .then((d) => setData({ ...d, live: true }))
      .catch(() => {
        // API 不可用 → 保持 mock，demo 不受影响
      })
  }, [])

  useEffect(load, [load])

  const [authed, setAuthed] = useState(() => !!getToken())

  useEffect(() => {
    const onExpire = () => setAuthed(false)
    window.addEventListener('topc-unauthorized', onExpire)
    return () => window.removeEventListener('topc-unauthorized', onExpire)
  }, [])

  const login = useCallback(async (password: string) => {
    await apiLogin(password)
    setAuthed(true)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setAuthed(false)
  }, [])

  const memberById = useCallback(
    (id: string) => {
      const m = data.members.find((x) => x.id === id)
      if (!m) throw new Error(`member not found: ${id}`)
      return m
    },
    [data.members],
  )

  const value = useMemo<DataValue>(
    () => ({ ...data, authed, login, logout, memberById, refresh: load }),
    [data, authed, login, logout, memberById, load],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
