from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Assignment, Routine, User
from schemas import AssignmentCreate, AssignmentOut
from auth.auth import get_current_user

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.post("/", response_model=AssignmentOut, status_code=201)
def assign_routine(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = db.query(Routine).filter(Routine.id == data.routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    # Solo el dueño o un admin puede asignar
    if current_user.role != "admin" and routine.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso sobre esta rutina")

    target = db.query(User).filter(User.id == data.assigned_to_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario destino no encontrado")

    assignment = Assignment(
        routine_id=data.routine_id,
        assigned_to_id=data.assigned_to_id,
        assigned_by_id=current_user.id,
        note=data.note,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.get("/mine", response_model=list[AssignmentOut])
def my_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rutinas asignadas al usuario actual."""
    return db.query(Assignment).filter(Assignment.assigned_to_id == current_user.id).all()


@router.get("/sent", response_model=list[AssignmentOut])
def sent_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Asignaciones hechas por el usuario actual."""
    return db.query(Assignment).filter(Assignment.assigned_by_id == current_user.id).all()