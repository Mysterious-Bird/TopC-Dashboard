"""TopC 看板 MCP 服务：通过 API Key 鉴权的远程增删改查。

端点：/api/mcp（streamable HTTP，stateless + JSON 响应）
鉴权：Authorization: Bearer topc_xxx（管理页创建，或管理员 token）
"""
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .db import SessionLocal
from .mailer import send_email
from .models import Contest, Member, MemberRole, ReminderLog, Role
from .routers import _apply_contest, _apply_member, _apply_role, _role_to_out, _CONTEST_LOAD
from .scheduler import check_and_send_reminders
from .schemas import ContestIn, ContestOut, MemberIn, MemberOut, RoleIn, RoleOut


def _transport_security() -> TransportSecuritySettings:
    """公网反代 + Cursor 会带非 http Origin；已有 API Key 鉴权，关闭 DNS 重绑定防护。"""
    return TransportSecuritySettings(enable_dns_rebinding_protection=False)


mcp = FastMCP(
    'topc-dashboard',
    instructions='TopC 计算机学习社团看板：成员 / 职位 / 比赛（含队伍、里程碑、成绩）/ 邮件提醒 的全量增删改查。',
    host='0.0.0.0',
    streamable_http_path='/',
    stateless_http=True,
    json_response=True,
    transport_security=_transport_security(),
)


def _get_or_404(db, model, pk: int, label: str):
    row = db.get(model, pk)
    if row is None:
        raise ValueError(f'{label}不存在（id={pk}）')
    return row


# ---------- 成员 ----------

@mcp.tool()
def list_members() -> list[MemberOut]:
    """列出全部成员（含职位、联系方式、技术栈）。"""
    with SessionLocal() as db:
        rows = db.scalars(
            select(Member).options(selectinload(Member.member_roles).selectinload(MemberRole.role)).order_by(Member.id)
        ).all()
        return [MemberOut.from_orm_row(m) for m in rows]


@mcp.tool()
def get_member(member_id: int) -> MemberOut:
    """按 id 查看单个成员详情。"""
    with SessionLocal() as db:
        m = _get_or_404(db, Member, member_id, '成员')
        return MemberOut.from_orm_row(m)


@mcp.tool()
def create_member(data: MemberIn) -> MemberOut:
    """新增成员。roles 为职位名列表；enroll_year=入学年份（年级按每年 9/1 自动推算）。"""
    with SessionLocal() as db:
        m = Member()
        db.add(m)
        _apply_member(db, m, data)
        db.commit()
        db.refresh(m)
        return MemberOut.from_orm_row(m)


@mcp.tool()
def update_member(member_id: int, data: MemberIn) -> MemberOut:
    """全量更新成员信息（职位列表会整体替换）。"""
    with SessionLocal() as db:
        m = _get_or_404(db, Member, member_id, '成员')
        _apply_member(db, m, data)
        db.commit()
        db.refresh(m)
        return MemberOut.from_orm_row(m)


@mcp.tool()
def delete_member(member_id: int) -> str:
    """删除成员（其参赛记录一并移除）。"""
    with SessionLocal() as db:
        m = _get_or_404(db, Member, member_id, '成员')
        name = m.name
        db.delete(m)
        db.commit()
        return f'已删除成员「{name}」'


@mcp.tool()
def send_member_email(member_id: int, subject: str, body: str) -> str:
    """给单个成员发送邮件（未配置 SMTP 时为模拟发送）。"""
    with SessionLocal() as db:
        m = _get_or_404(db, Member, member_id, '成员')
        if not m.email:
            raise ValueError('该成员未填写邮箱')
        real = send_email([m.email], subject, body)
        return '已发送' if real else '已模拟发送（未配置 SMTP）'


# ---------- 职位 ----------

@mcp.tool()
def list_roles() -> list[RoleOut]:
    """列出全部职位（含管理规则与成员数）。"""
    with SessionLocal() as db:
        rows = db.scalars(select(Role).order_by(Role.sort, Role.id)).all()
        return [_role_to_out(db, r) for r in rows]


@mcp.tool()
def create_role(data: RoleIn) -> RoleOut:
    """新增职位。manages_all=全局管理（excludes 排除）；manages=显式管理的职位名。"""
    with SessionLocal() as db:
        if db.scalar(select(Role).where(Role.name == data.name)):
            raise ValueError('职位已存在')
        r = Role()
        db.add(r)
        _apply_role(db, r, data)
        db.commit()
        return _role_to_out(db, r)


