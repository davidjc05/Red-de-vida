"""Migración base: el estado de la base de datos al estrenar Alembic.

Sirve para dos casos y en los dos deja el mismo resultado:
  * Base de datos VACÍA (instalación nueva, tests): crea todas las tablas.
  * Base de datos que YA EXISTE (la de Supabase hoy): no toca las tablas que ya están. Solo añade
    las columnas que le falten (las que antes se añadían con _USER_EXTRA_COLUMNS) y deja
    registrado en la tabla "alembic_version" que está en este punto.

Es segura de repetir: si ya se ejecutó, no hace nada.

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Columnas que se añadieron a tablas ya creadas con el sistema antiguo (database.py).
# Copia congelada: las migraciones nuevas no deben depender de código que cambie.
_COLUMNAS_NUEVAS = {
    "users": {
        "phone": "VARCHAR",
        "country": "VARCHAR",
        "city": "VARCHAR",
        "birth_date": "DATE",
        "status": "VARCHAR NOT NULL DEFAULT 'active'",
        "email_verified": "BOOLEAN NOT NULL DEFAULT TRUE",
        "consent_at": "TIMESTAMP",
        "consent_version": "VARCHAR",
        "email_reminders": "BOOLEAN NOT NULL DEFAULT TRUE",
    },
    "workout_logs": {
        "set_number": "INTEGER NOT NULL DEFAULT 1",
    },
}


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    existentes = set(insp.get_table_names())   # tablas que ya había antes de esta migración

    # 1) Tablas que faltan (en una base vacía, todas)
    if "email_codes" not in existentes:
        op.create_table('email_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('purpose', sa.String(), nullable=False),
        sa.Column('code_hash', sa.String(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_email_codes_email'), 'email_codes', ['email'], unique=False)
        op.create_index(op.f('ix_email_codes_id'), 'email_codes', ['id'], unique=False)

    if "exercises" not in existentes:
        op.create_table('exercises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('muscle_group', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('image_url', sa.String(), nullable=True),
        sa.Column('video_url', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_exercises_id'), 'exercises', ['id'], unique=False)

    if "forms" not in existentes:
        op.create_table('forms',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('url', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_forms_id'), 'forms', ['id'], unique=False)

    if "users" not in existentes:
        op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('weight_kg', sa.Float(), nullable=True),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('city', sa.String(), nullable=True),
        sa.Column('birth_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(), server_default='active', nullable=False),
        sa.Column('email_verified', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('consent_at', sa.DateTime(), nullable=True),
        sa.Column('consent_version', sa.String(), nullable=True),
        sa.Column('email_reminders', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
        op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    if "activities" not in existentes:
        op.create_table('activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('elapsed_s', sa.Integer(), nullable=False),
        sa.Column('distance_m', sa.Float(), nullable=False),
        sa.Column('kcal', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_activities_id'), 'activities', ['id'], unique=False)
        op.create_index(op.f('ix_activities_user_id'), 'activities', ['user_id'], unique=False)

    if "form_sends" not in existentes:
        op.create_table('form_sends',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('form_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.Column('email_sent', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['form_id'], ['forms.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_form_sends_form_id'), 'form_sends', ['form_id'], unique=False)
        op.create_index(op.f('ix_form_sends_id'), 'form_sends', ['id'], unique=False)
        op.create_index(op.f('ix_form_sends_user_id'), 'form_sends', ['user_id'], unique=False)

    if "notification_logs" not in existentes:
        op.create_table('notification_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('kind', 'user_id', 'day', name='uq_notification_kind_user_day')
        )
        op.create_index(op.f('ix_notification_logs_id'), 'notification_logs', ['id'], unique=False)

    if "routines" not in existentes:
        op.create_table('routines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_routines_id'), 'routines', ['id'], unique=False)

    if "assignments" not in existentes:
        op.create_table('assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('routine_id', sa.Integer(), nullable=False),
        sa.Column('assigned_to_id', sa.Integer(), nullable=False),
        sa.Column('assigned_by_id', sa.Integer(), nullable=False),
        sa.Column('note', sa.String(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('declined_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['routine_id'], ['routines.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_assignments_id'), 'assignments', ['id'], unique=False)

    if "blocks" not in existentes:
        op.create_table('blocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('routine_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['routine_id'], ['routines.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_blocks_id'), 'blocks', ['id'], unique=False)

    if "routine_exercises" not in existentes:
        op.create_table('routine_exercises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('routine_id', sa.Integer(), nullable=True),
        sa.Column('exercise_id', sa.Integer(), nullable=True),
        sa.Column('sets', sa.Integer(), nullable=True),
        sa.Column('reps', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['routine_id'], ['routines.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_routine_exercises_id'), 'routine_exercises', ['id'], unique=False)

    if "block_exercises" not in existentes:
        op.create_table('block_exercises',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('block_id', sa.Integer(), nullable=True),
        sa.Column('exercise_id', sa.Integer(), nullable=True),
        sa.Column('sets', sa.Integer(), nullable=True),
        sa.Column('reps', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['block_id'], ['blocks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_block_exercises_id'), 'block_exercises', ['id'], unique=False)

    if "workout_logs" not in existentes:
        op.create_table('workout_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('assignment_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('exercise_id', sa.Integer(), nullable=True),
        sa.Column('kg', sa.Float(), nullable=True),
        sa.Column('reps', sa.Integer(), nullable=True),
        sa.Column('set_number', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['assignment_id'], ['assignments.id'], ),
        sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_workout_logs_id'), 'workout_logs', ['id'], unique=False)

    # 2) Bases antiguas: columnas que faltan en tablas que ya existían
    for tabla, columnas in _COLUMNAS_NUEVAS.items():
        if tabla not in existentes:
            continue   # se acaba de crear con todas sus columnas
        tiene = {c["name"] for c in insp.get_columns(tabla)}
        for nombre, ddl in columnas.items():
            if nombre not in tiene:
                op.execute(f"ALTER TABLE {tabla} ADD COLUMN {nombre} {ddl}")

    # 3) Dato antiguo: el grupo muscular "Core" ahora se llama "Abdomen"
    if "exercises" in existentes:
        op.execute("UPDATE exercises SET muscle_group = 'Abdomen' WHERE muscle_group = 'Core'")


def downgrade() -> None:
    raise RuntimeError("La migración base no se puede deshacer: borraría todos los datos.")
