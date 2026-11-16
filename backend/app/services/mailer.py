"""Transactional email through Resend (https://resend.com).

Without RESEND_API_KEY the email is written to the log instead, so development and
tests never send real mail. Sending never raises: a failed email must not break an
order or a password reset.
"""

import html
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("terralens")

BRAND = "#1E4D3B"


def send_email(to: str, subject: str, heading: str, paragraphs: list[str], button: tuple[str, str] | None = None) -> bool:
    body_html = render(heading, paragraphs, button)
    text = "\n\n".join([heading, *paragraphs] + ([f"{button[0]}: {button[1]}"] if button else []))
    if not settings.resend_api_key:
        logger.info("Email (not sent, no RESEND_API_KEY) to=%s subject=%s\n%s", to, subject, text)
        return False
    try:
        r = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": settings.mail_from, "to": [to], "subject": subject, "html": body_html, "text": text},
            timeout=8,
        )
        if r.status_code >= 300:
            logger.warning("Resend refused email to %s: %s %s", to, r.status_code, r.text[:300])
            return False
        return True
    except httpx.HTTPError:
        logger.exception("Could not reach Resend")
        return False


def render(heading: str, paragraphs: list[str], button: tuple[str, str] | None) -> str:
    """Simple, email-client-safe HTML (tables and inline styles only)."""
    paras = "".join(
        f'<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#33413b">{p}</p>' for p in paragraphs
    )
    btn = ""
    if button:
        label, url = button
        btn = (
            f'<p style="margin:22px 0"><a href="{html.escape(url, quote=True)}" '
            f'style="background:{BRAND};color:#fff;text-decoration:none;padding:12px 22px;'
            f'border-radius:999px;font-weight:600;font-size:15px;display:inline-block">{html.escape(label)}</a></p>'
        )
    return f"""<!doctype html><html><body style="margin:0;background:#f3f6f2;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px">
<tr><td style="background:{BRAND};border-radius:16px 16px 0 0;padding:18px 26px;color:#fff;font-size:20px;font-weight:700">Terralens</td></tr>
<tr><td style="padding:26px">
<h1 style="margin:0 0 16px;font-size:21px;color:#16241e">{html.escape(heading)}</h1>
{paras}{btn}
</td></tr>
<tr><td style="padding:0 26px 22px;font-size:12px;color:#7a8780">GI-tagged products from Tamil Nadu, sold wholesale.</td></tr>
</table></td></tr></table></body></html>"""


def esc(value) -> str:
    """Escape user-entered text (names, addresses) before putting it into an email."""
    return html.escape(str(value))
