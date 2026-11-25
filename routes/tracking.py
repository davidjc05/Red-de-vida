"""Seguimiento de un cliente para la entrenadora: todos sus entrenos y, en cada uno,
los ejercicios con el peso y las repeticiones de cada serie que registró."""
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

    # series registradas (una fila por serie): {assignment_id: {exercise_id: [series ordenadas]}}
    logs: dict = {}
    for log in (
        db.query(WorkoutLog)
        .options(selectinload(WorkoutLog.exercise))
        .filter(WorkoutLog.user_id == user_id)
        .order_by(WorkoutLog.set_number, WorkoutLog.created_at, WorkoutLog.id)
    ):
        logs.setdefault(log.assignment_id, {}).setdefault(log.exercise_id, []).append(log)

    def _entry(exercise_id, name, sets, reps, logged):
        logged = logged or []
        # "kg" y "reps" = la serie más pesada (las versiones antiguas de la app solo leen esto)
        best = max(logged, key=lambda l: (l.kg or 0, l.reps or 0), default=None)
        return {
            "exercise_id": exercise_id,
            "name": name,
            "planned_sets": sets,
            "planned_reps": reps,
            "logged": bool(logged),
            "kg": best.kg if best else None,
            "reps": best.reps if best else None,
            "sets": [
                {"set_number": l.set_number or 1, "kg": l.kg, "reps": l.reps} for l in logged
            ],
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
                    done = mine.pop(be.exercise_id, None) if first else None
                    exercises.append(_entry(be.exercise_id, be.exercise.name, be.sets, be.reps, done))
        # ejercicios registrados que ya no están en la rutina (la rutina se editó después)
        for exercise_id, done in mine.items():
            ex = done[0].exercise
            name = ex.name if ex else f"Ejercicio {exercise_id}"
            exercises.append(_entry(exercise_id, name, None, None, done))

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
