import os
import sys
import tempfile

# Entorno de pruebas: base de datos SQLite temporal y sin envío real de correos.
# Debe fijarse ANTES de importar la app.
_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["SECRET_KEY"] = "t" * 48
os.environ["ADMIN_EMAIL"] = "admin@test.com"  # la cuenta de entrenadora en los tests
os.environ.pop("BREVO_API_KEY", None)
os.environ.pop("MAIL_FROM", None)
os.environ.pop("CORS_ORIGINS", None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

import ratelimit
from main import app
from database import engine
from sqlalchemy import event


# SQLite no comprueba las claves foráneas si no se le pide; Postgres (producción) sí.
# Se activan para que los tests fallen igual que fallaría el servidor de verdad.
@event.listens_for(engine, "connect")
def _foreign_keys_on(dbapi_conn, _record):
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


@pytest.fixture()
def client():
    ratelimit.clear_all()
    return TestClient(app)
