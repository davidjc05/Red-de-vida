"""Seguimiento de clientes para la entrenadora: quién cumple y quién lleva días sin entrenar."""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Activity, Assignment, User, WorkoutLog
from permissions import require_admin

router = APIRouter(prefix="/tracking", tags=["Seguimiento"])

try:  # la fecha "de hoy" se calcula con la hora de España
    from zoneinfo import ZoneInfo

    _TZ = ZoneInfo("Europe/Madrid")
except Exception:  # sin base de zonas horarias: se usa UTC
    _TZ = None

WINDOW_DAYS = 30
ATTENTION_DAYS = 4   # a partir de aquí: "atención"
INACTIVE_DAYS = 7    # a partir de aquí: "inactivo"


def _today() -> date:
    return datetime.now(_TZ).date() if _TZ else datetime.utcnow().date()


def _status(assigned: int, upcoming, days_since):
    if assigned == 0:
        return "al_dia" if upcoming else "sin_plan"
    if days_since is None or days_since >= INACTIVE_DAYS:
        return "inactivo"
    if days_since >= ATTENTION_DAYS:
        return "atencion"
    return "al_dia"


@router.get("/summary")
def summary(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    today = _today()
    since = today - timedelta(days=WINDOW_DAYS - 1)

    clients = db.query(User).filter(User.role != "admin", User.status == "active").all()
    pending = db.query(User).filter(User.role != "admin", User.status == "pending").count()
    ids = [c.id for c in clients]

    assigned, done, last_done, last_log, last_act, upcoming = {}, {}, {}, {}, {}, {}
    if ids:
        for uid, st, n in (
            db.query(Assignment.assigned_to_id, Assignment.status, func.count(Assignment.id))
            .filter(Assignment.assigned_to_id.in_(ids), Assignment.date.between(since, today))
            .group_by(Assignment.assigned_to_id, Assignment.status)
        ):
            assigned[uid] = assigned.get(uid, 0) + n
            if st == "confirmed":
                done[uid] = n
        last_done = dict(
            db.query(Assignment.assigned_to_id, func.max(Assignment.confirmed_at))
            .filter(Assignment.assigned_to_id.in_(ids), Assignment.status == "confirmed")
            .group_by(Assignment.assigned_to_id)
        )
        last_log = dict(
            db.query(WorkoutLog.user_id, func.max(WorkoutLog.created_at))
            .filter(WorkoutLog.user_id.in_(ids))
            .group_by(WorkoutLog.user_id)
        )
        last_act = dict(
            db.query(Activity.user_id, func.max(Activity.started_at))
            .filter(Activity.user_id.in_(ids))
            .group_by(Activity.user_id)
        )
        upcoming = dict(
            db.query(Assignment.assigned_to_id, func.min(Assignment.date))
            .filter(Assignment.assigned_to_id.in_(ids), Assignment.date >= today)
            .group_by(Assignment.assigned_to_id)
        )

    rows = []
    for c in clients:
        seen = [d for d in (last_done.get(c.id), last_log.get(c.id), last_act.get(c.id)) if d]
        last_seen = max(seen) if seen else None
        days = max(0, (today - last_seen.date()).days) if last_seen else None
        n_assigned = assigned.get(c.id, 0)
        n_done = done.get(c.id, 0)
        rows.append({
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "tracking_status": _status(n_assigned, upcoming.get(c.id), days),
            "assigned_30d": n_assigned,
            "done_30d": n_done,
            "adherence_pct": round(100 * n_done / n_assigned) if n_assigned else None,
            "days_since_last": days,
            "last_seen": last_seen.isoformat() if last_seen else None,
            "next_date": upcoming[c.id].isoformat() if upcoming.get(c.id) else None,
        })

    order = {"inactivo": 0, "atencion": 1, "sin_plan": 2, "al_dia": 3}
    rows.sort(key=lambda r: (order[r["tracking_status"]], -(r["days_since_last"] or 0), r["name"].lower()))

    counts = {k: sum(1 for r in rows if r["tracking_status"] == k) for k in order}
    rated = [r["adherence_pct"] for r in rows if r["adherence_pct"] is not None]
    return {
        "window_days": WINDOW_DAYS,
        "pending_approvals": pending,
        "active_clients": len(rows),
        "counts": counts,
        "avg_adherence_pct": round(sum(rated) / len(rated)) if rated else None,
        "clients": rows,
    }
