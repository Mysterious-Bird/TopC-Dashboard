"""导入演示数据（与前端 mock 一致）。运行：python seed.py

职位体系（可扩展）：
- 社长：管理所有人
- 副社长：管理除社长外所有人
- AC部部长 / 设计部部长：各管本部成员
- 监察部部长：管理 AC部成员 + 设计部成员
- AC/设计/TC 部成员：普通职位
一个成员可挂多个职位（见下方 MEMBERS 的 roles 列表）。
"""
from datetime import date

from app.db import Base, SessionLocal, engine
from app.models import (
    Contest,
    ContestMilestone,
    ContestParticipant,
    ContestResult,
    Member,
    MemberRole,
    Role,
    RoleManage,
    Team,
    TeamMember,
)

# (name, sort, color, manages_all, excludes, manages)
ROLES = [
    ('社长', 1, '#22d3ee', True, [], []),
    ('副社长', 2, '#a78bfa', True, ['社长'], []),
    ('监察部部长', 3, '#f87171', False, [], ['AC部成员', '设计部成员']),
    ('AC部部长', 4, '#38bdf8', False, [], ['AC部成员']),
    ('设计部部长', 5, '#f472b6', False, [], ['设计部成员']),
    ('AC部成员', 10, '#34d399', False, [], []),
    ('设计部成员', 11, '#fbbf24', False, [], []),
    ('TC部成员', 12, '#c084fc', False, [], []),
]

MEMBERS = [
    # (name, gender, phone, qq, email, [roles], grade, major, student_id, tags, joined_at, color)
    ('林亦风', '男', '138****2201', '821034556', 'linyf@topc.dev', ['社长'], '大三', '计算机科学与技术', '2023****01', '全栈,Rust,架构', '2023-09-01', '#22d3ee'),
    ('苏晚星', '女', '137****8842', '790123884', 'suwx@topc.dev', ['副社长', 'TC部成员'], '大三', '软件工程', '2023****02', '算法,C++,竞赛', '2023-09-01', '#a78bfa'),
    ('赵擎苍', '男', '139****9024', '417766230', 'zhaoqc@topc.dev', ['监察部部长', 'AC部成员'], '大二', '网络空间安全', '2024****05', 'CTF,Pwn,逆向', '2024-09-02', '#f87171'),
    ('许青梧', '女', '188****5567', '552019376', 'xuqw@topc.dev', ['AC部部长'], '大二', '人工智能', '2024****04', 'DP,图论,Python', '2024-09-02', '#fbbf24'),
    ('顾清让', '女', '136****7743', '905512847', 'guqr@topc.dev', ['设计部部长'], '大二', '数字媒体技术', '2024****06', '设计,视频,运营', '2024-09-02', '#f472b6'),
    ('陈砚舟', '男', '150****3310', '630288145', 'chenyz@topc.dev', ['TC部成员'], '大二', '计算机科学与技术', '2024****03', '前端,React,Three.js', '2024-09-02', '#34d399'),
    ('何思源', '男', '155****4419', '308844961', 'hesy@topc.dev', ['TC部成员'], '大一', '计算机科学与技术', '2025****07', 'Go,后端', '2025-09-01', '#38bdf8'),
    ('沈知夏', '女', '152****6680', '223019458', 'shenzx@topc.dev', ['AC部成员'], '大一', '软件工程', '2025****08', 'Vue,TypeScript', '2025-09-01', '#4ade80'),
    ('韩景行', '男', '187****2255', '774120693', 'hanjx@topc.dev', ['AC部成员'], '大一', '人工智能', '2025****09', '数论,组合数学', '2025-09-01', '#facc15'),
    ('唐雨桐', '女', '135****8874', '661337209', 'tangyt@topc.dev', ['设计部成员'], '大一', '数据科学', '2025****10', '机器学习,PyTorch', '2025-09-01', '#c084fc'),
    ('罗亦凡', '男', '186****1102', '149885730', 'luoyf@topc.dev', ['AC部成员'], '大二', '网络空间安全', '2024****11', 'Web安全,渗透', '2024-09-02', '#fb923c'),
    ('纪云舒', '女', '158****3346', '330671284', 'jiys@topc.dev', ['AC部成员'], '大二', '信息安全', '2024****12', 'Crypto,Misc', '2024-09-02', '#2dd4bf'),
    ('温以凡', '男', '177****9921', '518203947', 'wenyf@topc.dev', ['设计部成员'], '大一', '数字媒体技术', '2025****13', '摄影,剪辑', '2025-09-01', '#e879f9'),
    ('白露白', '女', '133****5578', '882914630', '', ['设计部成员'], '大一', '视觉传达', '2025****14', '海报,UI', '2025-09-01', '#93c5fd'),
]

