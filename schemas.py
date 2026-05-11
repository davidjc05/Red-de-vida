from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date


# ─── USER ─────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    age: Optional[int] = None
    weight_kg: Optional[float] = None


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    age: Optional[int]
    weight_kg: Optional[float]
    role: str

    class Config:
        from_attributes = True


# ─── AUTH ─────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str


# ─── EXERCISES ────────────────────────────

class ExerciseCreate(BaseModel):
    name: str
    muscle_group: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None


class ExerciseOut(BaseModel):
    id: int
    name: str
    muscle_group: str
    description: Optional[str]
    image_url: Optional[str]
    video_url: Optional[str]

    class Config:
        from_attributes = True


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    muscle_group: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None


# ─── RELACIÓN ─────────────────────────────

class RoutineExerciseOut(BaseModel):
    id: int
    sets: Optional[int]
    reps: Optional[int]
    exercise: ExerciseOut

    class Config:
        from_attributes = True


# ─── ROUTINES ─────────────────────────────

class RoutineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    user_id: int
    date: date


class RoutineOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    user_id: int
    date: date

    routine_exercises: List[RoutineExerciseOut] = []

    class Config:
        from_attributes = True


class RoutineUpdate(BaseModel):
    name: str
    description: Optional[str] = None


# ─── ASSIGNMENTS ──────────────────────────

class AssignmentCreate(BaseModel):
    routine_id: int
    assigned_to_ids: List[int]
    note: Optional[str] = None
    date: date


class AssignmentOut(BaseModel):
    id: int
    routine_id: int
    assigned_to_id: int
    note: Optional[str]
    date: date

    routine: Optional[RoutineOut] = None

    class Config:
        from_attributes = True