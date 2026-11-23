import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class Settlement(Base):
    __tablename__ = "settlements"

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

    payer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    payee_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="pending",
    )

    notes = Column(
        String(255),
        nullable=True,
    )

    action_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    action_at = Column(
        DateTime(timezone=True),
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

    # Relationships
    group = relationship(
        "Group",
        back_populates="settlements",
    )

    payer = relationship(
        "User",
        foreign_keys=[payer_id],
        back_populates="settlements_paid",
    )

    payee = relationship(
        "User",
        foreign_keys=[payee_id],
        back_populates="settlements_received",
    )

    action_by = relationship(
        "User",
        foreign_keys=[action_by_id],
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="settlement_amount_positive"),
        CheckConstraint("payer_id != payee_id", name="settlement_payer_not_payee"),
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'rejected', 'cancelled')",
            name="valid_settlement_status",
        ),
        Index("ix_settlements_group_status", "group_id", "status"),
    )
