from tests.test_seguridad import REG, _admin, _headers, _login, _register


def _active_client(c, email="cli2@test.com"):
    admin = _admin(c)
    uid = _register(c, email).json()["id"]
    c.patch(f"/users/{uid}/status", json={"status": "active"}, headers=admin)
    return admin, uid, _headers(c, email)


def test_registro_exige_aceptar_la_politica(client):
    _admin(client)
    body = {"name": "X", "email": "x@test.com", "password": "password1", **REG, "accept_terms": False}
    r = client.post("/auth/register", json=body)
    assert r.status_code == 422 and "política de privacidad" in r.text
    body.pop("accept_terms")
    assert client.post("/auth/register", json=body).status_code == 422


def test_se_guarda_el_consentimiento(client):
    admin, uid, cli = _active_client(client, "consent@test.com")
    me = client.get("/auth/me", headers=cli).json()
    assert me["consent_at"] is not None


def _cliente_con_datos(client, email):
    admin, uid, cli = _active_client(client, email)
    ex = client.post("/exercises", json={"name": "Sentadilla", "muscle_group": "Pierna"}, headers=admin).json()["id"]
    rt = client.post("/routines/", json={"name": "Rutina A", "user_id": 1, "date": "2026-11-20"}, headers=admin).json()["id"]
    a = client.post(
        "/assignments/", json={"routine_id": rt, "assigned_to_ids": [uid], "date": "2026-11-20"}, headers=admin
    ).json()[0]["id"]
    client.post("/assignments/log", json={"assignment_id": a, "exercise_id": ex, "kg": 40, "reps": 10}, headers=cli)
    client.post(
        "/activities",
        json={"kind": "run", "started_at": "2026-11-19T10:00:00", "elapsed_s": 600, "distance_m": 1500, "kcal": 120},
        headers=cli,
    )
    return admin, uid, cli


def test_exportar_mis_datos(client):
    admin, uid, cli = _cliente_con_datos(client, "export@test.com")
    r = client.get("/auth/me/export", headers=cli)
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    d = r.json()
    assert d["perfil"]["email"] == "export@test.com"
    assert d["rutinas_asignadas"][0]["rutina"] == "Rutina A"
    assert d["registros_de_entrenamiento"][0]["ejercicio"] == "Sentadilla"
    assert d["actividad"][0]["distancia_m"] == 1500
    assert client.get("/auth/me/export").status_code == 401


def test_borrar_mi_cuenta_con_datos(client):
    admin, uid, cli = _cliente_con_datos(client, "borrar@test.com")
    assert client.post("/auth/me/delete", json={"password": "mala"}, headers=cli).status_code == 400
    assert client.post("/auth/me/delete", json={"password": "password1"}, headers=cli).status_code == 200
    assert _login(client, "borrar@test.com").status_code == 401
    assert client.get("/auth/me", headers=cli).status_code == 401
    assert all(u["email"] != "borrar@test.com" for u in client.get("/users/", headers=admin).json())


def test_el_entrenador_puede_borrar_un_cliente_con_datos(client):
    admin, uid, cli = _cliente_con_datos(client, "borrado-admin@test.com")
    assert client.delete(f"/users/{uid}", headers=admin).status_code == 204
    assert all(u["id"] != uid for u in client.get("/users/", headers=admin).json())


def test_una_cuenta_de_entrenador_no_se_borra(client):
    admin = _admin(client)
    assert client.post("/auth/me/delete", json={"password": "password1"}, headers=admin).status_code == 400
    other = _register(client, "otro-admin@test.com").json()["id"]
    client.patch(f"/auth/users/{other}/promote", headers=admin)
    assert client.delete(f"/users/{other}", headers=admin).status_code == 400
