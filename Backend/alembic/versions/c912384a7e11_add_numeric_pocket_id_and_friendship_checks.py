"""add numeric pocket id and friendship checks

Revision ID: c912384a7e11
Revises: f88220a7ddc6
Create Date: 2026-10-16 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c912384a7e11'
down_revision: Union[str, None] = 'f88220a7ddc6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update any legacy non-numeric pocket_ids so that the check constraint can succeed
    op.execute(
        sa.text(
            """
            UPDATE users 
            SET pocket_id = LPAD((abs(hashtext(id::text)) % 10000000000)::text, 10, '0')
            WHERE pocket_id !~ '^[0-9]{10}$'
            """
        )
    )

    # 2. Add check constraint on users for 10-digit numeric pocket ID
    op.create_check_constraint(
        constraint_name='valid_numeric_pocket_id',
        table_name='users',
        condition="pocket_id ~ '^[0-9]{10}$'",
    )

    # 3. Add check constraint on friendships to prevent self-friendship
    op.create_check_constraint(
        constraint_name='friendship_not_self',
        table_name='friendships',
        condition='user_id <> friend_id',
    )


def downgrade() -> None:
    op.drop_constraint('friendship_not_self', 'friendships', type_='check')
    op.drop_constraint('valid_numeric_pocket_id', 'users', type_='check')
