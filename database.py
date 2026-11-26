from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# Cargar variables del .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL no está definida en el .env")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

# Dependency para FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────
# MIGRACIONES (Alembic)
# ─────────────────────────────────────────
# Los cambios de la base de datos (tablas o columnas nuevas) ya NO se hacen aquí:
# se escriben como migraciones en la carpeta migrations/versions/ y se aplican solas al arrancar.
# Pasos para un cambio nuevo:
#   1. Cambia models.py (por ejemplo, añade una columna).
#   2. alembic revision --autogenerate -m "descripción corta"   (crea el archivo de migración)
#   3. Revisa ese archivo, haz commit y push. Al arrancar, el servidor lo aplica.

_BASE_DIR = Path(__file__).resolve().parent


def run_migrations(target_engine=None, revision="head"):
    """Lleva la base de datos a la última versión. Si ya está al día, no hace nada.

    Todo ocurre en una sola transacción: si una migración falla, no queda a medias.
    En Postgres se usa un cerrojo para que dos instancias arrancando a la vez no choquen."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(_BASE_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(_BASE_DIR / "migrations"))
    with (target_engine or engine).begin() as conn:
        if conn.dialect.name == "postgresql":
            conn.execute(text("SELECT pg_advisory_xact_lock(727274)"))
        cfg.attributes["connection"] = conn
        command.upgrade(cfg, revision)
