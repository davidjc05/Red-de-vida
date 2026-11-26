"""Migraciones (Alembic): base vacía, base antigua con datos y base ya al día.

Se prueban siempre con SQLite. Si está instalado `pgserver` (pip install pgserver), también con un
Postgres de verdad, que es lo que usa Render/Supabase. En GitHub Actions no está, así que allí
solo corre la parte de SQLite.
"""
import os
import tempfile
import uuid
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text

from database import Base, run_migrations
import models  # noqa: F401  (registra las tablas)

TABLAS = set(Base.metadata.tables)
COLUMNAS_NUEVAS_USERS = ["phone", "country", "city", "birth_date", "status", "email_verified",
                         "consent_at", "consent_version", "email_reminders"]


# ── Motores de prueba ────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def _postgres():
    pgserver = pytest.importorskip("pgserver", exc_type=ImportError)
    srv = pgserver.get_server(tempfile.mkdtemp())
    yield srv
    srv.cleanup()


@pytest.fixture(params=["sqlite", "postgres"])
def motor(request):
    """Una base de datos nueva y vacía por cada test."""
    if request.param == "sqlite":
        eng = create_engine(f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'prueba.db')}")
    else:
        srv = request.getfixturevalue("_postgres")
        nombre = "t_" + uuid.uuid4().hex[:10]
        base = create_engine(srv.get_uri().replace("postgresql://", "postgresql+psycopg2://"), isolation_level="AUTOCOMMIT")
        with base.connect() as c:
            c.execute(text(f"CREATE DATABASE {nombre}"))
        base.dispose()
        eng = create_engine(srv.get_uri(database=nombre).replace("postgresql://", "postgresql+psycopg2://"))
    yield eng
    eng.dispose()


def _ultima_version():
    """La migración más reciente que hay en migrations/versions/ (crece al añadir migraciones)."""
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    raiz = Path(__file__).resolve().parent.parent
    cfg = Config(str(raiz / "alembic.ini"))
    cfg.set_main_option("script_location", str(raiz / "migrations"))
    return ScriptDirectory.from_config(cfg).get_current_head()


def _version(eng):
    with eng.connect() as c:
        return c.execute(text("SELECT version_num FROM alembic_version")).scalar()


def _sin_diferencias(eng):
    """Compara la base real con models.py. Lista vacía = coinciden."""
    with eng.connect() as c:
        ctx = MigrationContext.configure(c, opts={"compare_type": eng.dialect.name != "sqlite", "compare_server_default": eng.dialect.name != "sqlite"})
        return compare_metadata(ctx, Base.metadata)


def _base_sin_alembic(eng):
    """Una base como la de producción hoy: las tablas completas pero SIN la tabla alembic_version.

    Se construye con el esquema congelado de la migración 0001 (no con models.py), para que estos
    tests sigan valiendo cuando models.py cambie en el futuro."""
    run_migrations(eng, revision="0001")
    with eng.begin() as c:
        c.execute(text("DROP TABLE alembic_version"))


def _base_antigua(eng):
    """Reproduce una base de datos de antes de estrenar Alembic y de antes de varias funciones:
    sin las columnas nuevas de users y workout_logs, sin las tablas de actividad, formularios,
    avisos y códigos, y con datos reales dentro."""
    _base_sin_alembic(eng)
    with eng.begin() as c:
        for t in ("form_sends", "forms", "notification_logs", "activities", "email_codes"):
            c.execute(text(f"DROP TABLE {t}"))
        c.execute(text("DROP INDEX ix_users_email"))  # se recrea abajo: SQLite no deja borrar columnas con índice
        for col in COLUMNAS_NUEVAS_USERS:
            c.execute(text(f"ALTER TABLE users DROP COLUMN {col}"))
        c.execute(text("CREATE UNIQUE INDEX ix_users_email ON users (email)"))
        c.execute(text("ALTER TABLE workout_logs DROP COLUMN set_number"))
        # datos
        c.execute(text("INSERT INTO users (id, name, email, hashed_password, role) VALUES (1, 'Ana', 'ana@x.com', 'h', 'admin')"))
        c.execute(text("INSERT INTO users (id, name, email, hashed_password, role) VALUES (2, 'Luis', 'luis@x.com', 'h', 'user')"))
        c.execute(text("INSERT INTO exercises (id, name, muscle_group) VALUES (1, 'Plancha', 'Core'), (2, 'Sentadilla', 'Pierna')"))
        c.execute(text("INSERT INTO routines (id, name, user_id, date) VALUES (1, 'R', 1, '2026-11-01')"))
        c.execute(text("INSERT INTO assignments (id, routine_id, assigned_to_id, assigned_by_id, date, status)"
                       " VALUES (1, 1, 2, 1, '2026-11-01', 'confirmed')"))
        c.execute(text("INSERT INTO workout_logs (assignment_id, user_id, exercise_id, kg, reps) VALUES (1, 2, 2, 60, 8)"))


