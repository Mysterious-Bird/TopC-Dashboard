"""管理员认证：密码登录 → 静态 token；写操作需携带 Authorization: Bearer <token>。"""
import hashlib
import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'topc2026')
SECRET_KEY = os.getenv('SECRET_KEY', 'topc-dev-secret-change-me')

# token 由 SECRET_KEY 派生：改密钥即可让全部已发 token 失效
TOKEN = hmac.new(SECRET_KEY.encode(), b'topc-admin', hashlib.sha256).hexdigest()

router = APIRouter(prefix='/api/auth', tags=['auth'])


class LoginIn(BaseModel):
    password: str


@router.post('/login')
def login(data: LoginIn):
    if not hmac.compare_digest(data.password, ADMIN_PASSWORD):
        raise HTTPException(401, '密码错误')
    return {'token': TOKEN}


def require_admin(authorization: str | None = Header(default=None)) -> None:
    if authorization != f'Bearer {TOKEN}':
        raise HTTPException(401, '需要管理员登录')
