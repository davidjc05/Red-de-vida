from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Routine, User, Exercise
from schemas import RoutineCreate, RoutineOut
from sqlalchemy import Date

from permissions import require_admin
from auth.auth import get_current_user

router = APIRouter(prefix="/routines", tags=["📅 Rutinas"])


from datetime import date
from typing import Optional

@router.get("/me", response_model=List[RoutineOut])
def get_my_routines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    start: Optional[date] = None,
    end: Optional[date] = None,
):
    query = db.query(Routine).filter(Routine.user_id == current_user.id)

    if start:
        query = query.filter(Routine.date >= start)
    if end:
        query = query.filter(Routine.date <= end)

    return query.all()


# 🔹 Admin: ver TODAS las rutinas
@router.get("/", response_model=List[RoutineOut])
def list_routines(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    return db.query(Routine).all()


# 🔹 Obtener rutina por ID (solo admin)
@router.get("/{routine_id}", response_model=RoutineOut)
def get_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return routine


# 🔹 Admin: crear rutina para un usuario
@router.post("/", response_model=RoutineOut)
def create_routine(
    routine_in: RoutineCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    # comprobar que el usuario existe
    user = db.query(User).filter(User.id == routine_in.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no existe")

    db_routine = Routine(
        name=routine_in.name,
        description=routine_in.description,
        user_id=routine_in.user_id,
        date=routine_in.date
    )

    db.add(db_routine)
    db.commit()
    db.refresh(db_routine)
    return db_routine


# 🔹 Admin: añadir ejercicio a rutina
@router.post("/{routine_id}/exercises/{exercise_id}", response_model=RoutineOut)
def add_exercise_to_routine(
    routine_id: int,
    exercise_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")

    if exercise in routine.exercises:
        raise HTTPException(status_code=400, detail="El ejercicio ya está en esta rutina")

    routine.exercises.append(exercise)
    db.commit()
    db.refresh(routine)
    return routine


# 🔹 Admin: eliminar ejercicio de rutina
@router.delete("/{routine_id}/exercises/{exercise_id}", response_model=RoutineOut)
def remove_exercise_from_routine(
    routine_id: int,
    exercise_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise or exercise not in routine.exercises:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado en esta rutina")

    routine.exercises.remove(exercise)
    db.commit()
    db.refresh(routine)
    return routine


# 🔹 Admin: eliminar rutina
@router.delete("/{routine_id}", status_code=204)
def delete_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    db.delete(routine)
    db.commit()