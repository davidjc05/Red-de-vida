from tests.test_seguridad import _admin, _headers, _register


def _client(c, admin, email):
    uid = _register(c, email).json()["id"]
    c.patch(f"/users/{uid}/status", json={"status": "active"}, headers=admin)
    return uid, _headers(c, email)


def test_historial_de_entrenos_con_pesos(client):
    admin = _admin(client)
    uid, cli = _client(client, admin, "hist@seg.com")
    sent = client.post("/exercises", json={"name": "Sentadilla", "muscle_group": "Pierna"}, headers=admin).json()["id"]
    press = client.post("/exercises", json={"name": "Press banca", "muscle_group": "Pecho"}, headers=admin).json()["id"]
    rt = client.post("/routines/", json={"name": "Pierna y pecho", "user_id": 1, "date": "2026-11-18"}, headers=admin).json()["id"]
    client.put(
        f"/routines/{rt}/full",
        json={"name": "Pierna y pecho", "blocks": [{"name": "B", "exercises": [
            {"exerciseId": sent, "sets": 4, "reps": 8}, {"exerciseId": press, "sets": 3, "reps": 10}]}]},
        headers=admin,
    )
    old = client.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [uid], "date": "2026-11-10"}, headers=admin).json()[0]["id"]
    new = client.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [uid], "date": "2026-11-18"}, headers=admin).json()[0]["id"]
    client.post("/assignments/log", json={"assignment_id": new, "exercise_id": sent, "kg": 60, "reps": 8}, headers=cli)
    client.patch(f"/assignments/{new}/confirm", json={"status": "confirmed"}, headers=cli)

    r = client.get(f"/tracking/client/{uid}", headers=admin)
    assert r.status_code == 200
    d = r.json()
    assert d["client"]["name"] and [w["date"] for w in d["workouts"]] == ["2026-11-18", "2026-11-10"]  # más reciente primero
    w = d["workouts"][0]
    assert w["routine_name"] == "Pierna y pecho" and w["status"] == "confirmed"
    sq, pb = w["exercises"]
    assert sq["name"] == "Sentadilla" and (sq["planned_sets"], sq["planned_reps"]) == (4, 8)
    assert sq["logged"] and (sq["kg"], sq["reps"]) == (60, 8)
    assert pb["name"] == "Press banca" and not pb["logged"] and pb["kg"] is None  # planificado pero sin registrar
    assert d["workouts"][1]["status"] == "pending" and not any(e["logged"] for e in d["workouts"][1]["exercises"])
    assert old  # la asignación antigua existe


def test_historial_solo_para_la_entrenadora(client):
    admin = _admin(client)
    uid, cli = _client(client, admin, "perm@seg.com")
    assert client.get(f"/tracking/client/{uid}", headers=cli).status_code == 403
    assert client.get(f"/tracking/client/{uid}").status_code == 401
    assert client.get("/tracking/client/9999", headers=admin).status_code == 404
    assert client.get("/tracking/client/1", headers=admin).status_code == 404  # un entrenador no es cliente
