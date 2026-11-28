from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from datetime import datetime, date, timedelta
from typing import Literal, Optional
from pydantic import BaseModel, Field

from database import get_db
from models import (
    Assignment,
    Exercise,
    Routine,
    User,
    RoutineExercise,
    WorkoutLog,
    Block, 
    BlockExercise
)

from schemas import AssignmentCreate, AssignmentOut
from timeutil import today_es, utcnow
from auth.auth import get_current_user
from permissions import get_routine_or_403, require_admin

router = APIRouter(prefix="/assignments", tags=["assignments"])


# ─────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────

class ConfirmWorkoutSchema(BaseModel):
    status: Literal["confirmed", "declined"]


MAX_SETS = 20   # series máximas por ejercicio y entreno


class WorkoutLogSchema(BaseModel):
    assignment_id: int
    exercise_id: int
    kg: float = Field(ge=0, le=1000)
    reps: int = Field(ge=0, le=1000)
    set_number: int = Field(default=1, ge=1, le=MAX_SETS)   # la app antigua no lo envía: serie 1


class SetIn(BaseModel):
    kg: float = Field(ge=0, le=1000)
    reps: int = Field(ge=0, le=1000)


class ExerciseSetsIn(BaseModel):
    """Todas las series de un ejercicio en un entreno. Sustituye a las que hubiera guardadas."""
    assignment_id: int
    exercise_id: int
    sets: list[SetIn] = Field(max_length=MAX_SETS)


class CopyWeekIn(BaseModel):
    source_user_id: int
    source_start: date          # cualquier día de la semana de origen
    target_user_ids: list[int] = Field(min_length=1, max_length=50)
    target_start: date          # cualquier día de la primera semana de destino
    weeks: int = Field(default=1, ge=1, le=12)  # cuántas semanas seguidas se rellenan


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


# ─────────────────────────────────────────
# COPIAR UNA SEMANA (entrenadora)
# ─────────────────────────────────────────

