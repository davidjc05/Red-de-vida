import logging
from datetime import timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from auth.auth import get_current_user
from database import get_db
from email_service import email_enabled, send_email
from models import Form, FormSend, User
from timeutil import utcnow
from permissions import require_admin

router = APIRouter(prefix="/forms", tags=["forms"])
log = logging.getLogger("forms")

ALLOWED_HOSTS = {"docs.google.com", "forms.gle", "forms.google.com"}


class FormIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    url: str = Field(max_length=500)

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El título no puede estar vacío")
        return v

    @field_validator("url")
    @classmethod
    def google_forms_url(cls, v: str) -> str:
        v = v.strip()
        u = urlparse(v)
        if u.scheme != "https" or (u.hostname or "").lower() not in ALLOWED_HOSTS:
            raise ValueError("Pega el enlace de Google Forms (empieza por https://docs.google.com/forms o https://forms.gle)")
        return v


class SendIn(BaseModel):
    user_id: int


def _form_out(f: Form) -> dict:
    return {"id": f.id, "title": f.title, "url": f.url}


def _send_out(sd: FormSend) -> dict:
    return {
        "id": sd.id,
        "form_id": sd.form_id,
        "title": sd.form.title,
        "url": sd.form.url,
        "sent_at": sd.sent_at,
        "email_sent": sd.email_sent,
    }


# ── Cliente: formularios que me han enviado ──
@router.get("/mine")
def my_forms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(FormSend)
        .filter(FormSend.user_id == current_user.id)
        .order_by(FormSend.sent_at.desc())
        .all()
    )
    return [_send_out(r) for r in rows]


# ── Entrenador ──
@router.get("")
def list_forms(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return [_form_out(f) for f in db.query(Form).order_by(Form.title).all()]


@router.post("", status_code=201)
def create_form(data: FormIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    f = Form(title=data.title, url=data.url)
    db.add(f)
    db.commit()
    db.refresh(f)
    return _form_out(f)


@router.get("/sent/{user_id}")
def sent_to_client(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    rows = (
        db.query(FormSend)
        .filter(FormSend.user_id == user_id)
        .order_by(FormSend.sent_at.desc())
        .all()
    )
    return [_send_out(r) for r in rows]


@router.delete("/{form_id}", status_code=204)
def delete_form(form_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Formulario no encontrado")
    db.query(FormSend).filter(FormSend.form_id == form_id).delete()
    db.delete(f)
    db.commit()


@router.post("/{form_id}/send")
def send_form(form_id: int, data: SendIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    f = db.get(Form, form_id)
    if not f:
        raise HTTPException(404, "Formulario no encontrado")
    client = db.get(User, data.user_id)
    if not client or client.role == "admin":
        raise HTTPException(404, "Cliente no encontrado")

    # Evita dobles envíos por un doble clic
    recent = (
        db.query(FormSend)
        .filter(FormSend.form_id == f.id, FormSend.user_id == client.id,
                FormSend.sent_at > utcnow() - timedelta(seconds=30))
        .first()
    )
    if recent:
        return {"ok": True, "email_sent": recent.email_sent}

    email_ok = False
    if email_enabled():
        try:
            send_email(
                client.email,
                f"Tu entrenador te ha enviado un formulario: {f.title}",
                f"Hola {client.name},\n\nTu entrenador te ha enviado el formulario \"{f.title}\".\n"
                f"Puedes rellenarlo aquí:\n{f.url}\n\n"
                "También lo tienes siempre en la app, en tu Perfil, en \"Mis formularios\".",
            )
            email_ok = True
        except Exception as e:
            # En los logs va el id del cliente, no su email (dato personal)
            log.warning("No se pudo enviar el formulario %s al usuario %s: %s", f.id, client.id, e)

    db.add(FormSend(form_id=f.id, user_id=client.id, email_sent=email_ok))
    db.commit()
    return {"ok": True, "email_sent": email_ok}
