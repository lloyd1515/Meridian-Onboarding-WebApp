from unittest.mock import MagicMock, patch

import pytest

import scripts.send_digest as send_digest


@pytest.mark.asyncio
async def test_run_digest_noop_when_smtp_unconfigured(db_session, monkeypatch):
    """With no SMTP_HOST/recipients configured, run_digest() must not raise
    and must not attempt any network connection."""
    monkeypatch.setattr(send_digest.settings, "SMTP_HOST", None)
    monkeypatch.setattr(send_digest.settings, "DIGEST_RECIPIENT_EMAILS", None)

    with patch("scripts.send_digest.AsyncSessionLocal") as mock_session_local:
        mock_session_local.return_value.__aenter__.return_value = db_session
        mock_session_local.return_value.__aexit__.return_value = False

        with patch("smtplib.SMTP") as mock_smtp:
            await send_digest.run_digest()
            mock_smtp.assert_not_called()


@pytest.mark.asyncio
async def test_run_digest_noop_when_recipients_missing(db_session, monkeypatch):
    """SMTP_HOST alone isn't enough -- without recipients it should still no-op."""
    monkeypatch.setattr(send_digest.settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(send_digest.settings, "DIGEST_RECIPIENT_EMAILS", None)

    with patch("scripts.send_digest.AsyncSessionLocal") as mock_session_local:
        mock_session_local.return_value.__aenter__.return_value = db_session
        mock_session_local.return_value.__aexit__.return_value = False

        with patch("smtplib.SMTP") as mock_smtp:
            await send_digest.run_digest()
            mock_smtp.assert_not_called()


@pytest.mark.asyncio
async def test_run_digest_sends_when_configured(db_session, monkeypatch):
    monkeypatch.setattr(send_digest.settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(send_digest.settings, "SMTP_PORT", 587)
    monkeypatch.setattr(send_digest.settings, "SMTP_USERNAME", "user")
    monkeypatch.setattr(send_digest.settings, "SMTP_PASSWORD", "pass")
    monkeypatch.setattr(send_digest.settings, "SMTP_FROM_ADDRESS", "hr@meridian.com")
    monkeypatch.setattr(send_digest.settings, "DIGEST_RECIPIENT_EMAILS", "hr@meridian.com,ops@meridian.com")

    with patch("scripts.send_digest.AsyncSessionLocal") as mock_session_local:
        mock_session_local.return_value.__aenter__.return_value = db_session
        mock_session_local.return_value.__aexit__.return_value = False

        with patch("smtplib.SMTP") as mock_smtp_cls:
            mock_server = MagicMock()
            mock_smtp_cls.return_value.__enter__.return_value = mock_server

            await send_digest.run_digest()

            mock_smtp_cls.assert_called_once_with("smtp.example.com", 587, timeout=30)
            mock_server.starttls.assert_called_once()
            mock_server.login.assert_called_once_with("user", "pass")
            mock_server.sendmail.assert_called_once()
            args, _ = mock_server.sendmail.call_args
            assert args[0] == "hr@meridian.com"
            assert args[1] == ["hr@meridian.com", "ops@meridian.com"]


def test_send_email_builds_message_and_uses_smtp(monkeypatch):
    monkeypatch.setattr(send_digest.settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(send_digest.settings, "SMTP_PORT", 2525)
    monkeypatch.setattr(send_digest.settings, "SMTP_USERNAME", None)
    monkeypatch.setattr(send_digest.settings, "SMTP_PASSWORD", None)
    monkeypatch.setattr(send_digest.settings, "SMTP_FROM_ADDRESS", None)

    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        send_digest.send_email("Subject", "Body text", ["a@b.com"])

        mock_smtp_cls.assert_called_once_with("smtp.example.com", 2525, timeout=30)
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_not_called()
        mock_server.sendmail.assert_called_once()
