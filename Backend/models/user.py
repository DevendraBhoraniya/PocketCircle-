import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    google_sub = Column(
        String(255),
        unique=True,
        nullable=True,
    )

    password_hash = Column(
        String(255),
        nullable=True,
    )

    is_email_verified = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
    )

    name = Column(
        String(255),
        nullable=False,
    )

    username = Column(
        String(20),
        unique=True,
    )

    pocket_id = Column(
        String(10),
        unique=True,
        nullable=False,
    )

    avatar_url = Column(
        String(500),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Friendships sent by this user
    friendships_sent = relationship(
        "Friendship",
        foreign_keys="[Friendship.user_id]",
        back_populates="user",
    )

    # Friend requests received by this user
    friendships_received = relationship(
        "Friendship",
        foreign_keys="[Friendship.friend_id]",
        back_populates="friend",
    )

    # Groups owned by this user
    owned_groups = relationship(
        "Group",
        foreign_keys="[Group.owner_id]",
        back_populates="owner",
    )

    # Group memberships
    group_memberships = relationship(
        "GroupMember",
        foreign_keys="[GroupMember.user_id]",
        back_populates="user",
    )

    # Expenses created by this user
    created_expenses = relationship(
        "Expense",
        foreign_keys="[Expense.creator_id]",
        back_populates="creator",
    )

    # Settlements where user is payer
    settlements_paid = relationship(
        "Settlement",
        foreign_keys="[Settlement.payer_id]",
        back_populates="payer",
    )

    # Settlements where user is payee
    settlements_received = relationship(
        "Settlement",
        foreign_keys="[Settlement.payee_id]",
        back_populates="payee",
    )

    # In-app notifications received by this user
    notifications_received = relationship(
        "Notification",
        foreign_keys="[Notification.recipient_id]",
        back_populates="recipient",
    )

    __table_args__ = (
        CheckConstraint(
            "pocket_id ~ '^[0-9]{10}$'",
            name="valid_numeric_pocket_id",
        ),
    )

# Import models here to ensure they are registered in SQLAlchemy's declarative registry
from models.friendship import Friendship
from models.group import Group, GroupMember
from models.expense import Expense, ExpensePayer, ExpenseParticipant
from models.settlement import Settlement
from models.audit_event import AuditEvent
from models.notification import Notification
from models.email_otp import EmailOTP


