from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth.auth import get_current_user
from database import get_db
from models import User, Routine


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(403, "Solo admins")
    return current_user


def get_routine_or_403(
    routine_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()

    if not routine:
        raise HTTPException(404, "Rutina no encontrada")

    if current_user.role != "admin" and routine.user_id != current_user.id:
        raise HTTPException(403, "No tienes permiso")

    return routine