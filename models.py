from sqlalchemy import Column, Integer, String, Float, ForeignKey, Table, Date
from sqlalchemy.orm import relationship
from database import Base


# Tabla intermedia rutina ↔ ejercicio
routine_exercises = Table(
    "routine_exercises",
    Base.metadata,
    Column("routine_id", Integer, ForeignKey("routines.id"), primary_key=True),
    Column("exercise_id", Integer, ForeignKey("exercises.id"), primary_key=True),
)


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


class Exercise(Base):
    __tablename__ = "exercises"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, nullable=False)
    muscle_group = Column(String, nullable=False)
    description  = Column(String, nullable=True)
    
    image_url    = Column(String, nullable=True)
    video_url    = Column(String, nullable=True)

    sets         = Column(Integer, default=3, nullable=True)
    reps         = Column(Integer, default=10, nullable=True)

    routines = relationship("Routine", secondary=routine_exercises, back_populates="exercises")


class Routine(Base):
    __tablename__ = "routines"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    description = Column(String, nullable=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    date        = Column(Date, nullable=False)

    user        = relationship("User", back_populates="routines")
    exercises   = relationship("Exercise", secondary=routine_exercises, back_populates="routines")
    assignments = relationship("Assignment", back_populates="routine")


class Assignment(Base):
    __tablename__ = "assignments"

    id             = Column(Integer, primary_key=True, index=True)
    routine_id     = Column(Integer, ForeignKey("routines.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note           = Column(String, nullable=True)

    routine     = relationship("Routine", back_populates="assignments")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="assignments_received")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], back_populates="assignments_sent")