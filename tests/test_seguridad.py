import itertools

import jwt

import auth.auth as auth_mod

_n = itertools.count(1)
REG = dict(phone="600111222", country="España", city="Madrid", birth_date="1990-05-17", accept_terms=True)


def _register(c, email, password="password1", name="Test"):
    return c.post("/auth/register", json={"name": name, "email": email, "password": password, **REG})


def _login(c, email, password="password1"):
    return c.post("/auth/login", data={"username": email, "password": password})


def _headers(c, email, password="password1"):
    return {"Authorization": "Bearer " + _login(c, email, password).json()["access_token"]}


def _admin(c):
    """El primer usuario registrado es admin; en las pruebas siguientes ya existe."""
    _register(c, "admin@test.com")
    return _headers(c, "admin@test.com")


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}


def test_flujo_cliente_y_permisos(client):
    admin = _admin(client)
    r = _register(client, "cli@test.com")
    assert r.status_code == 201 and r.json()["status"] == "pending"
    assert _login(client, "cli@test.com").status_code == 403  # pendiente de aprobación
    uid = r.json()["id"]
    assert client.patch(f"/users/{uid}/status", json={"status": "active"}, headers=admin).status_code == 200
    cli = _headers(client, "cli@test.com")
    assert client.get("/auth/me", headers=cli).status_code == 200
    # un cliente no puede usar rutas de administración
    assert client.get("/users/", headers=cli).status_code == 403
    assert client.patch(f"/users/{uid}/status", json={"status": "suspended"}, headers=cli).status_code in (401, 403)
    # sin token
    assert client.get("/auth/me").status_code == 401


def test_token_manipulado_o_caducado(client):
    _admin(client)
    assert client.get("/auth/me", headers={"Authorization": "Bearer abc.def.ghi"}).status_code == 401
    forged = jwt.encode({"sub": "1", "exp": 9999999999}, "otra-clave-" * 5, algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401
    expired = jwt.encode({"sub": "1", "exp": 1}, auth_mod.SECRET_KEY, algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_login_se_bloquea_tras_5_fallos(client):
    _admin(client)
    for _ in range(5):
        assert _login(client, "admin@test.com", "mala-clave").status_code == 401
    # aunque la clave sea correcta, queda bloqueado un rato
    r = _login(client, "admin@test.com")
    assert r.status_code == 429 and "Retry-After" in r.headers
    # otro email no se ve afectado
    assert _login(client, "otro@test.com", "x").status_code == 401


def test_login_correcto_reinicia_el_contador(client):
    _admin(client)
    for _ in range(3):
        _login(client, "admin@test.com", "mala-clave")
    assert _login(client, "admin@test.com").status_code == 200
    for _ in range(4):
        assert _login(client, "admin@test.com", "mala-clave").status_code == 401


def test_codigos_de_email_limitan_intentos(client):
    codes = [
        client.post("/auth/verify-email", json={"email": "x@test.com", "code": "000000"}).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [400] * 10 and codes[10] == 429


def test_cors_solo_origenes_permitidos(client):
    ok = client.get("/health", headers={"Origin": "https://red-de-vida-web.onrender.com"})
    assert ok.headers.get("access-control-allow-origin") == "https://red-de-vida-web.onrender.com"
    bad = client.get("/health", headers={"Origin": "https://malo.example"})
    assert "access-control-allow-origin" not in bad.headers
