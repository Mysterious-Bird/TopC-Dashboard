from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Role(Base):
    """职位：动态可扩展。管理关系 = manages_all 全局规则 + RoleManage 显式规则。"""

    __tablename__ = 'roles'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    sort: Mapped[int] = mapped_column(Integer, default=99)  # 越小越靠前
    color: Mapped[str] = mapped_column(String(9), default='#93c5fd')
    manages_all: Mapped[bool] = mapped_column(Boolean, default=False)  # 管理全社（如 社长/副社长）
    excludes: Mapped[str] = mapped_column(String(255), default='')  # manages_all 时排除的职位名，逗号分隔

    manages: Mapped[list['RoleManage']] = relationship(
        back_populates='manager_role',
        cascade='all, delete-orphan',
        foreign_keys='RoleManage.manager_role_id',
    )


class RoleManage(Base):
    """显式管理规则：manager_role 管理 managed_role（如 AC部部长 → AC部成员）。"""

    __tablename__ = 'role_manages'
    __table_args__ = (UniqueConstraint('manager_role_id', 'managed_role_id', name='uq_manage_rule'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    manager_role_id: Mapped[int] = mapped_column(ForeignKey('roles.id', ondelete='CASCADE'), index=True)
    managed_role_id: Mapped[int] = mapped_column(ForeignKey('roles.id', ondelete='CASCADE'), index=True)

    manager_role: Mapped[Role] = relationship(foreign_keys=[manager_role_id], back_populates='manages')
    managed_role: Mapped[Role] = relationship(foreign_keys=[managed_role_id])


class Member(Base):
    __tablename__ = 'members'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False)
    gender: Mapped[str] = mapped_column(String(4), default='男')
    phone: Mapped[str] = mapped_column(String(20), default='')
    qq: Mapped[str] = mapped_column(String(20), default='')
    email: Mapped[str] = mapped_column(String(64), default='')
    grade: Mapped[str] = mapped_column(String(8), default='')
    major: Mapped[str] = mapped_column(String(32), default='')
    student_id: Mapped[str] = mapped_column(String(32), default='')
    tags: Mapped[str] = mapped_column(String(255), default='')  # 逗号分隔
    joined_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    color: Mapped[str] = mapped_column(String(9), default='#22d3ee')

    member_roles: Mapped[list['MemberRole']] = relationship(
        back_populates='member', cascade='all, delete-orphan'
    )
    contests: Mapped[list['ContestParticipant']] = relationship(
        back_populates='member', cascade='all, delete-orphan'
    )


class MemberRole(Base):
    __tablename__ = 'member_roles'
    __table_args__ = (UniqueConstraint('member_id', 'role_id', name='uq_member_role'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(ForeignKey('members.id', ondelete='CASCADE'), index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey('roles.id', ondelete='CASCADE'), index=True)

    member: Mapped[Member] = relationship(back_populates='member_roles')
    role: Mapped[Role] = relationship()


class Contest(Base):
    __tablename__ = 'contests'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    short: Mapped[str] = mapped_column(String(32), default='')
    category: Mapped[str] = mapped_column(String(16), default='算法', index=True)
    level: Mapped[str] = mapped_column(String(8), default='校级')
    start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    end: Mapped[date] = mapped_column(Date, nullable=False)
    register_by: Mapped[date | None] = mapped_column(Date, nullable=True)
    location: Mapped[str] = mapped_column(String(64), default='')
    team_size: Mapped[int] = mapped_column(Integer, default=1)
    color: Mapped[str] = mapped_column(String(9), default='#38bdf8')
    description: Mapped[str] = mapped_column(Text, default='')
    reminder_days: Mapped[str] = mapped_column(String(32), default='7,1')  # 逗号分隔的天数节点
    is_team: Mapped[bool] = mapped_column(Boolean, default=False)  # 团队赛才有队伍
    remind_enabled: Mapped[bool] = mapped_column(Boolean, default=True)  # 关闭则不发赛前提醒
    remind_recipients: Mapped[str] = mapped_column(String(512), default='')  # 自定义收件人 member id CSV；空 = 该比赛参赛者+社长

    participants: Mapped[list['ContestParticipant']] = relationship(
        back_populates='contest', cascade='all, delete-orphan'
    )
    teams: Mapped[list['Team']] = relationship(back_populates='contest', cascade='all, delete-orphan')
    milestones: Mapped[list['ContestMilestone']] = relationship(
        back_populates='contest', cascade='all, delete-orphan', order_by='ContestMilestone.date'
    )
    results: Mapped[list['ContestResult']] = relationship(
        back_populates='contest', cascade='all, delete-orphan'
    )


class ContestResult(Base):
    """比赛成绩：奖项 + 获奖成员（可多人，如团队奖）。"""

    __tablename__ = 'contest_results'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(ForeignKey('contests.id', ondelete='CASCADE'), index=True)
    award: Mapped[str] = mapped_column(String(64), default='')  # 如 国家级二等奖 / 银牌
    member_ids: Mapped[str] = mapped_column(String(255), default='')  # 获奖成员 id CSV
    note: Mapped[str] = mapped_column(String(128), default='')

    contest: Mapped[Contest] = relationship(back_populates='results')


class ContestMilestone(Base):
    """比赛中的固定日期事项（如作品提交截止），当天触发邮件提醒。"""

    __tablename__ = 'contest_milestones'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(ForeignKey('contests.id', ondelete='CASCADE'), index=True)
    date: Mapped[date] = mapped_column(Date)
    title: Mapped[str] = mapped_column(String(64), default='')

    contest: Mapped[Contest] = relationship(back_populates='milestones')


class Team(Base):
    """队伍：只与比赛绑定，同一场比赛可有多支队伍。"""

    __tablename__ = 'teams'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(ForeignKey('contests.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(32), default='')

    contest: Mapped[Contest] = relationship(back_populates='teams')
    members: Mapped[list['TeamMember']] = relationship(back_populates='team', cascade='all, delete-orphan')


class TeamMember(Base):
    __tablename__ = 'team_members'
    __table_args__ = (UniqueConstraint('team_id', 'member_id', name='uq_team_member'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(ForeignKey('teams.id', ondelete='CASCADE'), index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey('members.id', ondelete='CASCADE'), index=True)

    team: Mapped[Team] = relationship(back_populates='members')


class ContestParticipant(Base):
    __tablename__ = 'contest_participants'
    __table_args__ = (UniqueConstraint('contest_id', 'member_id', name='uq_contest_member'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(ForeignKey('contests.id', ondelete='CASCADE'), index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey('members.id', ondelete='CASCADE'), index=True)

    contest: Mapped[Contest] = relationship(back_populates='participants')
    member: Mapped[Member] = relationship(back_populates='contests')


class ReminderLog(Base):
    __tablename__ = 'reminder_logs'
    __table_args__ = (UniqueConstraint('contest_id', 'days_before', 'kind', 'milestone_id', name='uq_reminder_once'),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contest_id: Mapped[int] = mapped_column(ForeignKey('contests.id', ondelete='CASCADE'))
    days_before: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(16), default='race')  # race=赛前提醒 | register=报名催办 | milestone=固定日期事项
    milestone_id: Mapped[int] = mapped_column(Integer, default=0)  # kind=milestone 时指向 ContestMilestone
    note: Mapped[str] = mapped_column(String(64), default='')  # 事项标题等附加说明
    skipped: Mapped[int] = mapped_column(Integer, default=0)  # 因无邮箱被跳过的收件人数
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    recipients: Mapped[str] = mapped_column(Text, default='')  # 逗号分隔邮箱
    mocked: Mapped[int] = mapped_column(Integer, default=0)  # 1 = 模拟发送


class ApiKey(Base):
    """MCP 远程接入凭证。只存哈希，明文仅创建时返回一次。"""

    __tablename__ = 'api_keys'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    prefix: Mapped[str] = mapped_column(String(16), default='')  # 如 topc_a1b2，用于列表识别
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
