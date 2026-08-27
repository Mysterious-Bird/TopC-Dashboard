"""管理员认证：密码登录 → 独立 session token；写操作需 Authorization: Bearer <token>。

每次登录签发一份新会话，不踢掉其他已登录会话，可多人同时在线。
退出登录只作废自己的会话。
"""
import hashlib
import hmac
import os
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .models import AdminSession

ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'topc2026')

router = APIRouter(prefix='/api/auth', tags=['auth'])


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        return ''
    return authorization[7:].strip()


def verify_admin_token(token: str, db: Session, *, touch: bool = True) -> bool:
    """校验管理员 session token；通过时可选刷新 last_used_at。"""
    if not token:
        return False
    row = db.scalar(select(AdminSession).where(AdminSession.token_hash == _hash_token(token)))
    if not row:
        return False
    if touch:
        row.last_used_at = datetime.now()
        db.commit()
    return True


class LoginIn(BaseModel):
    password: str


@router.post('/login')
def login(data: LoginIn, db: Session = Depends(get_db)):
    if not hmac.compare_digest(data.password, ADMIN_PASSWORD):
        raise HTTPException(401, '密码错误')
    raw = secrets.token_urlsafe(32)
    db.add(AdminSession(token_hash=_hash_token(raw), last_used_at=datetime.now()))
    db.commit()
    return {'token': raw}


@router.post('/logout')
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    """作废当前会话；不影响其他管理员。"""
    token = _extract_bearer(authorization)
    if token:
        row = db.scalar(select(AdminSession).where(AdminSession.token_hash == _hash_token(token)))
        if row:
            db.delete(row)
            db.commit()
    return {'ok': True}


def require_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> None:
    token = _extract_bearer(authorization)
    if not verify_admin_token(token, db):
        raise HTTPException(401, '需要管理员登录')
