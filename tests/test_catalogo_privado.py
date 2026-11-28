"""El catálogo de ejercicios solo se ve con la sesión iniciada."""
from tests.test_series import _cliente
from tests.test_seguridad import _admin


def test_catalogo_de_ejercicios_requiere_sesion(client):
    admin = _admin(client)
    eid = client.post("/exercises", json={"name": "Plancha", "muscle_group": "Abdomen"}, headers=admin).json()["id"]

    # Sin iniciar sesión: no se ve nada
    assert client.get("/exercises").status_code == 401
    assert client.get(f"/exercises/{eid}").status_code == 401

    # Con sesión (clienta y entrenadora): se ve igual que antes
    _, cli = _cliente(client, admin, "catalogo@test.com")
    for headers in (cli, admin):
        assert any(e["id"] == eid for e in client.get("/exercises", headers=headers).json())
        assert client.get(f"/exercises/{eid}", headers=headers).json()["name"] == "Plancha"
