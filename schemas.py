from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date
from pydantic import field_validator


# ─── USER ─────────────────────────────────

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)  # bcrypt solo usa 72 bytes
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    phone: Optional[str] = Field(default=None, max_length=30)
    country: Optional[str] = Field(default=None, max_length=60)
    city: Optional[str] = Field(default=None, max_length=60)
    birth_date: Optional[date] = None

    @field_validator("birth_date")
    @classmethod
    def _birth_ok(cls, v):
        if v is not None and not (date(1900, 1, 1) <= v <= date.today()):
            raise ValueError("Fecha de nacimiento no válida")
        return v


class UserUpdate(BaseModel):
    """Datos que el propio usuario puede modificar en su perfil."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=30)
    country: Optional[str] = Field(default=None, max_length=60)
    city: Optional[str] = Field(default=None, max_length=60)
    birth_date: Optional[date] = None
    weight_kg: Optional[float] = Field(default=None, gt=0, le=500)

    @field_validator("birth_date")
    @classmethod
    def _birth_ok(cls, v):
        if v is not None and not (date(1900, 1, 1) <= v <= date.today()):
            raise ValueError("Fecha de nacimiento no válida")
        return v


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    role: str
    phone: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    birth_date: Optional[date] = None
    status: str = "active"

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

    # nombre correcto
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
    date:date


class AssignmentOut(BaseModel):
    id: int
    routine_id: int
    assigned_to_id: int
    note: Optional[str]
    date: date

    routine: Optional[RoutineOut] = None

    class Config:
        from_attributes = True