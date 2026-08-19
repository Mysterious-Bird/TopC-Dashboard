from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .auth import require_admin
from .db import get_db
from .mailer import send_email
from .models import (
    Contest,
    ContestMilestone,
    ContestParticipant,
    ContestResult,
    Member,
    MemberRole,
    ReminderLog,
    Role,
    RoleManage,
    Team,
    TeamMember,
)
from .schemas import (
    ContestIn,
    ContestOut,
    GraphLinkOut,
    GraphOut,
    MemberIn,
    MemberOut,
    OverviewOut,
    RoleIn,
    RoleOut,
)

api = APIRouter(prefix='/api')


# ---------- roles ----------

def _split_csv(s: str) -> list[str]:
    return [x.strip() for x in s.split(',') if x.strip()]


def _role_to_out(db: Session, r: Role) -> RoleOut:
    return RoleOut(
        id=r.id,
        name=r.name,
        sort=r.sort,
        color=r.color,
        manages_all=r.manages_all,
        excludes=_split_csv(r.excludes),
        manages=[rule.managed_role.name for rule in r.manages],
        member_count=db.scalar(select(func.count()).select_from(MemberRole).where(MemberRole.role_id == r.id)) or 0,
    )


@api.get('/roles', response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db)):
    rows = db.scalars(select(Role).options(selectinload(Role.manages).selectinload(RoleManage.managed_role)).order_by(Role.sort, Role.id)).all()
    return [_role_to_out(db, r) for r in rows]


def _apply_role(db: Session, r: Role, data: RoleIn) -> None:
    r.name = data.name
    r.sort = data.sort
    r.color = data.color
    r.manages_all = data.manages_all
    r.excludes = ','.join(data.excludes)
    db.flush()  # 拿到 r.id
    # 重建显式管理规则（按职位名解析）
    db.query(RoleManage).filter(RoleManage.manager_role_id == r.id).delete()
    all_roles = {x.name: x for x in db.scalars(select(Role)).all()}
    for name in dict.fromkeys(data.manages):
        target = all_roles.get(name)
        if target and target.id != r.id:
            db.add(RoleManage(manager_role_id=r.id, managed_role_id=target.id))


@api.post('/roles', response_model=RoleOut, status_code=201, dependencies=[Depends(require_admin)])
def create_role(data: RoleIn, db: Session = Depends(get_db)):
    if db.scalar(select(Role).where(Role.name == data.name)):
        raise HTTPException(409, '职位已存在')
    r = Role()
    db.add(r)
    _apply_role(db, r, data)
    db.commit()
    return _role_to_out(db, r)


@api.put('/roles/{role_id}', response_model=RoleOut, dependencies=[Depends(require_admin)])
def update_role(role_id: int, data: RoleIn, db: Session = Depends(get_db)):
    r = db.get(Role, role_id)
    if not r:
        raise HTTPException(404, '职位不存在')
    dup = db.scalar(select(Role).where(Role.name == data.name, Role.id != role_id))
    if dup:
        raise HTTPException(409, '职位名已被占用')
    _apply_role(db, r, data)
    db.commit()
    db.refresh(r)
    return _role_to_out(db, r)


@api.delete('/roles/{role_id}', status_code=204, dependencies=[Depends(require_admin)])
def delete_role(role_id: int, db: Session = Depends(get_db)):
    r = db.get(Role, role_id)
    if not r:
        raise HTTPException(404, '职位不存在')
    db.query(RoleManage).filter(
        (RoleManage.manager_role_id == role_id) | (RoleManage.managed_role_id == role_id)
    ).delete()
    db.query(MemberRole).filter(MemberRole.role_id == role_id).delete()
    db.delete(r)
    db.commit()


# ---------- members ----------

def _apply_member(db: Session, m: Member, data: MemberIn) -> None:
    m.name = data.name
    m.gender = data.gender
    m.phone = data.phone
    m.qq = data.qq
    m.email = data.email
    m.grade = data.grade
    m.major = data.major
    m.student_id = data.student_id
    m.tags = ','.join(data.tags)
    m.joined_at = data.joined_at
    m.color = data.color
    db.flush()  # 拿到 m.id
    # 重建职位关联（按职位名解析，不存在的自动创建，便于扩展）
    db.query(MemberRole).filter(MemberRole.member_id == m.id).delete()
    all_roles = {x.name: x for x in db.scalars(select(Role)).all()}
    for i, name in enumerate(dict.fromkeys(data.roles)):
        name = name.strip()
        if not name:
            continue
        role = all_roles.get(name)
        if not role:
            role = Role(name=name, sort=90 + i)
            db.add(role)
            db.flush()
            all_roles[name] = role
        db.add(MemberRole(member_id=m.id, role_id=role.id))


