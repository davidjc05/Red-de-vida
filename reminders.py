"""Recordatorios por correo (una vez al día, por la mañana, hora de España):

* Cliente: "Hoy tienes rutina" si tiene una rutina pendiente para hoy.
* Entrenadora: aviso de clientes que llevan días sin entrenar.

Cada correo se anota en `notification_logs`, así que no se repite aunque el servidor se reinicie.
Cada persona puede desactivarlos en su perfil (columna users.email_reminders).
"""
import logging
import os
import threading
import time
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import SessionLocal
from email_service import email_enabled, send_email
from models import Activity, Assignment, NotificationLog, User, WorkoutLog

log = logging.getLogger("reminders")

try:
    from zoneinfo import ZoneInfo

    _TZ = ZoneInfo("Europe/Madrid")
except Exception:  # sin base de zonas horarias: se usa UTC
    _TZ = None

SEND_FROM_HOUR = 8     # no se manda nada antes de esta hora
SEND_UNTIL_HOUR = 21   # ni después de esta
INACTIVE_FIRST_DAY = 5  # primer aviso cuando lleva 5 días sin entrenar...
INACTIVE_REPEAT = 7     # ...y se repite cada 7 días mientras siga igual
LOOKBACK_DAYS = 14      # solo cuenta a quien tuvo rutinas asignadas en las últimas 2 semanas


def app_url() -> str:
    return os.getenv("APP_URL", "https://red-de-vida-web.onrender.com")


def local_now() -> datetime:
    return datetime.now(_TZ) if _TZ else datetime.utcnow()


# ── control de envíos ────────────────────────────────────────────────────────

def _claim(db: Session, kind: str, user_id: int, day: date) -> bool:
    """Reserva el envío. False si ya se envió (o se está enviando) hoy."""
    db.add(NotificationLog(kind=kind, user_id=user_id, day=day))
    try:
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False


def _release(db: Session, kind: str, user_id: int, day: date) -> None:
    db.query(NotificationLog).filter_by(kind=kind, user_id=user_id, day=day).delete()
    db.commit()


def _deliver(db: Session, send, kind: str, user: User, day: date, subject: str, body: str) -> bool:
    if not _claim(db, kind, user.id, day):
        return False
    try:
        send(user.email, subject, body)
        return True
    except Exception as e:  # Brevo caído, correo inválido...: se libera para reintentar luego
        log.warning("No se pudo enviar %s a user %s: %s", kind, user.id, e)
        _release(db, kind, user.id, day)
        return False


# ── contenidos ───────────────────────────────────────────────────────────────

def _footer() -> str:
    return (
        f"\n\nAbre Red de Vida: {app_url()}\n"
        "Puedes desactivar estos avisos en Perfil → Ajustes → Recordatorios por correo."
    )


def _first_name(user: User) -> str:
    return (user.name or "").split(" ")[0] or "hola"


def _routine_name(a: Assignment) -> str:
    return a.routine.name if a.routine else "Rutina"


def _clients_today(db: Session, today: date):
    return (
        db.query(User)
        .filter(User.role != "admin", User.status == "active", User.email_verified.is_(True),
                User.email_reminders.is_(True))
        .join(Assignment, Assignment.assigned_to_id == User.id)
        .filter(Assignment.date == today, Assignment.status == "pending")
        .distinct()
        .all()
    )


def send_routine_reminders(db: Session, today: date, send=send_email) -> int:
    sent = 0
    for user in _clients_today(db, today):
        todays = (
            db.query(Assignment)
            .filter(Assignment.assigned_to_id == user.id, Assignment.date == today, Assignment.status == "pending")
            .order_by(Assignment.id)
            .all()
        )
        if not todays:
            continue
        lines = "\n".join(f"  • {_routine_name(a)}" for a in todays)
        body = f"Hola {_first_name(user)},\n\nHoy tienes en tu agenda:\n{lines}\n\n¡A por ello!" + _footer()
        if _deliver(db, send, "routine_today", user, today,
                    "Hoy tienes entrenamiento", body):
            sent += 1
    return sent


