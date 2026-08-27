"""入学年份 → 当前年级（每年 9 月 1 日升一级，最高大四，再往后为已毕业）。"""
from datetime import date, datetime
from zoneinfo import ZoneInfo

_LABELS = ('大一', '大二', '大三', '大四')
_LEGACY_OFFSET = {
    '大一': 0,
    '大二': 1,
    '大三': 2,
    '大四': 3,
    '已毕业': 4,
    '研究生': 4,
}
_CN_TZ = ZoneInfo('Asia/Shanghai')


def _china_today() -> date:
    return datetime.now(_CN_TZ).date()


def academic_year(today: date | None = None) -> int:
    """当前学年：9/1 起算新年；此前仍属上一年。"""
    today = today or _china_today()
    return today.year if (today.month, today.day) >= (9, 1) else today.year - 1


def grade_from_enroll_year(enroll_year: int | None, today: date | None = None) -> str:
    if not enroll_year:
        return ''
    n = academic_year(today) - enroll_year
    if n < 0:
        return '未入学'
    if n < 4:
        return _LABELS[n]
    return '已毕业'


def enroll_year_from_legacy_grade(grade: str, today: date | None = None) -> int | None:
    """把旧的「大一/大二…」文案反推入学年（按当前学年）。"""
    offset = _LEGACY_OFFSET.get((grade or '').strip())
    if offset is None:
        return None
    return academic_year(today) - offset
