import logging
import os
import smtplib
from email.header import Header
from email.mime.text import MIMEText

log = logging.getLogger('topc.mailer')

SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.qq.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '465'))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'TopC 社团看板')


def smtp_configured() -> bool:
    return bool(SMTP_USER and SMTP_PASSWORD)


def send_email(to: list[str], subject: str, body_text: str) -> bool:
    """发送邮件。未配置 SMTP 时进入模拟模式，仅打印日志。返回 True=真实发送。"""
    to = [t for t in to if t]
    if not to:
        log.info('[邮件] 无收件人，跳过: %s', subject)
        return True

    if not smtp_configured():
        log.info('[模拟发送] -> %s | %s\n%s', ', '.join(to), subject, body_text)
        return False

    msg = MIMEText(body_text, 'plain', 'utf-8')
    msg['From'] = f'{Header(SMTP_FROM_NAME, "utf-8").encode()} <{SMTP_USER}>'
    msg['To'] = ', '.join(to)
    msg['Subject'] = Header(subject, 'utf-8')

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.sendmail(SMTP_USER, to, msg.as_string())
    log.info('[邮件] 已发送 -> %s | %s', ', '.join(to), subject)
    return True
