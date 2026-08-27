"""Outgoing mail over SMTP.

When MAIL_FROM / MAIL_PASSWORD are not configured the message is printed to the
console instead of being sent, so local development works without credentials.
"""
import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings

BG = "#1a1c1e"
SURFACE = "#22252a"
BORDER = "#32373f"
TEXT = "#e8e6e0"
MUTED = "#7a7f88"
ACCENT = "#a8b8c8"


def is_configured() -> bool:
    return bool(settings.MAIL_FROM and settings.MAIL_PASSWORD)


def _send(to_email: str, subject: str, body_text: str, body_html: str) -> bool:
    """Deliver one message. Returns False instead of raising, so a mail outage
    never fails the request that triggered it."""
    if not is_configured():
        print("[mail] SMTP not configured, printing message instead:")
        print(f"[mail] to={to_email} subject={subject}")
        print(body_text)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"Velox Pass <{settings.MAIL_FROM}>"
    message["To"] = to_email
    message.set_content(body_text)
    message.add_alternative(body_html, subtype="html")

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=20
        ) as smtp:
            smtp.login(settings.MAIL_FROM, settings.MAIL_PASSWORD)
            smtp.send_message(message)
        print(f"[mail] sent '{subject}' to {to_email}")
        return True
    except Exception as exc:
        print(f"[mail] failed to send to {to_email}: {exc}")
        return False


def _shell(inner: str) -> str:
    """Velox Pass dark-theme wrapper shared by every message."""
    return f"""\
<body style="margin:0;padding:0;background:{BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:{BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:{SURFACE};border:1px solid {BORDER};
                    border-radius:12px;overflow:hidden;">
        <tr><td style="height:4px;background:{ACCENT};"></td></tr>
        <tr><td style="padding:32px;font-family:'Segoe UI',Arial,sans-serif;color:{TEXT};">
          {inner}
        </td></tr>
      </table>
      <p style="max-width:520px;margin:16px auto 0;font-family:'Segoe UI',Arial,sans-serif;
                font-size:12px;color:{MUTED};text-align:center;">
        Velox Pass &middot; electronic ticketing
      </p>
    </td></tr>
  </table>
</body>"""


def send_verification_email(to_email: str, username: str, code: str) -> bool:
    """Email the six-digit code produced at registration."""
    subject = "Velox Pass — Verify your email"
    text = (
        f"Hi {username},\n\n"
        f"Your Velox Pass verification code is: {code}\n\n"
        "Enter it on the confirmation page to activate your account.\n"
        "The code is single use. If you did not create this account, ignore this email.\n"
    )
    inner = f"""\
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;color:{ACCENT};">
            VELOX&middot;PASS
          </p>
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:{TEXT};">
            Verify your email
          </h1>
          <p style="margin:0 0 8px;font-size:15px;color:{TEXT};">Hi {username},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:{MUTED};">
            Use this code to finish creating your Velox Pass account.
          </p>
          <div style="background:{BG};border:1px solid {BORDER};border-radius:10px;
                      padding:20px;text-align:center;margin:0 0 24px;">
            <span style="font-family:'Courier New',monospace;font-size:34px;
                         letter-spacing:10px;color:{TEXT};">{code}</span>
          </div>
          <p style="margin:0;font-size:13px;line-height:1.6;color:{MUTED};">
            The code can be used once. If you did not create this account,
            you can safely ignore this email.
          </p>"""
    return _send(to_email, subject, text, _shell(inner))


def send_ticket_email(to_email: str, username: str, event_title: str, ticket_id: str) -> bool:
    """Confirmation that a ticket has been issued."""
    subject = f"Velox Pass — your ticket for {event_title}"
    text = (
        f"Hi {username},\n\n"
        f"Your ticket for {event_title} is ready.\n"
        f"Ticket ID: {ticket_id}\n\n"
        "Open your cabinet in Velox Pass to download the PDF.\n"
    )
    inner = f"""\
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;color:{ACCENT};">
            VELOX&middot;PASS
          </p>
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:{TEXT};">
            Your ticket is ready
          </h1>
          <p style="margin:0 0 8px;font-size:15px;color:{TEXT};">Hi {username},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:{MUTED};">
            Your ticket for <strong style="color:{TEXT};">{event_title}</strong>
            has been issued.
          </p>
          <div style="background:{BG};border:1px solid {BORDER};border-radius:10px;
                      padding:16px;text-align:center;margin:0 0 24px;">
            <span style="font-family:'Courier New',monospace;font-size:16px;
                         letter-spacing:2px;color:{ACCENT};">{ticket_id}</span>
          </div>
          <p style="margin:0;font-size:13px;line-height:1.6;color:{MUTED};">
            Open your cabinet in Velox Pass to show the QR code or download the PDF.
          </p>"""
    return _send(to_email, subject, text, _shell(inner))
