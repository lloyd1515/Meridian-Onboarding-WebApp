import asyncio
import json
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.logging_config import logger
from app.models import Employee
from app.schemas import SlackMessageRequest, SlackMessageResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _post_to_slack(webhook_url: str, message: str) -> bool:
    """Blocking POST of a Slack "incoming webhook" payload. Kept as a plain
    function (not inlined) so tests can monkeypatch it without hitting a real
    Slack URL, and run off the event loop via asyncio.to_thread since urllib
    is synchronous."""
    data = json.dumps({"text": message}).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return 200 <= response.status < 300
    except urllib.error.URLError as exc:
        logger.warning("Slack webhook delivery failed", error=str(exc))
        return False


@router.get("/slack/status", response_model=SlackMessageResponse)
async def get_slack_status(current_user: Employee = Depends(get_current_user)):
    """Lets the frontend decide whether to offer a "Send to Slack" button or
    fall back to copy-to-clipboard only."""
    return SlackMessageResponse(sent=False, configured=bool(settings.SLACK_WEBHOOK_URL))


@router.post("/slack", response_model=SlackMessageResponse)
async def send_slack_message(
    payload: SlackMessageRequest,
    current_user: Employee = Depends(get_current_user),
):
    """Posts a message to the configured Slack incoming webhook. Not an error
    when Slack isn't configured -- returns configured=False so callers can
    gracefully fall back to their existing copy-to-clipboard behavior."""
    if not settings.SLACK_WEBHOOK_URL:
        return SlackMessageResponse(sent=False, configured=False)

    sent = await asyncio.to_thread(_post_to_slack, settings.SLACK_WEBHOOK_URL, payload.message)
    return SlackMessageResponse(sent=sent, configured=True)
