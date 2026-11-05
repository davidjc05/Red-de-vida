from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
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

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(400, "Email ya registrado")

    is_first_user = db.query(User).count() == 0

    role = "admin" if is_first_user else "client"
    # El primer usuario (entrenador) entra directo; los clientes esperan aprobación.
    account_status = "active" if is_first_user else "pending"

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
    db.commit()
    db.refresh(user)

    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Credenciales incorrectas")

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