CONTESTS = [
    # (name, short, category, level, start, end, register_by, location, team_size, color, description, reminder_days,
    #  is_team, payload, remind_recipients(None=默认全体+社长))
    #  is_team=True 时 payload = [(队伍名, [成员 1-based idx])]；否则 payload = [成员 idx]
    ('ICPC 亚洲区域赛 · 南京站', 'ICPC 南京', '算法', '国际', '2026-10-17', '2026-10-18', '2026-09-25', '南京', 3, '#22d3ee', 'ACM-ICPC 亚洲区域赛，三人一队，5 小时 13 题。', '14,7,1',
     True, [('TopC 一队', [1, 2, 9]), ('TopC 二队', [8, 11, 12])], None),
    ('CCPC 中国大学生程序设计竞赛 · 哈尔滨站', 'CCPC 哈尔滨', '算法', '全国', '2026-09-19', '2026-09-20', '2026-09-01', '哈尔滨', 3, '#38bdf8', 'CCPC 分站赛，强校云集，目标银牌以上。', '14,7,1',
     True, [('CCPC 队', [2, 4, 9])], None),
    ('全国大学生信息安全竞赛 · 作品赛', '信安作品赛', '安全', '全国', '2026-08-05', '2026-08-28', '2026-06-30', '线上', 4, '#f87171', '作品赛阶段，提交安全工具原型并答辩。', '7,3,1',
     True, [('信安队', [3, 11, 12])], None,
     [('2026-08-19', '中期进度检查'), ('2026-08-26', '作品提交截止')]),
    ('强网杯 CTF 线上选拔赛', '强网杯', '安全', '全国', '2026-08-22', '2026-08-23', '2026-08-18', '线上', 4, '#fb923c', '36 小时线上 CTF，晋级线下决赛。', '7,3,1',
     True, [('强网队', [3, 11, 12, 1])], [3, 11, 12, 1]),  # 自定义：只提醒参赛队员
    ('中国高校计算机大赛 · 团体程序设计天梯赛', '天梯赛', '算法', '全国', '2026-11-21', '2026-11-21', '2026-11-01', '线上', 5, '#a78bfa', '10 人团体赛，分级计分，考察整体厚度。', '14,7,1',
     True, [('天梯一队', [2, 4, 7, 8, 9]), ('天梯二队', [10, 3, 11, 12, 6])], None),
    ('校级黑客松 · 智慧校园', '校黑客松', '开发', '校级', '2026-09-05', '2026-09-06', '2026-08-22', '本校创新楼', 4, '#34d399', '48 小时极限开发，主题为智慧校园应用。', '7,2,1',
     True, [('黑客松队', [6, 7, 8, 14])], None),
    ('Kaggle · LLM 科学推理赛', 'Kaggle LLM', 'AI', '国际', '2026-08-10', '2026-10-10', '2026-09-30', '线上', 3, '#c084fc', '大模型科学推理，线上长期赛，按周迭代提交。', '7,3',
     True, [('Kaggle 队', [10, 4])], None,
     [('2026-09-01', '阶段提交'), ('2026-10-05', '最终提交截止')]),
    ('全国大学生数学建模竞赛', '数学建模', '建模', '全国', '2026-09-10', '2026-09-13', '2026-09-03', '本校机房', 3, '#fbbf24', '三天三夜，建模 + 编程 + 论文。', '7,3,1',
     True, [('建模队', [9, 10, 4])], None),
    ('蓝桥杯全国总决赛 · 软件类', '蓝桥杯国赛', '算法', '全国', '2026-07-11', '2026-07-11', '2026-06-20', '线上', 1, '#60a5fa', '已完赛：本社获国二 1 项、国三 2 项。', '7,1',
     False, [7, 8, 11], None, [],
     [('国家级二等奖', [8], ''), ('国家级三等奖', [7, 11], '')]),
    ('微信小程序应用开发赛', '小程序赛', '开发', '全国', '2026-11-27', '2026-12-05', '2026-10-30', '线上', 4, '#2dd4bf', '作品提交制，含路演视频与文档。', '14,7,2',
     True, [('小程序队', [6, 8])], None),
]


