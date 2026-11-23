"""concurrency_and_indexes

Revision ID: c552830ccf56
Revises: 415c500fb37c
Create Date: 2026-11-17 01:01:48.503290

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c552830ccf56'
down_revision: Union[str, Sequence[str], None] = '415c500fb37c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. refresh_tokens — dedupe, then unique index
    op.execute("""
        DELETE FROM refresh_tokens a USING refresh_tokens b
        WHERE a.id < b.id AND a.token_hash = b.token_hash
    """)
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    # 2. friendships — dedupe reciprocal pairs, then functional unique index
    op.execute("""
        DELETE FROM friendships a USING friendships b
        WHERE a.id > b.id
          AND LEAST(a.user_id, a.friend_id)    = LEAST(b.user_id, b.friend_id)
          AND GREATEST(a.user_id, a.friend_id) = GREATEST(b.user_id, b.friend_id)
    """)
    op.execute("""
        CREATE UNIQUE INDEX unique_friendship_pair
        ON friendships (LEAST(user_id, friend_id), GREATEST(user_id, friend_id))
    """)

    # 3. notifications composite index
    op.create_index(
        "ix_notifications_recipient_read_created",
        "notifications", ["recipient_id", "is_read", "created_at"],
        postgresql_ops={"created_at": "DESC"},
    )


def downgrade() -> None:
    op.drop_index(
        "ix_notifications_recipient_read_created",
        table_name="notifications",
    )
    op.execute("DROP INDEX IF EXISTS unique_friendship_pair")
    op.drop_index(
        "ix_refresh_tokens_user_id",
        table_name="refresh_tokens",
    )
    op.drop_index(
        "ix_refresh_tokens_token_hash",
        table_name="refresh_tokens",
    )
