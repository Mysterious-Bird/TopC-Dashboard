from datetime import date

from pydantic import BaseModel, ConfigDict, Field


def _split_csv(s: str) -> list[str]:
    return [x.strip() for x in s.split(',') if x.strip()]


class RoleIn(BaseModel):
    name: str
    sort: int = 99
    color: str = '#93c5fd'
    manages_all: bool = False
    excludes: list[str] = Field(default_factory=list)  # manages_all 时排除的职位名
    manages: list[str] = Field(default_factory=list)  # 显式管理的职位名


class RoleOut(RoleIn):
    id: int
    member_count: int = 0


class MemberIn(BaseModel):
    name: str
    gender: str = '男'
    phone: str = ''
    qq: str = ''
    email: str = ''
    roles: list[str] = Field(default_factory=list)  # 职位名列表（可多个）
    enroll_year: int | None = None  # 入学年份；年级由服务端按 9/1 推算
    major: str = ''
    student_id: str = ''
    tags: list[str] = Field(default_factory=list)
    joined_at: date | None = None
    color: str = '#22d3ee'


class MemberOut(MemberIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    grade: str = ''  # 只读：由 enroll_year 推算

    @classmethod
    def from_orm_row(cls, m):
        from .grade import grade_from_enroll_year

        roles = sorted((mr.role for mr in m.member_roles), key=lambda r: (r.sort, r.id))
        return cls(
            id=m.id,
            name=m.name,
            gender=m.gender,
            phone=m.phone,
            qq=m.qq,
            email=m.email,
            roles=[r.name for r in roles],
            enroll_year=m.enroll_year,
            grade=grade_from_enroll_year(m.enroll_year),
            major=m.major,
            student_id=m.student_id,
            tags=_split_csv(m.tags),
            joined_at=m.joined_at,
            color=m.color,
        )


class TeamIn(BaseModel):
    name: str = ''
    member_ids: list[int] = Field(default_factory=list)


class TeamOut(TeamIn):
    id: int


class MilestoneIn(BaseModel):
    date: date
    title: str = ''


class MilestoneOut(MilestoneIn):
    id: int


class ResultIn(BaseModel):
    award: str = ''
    member_ids: list[int] = Field(default_factory=list)
    note: str = ''


class ResultOut(ResultIn):
    id: int


class ContestIn(BaseModel):
    name: str
    short: str = ''
    category: str = '算法'
    level: str = '校级'
    start: date
    end: date
    register_by: date | None = None
    location: str = ''
    team_size: int = 1
    color: str = '#38bdf8'
    description: str = ''
    reminder_days: list[int] = Field(default_factory=lambda: [7, 1])
    is_team: bool = False
    remind_enabled: bool = True
    remind_recipient_ids: list[int] = Field(default_factory=list)  # 空 = 默认（本场参赛者+社长）；赛前/事项/报名催办共用
    participant_ids: list[int] = Field(default_factory=list)  # 个人赛用
    teams: list[TeamIn] = Field(default_factory=list)  # 团队赛用
    milestones: list[MilestoneIn] = Field(default_factory=list)  # 固定日期事项提醒
    results: list[ResultIn] = Field(default_factory=list)  # 成绩 / 获奖记录


class ContestOut(BaseModel):
    id: int
    name: str
    short: str
    category: str
    level: str
    start: date
    end: date
    register_by: date | None
    location: str
    team_size: int
    color: str
    description: str
    reminder_days: list[int]
    is_team: bool
    remind_enabled: bool
    remind_recipient_ids: list[int]
    participant_ids: list[int]  # 团队赛 = 各队伍成员并集；个人赛 = 直接名单
    teams: list[TeamOut]
    milestones: list[MilestoneOut]
    results: list[ResultOut]

    @classmethod
    def from_orm_row(cls, c):
        if c.is_team:
            participant_ids = sorted({tm.member_id for t in c.teams for tm in t.members})
        else:
            participant_ids = [p.member_id for p in c.participants]
        return cls(
            id=c.id,
            name=c.name,
            short=c.short,
            category=c.category,
            level=c.level,
            start=c.start,
            end=c.end,
            register_by=c.register_by,
            location=c.location,
            team_size=c.team_size,
            color=c.color,
            description=c.description,
            reminder_days=[int(x) for x in _split_csv(c.reminder_days)],
            is_team=c.is_team,
            remind_enabled=c.remind_enabled,
            remind_recipient_ids=[int(x) for x in _split_csv(c.remind_recipients)],
            participant_ids=participant_ids,
            teams=[TeamOut(id=t.id, name=t.name, member_ids=[tm.member_id for tm in t.members]) for t in c.teams],
            milestones=[MilestoneOut(id=m.id, date=m.date, title=m.title) for m in c.milestones],
            results=[
                ResultOut(
                    id=r.id,
                    award=r.award,
                    member_ids=[int(x) for x in _split_csv(r.member_ids)],
                    note=r.note,
                )
                for r in c.results
            ],
        )


class OverviewOut(BaseModel):
    member_count: int
    ongoing_count: int
    upcoming_count: int
    done_count: int
    server_time: str


class GraphLinkOut(BaseModel):
    source: int
    target: int
    kind: str  # role | contest
    label: str  # role: 命中的规则描述（如 "AC部部长 → AC部成员"）；contest: 比赛简称


class GraphOut(BaseModel):
    links: list[GraphLinkOut]
