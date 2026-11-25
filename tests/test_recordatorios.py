from datetime import date, datetime, timedelta

import pytest

import reminders
from database import SessionLocal
from models import Activity, Assignment, NotificationLog, User
from tests.test_seguridad import _admin, _headers, _register

TODAY = date(2026, 12, 8)


class Outbox:
    def __init__(self):
        self.sent = []

    def __call__(self, to, subject, body):
        self.sent.append((to, subject, body))

    def to(self, email):
        return [m for m in self.sent if m[0] == email]


@pytest.fixture()
def db():
    s = SessionLocal()
    s.query(NotificationLog).delete()
    s.commit()
    yield s
    s.close()


def _client(c, admin, email):
    uid = _register(c, email, name=email.split("@")[0].capitalize() + " Prueba").json()["id"]
    c.patch(f"/users/{uid}/status", json={"status": "active"}, headers=admin)
    return uid


def _routine(c, admin, name):
    return c.post("/routines/", json={"name": name, "user_id": 1, "date": str(TODAY)}, headers=admin).json()["id"]


def _assign(c, admin, uid, rt, day):
    return c.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [uid], "date": str(day)}, headers=admin).json()[0]["id"]


def test_recordatorio_de_rutina_de_hoy_una_sola_vez(client, db):
    admin = _admin(client)
    uid = _client(client, admin, "hoy@rec.com")
    rt = _routine(client, admin, "Pierna de hoy")
    _assign(client, admin, uid, rt, TODAY)
    out = Outbox()

    reminders.send_routine_reminders(db, TODAY, out)
    assert len(out.to("hoy@rec.com")) == 1
    to, subject, body = out.to("hoy@rec.com")[0]
    assert "Pierna de hoy" in body and "Hoy tienes" in subject and "Recordatorios por correo" in body
    # segunda pasada el mismo día: no se repite
    assert reminders.send_routine_reminders(db, TODAY, out) == 0
    assert len(out.to("hoy@rec.com")) == 1


def test_no_avisa_si_ya_esta_hecha_o_es_otro_dia_o_lo_desactivo(client, db):
    admin = _admin(client)
    done = _client(client, admin, "hecha@rec.com")
    other = _client(client, admin, "otrodia@rec.com")
    off = _client(client, admin, "off@rec.com")
    rt = _routine(client, admin, "R")
    a = _assign(client, admin, done, rt, TODAY)
    client.patch(f"/assignments/{a}/confirm", json={"status": "confirmed"}, headers=_headers(client, "hecha@rec.com"))
    _assign(client, admin, other, rt, TODAY + timedelta(days=1))
    _assign(client, admin, off, rt, TODAY)
    assert client.patch("/auth/me", json={"email_reminders": False}, headers=_headers(client, "off@rec.com")).json()["email_reminders"] is False
    out = Outbox()
    reminders.send_routine_reminders(db, TODAY, out)  # (la base de datos es compartida con otras pruebas)
    for email in ("hecha@rec.com", "otrodia@rec.com", "off@rec.com"):
        assert out.to(email) == []


def test_si_falla_el_envio_se_reintenta(client, db):
    admin = _admin(client)
    uid = _client(client, admin, "falla@rec.com")
    _assign(client, admin, uid, _routine(client, admin, "R"), TODAY)

    def broken(*a):
        raise RuntimeError("Brevo caído")

    assert reminders.send_routine_reminders(db, TODAY, broken) == 0
    out = Outbox()
    reminders.send_routine_reminders(db, TODAY, out)
    assert len(out.to("falla@rec.com")) == 1  # no quedó marcado como enviado, se reintentó


def test_aviso_a_la_entrenadora_de_clientes_inactivos(client, db):
    admin = _admin(client)
    idle = _client(client, admin, "inactivo@rec.com")
    active = _client(client, admin, "activo@rec.com")
    noplan = _client(client, admin, "sinplan@rec.com")
    rt = _routine(client, admin, "R")
    _assign(client, admin, idle, rt, TODAY - timedelta(days=5))     # 5 días con rutina y sin entrenar
    a = _assign(client, admin, active, rt, TODAY - timedelta(days=5))
    client.patch(f"/assignments/{a}/confirm", json={"status": "confirmed"}, headers=_headers(client, "activo@rec.com"))
    # el "último entreno" de activo es ahora (confirmed_at); lo adelantamos para simular 1 día
    s = SessionLocal()
    s.query(Assignment).filter(Assignment.id == a).update({"confirmed_at": datetime.combine(TODAY - timedelta(days=1), datetime.min.time())})
    s.commit(); s.close()

    out = Outbox()
    assert reminders.send_inactive_digest(db, TODAY, out) == 1
    to, subject, body = out.to("admin@test.com")[0]
    assert "Inactivo Prueba: 5 días" in body
    assert "Activo Prueba" not in body and "Sinplan Prueba" not in body
    assert reminders.send_inactive_digest(db, TODAY, out) == 0  # no se repite el mismo día

    # al día siguiente (6 días) no vuelve a avisar; a los 12 (5 + 7) sí
    assert reminders.send_inactive_digest(db, TODAY + timedelta(days=1), out) == 0
    assert reminders.send_inactive_digest(db, TODAY + timedelta(days=7), out) == 1


def test_actividad_cuenta_como_entreno(client, db):
    admin = _admin(client)
    uid = _client(client, admin, "corre@rec.com")
    _assign(client, admin, uid, _routine(client, admin, "R"), TODAY - timedelta(days=6))
    s = SessionLocal()
    s.add(Activity(user_id=uid, kind="run", started_at=datetime.combine(TODAY - timedelta(days=1), datetime.min.time()),
                   elapsed_s=600, distance_m=1500, kcal=100))
    s.commit(); s.close()
    out = Outbox()
    reminders.send_inactive_digest(db, TODAY, out)
    assert all("Corre Prueba" not in body for _, _, body in out.sent)


def test_correo_de_prueba_requiere_correo_configurado(client):
    admin = _admin(client)
    assert client.post("/auth/me/test-reminder", headers=admin).status_code == 503  # en tests no hay Brevo
    assert client.post("/auth/me/test-reminder").status_code == 401
