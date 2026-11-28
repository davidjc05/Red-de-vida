"""Fallos de prioridad media de la auditoría: IP real, bloqueo de cuentas ajenas, sesiones al cambiar
la contraseña, emails con mayúsculas, cuenta de entrenadora y listados con rango de fechas."""
from database import SessionLocal
from email_codes import issue_code
from tests.test_seguridad import REG, _admin, _headers, _login, _register
from tests.test_series import _cliente, _entreno


def _login_desde(c, email, password, ip):
    return c.post("/auth/login", data={"username": email, "password": password},
                  headers={"CF-Connecting-IP": ip})


def test_ip_de_cloudflare_no_se_puede_falsear_con_x_forwarded_for(client):
    # 10 registros por hora y por IP: cambiar X-Forwarded-For ya no da intentos nuevos
    codigos = [
        client.post("/auth/register",
                    json={"name": "z", "email": f"spam{i}@test.com", "password": "password1", **REG},
                    headers={"CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": f"10.0.0.{i}"}).status_code
        for i in range(11)
    ]
    assert codigos[:10] == [201] * 10 and codigos[10] == 429


def test_un_tercero_no_puede_bloquear_la_cuenta_de_otro(client):
    _register(client, "bloqueo@test.com")
    for _ in range(5):
        assert _login_desde(client, "bloqueo@test.com", "malamala", "198.51.100.1").status_code == 401
    # El atacante queda bloqueado...
    assert _login_desde(client, "bloqueo@test.com", "malamala", "198.51.100.1").status_code == 429
    # ...pero el dueño entra desde su conexión (la cuenta está pendiente: 403, no 429)
    assert _login_desde(client, "bloqueo@test.com", "password1", "198.51.100.2").status_code == 403


def test_muchos_fallos_desde_muchas_ips_tambien_se_frenan(client):
    _register(client, "repartido@test.com")
    for i in range(50):
        _login_desde(client, "repartido@test.com", "malamala", f"192.0.2.{i}")
    assert _login_desde(client, "repartido@test.com", "malamala", "192.0.2.200").status_code == 429


def test_cambiar_contrasena_cierra_las_otras_sesiones(client):
    admin = _admin(client)
    _, cli = _cliente(client, admin, "sesiones@test.com")
    otro_dispositivo = _headers(client, "sesiones@test.com")

    r = client.post("/auth/change-password",
                    json={"current_password": "password1", "new_password": "nuevaclave1"}, headers=cli)
    assert r.status_code == 200
    nuevo = {"Authorization": "Bearer " + r.json()["access_token"]}

    assert client.get("/auth/me", headers=otro_dispositivo).status_code == 401
    assert client.get("/auth/me", headers=cli).status_code == 401
    assert client.get("/auth/me", headers=nuevo).status_code == 200   # este dispositivo sigue dentro


def test_restablecer_contrasena_cierra_las_sesiones(client):
    admin = _admin(client)
    _, cli = _cliente(client, admin, "reset@test.com")
    db = SessionLocal()
    try:
        code = issue_code(db, "reset@test.com", "reset")
    finally:
        db.close()
    r = client.post("/auth/reset-password",
                    json={"email": "RESET@test.com", "code": code, "new_password": "nuevaclave1"})
    assert r.status_code == 200
    assert client.get("/auth/me", headers=cli).status_code == 401
    assert _login(client, "reset@test.com", "nuevaclave1").status_code == 200


def test_el_email_no_distingue_mayusculas(client):
    admin = _admin(client)
    uid, _ = _cliente(client, admin, "Mayus@Test.com")
    me = client.get("/users/", headers=admin).json()
    assert any(u["id"] == uid and u["email"] == "mayus@test.com" for u in me)   # se guarda en minúsculas
    assert _register(client, "MAYUS@test.com").status_code == 400                # no se duplica
    assert _login(client, "MAYUS@TEST.COM").status_code == 200                    # entra con cualquier forma
    assert client.post("/users/", json={"name": "X", "email": "mAyUs@test.com", "password": "password1"},
                       headers=admin).status_code == 400


def test_solo_admin_email_se_crea_como_entrenadora(client):
    r = _register(client, "cualquiera@test.com")
    assert r.json()["role"] == "client" and r.json()["status"] == "pending"
    _admin(client)
    assert client.get("/auth/me", headers=_headers(client, "admin@test.com")).json()["role"] == "admin"


def test_sesiones_de_clientes_por_rango_de_fechas(client):
    admin = _admin(client)
    uid, _ = _cliente(client, admin, "rango@test.com")
    a, _, _ = _entreno(client, admin, uid, nombre="Rango")   # fecha 2026-11-18
    ids = lambda q: {x["id"] for x in client.get(f"/assignments/clients{q}", headers=admin).json()}
    assert a in ids("")
    assert a in ids("?start=2026-11-01&end=2026-11-30")
    assert a not in ids("?start=2026-12-01&end=2026-12-31")
