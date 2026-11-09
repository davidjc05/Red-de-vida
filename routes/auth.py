from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserCreate, UserOut, UserUpdate, Token

from auth.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

from permissions import require_admin
from email_codes import issue_code, check_code
from email_service import email_enabled, send_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _send_code(db: Session, email: str, purpose: str) -> None:
    """Genera y envía un código. Si se pidió otro hace <1 min, no hace nada."""
    code = issue_code(db, email, purpose)
    if code is None:
        return
    if purpose == "verify":
        subject = "Tu código de verificación de Red de Vida"
        body = f"Tu código para verificar tu email es: {code}\n\nCaduca en 15 minutos. Si no lo has pedido tú, ignora este mensaje."
    else:
        subject = "Recupera tu contraseña de Red de Vida"
        body = f"Tu código para cambiar la contraseña es: {code}\n\nCaduca en 15 minutos. Si no lo has pedido tú, ignora este mensaje."
    try:
        send_email(email, subject, body)
    except Exception as e:  # no se filtra el motivo al cliente
        print(f"[email] fallo enviando a {email}: {e}")


class EmailIn(BaseModel):
    email: EmailStr


class VerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ResetIn(VerifyIn):
    new_password: str = Field(min_length=8, max_length=72)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


@router.post("/register", response_model=UserOut, status_code=201)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing and existing.email_verified:
        raise HTTPException(400, "Email ya registrado")

    is_first_user = db.query(User).count() == 0

    role = "admin" if is_first_user else "client"
    # El primer usuario (entrenador) entra directo; los clientes esperan aprobación.
    account_status = "active" if is_first_user else "pending"

    needs_verification = email_enabled()

    if existing:
        # Alguien se registró con este email y nunca lo verificó: se rehace esa cuenta
        # (así nadie puede bloquear el email de otra persona con un registro falso).
        user = existing
        user.name = user_in.name.strip()
        user.hashed_password = hash_password(user_in.password)
        user.phone = user_in.phone
        user.country = user_in.country
        user.city = user_in.city
        user.birth_date = user_in.birth_date
    else:
        user = User(
            name=user_in.name.strip(),
            email=user_in.email,
            hashed_password=hash_password(user_in.password),
            role=role,
            status=account_status,
            phone=user_in.phone,
            country=user_in.country,
            city=user_in.city,
            birth_date=user_in.birth_date,
        )
        db.add(user)

    user.email_verified = not needs_verification
    db.commit()
    db.refresh(user)

    if needs_verification:
        _send_code(db, user.email, "verify")

    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Credenciales incorrectas")

    if not user.email_verified:
        raise HTTPException(403, "EMAIL_NO_VERIFICADO")

    if user.role != "admin":
        if user.status == "pending":
            raise HTTPException(403, "Tu cuenta está pendiente de aprobación por tu entrenador.")
        if user.status == "suspended":
            raise HTTPException(403, "Tu suscripción está cancelada. Contacta con tu entrenador.")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # exclude_unset: solo se tocan los campos enviados (así se puede vaciar uno mandando "")
    for field, value in data.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip() or None
        if field == "name" and value is None:
            continue  # el nombre no puede quedar vacío
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/users/{user_id}/promote", response_model=UserOut)
def promote(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(404, "Usuario no encontrado")

    user.role = "admin"
    db.commit()
    db.refresh(user)

    return user


# ─────────────────────────────────────────
# VERIFICAR EMAIL / RECUPERAR Y CAMBIAR CONTRASEÑA
# ─────────────────────────────────────────

@router.post("/verify-email")
def verify_email(data: VerifyIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not check_code(db, data.email, "verify", data.code):
        raise HTTPException(400, "Código incorrecto o caducado")
    user.email_verified = True
    db.commit()
    return {"ok": True, "status": user.status}


@router.post("/resend-code")
def resend_code(data: EmailIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if user and not user.email_verified and email_enabled():
        _send_code(db, data.email, "verify")
    return {"ok": True}  # misma respuesta exista o no el email


@router.post("/forgot-password")
def forgot_password(data: EmailIn, db: Session = Depends(get_db)):
    if not email_enabled():
        raise HTTPException(503, "El envío de correos no está configurado en el servidor")
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        _send_code(db, data.email, "reset")
    return {"ok": True}  # misma respuesta exista o no el email


@router.post("/reset-password")
def reset_password(data: ResetIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not check_code(db, data.email, "reset", data.code):
        raise HTTPException(400, "Código incorrecto o caducado")
    user.hashed_password = hash_password(data.new_password)
    user.email_verified = True  # recibió el código en su correo
    db.commit()
    return {"ok": True}


@router.post("/change-password")
def change_password(
    data: ChangePasswordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(400, "La contraseña actual no es correcta")
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}
