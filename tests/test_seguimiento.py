from datetime import timedelta

from routes.tracking import _today
from tests.test_seguridad import _admin, _headers, _register


def _client(c, admin, email):
    uid = _register(c, email).json()["id"]
    c.patch(f"/users/{uid}/status", json={"status": "active"}, headers=admin)
    return uid, _headers(c, email)


def _assign(c, admin, uid, day, routine_id):
    return c.post(
        "/assignments/",
        json={"routine_id": routine_id, "assigned_to_ids": [uid], "date": str(day)},
        headers=admin,
    ).json()[0]["id"]


def test_resumen_de_seguimiento(client):
    admin = _admin(client)
    today = _today()
    rt = client.post("/routines/", json={"name": "R", "user_id": 1, "date": str(today)}, headers=admin).json()["id"]

    ok_id, ok_h = _client(client, admin, "ok@seg.com")          # hizo 1 de 2 hoy
    idle_id, _ = _client(client, admin, "idle@seg.com")         # asignada hace 10 días, nunca hecha
    free_id, _ = _client(client, admin, "free@seg.com")         # sin plan
    _register(client, "pend@seg.com")                           # pendiente de aprobar

    a1 = _assign(client, admin, ok_id, today, rt)
    _assign(client, admin, ok_id, today - timedelta(days=1), rt)
    client.patch(f"/assignments/{a1}/confirm", json={"status": "confirmed"}, headers=ok_h)
    _assign(client, admin, idle_id, today - timedelta(days=10), rt)

    r = client.get("/tracking/summary", headers=admin)
    assert r.status_code == 200
    d = r.json()
    by = {c["email"]: c for c in d["clients"]}
    assert by["ok@seg.com"]["tracking_status"] == "al_dia"
    assert (by["ok@seg.com"]["assigned_30d"], by["ok@seg.com"]["done_30d"], by["ok@seg.com"]["adherence_pct"]) == (2, 1, 50)
    assert by["idle@seg.com"]["tracking_status"] == "inactivo" and by["idle@seg.com"]["days_since_last"] is None
    assert by["free@seg.com"]["tracking_status"] == "sin_plan"
    assert d["pending_approvals"] >= 1 and d["active_clients"] >= 3
    # los que requieren atención van primero
    assert d["clients"][0]["tracking_status"] == "inactivo"


def test_resumen_solo_para_la_entrenadora(client):
    admin = _admin(client)
    _, cli = _client(client, admin, "cli@seg.com")
    assert client.get("/tracking/summary", headers=cli).status_code == 403
    assert client.get("/tracking/summary").status_code == 401
