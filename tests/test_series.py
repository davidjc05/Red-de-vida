"""Registro por series: peso y repeticiones de cada serie de un ejercicio."""


from database import SessionLocal
from models import WorkoutLog
from tests.test_seguridad import _admin, _headers, _register


def _cliente(c, admin, email):
    uid = _register(c, email).json()["id"]
    c.patch(f"/users/{uid}/status", json={"status": "active"}, headers=admin)
    return uid, _headers(c, email)


def _entreno(c, admin, uid, nombre="Pierna"):
    """Crea 2 ejercicios, una rutina con ellos y la asigna al cliente. Devuelve (asignación, ej1, ej2)."""
    e1 = c.post("/exercises", json={"name": f"Sentadilla {nombre}", "muscle_group": "Pierna"}, headers=admin).json()["id"]
    e2 = c.post("/exercises", json={"name": f"Prensa {nombre}", "muscle_group": "Pierna"}, headers=admin).json()["id"]
    rt = c.post("/routines/", json={"name": nombre, "user_id": 1, "date": "2026-11-18"}, headers=admin).json()["id"]
    c.put(
        f"/routines/{rt}/full",
        json={"name": nombre, "blocks": [{"name": "B", "exercises": [
            {"exerciseId": e1, "sets": 3, "reps": 10}, {"exerciseId": e2, "sets": 3, "reps": 12}]}]},
        headers=admin,
    )
    a = c.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [uid], "date": "2026-11-18"}, headers=admin).json()[0]["id"]
    c.patch(f"/assignments/{a}/confirm", json={"status": "confirmed"}, headers=_cli_headers(c, uid, admin))
    return a, e1, e2


def _cli_headers(c, uid, admin):
    email = next(u["email"] for u in c.get("/users/", headers=admin).json() if u["id"] == uid)
    return _headers(c, email)


def _mis_series(c, cli, a, e):
    logs = c.get("/assignments/logs/mine", headers=cli).json()
    return [(l["set_number"], l["kg"], l["reps"]) for l in logs if l["assignment_id"] == a and l["exercise_id"] == e]


def test_guardar_varias_series_y_verlas(client):
    admin = _admin(client)
    uid, cli = _cliente(client, admin, "series1@test.com")
    a, e1, e2 = _entreno(client, admin, uid, "A")

    r = client.post("/assignments/log/sets", json={
        "assignment_id": a, "exercise_id": e1,
        "sets": [{"kg": 60, "reps": 10}, {"kg": 62.5, "reps": 8}, {"kg": 65, "reps": 6}]}, headers=cli)
    assert r.status_code == 200 and r.json() == {"ok": True, "sets": 3}
    assert _mis_series(client, cli, a, e1) == [(1, 60, 10), (2, 62.5, 8), (3, 65, 6)]

    # la entrenadora ve cada serie, y kg/reps (compatibilidad) = la serie más pesada
    d = client.get(f"/tracking/client/{uid}", headers=admin).json()
    sq, prensa = d["workouts"][0]["exercises"]
    assert sq["logged"] and sq["sets"] == [
        {"set_number": 1, "kg": 60, "reps": 10},
        {"set_number": 2, "kg": 62.5, "reps": 8},
        {"set_number": 3, "kg": 65, "reps": 6},
    ]
    assert (sq["kg"], sq["reps"]) == (65, 6)
    assert not prensa["logged"] and prensa["sets"] == []


def test_guardar_de_nuevo_actualiza_quita_y_conserva_fecha(client):
    admin = _admin(client)
    uid, cli = _cliente(client, admin, "series2@test.com")
    a, e1, _ = _entreno(client, admin, uid, "B")
    body = lambda sets: {"assignment_id": a, "exercise_id": e1, "sets": sets}

    client.post("/assignments/log/sets", json=body([{"kg": 50, "reps": 10}, {"kg": 50, "reps": 9}, {"kg": 50, "reps": 8}]), headers=cli)
    antes = {l["set_number"]: (l["id"], l["created_at"]) for l in client.get("/assignments/logs/mine", headers=cli).json() if l["exercise_id"] == e1}

    # corrige la serie 2 y quita la 3
    client.post("/assignments/log/sets", json=body([{"kg": 50, "reps": 10}, {"kg": 52.5, "reps": 9}]), headers=cli)
    assert _mis_series(client, cli, a, e1) == [(1, 50, 10), (2, 52.5, 9)]
    despues = {l["set_number"]: (l["id"], l["created_at"]) for l in client.get("/assignments/logs/mine", headers=cli).json() if l["exercise_id"] == e1}
    assert despues[1] == antes[1] and despues[2] == antes[2]   # mismas filas, misma fecha

    # lista vacía = borrar todas
    assert client.post("/assignments/log/sets", json=body([]), headers=cli).status_code == 200
    assert _mis_series(client, cli, a, e1) == []


