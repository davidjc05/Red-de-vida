from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date
from pydantic import BaseModel

from database import get_db
from models import Routine, User, RoutineExercise, Block, BlockExercise
from schemas import RoutineCreate, RoutineUpdate
from permissions import require_admin
from auth.auth import get_current_user

router = APIRouter(prefix="/routines", tags=["Rutinas"])


# ─────────────────────────────
# SCHEMAS
# ─────────────────────────────

class SaveRoutineFull(BaseModel):
    name: str
    blocks: List[dict]


# ─────────────────────────────
# SERIALIZER
# ─────────────────────────────

def serialize_routine(routine: Routine):

    valid_relations = [
        re for re in routine.routine_exercises
        if re.exercise is not None
    ]

    blocks = []
    for b in getattr(routine, "blocks", []):
        blocks.append({
            "id": b.id,
            "name": b.name,
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
                for be in b.exercises if be.exercise
            ]
        })

    return {
        "id": routine.id,
        "name": routine.name,
        "description": routine.description,
        "user_id": routine.user_id,
        "date": routine.date,
        "blocks": blocks,

        # LEGACY
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


# ─────────────────────────────
# GET
# ─────────────────────────────

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
            joinedload(Routine.blocks)
            .joinedload(Block.exercises)
            .joinedload(BlockExercise.exercise)
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
            joinedload(Routine.blocks)
            .joinedload(Block.exercises)
            .joinedload(BlockExercise.exercise)
        )
        .all()
    )

    return [serialize_routine(r) for r in routines]


# ─────────────────────────────
# CREATE
# ─────────────────────────────

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


# ─────────────────────────────
# UPDATE FULL (BLOQUES)
# ─────────────────────────────

@router.put("/{routine_id}/full")
def update_full_routine(
    routine_id: int,
    data: SaveRoutineFull,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()

    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    if current_user.role != "admin" and routine.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    # 🔥 BORRADO SEGURO (sin joins)
    blocks = db.query(Block).filter(Block.routine_id == routine_id).all()

    for b in blocks:
        db.query(BlockExercise).filter(
            BlockExercise.block_id == b.id
        ).delete(synchronize_session=False)

    db.query(Block).filter(
        Block.routine_id == routine_id
    ).delete(synchronize_session=False)

    routine.name = data.name

    for block in data.blocks:
        db_block = Block(
            routine_id=routine_id,
            name=block["name"]
        )

        db.add(db_block)
        db.flush()

        for ex in block["exercises"]:
            db.add(BlockExercise(
                block_id=db_block.id,
                exercise_id=ex["exerciseId"],
                sets=3,
                reps=10
            ))

    db.commit()
    db.refresh(routine)

    return serialize_routine(routine)


# ─────────────────────────────
# UPDATE SIMPLE
# ─────────────────────────────

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

    if current_user.role != "admin" and routine.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    routine.name = routine_in.name
    routine.description = routine_in.description

    db.commit()
    db.refresh(routine)

    return serialize_routine(routine)


# ─────────────────────────────
# COMPATIBILIDAD FRONTEND
# ─────────────────────────────

@router.delete("/{routine_id}/exercises")
def clear_routine_exercises(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    blocks = db.query(Block).filter(Block.routine_id == routine_id).all()

    for b in blocks:
        db.query(BlockExercise).filter(
            BlockExercise.block_id == b.id
        ).delete(synchronize_session=False)

    db.query(Block).filter(
        Block.routine_id == routine_id
    ).delete(synchronize_session=False)

    db.commit()

    return {"ok": True}


# ─────────────────────────────
# DELETE
# ─────────────────────────────

@router.delete("/{routine_id}", status_code=204)
def delete_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    routine = db.query(Routine).filter(Routine.id == routine_id).first()
    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    if current_user.role != "admin" and routine.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="No autorizado")

    # Borrar asignaciones primero
    from models import Assignment  # ajusta el import si es diferente
    db.query(Assignment).filter(Assignment.routine_id == routine_id).delete(synchronize_session=False)

    # Borrar bloques y sus ejercicios
    blocks = db.query(Block).filter(Block.routine_id == routine_id).all()
    for b in blocks:
        db.query(BlockExercise).filter(BlockExercise.block_id == b.id).delete(synchronize_session=False)
    db.query(Block).filter(Block.routine_id == routine_id).delete(synchronize_session=False)

    db.delete(routine)
    db.commit()