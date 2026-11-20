"""Borrado completo de la cuenta de un cliente (derecho de supresión)."""
from sqlalchemy.orm import Session

from models import (
    Activity, Assignment, EmailCode, FormSend, Routine, User, WorkoutLog,
)


def _delete_assignments(db: Session, assignment_ids: list) -> None:
    if not assignment_ids:
        return
    db.query(WorkoutLog).filter(WorkoutLog.assignment_id.in_(assignment_ids)).delete(
        synchronize_session=False
    )
    db.query(Assignment).filter(Assignment.id.in_(assignment_ids)).delete(synchronize_session=False)


def erase_client(db: Session, user: User) -> None:
    """Borra al usuario y todo lo suyo: asignaciones, registros de entreno, actividad,
    formularios recibidos y códigos de email. No sirve para cuentas de entrenador."""
    uid = user.id

    mine = [
        i for (i,) in db.query(Assignment.id).filter(
            (Assignment.assigned_to_id == uid) | (Assignment.assigned_by_id == uid)
        )
    ]
    _delete_assignments(db, mine)
    db.query(WorkoutLog).filter(WorkoutLog.user_id == uid).delete(synchronize_session=False)

    for routine in db.query(Routine).filter(Routine.user_id == uid).all():
        ids = [i for (i,) in db.query(Assignment.id).filter(Assignment.routine_id == routine.id)]
        _delete_assignments(db, ids)
        db.expire(routine)
        db.delete(routine)

    db.query(Activity).filter(Activity.user_id == uid).delete(synchronize_session=False)
    db.query(FormSend).filter(FormSend.user_id == uid).delete(synchronize_session=False)
    db.query(EmailCode).filter(EmailCode.email == user.email).delete(synchronize_session=False)

    db.flush()
    db.expire_all()
    db.delete(db.get(User, uid))
    db.commit()