def _apply_contest(db: Session, c: Contest, data: ContestIn) -> None:
    c.name = data.name
    c.short = data.short
    c.category = data.category
    c.level = data.level
    c.start = data.start
    c.end = data.end
    c.register_by = data.register_by
    c.location = data.location
    c.team_size = data.team_size
    c.color = data.color
    c.description = data.description
    c.reminder_days = ','.join(str(d) for d in sorted(set(data.reminder_days), reverse=True))
    c.is_team = data.is_team
    c.remind_enabled = data.remind_enabled
    c.remind_recipients = ','.join(str(i) for i in dict.fromkeys(data.remind_recipient_ids))
    db.flush()  # 拿到 c.id
    # 团队赛：重建队伍；个人赛：重建直接名单
    db.query(TeamMember).filter(TeamMember.team_id.in_(select(Team.id).where(Team.contest_id == c.id))).delete()
    db.query(Team).filter(Team.contest_id == c.id).delete()
    db.query(ContestParticipant).filter(ContestParticipant.contest_id == c.id).delete()
    db.query(ContestMilestone).filter(ContestMilestone.contest_id == c.id).delete()
    for m in data.milestones:
        db.add(ContestMilestone(contest_id=c.id, date=m.date, title=m.title.strip() or '事项'))
    db.query(ContestResult).filter(ContestResult.contest_id == c.id).delete()
    for r in data.results:
        if r.award.strip():
            db.add(
                ContestResult(
                    contest_id=c.id,
                    award=r.award.strip(),
                    member_ids=','.join(str(i) for i in dict.fromkeys(r.member_ids)),
                    note=r.note.strip(),
                )
            )
    if data.is_team:
        for t in data.teams:
            team = Team(contest_id=c.id, name=t.name)
            db.add(team)
            db.flush()
            for mid in dict.fromkeys(t.member_ids):
                if db.get(Member, mid):
                    db.add(TeamMember(team_id=team.id, member_id=mid))
    else:
        for mid in dict.fromkeys(data.participant_ids):
            if db.get(Member, mid):
                db.add(ContestParticipant(contest_id=c.id, member_id=mid))


@api.get('/members', response_model=list[MemberOut])
def list_members(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Member).options(selectinload(Member.member_roles).selectinload(MemberRole.role)).order_by(Member.id)
    ).all()
    return [MemberOut.from_orm_row(m) for m in rows]


@api.post('/members', response_model=MemberOut, status_code=201, dependencies=[Depends(require_admin)])
def create_member(data: MemberIn, db: Session = Depends(get_db)):
    m = Member()
    db.add(m)
    _apply_member(db, m, data)
    db.commit()
    db.refresh(m)
    return MemberOut.from_orm_row(m)


@api.put('/members/{member_id}', response_model=MemberOut, dependencies=[Depends(require_admin)])
def update_member(member_id: int, data: MemberIn, db: Session = Depends(get_db)):
    m = db.get(Member, member_id)
    if not m:
        raise HTTPException(404, '成员不存在')
    _apply_member(db, m, data)
    db.commit()
    db.refresh(m)
    return MemberOut.from_orm_row(m)


@api.delete('/members/{member_id}', status_code=204, dependencies=[Depends(require_admin)])
def delete_member(member_id: int, db: Session = Depends(get_db)):
    m = db.get(Member, member_id)
    if not m:
        raise HTTPException(404, '成员不存在')
    db.delete(m)
    db.commit()


# ---------- contests ----------

_CONTEST_LOAD = (
    selectinload(Contest.participants),
    selectinload(Contest.teams).selectinload(Team.members),
    selectinload(Contest.milestones),
    selectinload(Contest.results),
)


@api.get('/contests', response_model=list[ContestOut])
def list_contests(db: Session = Depends(get_db)):
    rows = db.scalars(select(Contest).options(*_CONTEST_LOAD).order_by(Contest.start)).all()
    return [ContestOut.from_orm_row(c) for c in rows]


@api.post('/contests', response_model=ContestOut, status_code=201, dependencies=[Depends(require_admin)])
def create_contest(data: ContestIn, db: Session = Depends(get_db)):
    c = Contest()
    db.add(c)
    _apply_contest(db, c, data)
    db.commit()
    c = db.scalar(select(Contest).options(*_CONTEST_LOAD).where(Contest.id == c.id))
    return ContestOut.from_orm_row(c)


