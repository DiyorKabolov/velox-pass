"""Outgoing mail over SMTP.

When MAIL_FROM / MAIL_PASSWORD are not configured the message is printed to the
console instead of being sent, so local development works without credentials.
"""
import html
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


def send_friend_request_email(
    to_email: str, requester_username: str, accept_url: str, decline_url: str
) -> bool:
    """Invite someone to be friends, with a link to accept and one to decline.

    The username is chosen by whoever sent the request, so it is escaped before
    it goes into the HTML, and stripped of line breaks before the subject: a
    name carrying markup would otherwise restyle the message, and one carrying
    a newline would be refused as a header.
    """
    name = " ".join(requester_username.split())
    safe_name = html.escape(name)
    accept = html.escape(accept_url, quote=True)
    decline = html.escape(decline_url, quote=True)

    subject = f"{name} хочет добавить вас в друзья на Velox Pass"
    text = (
        f"{name} приглашает вас в друзья на Velox Pass.\n\n"
        f"Принять: {accept_url}\n"
        f"Отклонить: {decline_url}\n\n"
        "Если вы не знаете этого человека, просто проигнорируйте письмо.\n"
    )
    inner = f"""\
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;color:{ACCENT};">
            VELOX&middot;PASS
          </p>
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:{TEXT};">
            Приглашение в друзья
          </h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:{MUTED};">
            <strong style="color:{TEXT};">{safe_name}</strong>
            приглашает вас в друзья на Velox Pass.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
            <tr>
              <td style="padding-right:12px;">
                <a href="{accept}"
                   style="display:inline-block;padding:12px 26px;border-radius:8px;
                          background:{ACCENT};color:{BG};font-size:15px;font-weight:600;
                          text-decoration:none;">Принять</a>
              </td>
              <td>
                <a href="{decline}"
                   style="display:inline-block;padding:11px 25px;border-radius:8px;
                          border:1px solid {BORDER};color:{MUTED};font-size:15px;
                          text-decoration:none;">Отклонить</a>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.6;color:{MUTED};">
            Если вы не знаете этого человека, просто проигнорируйте письмо.
          </p>"""
    return _send(to_email, subject, text, _shell(inner))


def _paragraphs(text: str) -> str:
    """Escaped, with line breaks kept -- a gift message may run to several."""
    return "<br>".join(html.escape(line) for line in text.splitlines())


def send_gift_email(
    to_email: str,
    sender_username: str,
    message: str | None,
    event_title: str,
    when_text: str,
    location: str | None,
    accept_url: str,
    decline_url: str,
) -> bool:
    """Tell someone a friend has given them a ticket.

    Every string here but the links is written by a user -- the sender's name,
    their message, the event's title and address -- so all of it is escaped
    before it reaches the HTML, and the subject loses any line breaks.
    """
    sender = " ".join(sender_username.split())
    title = " ".join(event_title.split())
    subject = f"{sender} дарит вам билет на {title}!"

    details = " · ".join(part for part in (when_text, location) if part)
    text = (
        "Вам подарили билет!\n\n"
        + (f"{sender}: {message}\n\n" if message else f"От: {sender}\n\n")
        + f"{title}\n{details}\n\n"
        + f"Принять подарок: {accept_url}\n"
        + f"Отклонить: {decline_url}\n"
    )

    quote_block = (
        f"""<div style="background:{BG};border-left:3px solid #fbbf24;border-radius:6px;
                        padding:14px 16px;margin:0 0 20px;font-size:15px;line-height:1.6;color:{TEXT};">
              <strong style="color:#fbbf24;">{html.escape(sender)}:</strong>
              {_paragraphs(message)}
            </div>"""
        if message
        else f"""<p style="margin:0 0 20px;font-size:15px;color:{MUTED};">
              От: <strong style="color:{TEXT};">{html.escape(sender)}</strong></p>"""
    )
    inner = f"""
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;color:#fbbf24;">
            VELOX&middot;PASS
          </p>
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:{TEXT};">
            &#127873; Вам подарили билет!
          </h1>
          {quote_block}
          <div style="border:1px solid {BORDER};border-radius:10px;padding:16px;margin:0 0 24px;">
            <p style="margin:0 0 6px;font-size:17px;font-weight:600;color:{TEXT};">{html.escape(title)}</p>
            <p style="margin:0;font-size:14px;color:{MUTED};">{html.escape(details)}</p>
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
            <tr>
              <td style="padding-right:12px;">
                <a href="{html.escape(accept_url, quote=True)}"
                   style="display:inline-block;padding:12px 26px;border-radius:8px;
                          background:#fbbf24;color:{BG};font-size:15px;font-weight:600;
                          text-decoration:none;">Принять подарок</a>
              </td>
              <td>
                <a href="{html.escape(decline_url, quote=True)}"
                   style="display:inline-block;padding:11px 25px;border-radius:8px;
                          border:1px solid {BORDER};color:{MUTED};font-size:15px;
                          text-decoration:none;">Отклонить</a>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;line-height:1.6;color:{MUTED};">
            Если отклонить, билет вернётся к {html.escape(sender)}.
          </p>"""
    return _send(to_email, subject, text, _shell(inner))


def send_gift_declined_email(to_email: str, recipient_username: str, event_title: str) -> bool:
    """Tell the giver their gift came back, and that the ticket is theirs again."""
    recipient = " ".join(recipient_username.split())
    title = " ".join(event_title.split())
    subject = "Ваш подарок был отклонён"
    text = (
        f"{recipient} отклонил(а) билет на {title}.\n\n"
        "Билет вернулся к вам и снова в разделе «Мои билеты». "
        "Его код обновлён — скачайте PDF заново.\n"
    )
    inner = f"""
          <p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;color:{ACCENT};">
            VELOX&middot;PASS
          </p>
          <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:{TEXT};">
            Ваш подарок был отклонён
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:{MUTED};">
            <strong style="color:{TEXT};">{html.escape(recipient)}</strong> отклонил(а) билет на
            <strong style="color:{TEXT};">{html.escape(title)}</strong>.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:{MUTED};">
            Билет вернулся к вам и снова в разделе «Мои билеты». Его код обновлён —
            если вы скачивали PDF, скачайте его заново.
          </p>"""
    return _send(to_email, subject, text, _shell(inner))
