"""Outgoing mail over SMTP.

When MAIL_FROM / MAIL_PASSWORD are not configured the message is printed to the
console instead of being sent, so local development works without credentials.
"""
import smtplib
from email.message import EmailMessage

from app.core.config import settings


def _send(to_email: str, subject: str, body_text: str, body_html: str) -> bool:
    if not settings.MAIL_FROM or not settings.MAIL_PASSWORD:
        print("[mail] SMTP not configured, printing message instead:")
        print(f"[mail] to={to_email} subject={subject}")
        print(body_text)
        return False

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.MAIL_FROM
    message["To"] = to_email
    message.set_content(body_text)
    message.add_alternative(body_html, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(settings.MAIL_FROM, settings.MAIL_PASSWORD)
            smtp.send_message(message)
        print(f"[mail] sent '{subject}' to {to_email}")
        return True
    except Exception as exc:  # network / auth problems must not break the request
        print(f"[mail] failed to send to {to_email}: {exc}")
        return False


def send_verification_email(to_email: str, username: str, code: str) -> bool:
    subject = "Velox Pass — confirm your email"
    text = (
        f"Hi {username},\n\n"
        f"Your Velox Pass confirmation code is: {code}\n\n"
        "Enter it on the confirmation page to activate your account.\n"
        "If you did not create this account, you can ignore this email.\n"
    )
    html = f"""
    <div style="font-family:Manrope,Arial,sans-serif;background:#1a1c1e;color:#e8e6e0;padding:32px">
      <h1 style="font-size:20px;letter-spacing:2px;margin:0 0 16px">VELOX&middot;PASS</h1>
      <p style="margin:0 0 12px">Hi {username},</p>
      <p style="margin:0 0 20px">Your confirmation code:</p>
      <p style="font-family:'JetBrains Mono',monospace;font-size:32px;letter-spacing:8px;
                background:#22252a;border:1px solid #32373f;border-radius:12px;
                padding:16px 24px;display:inline-block;margin:0 0 20px">{code}</p>
      <p style="color:#7a7f88;font-size:13px;margin:0">
        If you did not create this account, you can ignore this email.
      </p>
    </div>
    """
    return _send(to_email, subject, text, html)


def send_ticket_email(to_email: str, username: str, event_title: str, ticket_id: str) -> bool:
    subject = f"Velox Pass — your ticket for {event_title}"
    text = (
        f"Hi {username},\n\n"
        f"Your ticket for {event_title} is ready.\n"
        f"Ticket ID: {ticket_id}\n\n"
        "Open your cabinet in Velox Pass to download the PDF.\n"
    )
    html = f"""
    <div style="font-family:Manrope,Arial,sans-serif;background:#1a1c1e;color:#e8e6e0;padding:32px">
      <h1 style="font-size:20px;letter-spacing:2px;margin:0 0 16px">VELOX&middot;PASS</h1>
      <p style="margin:0 0 12px">Hi {username}, your ticket for
         <strong>{event_title}</strong> is ready.</p>
      <p style="font-family:'JetBrains Mono',monospace;font-size:16px;color:#a8b8c8;margin:0">
        {ticket_id}
      </p>
    </div>
    """
    return _send(to_email, subject, text, html)
