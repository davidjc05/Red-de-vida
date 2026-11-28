"""Fallos de la auditoría: un cliente no puede crear ni asignar rutinas aunque llame a la API
directamente, y borrar algo con series registradas da un aviso claro en vez de un error 500."""
from tests.test_series import _cliente, _entreno


def test_cliente_no_puede_crear_ni_asignar_rutinas(client):
    from tests.test_seguridad import _admin
    admin = _admin(client)
    otro, _ = _cliente(client, admin, "victima@test.com")
    _, cli = _cliente(client, admin, "atacante@test.com")

    # Crear una rutina llamando a la API con el token del cliente
    r = client.post("/routines/", json={"name": "Spam", "user_id": 0, "date": "2026-11-28"}, headers=cli)
    assert r.status_code == 403

    # Asignar una rutina de la entrenadora a otra clienta
    rt = client.post("/routines/", json={"name": "Real", "user_id": 0, "date": "2026-11-28"}, headers=admin).json()["id"]
    r = client.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [otro], "date": "2026-11-28"}, headers=cli)
    assert r.status_code == 403

    # La entrenadora sigue pudiendo hacerlo
    r = client.post("/assignments/", json={"routine_id": rt, "assigned_to_ids": [otro], "date": "2026-11-28"}, headers=admin)
    assert r.status_code == 201


def test_borrar_con_series_registradas_avisa_y_no_pierde_datos(client):
    from tests.test_seguridad import _admin
    admin = _admin(client)
    uid, cli = _cliente(client, admin, "borrados@test.com")
    a, e1, _ = _entreno(client, admin, uid, nombre="Borrados")
    assert client.post("/assignments/log/sets", json={
        "assignment_id": a, "exercise_id": e1, "sets": [{"kg": 40, "reps": 10}]}, headers=cli).status_code == 200
    routine_id = next(x["routine_id"] for x in client.get("/assignments/clients", headers=admin).json() if x["id"] == a)

    assert client.delete(f"/assignments/{a}", headers=admin).status_code == 409
    assert client.delete(f"/routines/{routine_id}", headers=admin).status_code == 409
    assert client.delete(f"/exercises/{e1}", headers=admin).status_code == 409

    # Las series del cliente siguen ahí
    logs = client.get("/assignments/logs/mine", headers=cli).json()
    assert any(l["assignment_id"] == a and l["exercise_id"] == e1 and l["kg"] == 40 for l in logs)


def test_borrar_sin_series_sigue_funcionando(client):
    from tests.test_seguridad import _admin
    admin = _admin(client)
    uid, _ = _cliente(client, admin, "sinseries@test.com")
    a, e1, e2 = _entreno(client, admin, uid, nombre="SinSeries")
    routine_id = next(x["routine_id"] for x in client.get("/assignments/clients", headers=admin).json() if x["id"] == a)

    assert client.delete(f"/assignments/{a}", headers=admin).status_code == 200
    assert client.delete(f"/routines/{routine_id}", headers=admin).status_code == 204
    assert client.delete(f"/exercises/{e2}", headers=admin).status_code == 204
