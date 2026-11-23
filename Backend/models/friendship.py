import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # User who sends the friend request
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    # User who receives the friend request
    friend_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending",
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

    # Relationship to the sender
    user = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="friendships_sent",
    )

    # Relationship to the receiver
    friend = relationship(
        "User",
        foreign_keys=[friend_id],
        back_populates="friendships_received",
    )

    # Prevent duplicate A -> B friendship records
    __table_args__ = (
        CheckConstraint("user_id <> friend_id", name="friendship_not_self"),
        UniqueConstraint(
            "user_id",
            "friend_id",
            name="unique_friendship",
        ),
        Index(
            "unique_friendship_pair",
            func.least(user_id, friend_id),
            func.greatest(user_id, friend_id),
            unique=True,
        ),
    )