def _inactive_clients(db: Session, today: date) -> list[tuple[User, int]]:
    """Clientes con rutinas recientes que llevan días sin entrenar: [(cliente, días)]."""
    since = today - timedelta(days=LOOKBACK_DAYS)
    clients = (
        db.query(User)
        .filter(User.role != "admin", User.status == "active")
        .all()
    )
    if not clients:
        return []
    ids = [c.id for c in clients]

    first_plan = dict(
        db.query(Assignment.assigned_to_id, func.min(Assignment.date))
        .filter(Assignment.assigned_to_id.in_(ids), Assignment.date >= since, Assignment.date <= today)
        .group_by(Assignment.assigned_to_id)
    )
    last_done = dict(
        db.query(Assignment.assigned_to_id, func.max(Assignment.confirmed_at))
        .filter(Assignment.assigned_to_id.in_(ids), Assignment.status == "confirmed")
        .group_by(Assignment.assigned_to_id)
    )
    last_log = dict(
        db.query(WorkoutLog.user_id, func.max(WorkoutLog.created_at))
        .filter(WorkoutLog.user_id.in_(ids)).group_by(WorkoutLog.user_id)
    )
    last_act = dict(
        db.query(Activity.user_id, func.max(Activity.started_at))
        .filter(Activity.user_id.in_(ids)).group_by(Activity.user_id)
    )

    out = []
    for c in clients:
        if c.id not in first_plan:
            continue  # no tenía rutinas asignadas: no se le puede reprochar nada
        seen = [d for d in (last_done.get(c.id), last_log.get(c.id), last_act.get(c.id)) if d]
        # si nunca ha entrenado, cuenta desde su primera rutina reciente
        ref = max(seen).date() if seen else first_plan[c.id]
        days = (today - ref).days
        if days >= INACTIVE_FIRST_DAY and (days - INACTIVE_FIRST_DAY) % INACTIVE_REPEAT == 0:
            out.append((c, days))
    out.sort(key=lambda x: -x[1])
    return out


def send_inactive_digest(db: Session, today: date, send=send_email) -> int:
    inactive = _inactive_clients(db, today)
    if not inactive:
        return 0
    lines = "\n".join(
        f"  • {c.name}: {days} días sin entrenar" for c, days in inactive
    )
    sent = 0
    admins = (
        db.query(User)
        .filter(User.role == "admin", User.status == "active", User.email_reminders.is_(True))
        .all()
    )
    for admin in admins:
        body = (
            f"Hola {_first_name(admin)},\n\nEstos clientes llevan días sin entrenar:\n{lines}\n\n"
            "Quizá merezca la pena escribirles." + _footer()
        )
        if _deliver(db, send, "inactive_digest", admin, today,
                    "Clientes que llevan días sin entrenar", body):
            sent += 1
    return sent


def run_daily(db: Session, today: date, send=send_email) -> dict:
    return {
        "routine_reminders": send_routine_reminders(db, today, send),
        "inactive_digests": send_inactive_digest(db, today, send),
    }


# ── planificador (hilo en segundo plano) ─────────────────────────────────────

def _loop() -> None:
    done_day = None
    while True:
        time.sleep(60)
        now = local_now()
        if done_day == now.date() or not (SEND_FROM_HOUR <= now.hour < SEND_UNTIL_HOUR):
            continue
        db = SessionLocal()
        try:
            result = run_daily(db, now.date())
            log.info("Recordatorios de %s: %s", now.date(), result)
            done_day = now.date()
        except Exception:
            log.exception("Fallo en los recordatorios; se reintenta en 15 minutos")
            time.sleep(900)
        finally:
            db.close()


def start_scheduler() -> bool:
    """Arranca el hilo si el correo está configurado (REMINDERS_ENABLED=0 lo apaga)."""
    if not email_enabled() or os.getenv("REMINDERS_ENABLED", "1") == "0":
        return False
    threading.Thread(target=_loop, name="reminders", daemon=True).start()
    return True
