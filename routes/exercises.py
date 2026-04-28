from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import sys
sys.path.append("..")

from database import get_db
from models import Exercise
from schemas import ExerciseCreate, ExerciseOut

router = APIRouter(prefix="/exercises", tags=["🏋️ Ejercicios"])


@router.post("/", response_model=ExerciseOut, status_code=201)
def create_exercise(exercise: ExerciseCreate, db: Session = Depends(get_db)):
    """Crea un nuevo ejercicio."""
    db_exercise = Exercise(**exercise.model_dump())
    db.add(db_exercise)
    db.commit()
    db.refresh(db_exercise)
    return db_exercise


@router.get("/", response_model=List[ExerciseOut])
def list_exercises(muscle_group: str = None, db: Session = Depends(get_db)):
    """Lista todos los ejercicios. Filtra por grupo muscular con ?muscle_group=pecho"""
    query = db.query(Exercise)
    if muscle_group:
        query = query.filter(Exercise.muscle_group.ilike(f"%{muscle_group}%"))
    return query.all()


@router.get("/{exercise_id}", response_model=ExerciseOut)
def get_exercise(exercise_id: int, db: Session = Depends(get_db)):
    """Obtiene un ejercicio por su ID."""
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
    return exercise


@router.delete("/{exercise_id}", status_code=204)
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    """Elimina un ejercicio por su ID."""
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
    db.delete(exercise)
    db.commit()