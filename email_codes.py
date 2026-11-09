"""Códigos de 6 dígitos de un solo uso (verificar email / recuperar contraseña)."""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from models import EmailCode

CODE_TTL_MIN = 15
RESEND_COOLDOWN_S = 60
MAX_ATTEMPTS = 5


def _hash(email: str, purpose: str, code: str) -> str:
    key = os.environ["SECRET_KEY"].encode()
    return hmac.new(key, f"{email}:{purpose}:{code}".encode(), hashlib.sha256).hexdigest()


def issue_code(db: Session, email: str, purpose: str) -> str | None:
    """Crea un código nuevo. Devuelve None si se pidió otro hace menos de un minuto."""
    now = datetime.utcnow()
    last = (
        db.query(EmailCode)
        .filter(EmailCode.email == email, EmailCode.purpose == purpose)
        .order_by(EmailCode.created_at.desc())
        .first()
    )
    if last and (now - last.created_at).total_seconds() < RESEND_COOLDOWN_S:
        return None

    db.query(EmailCode).filter(EmailCode.email == email, EmailCode.purpose == purpose).delete()
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(EmailCode(
        email=email, purpose=purpose, code_hash=_hash(email, purpose, code),
        expires_at=now + timedelta(minutes=CODE_TTL_MIN), attempts=0, created_at=now,
    ))
    db.commit()
    return code


def check_code(db: Session, email: str, purpose: str, code: str) -> bool:
    row = (
        db.query(EmailCode)
        .filter(EmailCode.email == email, EmailCode.purpose == purpose)
        .first()
    )
    if not row or row.expires_at < datetime.utcnow() or row.attempts >= MAX_ATTEMPTS:
        return False

    if not hmac.compare_digest(row.code_hash, _hash(email, purpose, code.strip())):
        row.attempts += 1
        db.commit()
        return False

    db.delete(row)  # un solo uso
    db.commit()
    return True
