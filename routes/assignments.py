from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Assignment, Routine, User, RoutineExercise
from schemas import AssignmentCreate, AssignmentOut
from auth.auth import get_current_user

router = APIRouter(prefix="/assignments", tags=["assignments"])


# ─────────────────────────────────────────
# CREAR ASIGNACIONES
# ─────────────────────────────────────────
@router.post("/", response_model=list[AssignmentOut], status_code=201)
def assign_routine(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = db.query(Routine).filter(Routine.id == data.routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    if current_user.role != "admin" and routine.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso sobre esta rutina")

    assignments = []

    for user_id in data.assigned_to_ids:
        target = db.query(User).filter(User.id == user_id).first()
        if not target:
            continue

        assignment = Assignment(
            routine_id=data.routine_id,
            assigned_to_id=user_id,
            assigned_by_id=current_user.id,
            note=data.note,
            date=data.date,
        )

        db.add(assignment)
        assignments.append(assignment)

    db.commit()

    for a in assignments:
        db.refresh(a)

    return assignments


# ─────────────────────────────────────────
# MIS RUTINAS ASIGNADAS
# ─────────────────────────────────────────
@router.get("/mine", response_model=list[AssignmentOut])
def my_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignments = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.routine)
            .joinedload(Routine.routine_exercises)
            .joinedload(RoutineExercise.exercise),
            joinedload(Assignment.assigned_by),
        )
        .filter(Assignment.assigned_to_id == current_user.id)
        .all()
    )

    for a in assignments:
        if a.routine:
            a.routine.routine_exercises = [
                re for re in a.routine.routine_exercises if re.exercise is not None
            ]

    return assignments


# ─────────────────────────────────────────
# RUTINAS QUE HE ASIGNADO
# ─────────────────────────────────────────
@router.get("/sent", response_model=list[AssignmentOut])
def sent_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignments = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.routine)
            .joinedload(Routine.routine_exercises)
            .joinedload(RoutineExercise.exercise),
            joinedload(Assignment.assigned_to),
        )
        .filter(Assignment.assigned_by_id == current_user.id)
        .all()
    )

    for a in assignments:
        if a.routine:
            a.routine.routine_exercises = [
                re for re in a.routine.routine_exercises if re.exercise is not None
            ]

    return assignments


# ─────────────────────────────────────────
# OBTENER ASIGNACIONES POR RUTINA
# ─────────────────────────────────────────
@router.get("/routine/{routine_id}")
def get_assignments_by_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignments = db.query(Assignment).filter(
        Assignment.routine_id == routine_id
    ).all()

    return [
        {
            "id": a.id,
            "assigned_to_id": a.assigned_to_id,
            "date": a.date,
            "note": a.note,
        }
        for a in assignments
    ]


# ─────────────────────────────────────────
# BORRAR ASIGNACIÓN
# ─────────────────────────────────────────
@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    # Seguridad (solo admin o quien la creó)
    if current_user.role != "admin" and assignment.assigned_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    db.delete(assignment)
    db.commit()

    return {"ok": True}