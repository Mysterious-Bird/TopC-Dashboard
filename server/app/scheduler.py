import logging
import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from .db import SessionLocal
from .mailer import send_email
from .models import Contest, ContestParticipant, Member, MemberRole, ReminderLog, Role, Team, TeamMember

log = logging.getLogger('topc.scheduler')

INTERVAL_MINUTES = int(os.getenv('REMINDER_INTERVAL_MINUTES', '30'))
REGISTER_REMIND_DAYS = 3  # 报名截止前 N 天催办
CN_TZ = ZoneInfo('Asia/Shanghai')


def _china_today() -> date:
    return datetime.now(CN_TZ).date()


def _already_sent(db, contest_id: int, days_before: int, kind: str, milestone_id: int = 0) -> bool:
    return bool(
        db.scalar(
            select(ReminderLog).where(
                ReminderLog.contest_id == contest_id,
                ReminderLog.days_before == days_before,
                ReminderLog.kind == kind,
                ReminderLog.milestone_id == milestone_id,
            )
        )
    )


def _race_recipients(db, c: Contest) -> tuple[list[str], int]:
    """提醒收件人：自定义名单 > 默认（该比赛参赛者 + 社长）。

    赛前 / 固定事项 / 报名催办共用。返回 (有效邮箱列表, 因无邮箱被跳过的人数)。
    """
    custom = [int(x) for x in c.remind_recipients.split(',') if x.strip().isdigit()]
    if custom:
        ids = set(custom)
    else:
        if c.is_team:
            ids = set(
                db.scalars(
                    select(TeamMember.member_id)
                    .join(Team, Team.id == TeamMember.team_id)
                    .where(Team.contest_id == c.id)
                ).all()
            )
        else:
            ids = set(
                db.scalars(
                    select(ContestParticipant.member_id).where(ContestParticipant.contest_id == c.id)
                ).all()
            )
        ids |= set(
            db.scalars(
                select(MemberRole.member_id).join(Role, Role.id == MemberRole.role_id).where(Role.name == '社长')
            ).all()
        )
    rows = db.scalars(select(Member).where(Member.id.in_(ids))).all() if ids else []
    emails = sorted({m.email for m in rows if m.email})
    skipped = sum(1 for m in rows if not m.email)
    return emails, skipped


def check_and_send_reminders() -> None:
    """扫描：赛前节点提醒；固定日期事项提醒；报名截止前催办。"""
    today = _china_today()
    with SessionLocal() as db:
        # 赛前提醒只看未开赛；事项提醒覆盖进行中（长期赛），故取 end >= today
        contests = db.scalars(
            select(Contest).where(Contest.end >= today).options(selectinload(Contest.milestones))
        ).all()
        for c in contests:
            days_left = (c.start - today).days
            if days_left < 0:
                days_left = 0
            # 窗口规则：节点按天数降序，每个节点只负责 (下一节点, 本节点] 这个区间
            nodes = sorted((int(x) for x in c.reminder_days.split(',') if x.strip().isdigit()), reverse=True)
            hit = None
            if c.start >= today:
                for i, n in enumerate(nodes):
                    lower = nodes[i + 1] if i + 1 < len(nodes) else 0
                    if lower < days_left <= n:
                        hit = n
                        break
            if hit is not None and c.remind_enabled and not _already_sent(db, c.id, hit, 'race'):
                recipients, skipped = _race_recipients(db, c)
                if recipients:
                    subject = f'[TopC] 比赛提醒：{c.name} 还有 {days_left} 天开赛'
                    body = (
                        f'各位参赛同学：\n\n'
                        f'比赛：{c.name}\n'
                        f'时间：{c.start} 至 {c.end}\n'
                        f'地点：{c.location or "待定"}\n\n'
                        f'距开赛还有 {days_left} 天，请提前做好准备。\n'
                        f'—— TopC 社团看板（自动提醒）'
                    )
                    real = send_email(recipients, subject, body)
                    db.add(
                        ReminderLog(
                            contest_id=c.id, days_before=hit, kind='race',
                            recipients=','.join(recipients), mocked=0 if real else 1, skipped=skipped,
                        )
                    )
                    db.commit()
                    log.info('[提醒] %s 赛前 %d 天节点已%s -> %d 人（跳过 %d 人无邮箱）', c.short, hit, '发送' if real else '模拟记录', len(recipients), skipped)

            # 固定日期事项：当天触发，收件人规则与赛前提醒一致
            if c.remind_enabled:
                for m in c.milestones:
                    if m.date == today and not _already_sent(db, c.id, 0, 'milestone', m.id):
                        recipients, skipped = _race_recipients(db, c)
                        if recipients:
                            subject = f'[TopC] 事项提醒：{c.name} · {m.title}'
                            body = (
                                f'各位同学：\n\n'
                                f'比赛：{c.name}\n'
                                f'事项：{m.title}\n'
                                f'日期：{m.date}（今天）\n\n'
                                f'请按时完成该事项。\n'
                                f'—— TopC 社团看板（自动提醒）'
                            )
                            real = send_email(recipients, subject, body)
                            db.add(
                                ReminderLog(
                                    contest_id=c.id, days_before=0, kind='milestone', milestone_id=m.id,
                                    note=m.title, recipients=','.join(recipients), mocked=0 if real else 1,
                                    skipped=skipped,
                                )
                            )
                            db.commit()
                            log.info('[事项] %s · %s 已%s -> %d 人（跳过 %d 人无邮箱）', c.short, m.title, '发送' if real else '模拟记录', len(recipients), skipped)

            # 报名催办：截止日前 [0, REGISTER_REMIND_DAYS] 窗口；收件人与赛前提醒相同（默认参赛者+社长）
            if c.register_by and c.register_by >= today:
                reg_left = (c.register_by - today).days
                if 0 <= reg_left <= REGISTER_REMIND_DAYS and not _already_sent(db, c.id, REGISTER_REMIND_DAYS, 'register'):
                    recipients, skipped = _race_recipients(db, c)
                    if recipients:
                        subject = f'[TopC] 报名催办：{c.name} 报名还剩 {reg_left} 天截止'
                        body = (
                            f'各位同学：\n\n'
                            f'比赛：{c.name}\n'
                            f'报名截止：{c.register_by}（还剩 {reg_left} 天）\n'
                            f'开赛时间：{c.start}\n\n'
                            f'请确认参赛名单与报名状态。\n'
                            f'—— TopC 社团看板（自动催办）'
                        )
                        real = send_email(recipients, subject, body)
                        db.add(
                            ReminderLog(
                                contest_id=c.id, days_before=REGISTER_REMIND_DAYS, kind='register',
                                recipients=','.join(recipients), mocked=0 if real else 1, skipped=skipped,
                            )
                        )
                        db.commit()
                        log.info('[催办] %s 报名剩 %d 天已%s -> %d 人（跳过 %d 人无邮箱）', c.short, reg_left, '发送' if real else '模拟记录', len(recipients), skipped)


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone='Asia/Shanghai')
    scheduler.add_job(check_and_send_reminders, 'interval', minutes=INTERVAL_MINUTES, id='reminder_scan')
    scheduler.start()
    log.info('提醒调度器已启动，每 %d 分钟扫描一次', INTERVAL_MINUTES)
    return scheduler