@mcp.tool()
def update_role(role_id: int, data: RoleIn) -> RoleOut:
    """全量更新职位（管理规则整体替换）。"""
    with SessionLocal() as db:
        r = _get_or_404(db, Role, role_id, '职位')
        dup = db.scalar(select(Role).where(Role.name == data.name, Role.id != role_id))
        if dup:
            raise ValueError('职位名已被占用')
        _apply_role(db, r, data)
        db.commit()
        return _role_to_out(db, r)


@mcp.tool()
def delete_role(role_id: int) -> str:
    """删除职位（成员关联与管理规则一并移除）。"""
    with SessionLocal() as db:
        r = _get_or_404(db, Role, role_id, '职位')
        name = r.name
        db.delete(r)
        db.commit()
        return f'已删除职位「{name}」'


# ---------- 比赛 ----------

@mcp.tool()
def list_contests() -> list[ContestOut]:
    """列出全部比赛（含队伍、里程碑、成绩、提醒配置）。"""
    with SessionLocal() as db:
        rows = db.scalars(select(Contest).options(*_CONTEST_LOAD).order_by(Contest.start)).all()
        return [ContestOut.from_orm_row(c) for c in rows]


@mcp.tool()
def get_contest(contest_id: int) -> ContestOut:
    """按 id 查看单场比赛详情。"""
    with SessionLocal() as db:
        c = db.scalar(select(Contest).options(*_CONTEST_LOAD).where(Contest.id == contest_id))
        if not c:
            raise ValueError(f'比赛不存在（id={contest_id}）')
        return ContestOut.from_orm_row(c)


@mcp.tool()
def create_contest(data: ContestIn) -> ContestOut:
    """新增比赛。is_team=True 时用 teams 配置队伍；个人赛用 participant_ids；
    milestones=固定日期事项提醒；results=成绩/获奖记录；reminder_days=赛前提醒节点（天）。"""
    with SessionLocal() as db:
        c = Contest()
        db.add(c)
        _apply_contest(db, c, data)
        db.commit()
        c = db.scalar(select(Contest).options(*_CONTEST_LOAD).where(Contest.id == c.id))
        return ContestOut.from_orm_row(c)


@mcp.tool()
def update_contest(contest_id: int, data: ContestIn) -> ContestOut:
    """全量更新比赛（队伍 / 里程碑 / 成绩 / 名单整体替换）。"""
    with SessionLocal() as db:
        _get_or_404(db, Contest, contest_id, '比赛')
        c = db.scalar(select(Contest).options(*_CONTEST_LOAD).where(Contest.id == contest_id))
        _apply_contest(db, c, data)
        db.commit()
        c = db.scalar(select(Contest).options(*_CONTEST_LOAD).where(Contest.id == contest_id))
        return ContestOut.from_orm_row(c)


@mcp.tool()
def delete_contest(contest_id: int) -> str:
    """删除比赛（队伍、里程碑、成绩一并移除）。"""
    with SessionLocal() as db:
        c = _get_or_404(db, Contest, contest_id, '比赛')
        name = c.name
        db.delete(c)
        db.commit()
        return f'已删除比赛「{name}」'


# ---------- 提醒 ----------

@mcp.tool()
def list_reminder_logs(limit: int = 50) -> list[dict]:
    """查看提醒邮件发送历史（赛前 / 报名催办 / 固定日期事项）。"""
    with SessionLocal() as db:
        rows = db.scalars(select(ReminderLog).order_by(ReminderLog.sent_at.desc()).limit(min(limit, 200))).all()
        contests = {c.id: c.short for c in db.scalars(select(Contest)).all()}
        return [
            {
                'id': r.id,
                'contest': contests.get(r.contest_id, ''),
                'kind': r.kind,
                'days_before': r.days_before,
                'note': r.note,
                'skipped': r.skipped,
                'sent_at': r.sent_at.isoformat(timespec='seconds'),
                'recipients': r.recipients,
                'mocked': bool(r.mocked),
            }
            for r in rows
        ]


@mcp.tool()
def run_reminder_scan() -> str:
    """立即执行一次提醒扫描：发送当天到期的赛前 / 报名 / 事项提醒邮件。"""
    check_and_send_reminders()
    return '提醒扫描已执行'
