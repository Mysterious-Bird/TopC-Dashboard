# TopC Dashboard

TopC 计算机学习社团看板：成员管理、比赛安排、关系图谱、邮件提醒、荣誉殿堂与远程 MCP 接入。

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-streamable%20HTTP-8B5CF6)

## 功能概览

| 模块 | 说明 |
|------|------|
| **总览** | 进行中比赛、提醒队列、参赛成员实时统计 |
| **成员管理** | 多职位、技术栈、获奖记录；管理员可增删改 |
| **比赛安排** | 甘特图 / 日历视图，可拖动缩放时间轴；团队赛、里程碑、成绩录入 |
| **参赛视图** | 按比赛或成员查看负载与队伍编组 |
| **关系图谱** | 职务管理关系 + 同队队友；职位/比赛分组高亮 |
| **提醒中心** | 赛前节点、报名催办、固定日期事项；发送历史与跳过统计 |
| **荣誉殿堂** | 分级特效展示获奖记录，荣誉编年与可筛选列表 |
| **MCP 服务** | 远程 API Key 鉴权，Agent 可通过 MCP 完成全量 CRUD |

### 权限模型

- **访客**：只读浏览全部页面
- **管理员**：登录后可编辑成员 / 职位 / 比赛，管理 MCP API Key，手动触发提醒扫描

## 技术栈

**前端**：React 18 · Vite 6 · TypeScript · Tailwind CSS 4 · react-router-dom · react-force-graph-2d

**后端**：FastAPI · SQLAlchemy · APScheduler · MCP SDK (FastMCP)

**数据库**：MySQL（生产）/ SQLite（开发，默认 `server/topc.db`）

**邮件**：QQ 邮箱 SMTP（未配置时模拟发送）

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.11+

### 1. 克隆仓库

```bash
git clone git@github.com:Mysterious-Bird/TopC-Dashboard.git
cd TopC-Dashboard
```

### 2. 启动后端

```bash
cd server
pip install -r requirements.txt

# 复制并编辑环境变量（可选，默认 SQLite + 模拟邮件）
cp .env.example .env

# 初始化示例数据
python seed.py

# 启动 API（含 MCP 端点）
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 3. 启动前端

```bash
# 项目根目录
npm install
npm run dev
```

浏览器访问 **http://localhost:5173**

前端通过 Vite 代理将 `/api` 请求转发到 `http://localhost:8000`。

### 4. 管理员登录

点击右上角锁图标，默认密码见 `server/.env.example` 中的 `ADMIN_PASSWORD`（默认 `topc2026`）。

## 环境变量

在 `server/.env` 中配置（参考 `server/.env.example`）：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | MySQL 连接串；留空则使用 SQLite |
| `ADMIN_PASSWORD` | 管理员登录密码 |
| `SECRET_KEY` | Token 派生密钥 |
| `SMTP_*` | QQ 邮箱 SMTP；留空则模拟发送 |
| `REMINDER_INTERVAL_MINUTES` | 提醒扫描间隔（分钟） |

## MCP 远程接入

管理员登录后，侧边栏进入 **MCP** 页面：

1. 创建 API Key（明文仅展示一次，请立即保存）
2. 复制 Agent 配置提示词或 JSON 配置
3. 在 MCP 客户端中配置远程端点

```
端点：  https://你的域名/api/mcp/
认证：  Authorization: Bearer topc_xxx
协议：  streamable HTTP（stateless，JSON 响应）
```

可用工具包括成员 / 职位 / 比赛的增删改查、提醒扫描、单发邮件等 17 个工具。

## 项目结构

```
TopC-Dashboard/
├── src/                    # React 前端
│   ├── pages/              # 各功能页面
│   ├── components/         # UI 组件与表单
│   └── data/               # 类型定义与数据上下文
├── server/
│   ├── app/
│   │   ├── main.py         # FastAPI 入口 + MCP 挂载
│   │   ├── mcp_server.py   # MCP 工具定义
│   │   ├── routers.py      # REST API
│   │   ├── keys.py         # API Key 管理
│   │   ├── scheduler.py    # 邮件提醒调度
│   │   └── models.py       # 数据库模型
│   ├── seed.py             # 示例数据填充
│   └── requirements.txt
├── vite.config.ts
└── package.json
```

## 构建部署

```bash
# 前端静态资源
npm run build        # 输出 dist/

# 后端生产启动
cd server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

生产环境建议：Nginx 托管 `dist/` 并反代 `/api` 与 `/api/mcp/` 到 Uvicorn，MySQL 作为数据库，配置 SMTP 与强密码。

## License

Private — TopC 社团内部使用。