def test_la_app_antigua_sigue_funcionando(client):
    admin = _admin(client)
    uid, cli = _cliente(client, admin, "series3@test.com")
    a, e1, _ = _entreno(client, admin, uid, "C")

    # sin set_number = serie 1 y volver a guardar la actualiza (como antes)
    client.post("/assignments/log", json={"assignment_id": a, "exercise_id": e1, "kg": 40, "reps": 12}, headers=cli)
    client.post("/assignments/log", json={"assignment_id": a, "exercise_id": e1, "kg": 45, "reps": 10}, headers=cli)
    assert _mis_series(client, cli, a, e1) == [(1, 45, 10)]
    # con set_number se añade otra serie
    client.post("/assignments/log", json={"assignment_id": a, "exercise_id": e1, "kg": 47.5, "reps": 8, "set_number": 2}, headers=cli)
    assert _mis_series(client, cli, a, e1) == [(1, 45, 10), (2, 47.5, 8)]


def test_series_permisos_y_validaciones(client):
    admin = _admin(client)
    uid, cli = _cliente(client, admin, "series4@test.com")
    _, otro = _cliente(client, admin, "series5@test.com")
    a, e1, _ = _entreno(client, admin, uid, "D")
    ok = {"assignment_id": a, "exercise_id": e1, "sets": [{"kg": 10, "reps": 10}]}

    assert client.post("/assignments/log/sets", json=ok).status_code == 401
    assert client.post("/assignments/log/sets", json=ok, headers=otro).status_code == 403   # no es su entreno
    assert client.post("/assignments/log/sets", json={**ok, "assignment_id": 99999}, headers=cli).status_code == 404
    assert client.post("/assignments/log/sets", json={**ok, "exercise_id": 99999}, headers=cli).status_code == 404
    assert client.post("/assignments/log", json={"assignment_id": a, "exercise_id": 99999, "kg": 1, "reps": 1}, headers=cli).status_code == 404
    assert client.post("/assignments/log/sets", json={**ok, "sets": [{"kg": -1, "reps": 10}]}, headers=cli).status_code == 422
    assert client.post("/assignments/log/sets", json={**ok, "sets": [{"kg": 10, "reps": 5000}]}, headers=cli).status_code == 422
    assert client.post("/assignments/log/sets", json={**ok, "sets": [{"kg": 10, "reps": 10}] * 21}, headers=cli).status_code == 422
    assert client.post("/assignments/log", json={"assignment_id": a, "exercise_id": e1, "kg": 1, "reps": 1, "set_number": 0}, headers=cli).status_code == 422
    assert _mis_series(client, cli, a, e1) == []   # nada se guardó con datos inválidos


def test_series_duplicadas_antiguas_se_limpian(client):
    admin = _admin(client)
    uid, cli = _cliente(client, admin, "series6@test.com")
    a, e1, _ = _entreno(client, admin, uid, "E")
    db = SessionLocal()
    try:   # dos filas con el mismo número de serie (por un doble toque)
        for kg in (30, 31):
            db.add(WorkoutLog(assignment_id=a, user_id=uid, exercise_id=e1, set_number=1, kg=kg, reps=10))
        db.commit()
    finally:
        db.close()
    client.post("/assignments/log/sets", json={"assignment_id": a, "exercise_id": e1, "sets": [{"kg": 35, "reps": 10}]}, headers=cli)
    assert _mis_series(client, cli, a, e1) == [(1, 35, 10)]


def test_exportar_datos_incluye_la_serie(client):
    admin = _admin(client)
    uid, cli = _cliente(client, admin, "series7@test.com")
    a, e1, _ = _entreno(client, admin, uid, "F")
    client.post("/assignments/log/sets", json={"assignment_id": a, "exercise_id": e1, "sets": [{"kg": 20, "reps": 15}, {"kg": 25, "reps": 12}]}, headers=cli)
    regs = client.get("/auth/me/export", headers=cli).json()["registros_de_entrenamiento"]
    assert [(r["serie"], r["kg"], r["repeticiones"]) for r in regs] == [(1, 20, 15), (2, 25, 12)]
