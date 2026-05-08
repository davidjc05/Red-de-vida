from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


# ─────────────────────────────────────────
# USER
# ─────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String, nullable=False)
    email            = Column(String, unique=True, index=True, nullable=False)
    age              = Column(Integer, nullable=True)
    weight_kg        = Column(Float, nullable=True)
    hashed_password  = Column(String, nullable=False)
    role             = Column(String, default="user", nullable=False)

    routines             = relationship("Routine", back_populates="user")
    assignments_received = relationship("Assignment", foreign_keys="Assignment.assigned_to_id", back_populates="assigned_to")
    assignments_sent     = relationship("Assignment", foreign_keys="Assignment.assigned_by_id", back_populates="assigned_by")


# ─────────────────────────────────────────
# EXERCISE
# ─────────────────────────────────────────

class Exercise(Base):
    __tablename__ = "exercises"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, nullable=False)
    muscle_group = Column(String, nullable=False)
    description  = Column(String, nullable=True)

    image_url    = Column(String, nullable=True)
    video_url    = Column(String, nullable=True)

    routine_exercises = relationship("RoutineExercise", back_populates="exercise")
    block_exercises   = relationship("BlockExercise", back_populates="exercise")


# ─────────────────────────────────────────
# ROUTINE
# ─────────────────────────────────────────

class Routine(Base):
    __tablename__ = "routines"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, nullable=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    date        = Column(Date, nullable=False)

    user = relationship("User", back_populates="routines")

    routine_exercises = relationship(
        "RoutineExercise",
        back_populates="routine",
        cascade="all, delete"
    )

    blocks = relationship(
        "Block",
        back_populates="routine",
        cascade="all, delete"
    )

    assignments = relationship("Assignment", back_populates="routine")


# ─────────────────────────────────────────
# BLOQUES
# ─────────────────────────────────────────

class Block(Base):
    __tablename__ = "blocks"

    id         = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id", ondelete="CASCADE"))
    name       = Column(String, nullable=False)

    routine = relationship("Routine", back_populates="blocks")

    exercises = relationship(
        "BlockExercise",
        back_populates="block",
        cascade="all, delete"
    )


# ─────────────────────────────────────────
# BLOQUE → EJERCICIOS
# ─────────────────────────────────────────

class BlockExercise(Base):
    __tablename__ = "block_exercises"

    id          = Column(Integer, primary_key=True, index=True)
    block_id    = Column(Integer, ForeignKey("blocks.id", ondelete="CASCADE"))
    exercise_id = Column(Integer, ForeignKey("exercises.id", ondelete="CASCADE"))

    sets = Column(Integer, default=3)
    reps = Column(Integer, default=10)

    block    = relationship("Block", back_populates="exercises")
    exercise = relationship("Exercise", back_populates="block_exercises")


# ─────────────────────────────────────────
# ROUTINE EXERCISE (legacy)
# ─────────────────────────────────────────

class RoutineExercise(Base):
    __tablename__ = "routine_exercises"

    id = Column(Integer, primary_key=True, index=True)

    routine_id  = Column(Integer, ForeignKey("routines.id", ondelete="CASCADE"))
    exercise_id = Column(Integer, ForeignKey("exercises.id", ondelete="CASCADE"))

    sets = Column(Integer, default=3)
    reps = Column(Integer, default=10)

    routine  = relationship("Routine", back_populates="routine_exercises")
    exercise = relationship("Exercise", back_populates="routine_exercises")


# ─────────────────────────────────────────
# ASSIGNMENT
# ─────────────────────────────────────────

class Assignment(Base):
    __tablename__ = "assignments"

    id             = Column(Integer, primary_key=True, index=True)
    routine_id     = Column(Integer, ForeignKey("routines.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note           = Column(String, nullable=True)
    date           = Column(Date, nullable=False)
    status         = Column(String, default="pending")
    confirmed_at   = Column(DateTime, nullable=True)
    declined_at    = Column(DateTime, nullable=True)

    routine = relationship("Routine", back_populates="assignments")

    assigned_to = relationship(
        "User",
        foreign_keys=[assigned_to_id],
        back_populates="assignments_received"
    )

    assigned_by = relationship(
        "User",
        foreign_keys=[assigned_by_id],
        back_populates="assignments_sent"
    )


# ─────────────────────────────────────────
# WORKOUT LOG
# ─────────────────────────────────────────

class WorkoutLog(Base):
    __tablename__ = "workout_logs"

    id            = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"))
    user_id       = Column(Integer, ForeignKey("users.id"))
    exercise_id   = Column(Integer, ForeignKey("exercises.id"))
    kg            = Column(Float, nullable=True)
    reps          = Column(Integer, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    # ✅ Relación para acceder a log.exercise.name en los endpoints
    exercise = relationship("Exercise")