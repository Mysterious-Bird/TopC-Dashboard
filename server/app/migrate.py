"""轻量 schema 修补：create_all 不会给已有表加列。"""
from sqlalchemy import inspect, text

from .db import engine
from .grade import enroll_year_from_legacy_grade


def ensure_member_enroll_year() -> None:
    insp = inspect(engine)
    if 'members' not in insp.get_table_names():
        return
    cols = {c['name'] for c in insp.get_columns('members')}
    with engine.begin() as conn:
        if 'enroll_year' not in cols:
            # SQLite / MySQL 都能吃这句
            conn.execute(text('ALTER TABLE members ADD COLUMN enroll_year INTEGER'))
        if 'grade' in cols:
            rows = conn.execute(
                text(
                    "SELECT id, grade FROM members "
                    "WHERE enroll_year IS NULL AND grade IS NOT NULL AND grade != ''"
                )
            ).fetchall()
            for mid, grade in rows:
                year = enroll_year_from_legacy_grade(grade)
                if year is not None:
                    conn.execute(
                        text('UPDATE members SET enroll_year = :y WHERE id = :id'),
                        {'y': year, 'id': mid},
                    )
