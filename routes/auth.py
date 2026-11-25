from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from database import get_db
import reminders
from account import erase_client
from legal import PRIVACY_VERSION
from models import Activity, Assignment, FormSend, User, WorkoutLog
from schemas import UserCreate, UserOut, UserUpdate, Token

from auth.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

import ratelimit
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


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)  # UTC sin zona, como el resto de columnas


class DeleteAccountIn(BaseModel):
    password: str


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
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    ratelimit.hit(f"register:ip:{ratelimit.client_ip(request)}", 10, 3600)
    missing = [
        label for label, value in (
            ("teléfono", user_in.phone), ("país", user_in.country),
            ("ciudad", user_in.city), ("fecha de nacimiento", user_in.birth_date),
        ) if not value
    ]
    if missing:
        raise HTTPException(422, "Faltan datos obligatorios: " + ", ".join(missing))
    if not user_in.accept_terms:
        raise HTTPException(422, "Debes aceptar la política de privacidad para crear tu cuenta")

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
        user.consent_at = _now()
        user.consent_version = PRIVACY_VERSION
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
            consent_at=_now(),
            consent_version=PRIVACY_VERSION,
        )
        db.add(user)

    user.email_verified = not needs_verification
    db.commit()
    db.refresh(user)

    if needs_verification:
        _send_code(db, user.email, "verify")

    return user


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # Límite por IP (general) y por email (solo cuenta los fallos): frena la adivinación de contraseñas
    ratelimit.hit(f"login:ip:{ratelimit.client_ip(request)}", 30, 600)
    email_key = f"login:fail:{form_data.username.strip().lower()}"
    ratelimit.blocked(email_key, 5, 900)

    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        ratelimit.fail(email_key, 900)
        raise HTTPException(401, "Credenciales incorrectas")

    ratelimit.reset(email_key)

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
        if field == "email_reminders" and value is None:
            continue
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
def verify_email(request: Request, data: VerifyIn, db: Session = Depends(get_db)):
    ratelimit.hit(f"verify:ip:{ratelimit.client_ip(request)}", 30, 900)
    ratelimit.hit(f"verify:email:{data.email.lower()}", 10, 900)
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not check_code(db, data.email, "verify", data.code):
        raise HTTPException(400, "Código incorrecto o caducado")
    user.email_verified = True
    db.commit()
    return {"ok": True, "status": user.status}


@router.post("/resend-code")
def resend_code(request: Request, data: EmailIn, db: Session = Depends(get_db)):
    ratelimit.hit(f"mail:ip:{ratelimit.client_ip(request)}", 10, 900)
    ratelimit.hit(f"mail:email:{data.email.lower()}", 5, 900)
    user = db.query(User).filter(User.email == data.email).first()
    if user and not user.email_verified and email_enabled():
        _send_code(db, data.email, "verify")
    return {"ok": True}  # misma respuesta exista o no el email


@router.post("/forgot-password")
def forgot_password(request: Request, data: EmailIn, db: Session = Depends(get_db)):
    ratelimit.hit(f"mail:ip:{ratelimit.client_ip(request)}", 10, 900)
    ratelimit.hit(f"mail:email:{data.email.lower()}", 5, 900)
    if not email_enabled():
        raise HTTPException(503, "El envío de correos no está configurado en el servidor")
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        _send_code(db, data.email, "reset")
    return {"ok": True}  # misma respuesta exista o no el email


@router.post("/reset-password")
def reset_password(request: Request, data: ResetIn, db: Session = Depends(get_db)):
    ratelimit.hit(f"verify:ip:{ratelimit.client_ip(request)}", 30, 900)
    ratelimit.hit(f"verify:email:{data.email.lower()}", 10, 900)
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
    ratelimit.hit(f"pw:user:{current_user.id}", 10, 900)
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(400, "La contraseña actual no es correcta")
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────
# DERECHOS DEL USUARIO (RGPD): descargar sus datos y borrar su cuenta
# ─────────────────────────────────────────

@router.get("/me/export")
def export_my_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Devuelve en JSON todos los datos que la app guarda de la persona que lo pide."""
    uid = current_user.id
    assignments = (
        db.query(Assignment).filter(Assignment.assigned_to_id == uid).order_by(Assignment.date).all()
    )
    logs = db.query(WorkoutLog).filter(WorkoutLog.user_id == uid).order_by(WorkoutLog.created_at, WorkoutLog.id).all()
    activities = db.query(Activity).filter(Activity.user_id == uid).order_by(Activity.started_at).all()
    sends = db.query(FormSend).filter(FormSend.user_id == uid).order_by(FormSend.sent_at).all()

    data = {
        "perfil": {
            "nombre": current_user.name,
            "email": current_user.email,
            "telefono": current_user.phone,
            "pais": current_user.country,
            "ciudad": current_user.city,
            "fecha_nacimiento": current_user.birth_date,
            "peso_kg": current_user.weight_kg,
            "rol": current_user.role,
            "estado": current_user.status,
            "politica_aceptada_el": current_user.consent_at,
            "politica_version": current_user.consent_version,
        },
        "rutinas_asignadas": [
            {
                "fecha": a.date,
                "rutina": a.routine.name if a.routine else None,
                "estado": a.status,
                "nota": a.note,
                "confirmada_el": a.confirmed_at,
            }
            for a in assignments
        ],
        "registros_de_entrenamiento": [
            {
                "fecha": l.created_at,
                "ejercicio": l.exercise.name if l.exercise else None,
                "serie": l.set_number or 1,
                "kg": l.kg,
                "repeticiones": l.reps,
            }
            for l in logs
        ],
        "actividad": [
            {
                "tipo": a.kind,
                "inicio": a.started_at,
                "segundos": a.elapsed_s,
                "distancia_m": a.distance_m,
                "kcal": a.kcal,
            }
            for a in activities
        ],
        "formularios_recibidos": [
            {"titulo": s.form.title if s.form else None, "enviado_el": s.sent_at} for s in sends
        ],
    }
    return JSONResponse(
        content=jsonable_encoder(data),
        headers={"Content-Disposition": 'attachment; filename="mis-datos-red-de-vida.json"'},
    )


@router.post("/me/delete")
def delete_my_account(
    data: DeleteAccountIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El propio cliente borra su cuenta y todos sus datos (pide la contraseña)."""
    ratelimit.hit(f"pw:user:{current_user.id}", 10, 900)
    if current_user.role == "admin":
        raise HTTPException(400, "Una cuenta de entrenador no se puede borrar desde la app")
    if not verify_password(data.password, current_user.hashed_password):
        raise HTTPException(400, "La contraseña no es correcta")
    erase_client(db, current_user)
    return {"ok": True}


@router.post("/me/test-reminder")
def send_test_reminder(current_user: User = Depends(get_current_user)):
    """Envía al propio usuario un correo de prueba para comprobar que los avisos le llegan."""
    if not email_enabled():
        raise HTTPException(503, "El envío de correos no está configurado en el servidor")
    ratelimit.hit(f"test-mail:user:{current_user.id}", 3, 3600)
    first = (current_user.name or "").split(" ")[0] or "hola"
    body = (
        f"Hola {first},\n\nEste es un correo de prueba de Red de Vida. "
        "Si lo estás leyendo, los recordatorios te llegarán bien." + reminders._footer()
    )
    try:
        send_email(current_user.email, "Prueba de recordatorios de Red de Vida", body)
    except Exception:
        raise HTTPException(502, "No se pudo enviar el correo. Inténtalo de nuevo en unos minutos")
    return {"ok": True}
