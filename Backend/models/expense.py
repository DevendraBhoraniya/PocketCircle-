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
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.database import Base


class Expense(Base):
    __tablename__ = "expenses"

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

    description = Column(
        String(255),
        nullable=False,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    split_type = Column(
        String(20),
        nullable=False,
        default="equal",
    )

    creator_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
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
    group = relationship(
        "Group",
        back_populates="expenses",
    )

    creator = relationship(
        "User",
        foreign_keys=[creator_id],
        back_populates="created_expenses",
    )

    payers = relationship(
        "ExpensePayer",
        back_populates="expense",
        cascade="all, delete-orphan",
    )

    participants = relationship(
        "ExpenseParticipant",
        back_populates="expense",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="expense_amount_positive"),
        CheckConstraint("split_type IN ('equal', 'exact')", name="valid_split_type"),
        Index("ix_expenses_group_deleted", "group_id", "deleted_at"),
    )


class ExpensePayer(Base):
    __tablename__ = "expense_payers"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    expense_id = Column(
        UUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    expense = relationship(
        "Expense",
        back_populates="payers",
    )

    user = relationship(
        "User",
        foreign_keys=[user_id],
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="payer_amount_positive"),
        UniqueConstraint("expense_id", "user_id", name="unique_expense_payer"),
    )


class ExpenseParticipant(Base):
    __tablename__ = "expense_participants"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    expense_id = Column(
        UUID(as_uuid=True),
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False,
    )

    expense = relationship(
        "Expense",
        back_populates="participants",
    )

    user = relationship(
        "User",
        foreign_keys=[user_id],
    )

    __table_args__ = (
        CheckConstraint("amount >= 0", name="participant_amount_non_negative"),
        UniqueConstraint("expense_id", "user_id", name="unique_expense_participant"),
    )