@router.post("/copy-week")
def copy_week(
    data: CopyWeekIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Copia las rutinas que un cliente tiene en una semana a otras semanas y/o a otros
    clientes. No duplica lo que ya existe (mismo cliente, rutina y día)."""
    src_monday = _monday(data.source_start)
    tgt_monday = _monday(data.target_start)

    if tgt_monday == src_monday and data.weeks == 1 and data.target_user_ids == [data.source_user_id]:
        raise HTTPException(400, "El origen y el destino son la misma semana del mismo cliente")

    source = (
        db.query(Assignment)
        .filter(
            Assignment.assigned_to_id == data.source_user_id,
            Assignment.date >= src_monday,
            Assignment.date <= src_monday + timedelta(days=6),
        )
        .order_by(Assignment.date, Assignment.id)
        .all()
    )
    if not source:
        raise HTTPException(400, "El cliente no tiene rutinas en la semana de origen")

    targets = (
        db.query(User)
        .filter(User.id.in_(data.target_user_ids), User.role != "admin", User.status == "active")
        .all()
    )
    if not targets:
        raise HTTPException(400, "No hay clientes activos de destino")

    # Lo que ya tienen los destinatarios en las semanas de destino, de una sola consulta
    target_ids = [t.id for t in targets]
    existing = {
        (uid, rid, d)
        for uid, rid, d in db.query(Assignment.assigned_to_id, Assignment.routine_id, Assignment.date)
        .filter(
            Assignment.assigned_to_id.in_(target_ids),
            Assignment.date >= tgt_monday,
            Assignment.date < tgt_monday + timedelta(days=7 * data.weeks),
        )
    }

    created = skipped = 0
    for week in range(data.weeks):
        shift = (tgt_monday - src_monday) + timedelta(days=7 * week)
        for target in targets:
            for a in source:
                new_date = a.date + shift
                key = (target.id, a.routine_id, new_date)
                if key in existing:
                    skipped += 1
                    continue
                existing.add(key)
                db.add(Assignment(
                    routine_id=a.routine_id,
                    assigned_to_id=target.id,
                    assigned_by_id=admin.id,
                    note=a.note,
                    date=new_date,
                    status="pending",
                ))
                created += 1

    db.commit()
    return {"created": created, "skipped": skipped}


# ─────────────────────────────────────────
# CREAR ASIGNACIONES
# ─────────────────────────────────────────

@router.post("/", response_model=list[AssignmentOut], status_code=201)
def assign_routine(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),  # solo la entrenadora asigna rutinas
):
    routine = db.query(Routine).filter(Routine.id == data.routine_id).first()

    if not routine:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    if current_user.role != "admin" and routine.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso sobre esta rutina"
        )

    assignments = []
    found = {i for (i,) in db.query(User.id).filter(User.id.in_(data.assigned_to_ids))}

    for user_id in data.assigned_to_ids:
        if user_id not in found:
            continue

        assignment = Assignment(
            routine_id=data.routine_id,
            assigned_to_id=user_id,
            assigned_by_id=current_user.id,
            note=data.note,
            date=data.date,
            status="pending"
        )

        db.add(assignment)
        assignments.append(assignment)

    db.commit()

    for a in assignments:
        db.refresh(a)

    return assignments


def _assignment_dict(a: Assignment) -> dict:
    routine = a.routine

    return {
        "id": a.id,
        "routine_id": a.routine_id,
        "assigned_to_id": a.assigned_to_id,
        "assigned_by_id": a.assigned_by_id,
        "note": a.note,
        "date": a.date,
        "status": a.status or "pending",
        "confirmed_at": a.confirmed_at,
        "declined_at": a.declined_at,

        "routine": {
            "id": routine.id,
            "name": routine.name,
            "description": routine.description,
            "user_id": routine.user_id,
            "date": routine.date,

            "blocks": [
                {
                    "id": block.id,
                    "name": block.name,
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
                        for be in block.exercises
                        if be.exercise is not None
                    ]
                }
                for block in routine.blocks
            ]
        } if routine else None,

        "assigned_by": {
            "id": a.assigned_by.id,
            "name": a.assigned_by.name,
            "email": a.assigned_by.email,
        } if a.assigned_by else None
    }



# ─────────────────────────────────────────
# MIS RUTINAS ASIGNADAS
# ─────────────────────────────────────────

@router.get("/mine")
def my_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.routine)
            .joinedload(Routine.blocks)
            .joinedload(Block.exercises)
            .joinedload(BlockExercise.exercise),

            joinedload(Assignment.assigned_by),
        )
        .filter(Assignment.assigned_to_id == current_user.id)
    )

    # Los clientes solo ven las rutinas del mes en curso. Al cambiar de mes dejan de
    # aparecer, pero NO se borran (se conservan los registros y el historial).
    # El mes se cuenta en hora de España (el servidor va en UTC).
    if current_user.role != "admin":
        today = today_es()
        month_start = today.replace(day=1)
        next_month = (month_start + timedelta(days=32)).replace(day=1)
        query = query.filter(Assignment.date >= month_start, Assignment.date < next_month)

    assignments = query.all()

    return [_assignment_dict(a) for a in assignments]


# ─────────────────────────────────────────
# TODAS LAS SESIONES DE LOS CLIENTES (solo entrenador)
# ─────────────────────────────────────────

@router.get("/clients")
def clients_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    start: Optional[date] = None,
    end: Optional[date] = None,
):
    """Sesiones de los clientes. La app pide solo las fechas del mes que se está viendo
    (start/end); sin ellas devuelve todo, como antes."""
    query = (
        db.query(Assignment)
        .options(
            # selectinload: una consulta por nivel en vez de un JOIN enorme con filas repetidas
            selectinload(Assignment.routine)
            .selectinload(Routine.blocks)
            .selectinload(Block.exercises)
            .selectinload(BlockExercise.exercise),
            selectinload(Assignment.assigned_to),
        )
        .join(User, Assignment.assigned_to_id == User.id)
        .filter(User.role != "admin")
    )
    if start:
        query = query.filter(Assignment.date >= start)
    if end:
        query = query.filter(Assignment.date <= end)
    assignments = query.order_by(Assignment.date).all()

    result = []
    for a in assignments:
        item = _assignment_dict(a)
        item["assigned_to"] = {
            "id": a.assigned_to.id,
            "name": a.assigned_to.name,
            "email": a.assigned_to.email,
        }
        result.append(item)
    return result


# ─────────────────────────────────────────
# MIS LOGS DE PESOS  ← ANTES del wildcard /{assignment_id}
# ─────────────────────────────────────────

@router.get("/logs/mine")
def get_my_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = (
        db.query(WorkoutLog)
        .filter(WorkoutLog.user_id == current_user.id)
        .order_by(WorkoutLog.created_at, WorkoutLog.id)
        .all()
    )
    return [
        {
            "id": log.id,
            "assignment_id": log.assignment_id,
            "exercise_id": log.exercise_id,
            "set_number": log.set_number or 1,
            "kg": log.kg,
            "reps": log.reps,
            "created_at": str(log.created_at),
            "date": str(log.created_at)[:10] if log.created_at else None,
            "exercise": {
                "id": log.exercise.id,
                "name": log.exercise.name,
            } if log.exercise else None,
        }
        for log in logs
    ]


# ─────────────────────────────────────────
# RUTINAS QUE HE ASIGNADO
# ─────────────────────────────────────────

@router.get("/sent", response_model=list[AssignmentOut])
def sent_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignments = (
        db.query(Assignment)
        .options(
            joinedload(Assignment.routine)
            .joinedload(Routine.routine_exercises)
            .joinedload(RoutineExercise.exercise),

            joinedload(Assignment.assigned_to),
        )
        .filter(Assignment.assigned_by_id == current_user.id)
        .all()
    )

    for a in assignments:
        if a.routine:
            a.routine.routine_exercises = [
                re for re in a.routine.routine_exercises
                if re.exercise is not None
            ]

    return assignments


# ─────────────────────────────────────────
# OBTENER ASIGNACIONES POR RUTINA
# ─────────────────────────────────────────

@router.get("/routine/{routine_id}")
def get_assignments_by_routine(
    routine_id: int,
    db: Session = Depends(get_db),
    routine: Routine = Depends(get_routine_or_403),  # 404/403 si no es admin ni dueño
):
    assignments = db.query(Assignment).filter(
        Assignment.routine_id == routine_id
    ).all()

    return [
        {
            "id": a.id,
            "assigned_to_id": a.assigned_to_id,
            "date": a.date,
            "note": a.note,
            "status": a.status,
        }
        for a in assignments
    ]


# ─────────────────────────────────────────
# GUARDAR PESOS / REPS
# ─────────────────────────────────────────

def _my_assignment(db: Session, assignment_id: int, exercise_id: int, user: User) -> None:
    """Comprueba que la asignación es mía y que el ejercicio existe."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    if assignment.assigned_to_id != user.id:
        raise HTTPException(status_code=403, detail="No autorizado")
    if not db.get(Exercise, exercise_id):
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")


@router.post("/log")
def save_workout_log(
    data: WorkoutLogSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Guarda UNA serie (peso y repeticiones). Si no se indica set_number, es la serie 1."""
    _my_assignment(db, data.assignment_id, data.exercise_id, current_user)

    existing = db.query(WorkoutLog).filter(
        WorkoutLog.assignment_id == data.assignment_id,
        WorkoutLog.exercise_id == data.exercise_id,
        WorkoutLog.user_id == current_user.id,
        WorkoutLog.set_number == data.set_number,
    ).first()

    if existing:
        existing.kg = data.kg
        existing.reps = data.reps
    else:
        db.add(WorkoutLog(
            assignment_id=data.assignment_id,
            user_id=current_user.id,
            exercise_id=data.exercise_id,
            set_number=data.set_number,
            kg=data.kg,
            reps=data.reps,
        ))

    db.commit()

    return {"ok": True}


@router.post("/log/sets")
def save_exercise_sets(
    data: ExerciseSetsIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Guarda todas las series de un ejercicio de una vez (serie 1, 2, 3...).

    Las series que ya existían se actualizan (conservan su fecha), las nuevas se crean y las
    que sobran —porque la persona quitó alguna— se borran. Una lista vacía borra todas."""
    _my_assignment(db, data.assignment_id, data.exercise_id, current_user)

    rows = (
        db.query(WorkoutLog)
        .filter(
            WorkoutLog.assignment_id == data.assignment_id,
            WorkoutLog.exercise_id == data.exercise_id,
            WorkoutLog.user_id == current_user.id,
        )
        .order_by(WorkoutLog.set_number, WorkoutLog.id)
        .all()
    )
    by_number: dict[int, WorkoutLog] = {}
    sobrantes: list[WorkoutLog] = []      # duplicados (p. ej. por un doble toque antiguo)
    for row in rows:
        n = row.set_number or 1
        if n in by_number:
            sobrantes.append(row)
        else:
            by_number[n] = row

    for n, item in enumerate(data.sets, start=1):
        row = by_number.pop(n, None)
        if row:
            row.kg, row.reps = item.kg, item.reps
        else:
            db.add(WorkoutLog(
                assignment_id=data.assignment_id,
                user_id=current_user.id,
                exercise_id=data.exercise_id,
                set_number=n,
                kg=item.kg,
                reps=item.reps,
            ))

    for row in [*by_number.values(), *sobrantes]:
        db.delete(row)

    db.commit()
    return {"ok": True, "sets": len(data.sets)}


# ─────────────────────────────────────────
# CONFIRMAR / RECHAZAR ENTRENAMIENTO
# ─────────────────────────────────────────

@router.patch("/{assignment_id}/confirm")
def confirm_assignment(
    assignment_id: int,
    data: ConfirmWorkoutSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Asignación no encontrada"
        )

    if assignment.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="No autorizado"
        )

    assignment.status = data.status

    if data.status == "confirmed":
        assignment.confirmed_at = utcnow()
        assignment.declined_at = None
    elif data.status == "declined":
        assignment.declined_at = utcnow()
        assignment.confirmed_at = None

    db.commit()

    return {
        "ok": True,
        "status": assignment.status
    }


# ─────────────────────────────────────────
# BORRAR ASIGNACIÓN
# ─────────────────────────────────────────

@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id
    ).first()

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Asignación no encontrada"
        )

    if (
        current_user.role != "admin"
        and assignment.assigned_by_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="No autorizado"
        )

    if db.query(WorkoutLog.id).filter(WorkoutLog.assignment_id == assignment_id).first():
        raise HTTPException(
            status_code=409,
            detail="El cliente ya registró series en este entrenamiento. "
                   "No se puede borrar sin perder su historial.",
        )

    db.delete(assignment)
    db.commit()

    return {"ok": True}