@api.put('/contests/{contest_id}', response_model=ContestOut, dependencies=[Depends(require_admin)])
def update_contest(contest_id: int, data: ContestIn, db: Session = Depends(get_db)):
    c = db.get(Contest, contest_id)
    if not c:
        raise HTTPException(404, '比赛不存在')
    _apply_contest(db, c, data)
    db.commit()
    c = db.scalar(select(Contest).options(*_CONTEST_LOAD).where(Contest.id == c.id))
    return ContestOut.from_orm_row(c)


@api.delete('/contests/{contest_id}', status_code=204, dependencies=[Depends(require_admin)])
def delete_contest(contest_id: int, db: Session = Depends(get_db)):
    c = db.get(Contest, contest_id)
    if not c:
        raise HTTPException(404, '比赛不存在')
    db.delete(c)
    db.commit()


# ---------- stats / graph ----------

@api.get('/overview', response_model=OverviewOut)
def overview(db: Session = Depends(get_db)):
    today = date.today()
    contests = db.scalars(select(Contest)).all()
    return OverviewOut(
        member_count=db.scalar(select(func.count()).select_from(Member)) or 0,
        ongoing_count=sum(1 for c in contests if c.start <= today <= c.end),
        upcoming_count=sum(1 for c in contests if c.start > today),
        done_count=sum(1 for c in contests if c.end < today),
        server_time=datetime.now().isoformat(timespec='seconds'),
    )


@api.get('/graph', response_model=GraphOut)
def graph(db: Session = Depends(get_db)):
    links: list[GraphLinkOut] = []
    roles = db.scalars(
        select(Role).options(selectinload(Role.manages).selectinload(RoleManage.managed_role))
    ).all()
    rules = [
        {
            'name': r.name,
            'manages_all': r.manages_all,
            'excludes': set(_split_csv(r.excludes)),
            'manages': {rule.managed_role.name for rule in r.manages},
        }
        for r in roles
    ]
    members = db.scalars(
        select(Member).options(selectinload(Member.member_roles).selectinload(MemberRole.role))
    ).all()
    role_names = {m.id: {mr.role.name for mr in m.member_roles} for m in members}

    # 职务连线：由管理规则推导（manages_all 全局 / 显式 RoleManage）
    for mgr in members:
        mgr_roles = role_names[mgr.id]
        for mbr in members:
            if mgr.id == mbr.id:
                continue
            hit = None
            for rule in rules:
                if rule['name'] not in mgr_roles:
                    continue
                if rule['manages_all']:
                    if not (role_names[mbr.id] & rule['excludes']):
                        hit = f"{rule['name']}（全局管理）"
                        break
                elif role_names[mbr.id] & rule['manages']:
                    hit = f"{rule['name']} → {' / '.join(sorted(role_names[mbr.id] & rule['manages']))}"
                    break
            if hit:
                links.append(GraphLinkOut(source=mgr.id, target=mbr.id, kind='role', label=hit))

    # 比赛连线：仅团队赛，且只连同队成员（同场不同队不连线）
    rows = db.scalars(
        select(Contest).options(selectinload(Contest.teams).selectinload(Team.members))
    ).all()
    for c in rows:
        if not c.is_team:
            continue
        for t in c.teams:
            ids = [tm.member_id for tm in t.members]
            for i, a in enumerate(ids):
                for b in ids[i + 1 :]:
                    links.append(GraphLinkOut(source=a, target=b, kind='contest', label=f'{c.short}·{t.name}'))
    return GraphOut(links=links)


@api.get('/reminders')
def reminder_logs(db: Session = Depends(get_db)):
    rows = db.scalars(select(ReminderLog).order_by(ReminderLog.sent_at.desc()).limit(100)).all()
    contests = {c.id: c.short for c in db.scalars(select(Contest)).all()}
    return [
        {
            'id': r.id,
            'contest_id': r.contest_id,
            'contest_short': contests.get(r.contest_id, ''),
            'days_before': r.days_before,
            'kind': r.kind,
            'milestone_id': r.milestone_id,
            'note': r.note,
            'skipped': r.skipped,
            'sent_at': r.sent_at.isoformat(timespec='seconds'),
            'recipients': r.recipients,
            'mocked': bool(r.mocked),
        }
        for r in rows
    ]


class MemberEmailIn(BaseModel):
    subject: str
    body: str


@api.post('/members/{member_id}/email', dependencies=[Depends(require_admin)])
def email_member(member_id: int, data: MemberEmailIn, db: Session = Depends(get_db)):
    m = db.get(Member, member_id)
    if not m:
        raise HTTPException(404, '成员不存在')
    if not m.email:
        raise HTTPException(400, '该成员未填写邮箱')
    real = send_email([m.email], data.subject, data.body)
    return {'ok': True, 'mocked': not real}
