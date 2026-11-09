from sqlalchemy import create_engine, inspect, text
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


# Columnas añadidas a "users" después de crear la tabla. create_all() no modifica
# tablas existentes, así que las añadimos aquí si faltan (válido para Postgres y SQLite).
_USER_EXTRA_COLUMNS = {
    "phone": "VARCHAR",
    "country": "VARCHAR",
    "city": "VARCHAR",
    "birth_date": "DATE",
    "status": "VARCHAR NOT NULL DEFAULT 'active'",
    "email_verified": "BOOLEAN NOT NULL DEFAULT TRUE",
}


def rename_muscle_groups(engine):
    """Renombra grupos antiguos en los ejercicios ya guardados (Core -> Abdomen). Idempotente."""
    insp = inspect(engine)
    if not insp.has_table("exercises"):
        return
    with engine.begin() as conn:
        conn.execute(text("UPDATE exercises SET muscle_group = 'Abdomen' WHERE muscle_group = 'Core'"))


def ensure_user_columns(engine):
    insp = inspect(engine)
    if not insp.has_table("users"):
        return
    existing = {c["name"] for c in insp.get_columns("users")}
    with engine.begin() as conn:
        for name, ddl in _USER_EXTRA_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl}"))
