"""add classified incident event

Revision ID: cfdca444e984
Revises: e254a42f7024
Create Date: 2026-10-21 02:24:44.750225
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cfdca444e984"
down_revision: Union[str, Sequence[str], None] = "e254a42f7024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Permite registrar eventos de clasificación."""
    op.drop_constraint(
        "incident_event_type",
        "incident_events",
        type_="check",
    )

    op.create_check_constraint(
        "incident_event_type",
        "incident_events",
        "event_type IN ("
        "'reported', "
        "'assigned', "
        "'started', "
        "'resolved', "
        "'closed', "
        "'returned', "
        "'classified'"
        ")",
    )


def downgrade() -> None:
    """Restaura los tipos anteriores si no hay clasificaciones."""
    connection = op.get_bind()

    classified_events = connection.execute(
        sa.text(
            "SELECT COUNT(*) "
            "FROM incident_events "
            "WHERE event_type = :event_type"
        ),
        {"event_type": "classified"},
    ).scalar_one()

    if classified_events > 0:
        raise RuntimeError(
            "No se puede revertir esta migración porque existen "
            "eventos de clasificación. Se conserva el historial."
        )

    op.drop_constraint(
        "incident_event_type",
        "incident_events",
        type_="check",
    )

    op.create_check_constraint(
        "incident_event_type",
        "incident_events",
        "event_type IN ("
        "'reported', "
        "'assigned', "
        "'started', "
        "'resolved', "
        "'closed', "
        "'returned'"
        ")",
    )