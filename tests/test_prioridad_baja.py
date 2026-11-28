"""Fallos de prioridad baja de la auditoría."""
from datetime import date, datetime, timezone
from unittest.mock import patch

from auth.auth import hash_password, verify_password
from database import SessionLocal
from models import BlockExercise
from tests.test_seguridad import _admin
from tests.test_series import _cliente, _entreno

# Hash creado con passlib (la librería de antes): las contraseñas guardadas deben seguir valiendo
HASH_PASSLIB = "$2b$12$.6yqQzooX9OnFfLz1m7CPuTPfV2KUrezpyed0lpPUG0GqcodGE4LG"


def test_contrasenas_antiguas_siguen_funcionando_sin_passlib():
    assert verify_password("ClaveAntigua1", HASH_PASSLIB)
    assert not verify_password("otra", HASH_PASSLIB)
    nuevo = hash_password("ClaveNueva1")
    assert nuevo.startswith("$2b$") and verify_password("ClaveNueva1", nuevo)
    assert not verify_password("x", "")   # hash vacío o roto: no entra, no da error


def test_mes_en_curso_en_hora_de_espana(client):
    """El 1 de diciembre a las 00:30 en España (23:30 del 30 de noviembre en UTC) la clienta
    ya ve las rutinas de diciembre."""
    admin = _admin(client)
    uid, cli = _cliente(client, admin, "medianoche@test.com")
    rt = client.post("/routines/", json={"name": "Dic", "user_id": 0, "date": "2026-12-01"}, headers=admin).json()["id"]
    a = client.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [uid], "date": "2026-12-01"},
                    headers=admin).json()[0]["id"]
    with patch("routes.assignments.today_es", return_value=date(2026, 12, 1)):
        assert a in [x["id"] for x in client.get("/assignments/mine", headers=cli).json()]


def test_hora_de_espana_cerca_de_medianoche():
    import timeutil
    utc = datetime(2026, 11, 30, 23, 30, tzinfo=timezone.utc)

    class _DT(datetime):
        @classmethod
        def now(cls, tz=None):
            return utc.astimezone(tz) if tz else utc.replace(tzinfo=None)

    with patch.object(timeutil, "datetime", _DT):
        assert timeutil.today_es() == date(2026, 12, 1)
        assert timeutil.utcnow() == datetime(2026, 11, 30, 23, 30)


def test_ejercicios_validan_enlaces_y_longitudes(client):
    admin = _admin(client)
    ok = client.post("/exercises", json={"name": "Remo", "muscle_group": "Espalda",
                                          "video_url": " https://youtube.com/x ", "image_url": ""}, headers=admin)
    assert ok.status_code == 201
    assert ok.json()["video_url"] == "https://youtube.com/x" and ok.json()["image_url"] is None
    for malo in ({"video_url": "javascript:alert(1)"}, {"image_url": "ftp://x"}, {"name": ""}, {"name": "x" * 101}):
        body = {"name": "Remo", "muscle_group": "Espalda", **malo}
        assert client.post("/exercises", json=body, headers=admin).status_code == 422
    eid = ok.json()["id"]
    assert client.patch(f"/exercises/{eid}", json={"video_url": "javascript:x"}, headers=admin).status_code == 422


def test_borrar_ejercicio_lo_quita_de_las_rutinas(client):
    admin = _admin(client)
    uid, _ = _cliente(client, admin, "quitar@test.com")
    _, e1, e2 = _entreno(client, admin, uid, nombre="Quitar")
    assert client.delete(f"/exercises/{e2}", headers=admin).status_code == 204
    db = SessionLocal()
    try:
        assert db.query(BlockExercise).filter(BlockExercise.exercise_id.is_(None)).count() == 0
        assert db.query(BlockExercise).filter(BlockExercise.exercise_id == e1).count() == 1
    finally:
        db.close()
