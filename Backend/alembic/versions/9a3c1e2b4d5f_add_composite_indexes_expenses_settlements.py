"""add composite indexes for expenses and settlements

Revision ID: 9a3c1e2b4d5f
Revises: 8f12a3b4c5d6
Create Date: 2026-10-27 18:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a3c1e2b4d5f'
down_revision: Union[str, None] = '8f12a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Composite index for filtering active expenses by circle
    op.create_index(
        'ix_expenses_group_deleted',
        'expenses',
        ['group_id', 'deleted_at'],
        unique=False,
    )

    # Composite index for querying settlements by group and lifecycle status
    op.create_index(
        'ix_settlements_group_status',
        'settlements',
        ['group_id', 'status'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_settlements_group_status', table_name='settlements')
    op.drop_index('ix_expenses_group_deleted', table_name='expenses')
