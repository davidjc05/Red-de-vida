from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date

# ─── USER SCHEMAS ─────────────────────────────────────────────────────────────

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

    class Config:
        from_attributes = True


# ─── AUTH ─────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str


# ─── EXERCISE SCHEMAS ─────────────────────────────────────────────────────────

class ExerciseCreate(BaseModel):
    name: str
    muscle_group: str
    description: Optional[str] = None
    image_url: Optional[str] = None  
    video_url: Optional[str] = None  
    sets: int = 3
    reps: int = 10

class ExerciseOut(BaseModel):
    id: int
    name: str
    muscle_group: str
    description: Optional[str]
    image_url: Optional[str]     
    
    video_url: Optional[str] 
    
    sets: int
    reps: int

    class Config:
        from_attributes = True


# ─── ROUTINE SCHEMAS ──────────────────────────────────────────────────────────

class RoutineCreate(BaseModel):
    name: str
    description: str | None = None
    user_id: int
    date: date


class RoutineOut(BaseModel):
    id: int
    name: str
    description: str | None
    user_id: int
    date: date

    class Config:
        from_attributes = True