"""MCP API Key 管理：管理员增删改查 + MCP 请求的 Key 鉴权。"""
import hashlib
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from .auth import require_admin, verify_admin_token
from .db import SessionLocal, get_db
from .models import ApiKey

router = APIRouter(prefix='/api/keys', tags=['api-keys'], dependencies=[Depends(require_admin)])


def generate_api_key() -> str:
    return 'topc_' + secrets.token_urlsafe(24)


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def authenticate_token(token: str) -> bool:
    """校验 MCP Bearer token：管理员 session 或启用中的 API Key。通过时刷新 last_used_at。"""
    if not token:
        return False
    db = SessionLocal()
    try:
        if verify_admin_token(token, db):
            return True
        k = db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_api_key(token)))
        if not k or not k.enabled:
            return False
        k.last_used_at = datetime.now()
        db.commit()
        return True
    finally:
        db.close()


class ApiKeyAuthMiddleware:
    """纯 ASGI 中间件：MCP 端点要求 Authorization: Bearer <api_key>。"""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        headers = {k.decode(): v.decode() for k, v in scope.get('headers', [])}
        auth = headers.get('authorization', '')
        token = auth.removeprefix('Bearer ').strip() if auth.startswith('Bearer ') else ''
        if not authenticate_token(token):
            resp = JSONResponse(
                {'detail': '需要有效的 API Key：Authorization: Bearer topc_xxx（在 MCP 管理页创建）'},
                status_code=401,
            )
            await resp(scope, receive, send)
            return
        await self.app(scope, receive, send)


# ---------- schemas ----------

class ApiKeyIn(BaseModel):
    name: str


class ApiKeyUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None


class ApiKeyOut(BaseModel):
    id: int
    name: str
    prefix: str
    enabled: bool
    created_at: str
    last_used_at: str | None

    @classmethod
    def from_row(cls, k: ApiKey) -> 'ApiKeyOut':
        return cls(
            id=k.id,
            name=k.name,
            prefix=k.prefix,
            enabled=k.enabled,
            created_at=k.created_at.isoformat(timespec='seconds'),
            last_used_at=k.last_used_at.isoformat(timespec='seconds') if k.last_used_at else None,
        )


class ApiKeyCreatedOut(ApiKeyOut):
    key: str  # 明文仅此一次返回


# ---------- endpoints ----------

@router.get('', response_model=list[ApiKeyOut])
def list_keys(db: Session = Depends(get_db)):
    rows = db.scalars(select(ApiKey).order_by(ApiKey.id.desc())).all()
    return [ApiKeyOut.from_row(k) for k in rows]


@router.post('', response_model=ApiKeyCreatedOut, status_code=201)
def create_key(data: ApiKeyIn, db: Session = Depends(get_db)):
    name = data.name.strip()
    if not name:
        raise HTTPException(400, '名称不能为空')
    key = generate_api_key()
    row = ApiKey(name=name, prefix=key[:10], key_hash=hash_api_key(key))
    db.add(row)
    db.commit()
    db.refresh(row)
    return ApiKeyCreatedOut(**ApiKeyOut.from_row(row).model_dump(), key=key)


@router.put('/{key_id}', response_model=ApiKeyOut)
def update_key(key_id: int, data: ApiKeyUpdate, db: Session = Depends(get_db)):
    k = db.get(ApiKey, key_id)
    if not k:
        raise HTTPException(404, 'Key 不存在')
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(400, '名称不能为空')
        k.name = name
    if data.enabled is not None:
        k.enabled = data.enabled
    db.commit()
    db.refresh(k)
    return ApiKeyOut.from_row(k)


@router.delete('/{key_id}', status_code=204)
def delete_key(key_id: int, db: Session = Depends(get_db)):
    k = db.get(ApiKey, key_id)
    if not k:
        raise HTTPException(404, 'Key 不存在')
    db.delete(k)
    db.commit()
