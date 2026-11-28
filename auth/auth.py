import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import bcrypt
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import User

# ─── CONFIG ─────────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY no está definida (o es demasiado corta) en el .env. "
        "Genera una con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ─── PASSWORD ───────────────────────────────────────────

# bcrypt directamente (passlib ya no se mantiene). Los hashes antiguos de passlib son
# bcrypt estándar ($2b$...), así que las contraseñas de siempre siguen funcionando.
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:  # hash vacío o con formato raro
        return False

# ─── TOKEN ──────────────────────────────────────────────

def normalize_email(email: str) -> str:
    return email.strip().lower()


def find_user_by_email(db: Session, email: str):
    """Busca el usuario sin distinguir mayúsculas (también encuentra cuentas antiguas
    guardadas con mayúsculas)."""
    return (
        db.query(User)
        .filter(func.lower(User.email) == normalize_email(email))
        .order_by(User.id)
        .first()
    )


def token_for(user: User) -> str:
    """Token de sesión. Lleva la versión de la contraseña: al cambiarla, los anteriores caducan."""
    return create_access_token({"sub": str(user.id), "tv": user.token_version or 0})


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    # ⚠️ IMPORTANTE: aseguramos que sub es string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])

    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# ─── USER ACTUAL ────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")

        if user_id is None:
            raise credentials_exception

    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()

    if user is None:
        raise credentials_exception

    # Token de antes de un cambio de contraseña: ya no vale
    if payload.get("tv", 0) != (user.token_version or 0):
        raise credentials_exception

    # Un cliente pendiente o con la suscripción cancelada pierde el acceso al instante,
    # aunque conserve un token válido. El entrenador (admin) nunca se bloquea.
    if user.role != "admin" and user.status != "active":
        raise HTTPException(
            status_code=401,
            detail="Cuenta no activa",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

# ─── SOLO ADMIN ─────────────────────────────────────────

def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")
    return current_user