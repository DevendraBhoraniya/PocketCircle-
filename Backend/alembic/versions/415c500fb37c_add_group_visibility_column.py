"""add_group_visibility_column

Revision ID: 415c500fb37c
Revises: 9a3c1e2b4d5f
Create Date: 2026-10-27 23:32:26.948235

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '415c500fb37c'
down_revision: Union[str, Sequence[str], None] = '9a3c1e2b4d5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "groups",
        sa.Column("visibility", sa.String(length=20), server_default="private", nullable=False),
    )
    op.create_check_constraint(
        "valid_group_visibility",
        "groups",
        "visibility IN ('private', 'unlisted', 'public')",
    )


def downgrade() -> None:
    op.drop_constraint("valid_group_visibility", "groups", type_="check")
    op.drop_column("groups", "visibility")
