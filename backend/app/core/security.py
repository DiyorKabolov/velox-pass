"""Password hashing and JWT creation / verification."""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# passlib 1.7.4 probes bcrypt.__about__, which bcrypt >= 4.1 removed. The error
# is trapped internally but still logged, so quiet that one logger.
logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.ERROR)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    # bcrypt only consumes the first 72 bytes; truncate so long inputs don't error.
    return pwd_context.hash(password[:72])


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_password[:72], password_hash)
    except ValueError:
        return False


def create_access_token(
    subject: str | int,
    extra: Optional[dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload: dict[str, Any] = {"sub": str(subject), "exp": expire}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    """Return the token payload, or None when the token is invalid or expired."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def verify_token(token: str) -> Optional[int]:
    """Return the user id encoded in the token, or None when it is not usable."""
    payload = decode_access_token(token)
    if not payload:
        return None
    subject = payload.get("sub")
    if subject is None:
        return None
    try:
        return int(subject)
    except (TypeError, ValueError):
        return None


def generate_verification_code() -> str:
    """Six-digit numeric code emailed to the user after registration."""
    return f"{secrets.randbelow(1_000_000):06d}"
