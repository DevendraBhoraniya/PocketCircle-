import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class Group(Base):
    __tablename__ = "groups"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    name = Column(
        String(100),
        nullable=False,
    )

    description = Column(
        String(255),
        nullable=True,
    )

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    visibility = Column(
        String(20),
        default="private",
        server_default="private",
        nullable=False,
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

    # Relationships
    owner = relationship(
        "User",
        foreign_keys=[owner_id],
        back_populates="owned_groups",
    )

    members = relationship(
        "GroupMember",
        back_populates="group",
        cascade="all, delete-orphan",
    )

    expenses = relationship(
        "Expense",
        back_populates="group",
        cascade="all, delete-orphan",
    )

    audit_events = relationship(
        "AuditEvent",
        back_populates="group",
        cascade="all, delete-orphan",
    )

    settlements = relationship(
        "Settlement",
        back_populates="group",
        cascade="all, delete-orphan",
    )

    notifications = relationship(
        "Notification",
        back_populates="group",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("visibility IN ('private', 'unlisted', 'public')", name="valid_group_visibility"),
    )



class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    role = Column(
        String(20),
        nullable=False,
        default="member",
    )

    joined_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    group = relationship(
        "Group",
        back_populates="members",
    )

    user = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="group_memberships",
    )

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="unique_group_member"),
        CheckConstraint("role IN ('owner', 'admin', 'member')", name="valid_group_role"),
    )
