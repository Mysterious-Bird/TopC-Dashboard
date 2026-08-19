import { useEffect, useMemo, useState } from 'react'
import { useData } from '../data/DataContext'
import { PageTitle, Panel, Eyebrow } from '../components/ui'
import Modal, { Field, inputCls } from '../components/Modal'
import {
  createApiKey,
  deleteApiKey,
  fetchApiKeys,
  updateApiKey,
  type ApiKeyItem,
} from '../api'

export default function McpPage() {
  const { authed } = useData()
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<(ApiKeyItem & { key: string }) | null>(null)
  const [copied, setCopied] = useState<string>('')

  const endpoint = useMemo(() => `${window.location.origin}/api/mcp/`, [])

  const load = () => {
    if (!authed) return
    fetchApiKeys()
      .then(setKeys)
      .catch(() => setKeys([]))
  }
  useEffect(load, [authed])

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(tag)
    setTimeout(() => setCopied(''), 1600)
  }

  const create = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    try {
      const k = await createApiKey(name.trim())
      setCreated(k)
      setName('')
      load()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const toggle = async (k: ApiKeyItem) => {
    await updateApiKey(k.id, { enabled: !k.enabled })
    load()
  }

  const rename = async (k: ApiKeyItem) => {
    const n = window.prompt('重命名 Key', k.name)
    if (!n || !n.trim() || n.trim() === k.name) return
    await updateApiKey(k.id, { name: n.trim() })
    load()
  }

  const remove = async (k: ApiKeyItem) => {
    if (!window.confirm(`确定删除 Key「${k.name}」吗？使用该 Key 的 MCP 客户端将立即失效。`)) return
    await deleteApiKey(k.id)
    load()
  }

  const configSnippet = JSON.stringify(
    {
      mcpServers: {
        topc: {
          url: endpoint,
          headers: { Authorization: 'Bearer <在此粘贴 API Key>' },
        },
      },
    },
    null,
    2,
  )

  const agentPrompt = buildAgentPrompt(endpoint)
  const agentPromptWithKey = created ? buildAgentPrompt(endpoint, created.key) : null

  if (!authed) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-16 text-center">
        <div className="font-display text-2xl text-ink">MCP 服务</div>
        <p className="mt-2 text-[15px] text-ink-3">请先点击右上角图标登录管理员，再管理 API Key。</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <PageTitle title="MCP 服务" sub="远程 MCP 接入 · 凭 API Key 完成成员 / 职位 / 比赛全量增删改查" />

      {/* 接入信息 */}
      <Panel className="rise-in mt-5 p-5">
        <Eyebrow>Connection</Eyebrow>
        <h2 className="font-display text-[16px] font-semibold">接入信息</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[12px] text-ink-3">MCP 端点（streamable HTTP）</div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-edge bg-abyss/60 px-3 py-2 font-mono text-[13px] text-neon">
                {endpoint}
              </code>
              <button
                onClick={() => copy(endpoint, 'url')}
                className="shrink-0 rounded-lg border border-edge px-3 py-2 text-[13px] text-ink-2 transition hover:bg-panel-2 hover:text-ink"
              >
                {copied === 'url' ? '已复制 ✓' : '复制'}
              </button>
            </div>
            <div className="mt-4 mb-1.5 text-[12px] text-ink-3">支持的操作</div>
            <div className="flex flex-wrap gap-1.5">
              {['成员增删改查', '职位增删改查', '比赛增删改查', '队伍 / 里程碑 / 成绩', '提醒扫描与记录', '单发邮件'].map((t) => (
                <span key={t} className="tag-chip rounded-md border border-neon/25 bg-neon/5 px-2 py-1 text-neon">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[12px] text-ink-3">客户端配置示例</span>
              <button
                onClick={() => copy(configSnippet, 'cfg')}
                className="text-[12px] text-ink-3 transition hover:text-neon"
              >
                {copied === 'cfg' ? '已复制 ✓' : '复制配置'}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-edge bg-abyss/60 p-3 font-mono text-[12px] leading-relaxed text-ink-2">
              {configSnippet}
            </pre>
          </div>
        </div>
      </Panel>

      {/* Agent 一键配置提示词 */}
      <Panel className="rise-in rise-in-2 mt-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Eyebrow>Agent Setup</Eyebrow>
            <h2 className="font-display text-[16px] font-semibold">Agent 一键配置提示词</h2>
            <p className="mt-1 max-w-[56ch] text-[13px] leading-relaxed text-ink-3">
              复制下方提示词，粘贴到你使用的 Agent 对话中，由 Agent 写入 MCP 配置并验证连接。
              创建 Key 后可在弹窗中复制已填入 Key 的完整版本。
            </p>
          </div>
          <button
            onClick={() => copy(agentPrompt, 'prompt')}
            className="shrink-0 rounded-lg bg-violet/15 px-4 py-2 text-[14px] font-medium text-violet ring-1 ring-inset ring-violet/40 transition hover:bg-violet/25"
          >
            {copied === 'prompt' ? '已复制 ✓' : '一键复制提示词'}
          </button>
        </div>
        <pre className="mt-4 max-h-[320px] overflow-auto rounded-lg border border-edge bg-abyss/60 p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
          {agentPrompt}
        </pre>
      </Panel>

      {/* API Keys */}
      <Panel className="rise-in rise-in-2 mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Credentials</Eyebrow>
            <h2 className="font-display text-[16px] font-semibold">API Keys</h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="Key 用途备注，如：本地开发机"
              className={`${inputCls} w-56`}
            />
            <button
              onClick={create}
              disabled={creating || !name.trim()}
              className="shrink-0 rounded-lg bg-neon/15 px-4 py-2 text-[14px] font-medium text-neon ring-1 ring-inset ring-neon/40 transition hover:bg-neon/25 disabled:opacity-50"
            >
              {creating ? '创建中…' : '+ 创建 Key'}
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-edge">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-edge bg-panel-2/40 text-left font-display text-[12.5px] tracking-wider text-ink-3">
                <th className="px-4 py-2.5 font-medium">名称</th>
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">创建于</th>
                <th className="px-4 py-2.5 font-medium">最近使用</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-edge/60 last:border-0">
                  <td className="px-4 py-3">
                    <button onClick={() => rename(k)} className="font-medium transition hover:text-neon" title="点击重命名">
                      {k.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-ink-2">{k.prefix}…•••</td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-ink-3">{k.created_at.replace('T', ' ')}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-ink-3">
                    {k.last_used_at ? k.last_used_at.replace('T', ' ') : '从未使用'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(k)}
                      title={k.enabled ? '点击停用' : '点击启用'}
                      className={`relative h-5 w-9 rounded-full transition ${k.enabled ? 'bg-neon/30' : 'bg-edge'}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full transition-all ${
                          k.enabled ? 'left-[18px] bg-neon shadow-[0_0_8px_var(--color-neon)]' : 'left-0.5 bg-ink-3'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(k)}
                      className="rounded-md px-2.5 py-1 text-[13px] text-rose ring-1 ring-inset ring-rose/30 transition hover:bg-rose/10"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[14px] text-ink-3">
                    还没有 API Key，先在上方创建一个。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-ink-3">
          Key 只存哈希，明文仅在创建时展示一次，请立即复制保存；停用后该 Key 即刻失效。
        </p>
      </Panel>

      {/* 创建成功：一次性展示 */}
      {created && (
        <Modal title="API Key 已创建" onClose={() => setCreated(null)}>
          <Field label={`「${created.name}」的 Key（仅显示这一次）`}>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-amber/40 bg-amber/5 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-amber">
                {created.key}
              </code>
              <button
                onClick={() => copy(created.key, 'key')}
                className="shrink-0 rounded-lg bg-neon/15 px-3.5 py-2.5 text-[13px] font-medium text-neon ring-1 ring-inset ring-neon/40 transition hover:bg-neon/25"
              >
                {copied === 'key' ? '已复制 ✓' : '复制'}
              </button>
            </div>
          </Field>
          <p className="mt-3 rounded-lg border border-amber/30 bg-amber/5 px-3 py-2 text-[12.5px] leading-relaxed text-amber">
            关闭后将无法再次查看完整 Key，只能删除后重建。
          </p>
          {agentPromptWithKey && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] text-ink-3">Agent 配置提示词（已填入 Key）</span>
                <button
                  onClick={() => copy(agentPromptWithKey, 'prompt-key')}
                  className="rounded-lg bg-violet/15 px-3 py-1.5 text-[13px] font-medium text-violet ring-1 ring-inset ring-violet/40 transition hover:bg-violet/25"
                >
                  {copied === 'prompt-key' ? '已复制 ✓' : '复制 Agent 提示词'}
                </button>
              </div>
              <pre className="max-h-[200px] overflow-auto rounded-lg border border-violet/25 bg-violet/5 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
                {agentPromptWithKey}
              </pre>
            </div>
          )}
          <div className="mt-5 flex justify-end">
            <button
              onClick={() => setCreated(null)}
              className="rounded-lg border border-edge px-4 py-2 text-[14px] text-ink-2 transition hover:bg-panel-2"
            >
              我已保存
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** 生成给 Agent 的自然语言配置提示词；传入 apiKey 时自动填入认证信息 */
function buildAgentPrompt(endpoint: string, apiKey?: string) {
  const keyPlaceholder = apiKey ?? '<在此粘贴你的 API Key>'
  const config = JSON.stringify(
    {
      mcpServers: {
        topc: {
          url: endpoint,
          headers: { Authorization: `Bearer ${keyPlaceholder}` },
        },
      },
    },
    null,
    2,
  )
  return `请帮我接入 TopC 社团看板 MCP 服务。

说明：不限定 Agent 或 IDE 类型，按你所用 MCP 客户端的远程接入文档配置即可。

【接入信息】
- 服务名称：topc-dashboard
- 传输协议：streamable HTTP（stateless，JSON 响应）
- MCP 端点：${endpoint}
- 认证方式：HTTP Header \`Authorization: Bearer <API_KEY>\`
- API Key：${keyPlaceholder}

【请执行以下步骤】
1. 查阅你当前 MCP 客户端文档，将下方连接信息写入其支持的配置文件或设置界面（字段名若与示例不同，请等价映射 url 与 Authorization 请求头）。
2. 保存后重启 MCP 连接或重载客户端，使配置生效。
3. 调用 \`tools/list\` 验证连接是否正常，并简要列出可用工具名称。
4. 若连接失败，检查端点是否可访问、Key 是否有效且未被停用。

【参考配置 JSON（常见 remote MCP 格式）】
\`\`\`json
${config}
\`\`\`

【可用能力概览】
- 成员：list / get / create / update / delete_member，send_member_email
- 职位：list / create / update / delete_role
- 比赛：list / get / create / update / delete_contest（含队伍、里程碑、成绩、提醒配置）
- 提醒：list_reminder_logs、run_reminder_scan

配置完成后请告诉我连接状态和工具列表。`
}