# ── Tests ────────────────────────────────────────────────────────────────────
def test_base_vacia_crea_todo_y_coincide_con_los_modelos(motor):
    run_migrations(motor)
    assert set(inspect(motor).get_table_names()) == TABLAS | {"alembic_version"}
    assert _version(motor) == _ultima_version()
    # Si este test falla, cambiaste models.py sin escribir su migración:
    #   alembic revision --autogenerate -m "lo que cambia"
    assert _sin_diferencias(motor) == []


def test_base_antigua_se_actualiza_sin_perder_datos(motor):
    _base_antigua(motor)
    run_migrations(motor)

    assert _version(motor) == _ultima_version()
    assert _sin_diferencias(motor) == []   # quedó igual que una base nueva

    with motor.connect() as c:
        # los usuarios siguen y reciben los valores por defecto de las columnas nuevas
        filas = c.execute(text("SELECT id, name, role, status, email_verified, email_reminders FROM users ORDER BY id")).fetchall()
        assert [tuple(f) for f in filas] == [(1, "Ana", "admin", "active", True, True), (2, "Luis", "user", "active", True, True)]
        # los pesos antiguos pasan a ser la serie 1
        assert [tuple(f) for f in c.execute(text("SELECT set_number, kg, reps FROM workout_logs"))] == [(1, 60.0, 8)]
        # "Core" ahora es "Abdomen"; lo demás no se toca
        assert [tuple(f) for f in c.execute(text("SELECT name, muscle_group FROM exercises ORDER BY id"))] == [
            ("Plancha", "Abdomen"), ("Sentadilla", "Pierna")]
        assert c.execute(text("SELECT COUNT(*) FROM assignments")).scalar() == 1


def test_base_al_dia_no_cambia_nada_y_repetir_es_seguro(motor):
    """Es el caso de Supabase hoy: tablas completas hechas con el sistema antiguo, sin alembic_version."""
    _base_sin_alembic(motor)
    with motor.begin() as c:
        c.execute(text("INSERT INTO users (id, name, email, hashed_password, role) VALUES (1, 'Ana', 'ana@x.com', 'h', 'admin')"))
        c.execute(text("INSERT INTO exercises (id, name, muscle_group) VALUES (1, 'Plancha', 'Abdomen')"))

    run_migrations(motor)
    run_migrations(motor)   # una segunda vez (otro arranque del servidor): no hace nada

    assert _version(motor) == _ultima_version()
    assert _sin_diferencias(motor) == []
    with motor.connect() as c:
        assert c.execute(text("SELECT COUNT(*) FROM users")).scalar() == 1
        assert c.execute(text("SELECT COUNT(*) FROM exercises")).scalar() == 1


def test_la_migracion_base_no_se_puede_deshacer(motor):
    """Evita borrar todos los datos por accidente con `alembic downgrade`."""
    from alembic import command
    from alembic.config import Config

    run_migrations(motor)
    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).resolve().parent.parent / "migrations"))
    with motor.begin() as c:
        cfg.attributes["connection"] = c
        with pytest.raises(RuntimeError, match="no se puede deshacer"):
            command.downgrade(cfg, "base")
    assert set(inspect(motor).get_table_names()) >= TABLAS   # las tablas siguen ahí
