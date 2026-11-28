"""Sesiones que caducan al cambiar la contraseña y email único sin mayúsculas.

* users.token_version: sube en 1 al cambiar o restablecer la contraseña; los tokens antiguos dejan de valer.
* Índice único sobre lower(email): impide crear "Ana@x.com" si ya existe "ana@x.com".
  Si en la base ya hay emails repetidos con distintas mayúsculas, el índice NO se crea (fallaría el
  arranque del servidor). Se avisa en los logs para que se arreglen a mano; la app ya los trata como
  el mismo email al iniciar sesión y al registrarse.

Revision ID: 0002
Revises: 0001
"""
import logging

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic")


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "token_version" not in {c["name"] for c in insp.get_columns("users")}:
        op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))

    if "uq_users_email_lower" not in {i["name"] for i in insp.get_indexes("users")}:
        repetidos = bind.execute(sa.text(
            "SELECT lower(email) FROM users GROUP BY lower(email) HAVING COUNT(*) > 1"
        )).fetchall()
        if repetidos:
            log.warning(
                "No se crea el índice de email único: hay %d emails repetidos con distintas mayúsculas. "
                "Revisa la tabla users y deja una sola cuenta por email.", len(repetidos),
            )
        else:
            op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)


def downgrade() -> None:
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_column("users", "token_version")