def d(s: str) -> date:
    return date.fromisoformat(s)


def main() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.query(Member).count() > 0:
            print('已有数据，跳过 seed。如需重置请清空表后再运行。')
            return

        roles: dict[str, Role] = {}
        for name, sort, color, manages_all, excludes, manages in ROLES:
            r = Role(name=name, sort=sort, color=color, manages_all=manages_all, excludes=','.join(excludes))
            db.add(r)
            roles[name] = r
        db.flush()
        for name, _, _, _, _, manages in ROLES:
            for target in manages:
                db.add(RoleManage(manager_role_id=roles[name].id, managed_role_id=roles[target].id))

        members: list[Member] = []
        for row in MEMBERS:
            (name, gender, phone, qq, email, role_names, grade, major, sid, tags, joined, color) = row
            m = Member(
                name=name, gender=gender, phone=phone, qq=qq, email=email,
                grade=grade, major=major, student_id=sid, tags=tags,
                joined_at=d(joined), color=color,
            )
            db.add(m)
            db.flush()
            for rn in role_names:
                db.add(MemberRole(member_id=m.id, role_id=roles[rn].id))
            members.append(m)

        for row in CONTESTS:
            (name, short, cat, level, start, end, reg, loc, size, color, desc, rem, is_team, payload, remind_to) = row[:15]
            milestones = row[15] if len(row) > 15 else []
            results = row[16] if len(row) > 16 else []
            c = Contest(
                name=name, short=short, category=cat, level=level, start=d(start), end=d(end),
                register_by=d(reg), location=loc, team_size=size, color=color,
                description=desc, reminder_days=rem, is_team=is_team,
                remind_recipients=','.join(str(members[i - 1].id) for i in remind_to) if remind_to else '',
            )
            db.add(c)
            db.flush()
            if is_team:
                for team_name, idxs in payload:
                    t = Team(contest_id=c.id, name=team_name)
                    db.add(t)
                    db.flush()
                    for idx in idxs:
                        db.add(TeamMember(team_id=t.id, member_id=members[idx - 1].id))
            else:
                for idx in payload:
                    db.add(ContestParticipant(contest_id=c.id, member_id=members[idx - 1].id))
            for (mdate, mtitle) in milestones:
                db.add(ContestMilestone(contest_id=c.id, date=d(mdate), title=mtitle))
            for (award, idxs, note) in results:
                db.add(
                    ContestResult(
                        contest_id=c.id,
                        award=award,
                        member_ids=','.join(str(members[i - 1].id) for i in idxs),
                        note=note,
                    )
                )
        db.commit()
        print(f'seed 完成：{len(roles)} 个职位，{len(members)} 名成员，{len(CONTESTS)} 场比赛。')


if __name__ == '__main__':
    main()
