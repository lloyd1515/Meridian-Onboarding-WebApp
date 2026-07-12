"""Standalone script: builds and sends the HR email digest (open questions +
overdue checklist tasks). Not a running service -- meant to be invoked
periodically by cron (see README.md's "Email digest" section).

Safe to run in any environment: if SMTP isn't configured (SMTP_HOST or
DIGEST_RECIPIENT_EMAILS unset), it logs the digest content and exits 0
instead of crashing, so a cron job that blindly runs this on a schedule
doesn't break a deployment that hasn't set up SMTP yet.
"""
import asyncio
import smtplib
from email.mime.text import MIMEText
from typing import List

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.email_digest import DIGEST_SUBJECT, build_digest, render_digest_text
from app.core.logging_config import logger


def send_email(subject: str, body: str, recipients: List[str]) -> None:
    """Send `body` as a plain-text email via smtplib. Assumes SMTP_HOST is
    configured -- callers should check settings before calling this."""
    msg = MIMEText(body, "plain")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_ADDRESS or settings.SMTP_USERNAME or "no-reply@meridian.invalid"
    msg["To"] = ", ".join(recipients)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
        server.starttls()
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(msg["From"], recipients, msg.as_string())


async def run_digest() -> None:
    """Build the digest and either send it or, if SMTP isn't configured,
    log it and return without error."""
    async with AsyncSessionLocal() as session:
        digest = await build_digest(session)

    body = render_digest_text(digest)
    recipients = settings.digest_recipient_list()

    if not settings.SMTP_HOST or not recipients:
        logger.info(
            "email_digest.noop",
            reason="SMTP_HOST/DIGEST_RECIPIENT_EMAILS not configured",
            open_question_count=len(digest.open_questions),
            overdue_task_count=len(digest.overdue_tasks),
            body=body,
        )
        return

    send_email(DIGEST_SUBJECT, body, recipients)
    logger.info(
        "email_digest.sent",
        recipients=recipients,
        open_question_count=len(digest.open_questions),
        overdue_task_count=len(digest.overdue_tasks),
    )


if __name__ == "__main__":
    asyncio.run(run_digest())
