from decimal import Decimal
import random
import uuid
import pytest

from services.balance_engine import SettlementTransfer, simplify_debts
from services.split_engine import (
    calculate_equal_split,
    quantize_currency,
    validate_and_allocate_exact_split,
    validate_payers,
)


def test_invariant_equal_split_randomized_conservation():
    """
    Financial Invariant 1: Conservation of Money in Equal Splits.
    For any total amount and any group size (1 to 50):
      1. sum(shares) == total down to the exact paisa (0.01)
      2. Spread between max share and min share is at most 1 paisa (0.01)
    """
    rng = random.Random(42)  # Seeded for reproducible property testing

    for _ in range(100):
        # Generate random amount from 0.01 to 500,000.00
        cents = rng.randint(1, 50_000_000)
        total_amount = Decimal(cents) / Decimal(100)

        # Generate random member count from 1 to 50
        num_members = rng.randint(1, 50)
        members = [uuid.uuid4() for _ in range(num_members)]

        splits = calculate_equal_split(total_amount, members)

        # Invariant 1: Exact sum conservation
        allocated_sum = sum(splits.values())
        assert allocated_sum == total_amount, f"Sum {allocated_sum} != total {total_amount}"

        # Invariant 2: Maximum fairness spread is <= 0.01
        share_values = list(splits.values())
        assert max(share_values) - min(share_values) <= Decimal("0.01")


def test_invariant_equal_split_shuffled_determinism():
    """
    Financial Invariant 2: Deterministic Ordering Independence.
    Shuffling the input list of participants must NOT change the resulting allocation.
    """
    rng = random.Random(1337)
    members = [uuid.uuid4() for _ in range(11)]
    total_amount = Decimal("100.00")

    baseline = calculate_equal_split(total_amount, members)

    for _ in range(25):
        shuffled = list(members)
        rng.shuffle(shuffled)
        result = calculate_equal_split(total_amount, shuffled)
        assert result == baseline, "Shuffled input produced non-deterministic allocation"


def test_invariant_multi_payer_exact_sum_conservation():
    """
    Financial Invariant 3: Multi-Payer Contribution Conservation.
    validate_payers must strictly ensure sum(payers) == total_amount.
    """
    rng = random.Random(2024)
    for _ in range(50):
        num_payers = rng.randint(2, 8)
        payers = [uuid.uuid4() for _ in range(num_payers)]

        # Random individual payer contributions
        cents_parts = [rng.randint(10, 50_000) for _ in range(num_payers)]
        total_cents = sum(cents_parts)
        total_amount = Decimal(total_cents) / Decimal(100)

        raw_payers = {
            pid: Decimal(c) / Decimal(100) for pid, c in zip(payers, cents_parts)
        }

        validated = validate_payers(total_amount, raw_payers)
        assert sum(validated.values()) == total_amount


def test_invariant_debt_simplification_bounds_and_conservation():
    """
    Financial Invariant 4: Greedy Debt Simplification Guarantees.
    1. sum(transfers) == sum(creditor net balances) == sum(debtor net balances)
    2. Number of transfers is strictly bounded by max(0, N - 1)
    3. No self-transfers (from_user != to_user)
    4. Every transfer amount is strictly positive (> 0.00)
    """
    rng = random.Random(999)

    for _ in range(100):
        num_users = rng.randint(2, 30)
        users = [uuid.uuid4() for _ in range(num_users)]

        # Generate a balanced zero-sum ledger
        # Assign random raw balances, then balance with the last user
        raw_cents = [rng.randint(-50_000, 50_000) for _ in range(num_users - 1)]
        last_cents = -sum(raw_cents)

        all_cents = raw_cents + [last_cents]
        net_balances = {
            u: Decimal(c) / Decimal(100) for u, c in zip(users, all_cents)
        }

        # Verify generated test ledger is zero-sum
        assert sum(net_balances.values()) == Decimal("0.00")

        transfers = simplify_debts(net_balances)

        non_zero_members = [u for u, b in net_balances.items() if b != Decimal("0.00")]

        # Invariant: At most N - 1 transfers
        max_transfers = max(0, len(non_zero_members) - 1)
        assert len(transfers) <= max_transfers, (
            f"Transfers {len(transfers)} exceeded bound {max_transfers}"
        )

        # Invariant: No self-transfers and strictly positive amounts
        for t in transfers:
            assert t.from_user_id != t.to_user_id
            assert t.amount > Decimal("0.00")

        # Invariant: Total money transferred equals total positive balances
        total_credit = sum(b for b in net_balances.values() if b > Decimal("0.00"))
        total_transferred = sum(t.amount for t in transfers)
        assert total_transferred == total_credit, (
            f"Transferred {total_transferred} != total credit {total_credit}"
        )


def test_invariant_settlement_reconciliation_reduces_net_debt_to_zero():
    """
    Financial Invariant 5: Applying Simplified Transfers Completely Settles Ledger.
    Applying each transfer in sequence resolves all member debts exactly to 0.00.
    """
    users = [uuid.uuid4() for _ in range(5)]
    net_balances = {
        users[0]: Decimal("-100.00"),
        users[1]: Decimal("-50.00"),
        users[2]: Decimal("30.00"),
        users[3]: Decimal("40.00"),
        users[4]: Decimal("80.00"),
    }
    assert sum(net_balances.values()) == Decimal("0.00")

    transfers = simplify_debts(net_balances)

    # Simulate applying transfers
    running_balances = dict(net_balances)
    for t in transfers:
        running_balances[t.from_user_id] += t.amount
        running_balances[t.to_user_id] -= t.amount

    for u, b in running_balances.items():
        assert b == Decimal("0.00"), f"User {u} retained non-zero balance {b}"


def test_invariant_debt_simplification_tie_breaker_determinism():
    """
    Financial Invariant 6: Tie-Breaking Determinism.
    When multiple users have identical net balances, transfers are selected deterministically.
    """
    rng = random.Random(777)
    u1, u2 = uuid.UUID("00000000-0000-0000-0000-000000000001"), uuid.UUID("00000000-0000-0000-0000-000000000002")
    c1, c2 = uuid.UUID("00000000-0000-0000-0000-000000000003"), uuid.UUID("00000000-0000-0000-0000-000000000004")

    # Identical debtor amounts (-50) and identical creditor amounts (+50)
    net_balances = {u1: Decimal("-50.00"), u2: Decimal("-50.00"), c1: Decimal("50.00"), c2: Decimal("50.00")}

    baseline_transfers = simplify_debts(net_balances)

    for _ in range(20):
        shuffled_keys = list(net_balances.keys())
        rng.shuffle(shuffled_keys)
        shuffled_dict = {k: net_balances[k] for k in shuffled_keys}

        result = simplify_debts(shuffled_dict)
        assert result == baseline_transfers, "Tie-breaking produced non-deterministic transfer list"
