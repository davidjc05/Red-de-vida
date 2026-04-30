from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date
from pydantic import BaseModel

from database import get_db
from models import Routine, User, RoutineExercise
from schemas import RoutineCreate,RoutineUpdate
from permissions import require_admin
from auth.auth import get_current_user

router = APIRouter(prefix="/routines", tags=["Rutinas"])


class AddExercisesBulk(BaseModel):
    exercise_ids: List[int]


def serialize_routine(routine: Routine):
    valid_relations = [
        re for re in routine.routine_exercises
        if re.exercise is not None
    ]

    return {
        "id": routine.id,
        "name": routine.name,
        "description": routine.description,
        "user_id": routine.user_id,
        "date": routine.date,
        "routine_exercises": [
            {
                "id": re.id,
                "sets": re.sets,
                "reps": re.reps,
                "exercise": {
                    "id": re.exercise.id,
                    "name": re.exercise.name,
                    "muscle_group": re.exercise.muscle_group,
                    "description": re.exercise.description,
                    "image_url": re.exercise.image_url,
                    "video_url": re.exercise.video_url,
                }
            }
            for re in valid_relations
        ],
        "exercises": [
            {
                "id": re.exercise.id,
                "name": re.exercise.name,
                "muscle_group": re.exercise.muscle_group,
                "description": re.exercise.description,
                "image_url": re.exercise.image_url,
                "video_url": re.exercise.video_url,
            }
            for re in valid_relations
        ]
    }


@router.get("/me")
def get_my_routines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    start: Optional[date] = None,
    end: Optional[date] = None,
):
    query = (
        db.query(Routine)
        .options(
            joinedload(Routine.routine_exercises)
            .joinedload(RoutineExercise.exercise)
        )
        .filter(Routine.user_id == current_user.id)
    )

    if start:
        query = query.filter(Routine.date >= start)

    if end:
        query = query.filter(Routine.date <= end)

    routines = query.all()
    return [serialize_routine(r) for r in routines]


@router.get("/")
def list_routines(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    routines = (
        db.query(Routine)
        .options(
            joinedload(Routine.routine_exercises)
            .joinedload(RoutineExercise.exercise)
        )
        .all()
    )

    return [serialize_routine(r) for r in routines]


@router.post("/")
def create_routine(
    routine_in: RoutineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_routine = Routine(
        name=routine_in.name,
        description=routine_in.description,
        user_id=current_user.id,
        date=routine_in.date
    )

    db.add(db_routine)
    db.commit()
    db.refresh(db_routine)

    return serialize_routine(db_routine)


@router.post("/{routine_id}/exercises/bulk")
def add_exercises_bulk(
    routine_id: int,
    data: AddExercisesBulk,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()

    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    db.expire_all()

    existing_ids = {
        re.exercise_id
        for re in db.query(RoutineExercise)
        .filter(RoutineExercise.routine_id == routine_id)
        .all()
    }

    new_relations = []

    for exercise_id in data.exercise_ids:
        if exercise_id not in existing_ids:
            new_relations.append(
                RoutineExercise(
                    routine_id=routine_id,
                    exercise_id=exercise_id,
                    sets=3,
                    reps=10
                )
            )

    db.add_all(new_relations)
    db.commit()

    routine = (
        db.query(Routine)
        .options(
            joinedload(Routine.routine_exercises)
            .joinedload(RoutineExercise.exercise)
        )
        .filter(Routine.id == routine_id)
        .first()
    )

    return serialize_routine(routine)


@router.get("/{routine_id}")
def get_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = (
        db.query(Routine)
        .options(
            joinedload(Routine.routine_exercises)
            .joinedload(RoutineExercise.exercise)
        )
        .filter(Routine.id == routine_id)
        .first()
    )

    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    return serialize_routine(routine)


@router.delete("/{routine_id}", status_code=204)
def delete_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()

    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    db.query(RoutineExercise).filter(
        RoutineExercise.routine_id == routine_id
    ).delete()

    from models import Assignment
    db.query(Assignment).filter(
        Assignment.routine_id == routine_id
    ).delete()

    db.delete(routine)

    db.commit()
@router.put("/{routine_id}")
def update_routine(
    routine_id: int,
    routine_in: RoutineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()

    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    # seguridad
    if current_user.role != "admin" and routine.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    routine.name = routine_in.name
    routine.description = routine_in.description

    db.commit()
    db.refresh(routine)

    return serialize_routine(routine)

@router.delete("/{routine_id}/exercises")
def clear_routine_exercises(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()

    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    # seguridad
    if current_user.role != "admin" and routine.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    db.query(RoutineExercise).filter(
        RoutineExercise.routine_id == routine_id
    ).delete()

    db.commit()

    return {"ok": True}