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
    "consent_at": "TIMESTAMP",
    "consent_version": "VARCHAR",
    "email_reminders": "BOOLEAN NOT NULL DEFAULT TRUE",
}


def rename_muscle_groups(engine):
    """Renombra grupos antiguos en los ejercicios ya guardados (Core -> Abdomen). Idempotente."""
    insp = inspect(engine)
    if not insp.has_table("exercises"):
        return
    with engine.begin() as conn:
        conn.execute(text("UPDATE exercises SET muscle_group = 'Abdomen' WHERE muscle_group = 'Core'"))


# Columnas añadidas a "workout_logs" (registro de pesos). Cada fila es UNA serie de un ejercicio.
# Las filas antiguas (una por ejercicio) se quedan como serie 1.
_WORKOUT_LOG_EXTRA_COLUMNS = {
    "set_number": "INTEGER NOT NULL DEFAULT 1",
}

_EXTRA_COLUMNS = {
    "users": _USER_EXTRA_COLUMNS,
    "workout_logs": _WORKOUT_LOG_EXTRA_COLUMNS,
}


def ensure_extra_columns(engine):
    """Añade las columnas nuevas que falten en tablas ya creadas. Idempotente."""
    insp = inspect(engine)
    for table, columns in _EXTRA_COLUMNS.items():
        if not insp.has_table(table):
            continue
        existing = {c["name"] for c in insp.get_columns(table)}
        with engine.begin() as conn:
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


ensure_user_columns = ensure_extra_columns  # nombre antiguo, por compatibilidad
