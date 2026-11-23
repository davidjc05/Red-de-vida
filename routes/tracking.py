"""Seguimiento de un cliente para la entrenadora: todos sus entrenos y, en cada uno,
los ejercicios con los pesos y repeticiones que registró."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import Assignment, Block, Routine, User, WorkoutLog
from permissions import require_admin

router = APIRouter(prefix="/tracking", tags=["Seguimiento"])


@router.get("/client/{user_id}")
def client_history(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.get(User, user_id)
    if not user or user.role == "admin":
        raise HTTPException(404, "Cliente no encontrado")

    assignments = (
        db.query(Assignment)
        .options(
            selectinload(Assignment.routine)
            .selectinload(Routine.blocks)
            .selectinload(Block.exercises)
        )
        .filter(Assignment.assigned_to_id == user_id)
        .order_by(Assignment.date.desc(), Assignment.id.desc())
        .all()
    )

    # peso y repeticiones registrados (uno por ejercicio y entreno): {assignment_id: {exercise_id: log}}
    logs: dict = {}
    for log in (
        db.query(WorkoutLog)
        .options(selectinload(WorkoutLog.exercise))
        .filter(WorkoutLog.user_id == user_id)
        .order_by(WorkoutLog.created_at, WorkoutLog.id)
    ):
        logs.setdefault(log.assignment_id, {})[log.exercise_id] = log

    def _entry(exercise_id, name, sets, reps, log):
        return {
            "exercise_id": exercise_id,
            "name": name,
            "planned_sets": sets,
            "planned_reps": reps,
            "logged": log is not None,
            "kg": log.kg if log else None,
            "reps": log.reps if log else None,
        }

    workouts = []
    for a in assignments:
        mine = dict(logs.get(a.id, {}))
        exercises, seen = [], set()
        if a.routine:
            for block in a.routine.blocks:
                for be in block.exercises:
                    if be.exercise is None:
                        continue
                    first = be.exercise_id not in seen
                    seen.add(be.exercise_id)
                    log = mine.pop(be.exercise_id, None) if first else None
                    exercises.append(_entry(be.exercise_id, be.exercise.name, be.sets, be.reps, log))
        # ejercicios registrados que ya no están en la rutina (la rutina se editó después)
        for exercise_id, log in mine.items():
            name = log.exercise.name if log.exercise else f"Ejercicio {exercise_id}"
            exercises.append(_entry(exercise_id, name, None, None, log))

        workouts.append({
            "assignment_id": a.id,
            "date": a.date.isoformat(),
            "routine_name": a.routine.name if a.routine else "Rutina eliminada",
            "status": a.status or "pending",
            "note": a.note,
            "confirmed_at": a.confirmed_at.isoformat() if a.confirmed_at else None,
            "exercises": exercises,
        })

    return {"client": {"id": user.id, "name": user.name}, "workouts": workouts}
