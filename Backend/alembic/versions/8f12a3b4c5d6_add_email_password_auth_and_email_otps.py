"""add_email_password_auth_and_email_otps

Revision ID: 8f12a3b4c5d6
Revises: 7418a348ea85
Create Date: 2026-10-19 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8f12a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = '7418a348ea85'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Modify users table: make google_sub nullable, add password_hash and is_email_verified
    op.alter_column('users', 'google_sub',
               existing_type=sa.VARCHAR(length=255),
               nullable=True)
    op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('is_email_verified', sa.Boolean(), server_default=sa.text('false'), nullable=False))

    # Mark existing users (who have google_sub) as email verified
    op.execute("UPDATE users SET is_email_verified = TRUE WHERE google_sub IS NOT NULL")

    # 2. Create email_otps table
    op.create_table('email_otps',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('otp_hash', sa.String(length=64), nullable=False),
        sa.Column('purpose', sa.String(length=50), server_default='login', nullable=False),
        sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_used', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_otps_email'), 'email_otps', ['email'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_otps_email'), table_name='email_otps')
    op.drop_table('email_otps')
    op.drop_column('users', 'is_email_verified')
    op.drop_column('users', 'password_hash')
    op.alter_column('users', 'google_sub',
               existing_type=sa.VARCHAR(length=255),
               nullable=False)
