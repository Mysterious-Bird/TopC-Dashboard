import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_admin
from .auth import router as auth_router
from .db import Base, engine
from .keys import ApiKeyAuthMiddleware
from .keys import router as keys_router
from .mcp_server import mcp
from .migrate import ensure_member_enroll_year
from .models import AdminSession  # noqa: F401 — 注册表供 create_all
from .routers import api
from .scheduler import check_and_send_reminders, start_scheduler

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')

# MCP streamable HTTP 子应用（stateless + JSON），挂载前先生成 session manager
mcp_http_app = ApiKeyAuthMiddleware(mcp.streamable_http_app())


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    ensure_member_enroll_year()
    start_scheduler()
    # MCP session manager 需要常驻任务组（挂载的子应用不会自动跑 lifespan）
    async with mcp.session_manager.run():
        yield


app = FastAPI(title='TopC 社团看板 API', version='0.2.0', lifespan=lifespan)

_cors = os.getenv(
    'CORS_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080',
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors.split(',') if o.strip()],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api)
app.include_router(auth_router)
app.include_router(keys_router)

# 远程 MCP 端点：/api/mcp，需 Authorization: Bearer <api_key>
app.mount('/api/mcp', mcp_http_app)


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.post('/api/reminders/run', dependencies=[Depends(require_admin)])
def run_reminders_now():
    """手动触发一次提醒扫描（调试/演示用）。"""
    check_and_send_reminders()
    return {'status': 'done'}
