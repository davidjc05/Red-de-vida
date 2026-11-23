from datetime import date, timedelta

from tests.test_seguridad import _admin, _headers, _register


def _client(c, admin, email):
    uid = _register(c, email).json()["id"]
    c.patch(f"/users/{uid}/status", json={"status": "active"}, headers=admin)
    return uid


def _routine(c, admin, name):
    ex = c.post("/exercises", json={"name": f"Ej {name}", "muscle_group": "Pierna"}, headers=admin).json()["id"]
    rt = c.post("/routines/", json={"name": name, "user_id": 1, "date": "2026-11-01"}, headers=admin).json()["id"]
    c.put(
        f"/routines/{rt}/full",
        json={"name": name, "blocks": [{"name": "B1", "exercises": [{"exerciseId": ex, "sets": 5, "reps": 5}]}]},
        headers=admin,
    )
    return rt


def _dates(c, admin, uid):
    r = c.get(f"/tracking/client/{uid}", headers=admin).json()
    return sorted(w["date"] for w in r["workouts"])


def test_duplicar_rutina(client):
    admin = _admin(client)
    rt = _routine(client, admin, "Fuerza")
    r = client.post(f"/routines/{rt}/duplicate", headers=admin)
    assert r.status_code == 201
    d = r.json()
    assert d["id"] != rt and d["name"] == "Fuerza (copia)"
    assert d["blocks"][0]["name"] == "B1" and d["blocks"][0]["exercises"][0]["sets"] == 5
    assert client.post("/routines/9999/duplicate", headers=admin).status_code == 404
    uid = _client(client, admin, "dup@c.com")
    assert client.post(f"/routines/{rt}/duplicate", headers=_headers(client, "dup@c.com")).status_code == 403


def test_copiar_semana_a_otro_cliente_y_repetir(client):
    admin = _admin(client)
    a = _client(client, admin, "a@c.com")
    b = _client(client, admin, "b@c.com")
    rt = _routine(client, admin, "Semana")
    monday = date(2026, 11, 2)  # lunes
    for off in (0, 2, 4):  # lunes, miércoles, viernes
        client.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [a], "date": str(monday + timedelta(days=off))}, headers=admin)

    # a otro cliente, semana siguiente, 2 semanas seguidas (se da cualquier día de la semana)
    r = client.post("/assignments/copy-week", json={
        "source_user_id": a, "source_start": str(monday + timedelta(days=3)),
        "target_user_ids": [b], "target_start": str(monday + timedelta(days=7)), "weeks": 2}, headers=admin)
    assert r.status_code == 200 and r.json() == {"created": 6, "skipped": 0}
    assert _dates(client, admin, b) == ["2026-11-09", "2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18", "2026-11-20"]

    # repetirlo no duplica nada
    r = client.post("/assignments/copy-week", json={
        "source_user_id": a, "source_start": str(monday),
        "target_user_ids": [b], "target_start": str(monday + timedelta(days=7)), "weeks": 2}, headers=admin)
    assert r.json() == {"created": 0, "skipped": 6}
    # las copias empiezan pendientes
    assert all(w["status"] == "pending" for w in client.get(f"/tracking/client/{b}", headers=admin).json()["workouts"])


def test_copiar_semana_validaciones(client):
    admin = _admin(client)
    a = _client(client, admin, "v@c.com")
    monday = date(2026, 11, 2)
    body = {"source_user_id": a, "source_start": str(monday), "target_user_ids": [a], "target_start": str(monday + timedelta(days=7))}
    assert client.post("/assignments/copy-week", json=body, headers=admin).status_code == 400  # semana de origen vacía
    rt = _routine(client, admin, "Val")
    client.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [a], "date": str(monday)}, headers=admin)
    same = {**body, "target_start": str(monday + timedelta(days=2))}
    assert client.post("/assignments/copy-week", json=same, headers=admin).status_code == 400  # misma semana y cliente
    assert client.post("/assignments/copy-week", json=body, headers=_headers(client, "v@c.com")).status_code == 403
    assert client.post("/assignments/copy-week", json=body).status_code == 401
