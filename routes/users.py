from typing import List, Literal

from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth.auth import hash_password
from database import get_db
from models import User
from permissions import require_admin
from schemas import UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["Usuarios"])


# Todas las rutas de este router son solo para administradores.

@router.post("/", response_model=UserOut, status_code=201)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    db_user = User(
        name=user.name,
        email=user.email,
        age=user.age,
        weight_kg=user.weight_kg,
        phone=user.phone,
        country=user.country,
        city=user.city,
        birth_date=user.birth_date,
        hashed_password=hash_password(user.password),
        role="client",  # mismo valor que /auth/register
        status="active",  # lo crea el entrenador, no necesita aprobación
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return db.query(User).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes borrarte a ti mismo")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    db.delete(user)
    db.commit()



class StatusUpdate(BaseModel):
    status: Literal["active", "suspended"]


@router.patch("/{user_id}/status", response_model=UserOut)
def set_user_status(
    user_id: int,
    data: StatusUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Aprueba una alta pendiente, cancela la suscripción (suspended) o la reactiva (active)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.role == "admin":
        raise HTTPException(status_code=400, detail="No se puede cambiar el estado de un entrenador")

    user.status = data.status
    db.commit()
    db.refresh(user)
    return user
