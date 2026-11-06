from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth.auth import get_current_user
from database import get_db
from models import Activity, User
from permissions import require_admin

router = APIRouter(prefix="/activities", tags=["activities"])


class ActivityIn(BaseModel):
    kind: Literal["run", "walk"]
    started_at: datetime
    elapsed_s: int = Field(ge=5, le=86400)
    distance_m: float = Field(ge=0, le=500000)
    kcal: int = Field(ge=0, le=20000)


def _out(a: Activity) -> dict:
    return {
        "id": a.id,
        "kind": a.kind,
        "started_at": a.started_at,
        "elapsed_s": a.elapsed_s,
        "distance_m": a.distance_m,
        "kcal": a.kcal,
    }


@router.post("", status_code=201)
def create_activity(
    data: ActivityIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    started = data.started_at
    if started.tzinfo is not None:  # guardamos siempre en UTC sin zona
        from datetime import timezone
        started = started.astimezone(timezone.utc).replace(tzinfo=None)

    a = Activity(
        user_id=current_user.id,
        kind=data.kind,
        started_at=started,
        elapsed_s=data.elapsed_s,
        distance_m=data.distance_m,
        kcal=data.kcal,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _out(a)


@router.get("/mine")
def my_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Activity)
        .filter(Activity.user_id == current_user.id)
        .order_by(Activity.started_at.desc())
        .limit(100)
        .all()
    )
    return [_out(a) for a in rows]


@router.get("/clients")
def clients_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Solo entrenador: actividades agrupadas por cliente (clientes sin actividad incluidos)."""
    clients = (
        db.query(User)
        .filter(User.role != "admin", User.status == "active")
        .order_by(User.name)
        .all()
    )
    acts = (
        db.query(Activity)
        .filter(Activity.user_id.in_([c.id for c in clients]))
        .order_by(Activity.started_at.desc())
        .all()
    ) if clients else []

    by_user: dict[int, list] = {}
    for a in acts:
        by_user.setdefault(a.user_id, []).append(_out(a))

    return [
        {
            "client": {"id": c.id, "name": c.name},
            "activities": by_user.get(c.id, []),
        }
        for c in clients
    ]
