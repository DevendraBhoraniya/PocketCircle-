from decimal import Decimal, ROUND_DOWN
from typing import Sequence
import uuid


class SplitValidationError(ValueError):
    """Raised when split inputs are mathematically or logically invalid."""
    pass


def quantize_currency(amount: Decimal | str | float | int) -> Decimal:
    """Quantize any numeric amount to 2 decimal places (cents/paisa)."""
    if isinstance(amount, Decimal):
        dec = amount
    else:
        dec = Decimal(str(amount))
    return dec.quantize(Decimal("0.01"))


def calculate_equal_split(
    total_amount: Decimal | str,
    participant_ids: Sequence[uuid.UUID | str],
) -> dict[uuid.UUID, Decimal]:
    """
    Calculate equal shares for N participants with deterministic remainder allocation.
    
    1. Base share = floor(total / N) to 2 decimal places.
    2. Remainder = total - (base_share * N).
    3. Remainder cents (0 <= r < N) are distributed 1 paisa (0.01) each to the first
       r participants sorted deterministically by UUID string ascending.
    4. Exact conservation: sum(shares) == total down to the paisa.
    """
    if not participant_ids:
        raise SplitValidationError("At least one participant is required for an equal split.")

    quantized_total = quantize_currency(total_amount)
    if quantized_total <= Decimal("0.00"):
        raise SplitValidationError("Total amount must be greater than zero.")

    # Convert all to uuid.UUID if they are strings, remove duplicates while preserving sortability
    resolved_ids = [
        uid if isinstance(uid, uuid.UUID) else uuid.UUID(str(uid))
        for uid in set(participant_ids)
    ]
    if not resolved_ids:
        raise SplitValidationError("At least one valid participant is required.")

    # Sort deterministically by UUID string representation
    sorted_ids = sorted(resolved_ids, key=lambda x: str(x))
    n = len(sorted_ids)

    base_share = (quantized_total / Decimal(n)).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    allocated_sum = base_share * Decimal(n)
    remainder = quantized_total - allocated_sum
    remainder_cents = int((remainder * Decimal(100)).to_integral_value())

    splits: dict[uuid.UUID, Decimal] = {}
    for i, pid in enumerate(sorted_ids):
        extra = Decimal("0.01") if i < remainder_cents else Decimal("0.00")
        splits[pid] = base_share + extra

    # Absolute verification of mathematical conservation
    actual_sum = sum(splits.values())
    if actual_sum != quantized_total:
        raise SplitValidationError(
            f"Split allocation invariant violated: sum {actual_sum} != total {quantized_total}"
        )

    return splits


def validate_and_allocate_exact_split(
    total_amount: Decimal | str,
    shares: dict[uuid.UUID | str, Decimal | str],
) -> dict[uuid.UUID, Decimal]:
    """
    Validate and return exact shares for participants.
    
    1. Each share must be >= 0.00.
    2. Sum of all shares must exactly equal total_amount.
    """
    quantized_total = quantize_currency(total_amount)
    if quantized_total <= Decimal("0.00"):
        raise SplitValidationError("Total amount must be greater than zero.")

    if not shares:
        raise SplitValidationError("At least one participant share is required.")

    resolved_splits: dict[uuid.UUID, Decimal] = {}
    total_shares = Decimal("0.00")

    for uid, amt in shares.items():
        user_uuid = uid if isinstance(uid, uuid.UUID) else uuid.UUID(str(uid))
        quantized_share = quantize_currency(amt)
        if quantized_share < Decimal("0.00"):
            raise SplitValidationError(f"Share for user {user_uuid} cannot be negative.")
        resolved_splits[user_uuid] = resolved_splits.get(user_uuid, Decimal("0.00")) + quantized_share
        total_shares += quantized_share

    if total_shares != quantized_total:
        raise SplitValidationError(
            f"Sum of participant shares ({total_shares}) does not match expense total ({quantized_total})."
        )

    return resolved_splits


def validate_payers(
    total_amount: Decimal | str,
    payers: dict[uuid.UUID | str, Decimal | str],
) -> dict[uuid.UUID, Decimal]:
    """
    Validate multi-payer amounts.
    
    1. Each payer amount must be > 0.00.
    2. Sum of all payer amounts must exactly equal total_amount.
    """
    quantized_total = quantize_currency(total_amount)
    if quantized_total <= Decimal("0.00"):
        raise SplitValidationError("Total amount must be greater than zero.")

    if not payers:
        raise SplitValidationError("At least one payer is required.")

    resolved_payers: dict[uuid.UUID, Decimal] = {}
    total_paid = Decimal("0.00")

    for uid, amt in payers.items():
        user_uuid = uid if isinstance(uid, uuid.UUID) else uuid.UUID(str(uid))
        quantized_paid = quantize_currency(amt)
        if quantized_paid <= Decimal("0.00"):
            raise SplitValidationError(f"Payer amount for {user_uuid} must be strictly positive.")
        resolved_payers[user_uuid] = resolved_payers.get(user_uuid, Decimal("0.00")) + quantized_paid
        total_paid += quantized_paid

    if total_paid != quantized_total:
        raise SplitValidationError(
            f"Sum of payers ({total_paid}) must equal expense total ({quantized_total})."
        )

    return resolved_payers
