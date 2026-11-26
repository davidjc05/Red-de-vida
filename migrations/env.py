"""Entorno de Alembic.

Se usa de dos formas:
  * Al arrancar la app: main.py llama a database.run_migrations(), que pasa su propia conexión.
  * A mano, para crear migraciones:  alembic revision --autogenerate -m "lo que cambia"
"""
from alembic import context
from sqlalchemy import create_engine

import models  # noqa: F401  (registra todas las tablas en Base.metadata)
from database import DATABASE_URL, Base

config = context.config
target_metadata = Base.metadata


def _configure(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # SQLite es muy flexible con los tipos y los valores por defecto y daría falsas alarmas;
        # en Postgres (el real) la comparación es estricta.
        compare_type=connection.dialect.name != "sqlite",
        compare_server_default=connection.dialect.name != "sqlite",
    )


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:           # lo llama la app con su conexión
        _configure(connection)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_engine(DATABASE_URL)  # lo llamas tú desde la terminal
    with engine.connect() as conn:
        _configure(conn)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    raise SystemExit("El modo offline no está soportado: usa una base de datos real.")
run_migrations_online()
