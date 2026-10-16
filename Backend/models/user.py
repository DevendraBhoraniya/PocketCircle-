import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, Column, DateTime, String
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

    __table_args__ = (
        CheckConstraint(
            "pocket_id ~ '^[0-9]{10}$'",
            name="valid_numeric_pocket_id",
        ),
    )

# Import Friendship here to ensure it's registered in SQLAlchemy's declarative registry
from models.friendship import Friendship
