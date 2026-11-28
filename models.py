from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, Boolean, Index, UniqueConstraint, func, true
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

    # Datos de contacto (opcionales) y estado de la cuenta.
    # status: "pending" (alta sin aprobar) | "active" | "suspended" (suscripción cancelada)
    phone            = Column(String, nullable=True)
    country          = Column(String, nullable=True)
    city             = Column(String, nullable=True)
    birth_date       = Column(Date, nullable=True)
    status           = Column(String, default="active", nullable=False, server_default="active")
    email_verified   = Column(Boolean, default=True, nullable=False, server_default=true())

    # Consentimiento de la política de privacidad (fecha UTC y versión del texto aceptado)
    consent_at       = Column(DateTime, nullable=True)
    consent_version  = Column(String, nullable=True)

    # Recordatorios por correo (rutina de hoy / clientes inactivos). Se desactivan desde el perfil.
    email_reminders  = Column(Boolean, default=True, nullable=False, server_default=true())

    # Sube en 1 al cambiar o restablecer la contraseña: los tokens anteriores dejan de valer
    token_version    = Column(Integer, default=0, nullable=False, server_default="0")

    routines             = relationship("Routine", back_populates="user")
    assignments_received = relationship("Assignment", foreign_keys="Assignment.assigned_to_id", back_populates="assigned_to")
    assignments_sent     = relationship("Assignment", foreign_keys="Assignment.assigned_by_id", back_populates="assigned_by")

    # Un email solo puede existir una vez, sin importar mayúsculas (Ana@x.com = ana@x.com)
    __table_args__ = (Index("uq_users_email_lower", func.lower(email), unique=True),)


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
    # Cada fila es UNA serie. Las filas antiguas (una por ejercicio) cuentan como serie 1.
    set_number    = Column(Integer, nullable=False, default=1, server_default="1")
    created_at    = Column(DateTime, default=datetime.utcnow)

    # ✅ Relación para acceder a log.exercise.name en los endpoints
    exercise = relationship("Exercise")

# ─────────────────────────────────────────
# ACTIVIDAD (correr / caminar) registrada por los clientes
# ─────────────────────────────────────────

class Activity(Base):
    __tablename__ = "activities"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    kind       = Column(String, nullable=False)          # "run" | "walk"
    started_at = Column(DateTime, nullable=False)        # fecha/hora de la actividad (UTC)
    elapsed_s  = Column(Integer, nullable=False)         # segundos
    distance_m = Column(Float, nullable=False)           # metros
    kcal       = Column(Integer, nullable=False, default=0)

    user = relationship("User")


# ─────────────────────────────────────────
# CÓDIGOS DE EMAIL (verificación y recuperación de contraseña)
# ─────────────────────────────────────────

class EmailCode(Base):
    __tablename__ = "email_codes"

    id         = Column(Integer, primary_key=True, index=True)
    email      = Column(String, index=True, nullable=False)
    purpose    = Column(String, nullable=False)      # "verify" | "reset"
    code_hash  = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    attempts   = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ─────────────────────────────────────────
# FORMULARIOS (enlaces de Google Forms que el entrenador envía a sus clientes)
# ─────────────────────────────────────────

class Form(Base):
    __tablename__ = "forms"

    id         = Column(Integer, primary_key=True, index=True)
    title      = Column(String, nullable=False)
    url        = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class FormSend(Base):
    __tablename__ = "form_sends"

    id         = Column(Integer, primary_key=True, index=True)
    form_id    = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    sent_at    = Column(DateTime, nullable=False, default=datetime.utcnow)
    email_sent = Column(Boolean, nullable=False, default=False)

    form = relationship("Form")


# ─────────────────────────────────────────
# AVISOS ENVIADOS (evita repetir el mismo correo el mismo día)
# ─────────────────────────────────────────

class NotificationLog(Base):
    __tablename__ = "notification_logs"
    __table_args__ = (UniqueConstraint("kind", "user_id", "day", name="uq_notification_kind_user_day"),)

    id         = Column(Integer, primary_key=True, index=True)
    kind       = Column(String, nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    day        = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
