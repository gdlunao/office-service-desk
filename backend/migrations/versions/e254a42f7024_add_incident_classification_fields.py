"""add incident classification fields

Revision ID: e254a42f7024
Revises: 99920d4c6b6d
Create Date: 2026-10-19 19:22:07.172986

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e254a42f7024"
down_revision: Union[str, Sequence[str], None] = "99920d4c6b6d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Añade clasificación opcional a las incidencias."""
    op.add_column(
        "incidents",
        sa.Column("category", sa.String(length=2), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("impact", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("urgency", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("priority", sa.String(length=2), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("classified_by_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "incidents",
        sa.Column("classified_at", sa.DateTime(), nullable=True),
    )

    op.create_check_constraint(
        "incident_category",
        "incidents",
        "category IN ('C1', 'C2', 'C3', 'C4', "
        "'C5', 'C6', 'C7', 'C8')",
    )
    op.create_check_constraint(
        "incident_impact",
        "incidents",
        "impact IN ('high', 'medium', 'low')",
    )
    op.create_check_constraint(
        "incident_urgency",
        "incidents",
        "urgency IN ('high', 'medium', 'low')",
    )
    op.create_check_constraint(
        "incident_priority",
        "incidents",
        "priority IN ('p1', 'p2', 'p3', 'p4')",
    )

    op.create_check_constraint(
        "ck_incidents_complete_classification",
        "incidents",
        "("
        "category IS NULL AND "
        "impact IS NULL AND "
        "urgency IS NULL AND "
        "priority IS NULL AND "
        "classified_by_id IS NULL AND "
        "classified_at IS NULL"
        ") OR ("
        "category IS NOT NULL AND "
        "impact IS NOT NULL AND "
        "urgency IS NOT NULL AND "
        "priority IS NOT NULL AND "
        "classified_by_id IS NOT NULL AND "
        "classified_at IS NOT NULL"
        ")",
    )

    op.create_index(
        "ix_incidents_category",
        "incidents",
        ["category"],
        unique=False,
    )
    op.create_index(
        "ix_incidents_priority",
        "incidents",
        ["priority"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_incidents_classified_by_id_users",
        "incidents",
        "users",
        ["classified_by_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    """Retira los campos y restricciones de clasificación."""
    op.drop_constraint(
        "ck_incidents_complete_classification",
        "incidents",
        type_="check",
    )
    op.drop_constraint(
        "incident_priority",
        "incidents",
        type_="check",
    )
    op.drop_constraint(
        "incident_urgency",
        "incidents",
        type_="check",
    )
    op.drop_constraint(
        "incident_impact",
        "incidents",
        type_="check",
    )
    op.drop_constraint(
        "incident_category",
        "incidents",
        type_="check",
    )

    op.drop_constraint(
        "fk_incidents_classified_by_id_users",
        "incidents",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_incidents_priority",
        table_name="incidents",
    )
    op.drop_index(
        "ix_incidents_category",
        table_name="incidents",
    )

    op.drop_column("incidents", "classified_at")
    op.drop_column("incidents", "classified_by_id")
    op.drop_column("incidents", "priority")
    op.drop_column("incidents", "urgency")
    op.drop_column("incidents", "impact")
    op.drop_column("incidents", "category")