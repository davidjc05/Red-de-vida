from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models import (
    Assignment,
    Routine,
    User,
    RoutineExercise,
    WorkoutLog,
    Block, 
    BlockExercise
)

from schemas import AssignmentCreate, AssignmentOut
from auth.auth import get_current_user

router = APIRouter(prefix="/assignments", tags=["assignments"])


# ─────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────

class ConfirmWorkoutSchema(BaseModel):
    status: str


class WorkoutLogSchema(BaseModel):
    assignment_id: int
    exercise_id: int
    kg: float
    reps: int


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
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso sobre esta rutina"
        )

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
            status="pending"
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

@router.get("/mine")
def my_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignments = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.routine)
            .joinedload(Routine.blocks)
            .joinedload(Block.exercises)
            .joinedload(BlockExercise.exercise),

            joinedload(Assignment.assigned_by),
        )
        .filter(Assignment.assigned_to_id == current_user.id)
        .all()
    )

    result = []

    for a in assignments:
        routine = a.routine

        result.append({
            "id": a.id,
            "routine_id": a.routine_id,
            "assigned_to_id": a.assigned_to_id,
            "assigned_by_id": a.assigned_by_id,
            "note": a.note,
            "date": a.date,
            "status": a.status or "pending",
            "confirmed_at": a.confirmed_at,
            "declined_at": a.declined_at,

            "routine": {
                "id": routine.id,
                "name": routine.name,
                "description": routine.description,
                "user_id": routine.user_id,
                "date": routine.date,

                "blocks": [
                    {
                        "id": block.id,
                        "name": block.name,
                        "exercises": [
                            {
                                "id": be.id,
                                "sets": be.sets,
                                "reps": be.reps,
                                "exercise": {
                                    "id": be.exercise.id,
                                    "name": be.exercise.name,
                                    "muscle_group": be.exercise.muscle_group,
                                    "description": be.exercise.description,
                                    "image_url": be.exercise.image_url,
                                    "video_url": be.exercise.video_url,
                                }
                            }
                            for be in block.exercises
                            if be.exercise is not None
                        ]
                    }
                    for block in routine.blocks
                ]
            } if routine else None,

            "assigned_by": {
                "id": a.assigned_by.id,
                "name": a.assigned_by.name,
                "email": a.assigned_by.email,
            } if a.assigned_by else None
        })

    return result


# ─────────────────────────────────────────
# CONFIRMAR / RECHAZAR ENTRENAMIENTO
# ─────────────────────────────────────────

@router.patch("/{assignment_id}/confirm")
def confirm_assignment(
    assignment_id: int,
    data: ConfirmWorkoutSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Asignación no encontrada"
        )

    if assignment.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="No autorizado"
        )

    assignment.status = data.status

    if data.status == "confirmed":
        assignment.confirmed_at = datetime.utcnow()
        assignment.declined_at = None

    elif data.status == "declined":
        assignment.declined_at = datetime.utcnow()
        assignment.confirmed_at = None

    db.commit()

    return {
        "ok": True,
        "status": assignment.status
    }


# ─────────────────────────────────────────
# GUARDAR PESOS / REPS
# ─────────────────────────────────────────

@router.post("/log")
def save_workout_log(
    data: WorkoutLogSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = db.query(Assignment).filter(
        Assignment.id == data.assignment_id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Asignación no encontrada"
        )

    if assignment.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="No autorizado"
        )

    existing = db.query(WorkoutLog).filter(
        WorkoutLog.assignment_id == data.assignment_id,
        WorkoutLog.exercise_id == data.exercise_id,
        WorkoutLog.user_id == current_user.id
    ).first()

    if existing:
        existing.kg = data.kg
        existing.reps = data.reps

    else:
        log = WorkoutLog(
            assignment_id=data.assignment_id,
            user_id=current_user.id,
            exercise_id=data.exercise_id,
            kg=data.kg,
            reps=data.reps
        )

        db.add(log)

    db.commit()

    return {"ok": True}


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
                re for re in a.routine.routine_exercises
                if re.exercise is not None
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
            "status": a.status,
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
        raise HTTPException(
            status_code=404,
            detail="Asignación no encontrada"
        )

    if (
        current_user.role != "admin"
        and assignment.assigned_by_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="No autorizado"
        )

    db.delete(assignment)
    db.commit()

    return {"ok": True}