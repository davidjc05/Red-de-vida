from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import resend
import secrets
import os

from database import get_db
from models import User
from schemas import UserCreate, UserOut, Token
from auth.auth import (
    hash_password, verify_password,
    create_access_token, get_current_user,
)
from permissions import require_admin

resend.api_key = os.getenv("RESEND_API_KEY")  # ← añade esto a tu .env del backend

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(400, "Email ya registrado")

    is_first_user = db.query(User).count() == 0
    role = "admin" if is_first_user else "client"
    token = secrets.token_urlsafe(32)

    user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=role,
        is_verified=is_first_user,   # el primer usuario (admin) no necesita verificar
        verification_token=None if is_first_user else token,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Enviar email de verificación si no es admin
    if not is_first_user:
        resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": "djc0009@alu.medac.es",
            "subject": "Confirma tu cuenta",
            "html": f"""
                <h2>Bienvenido a Red de Vida 💪</h2>
                <p>Haz clic para confirmar tu cuenta:</p>
                <a href="https://pajamas-operable-traitor.ngrok-free.dev/auth/verify?token={token}">
                    Confirmar cuenta
                </a>
            """
        })

    return user


@router.get("/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()

    if not user:
        raise HTTPException(400, "Token inválido o ya usado")

    user.is_verified = True
    user.verification_token = None
    db.commit()

    return {"msg": "Email confirmado, ya puedes iniciar sesión ✅"}


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Credenciales incorrectas")

    # ← NUEVA COMPROBACIÓN
    if not user.is_verified:
        raise HTTPException(403, "Confirma tu email antes de entrar")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
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