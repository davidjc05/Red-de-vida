import os
import sys
import tempfile

# Entorno de pruebas: base de datos SQLite temporal y sin envío real de correos.
# Debe fijarse ANTES de importar la app.
_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ["SECRET_KEY"] = "t" * 48
os.environ.pop("BREVO_API_KEY", None)
os.environ.pop("MAIL_FROM", None)
os.environ.pop("CORS_ORIGINS", None)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient

import ratelimit
from main import app


@pytest.fixture()
def client():
    ratelimit.clear_all()
    return TestClient(app)
