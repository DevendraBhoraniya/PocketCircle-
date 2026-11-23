from decimal import Decimal
import random
import uuid
import pytest

from services.split_engine import (
    SplitValidationError,
    calculate_equal_split,
    quantize_currency,
    validate_and_allocate_exact_split,
    validate_payers,
)


def test_quantize_currency():
    assert quantize_currency("10.5") == Decimal("10.50")
    assert quantize_currency("10.555") == Decimal("10.56")
    assert quantize_currency(10) == Decimal("10.00")
    assert quantize_currency(Decimal("99.99")) == Decimal("99.99")


def test_equal_split_three_members():
    u1 = uuid.UUID("00000000-0000-0000-0000-000000000001")
    u2 = uuid.UUID("00000000-0000-0000-0000-000000000002")
    u3 = uuid.UUID("00000000-0000-0000-0000-000000000003")

    splits = calculate_equal_split(Decimal("100.00"), [u1, u2, u3])

    # 100 / 3 = 33.33 with 0.01 remainder -> u1 gets 33.34, u2 and u3 get 33.33
    assert splits[u1] == Decimal("33.34")
    assert splits[u2] == Decimal("33.33")
    assert splits[u3] == Decimal("33.33")
    assert sum(splits.values()) == Decimal("100.00")


def test_equal_split_seven_members():
    users = [uuid.uuid4() for _ in range(7)]
    sorted_users = sorted(users, key=lambda x: str(x))

    # 10.00 / 7 = 1.42857 -> base 1.42, 10 - (1.42 * 7) = 10 - 9.94 = 0.06 (6 paisa remainder)
    splits = calculate_equal_split(Decimal("10.00"), users)

    # First 6 get 1.43, 7th gets 1.42
    for u in sorted_users[:6]:
        assert splits[u] == Decimal("1.43")
    assert splits[sorted_users[6]] == Decimal("1.42")
    assert sum(splits.values()) == Decimal("10.00")


def test_equal_split_one_cent():
    users = [uuid.uuid4() for _ in range(3)]
    sorted_users = sorted(users, key=lambda x: str(x))

    splits = calculate_equal_split(Decimal("0.01"), users)

    # First user gets 0.01, other 2 get 0.00
    assert splits[sorted_users[0]] == Decimal("0.01")
    assert splits[sorted_users[1]] == Decimal("0.00")
    assert splits[sorted_users[2]] == Decimal("0.00")
    assert sum(splits.values()) == Decimal("0.01")


def test_equal_split_large_amount():
    users = [uuid.uuid4() for _ in range(3)]
    splits = calculate_equal_split(Decimal("100000000.00"), users)
    assert sum(splits.values()) == Decimal("100000000.00")


def test_equal_split_determinism():
    users = [uuid.uuid4() for _ in range(5)]
    shuffled_1 = list(users)
    random.shuffle(shuffled_1)

    shuffled_2 = list(users)
    random.shuffle(shuffled_2)

    res_1 = calculate_equal_split(Decimal("42.42"), shuffled_1)
    res_2 = calculate_equal_split(Decimal("42.42"), shuffled_2)

    assert res_1 == res_2
    assert sum(res_1.values()) == Decimal("42.42")


def test_equal_split_invalid_inputs():
    with pytest.raises(SplitValidationError, match="At least one participant"):
        calculate_equal_split(Decimal("100.00"), [])

    with pytest.raises(SplitValidationError, match="greater than zero"):
        calculate_equal_split(Decimal("0.00"), [uuid.uuid4()])

    with pytest.raises(SplitValidationError, match="greater than zero"):
        calculate_equal_split(Decimal("-50.00"), [uuid.uuid4()])


def test_exact_split_valid():
    u1, u2, u3 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    shares = {
        u1: Decimal("25.50"),
        u2: Decimal("40.00"),
        u3: Decimal("34.50"),
    }
    result = validate_and_allocate_exact_split(Decimal("100.00"), shares)
    assert result[u1] == Decimal("25.50")
    assert result[u2] == Decimal("40.00")
    assert result[u3] == Decimal("34.50")
    assert sum(result.values()) == Decimal("100.00")


def test_exact_split_mismatch_raises():
    u1, u2 = uuid.uuid4(), uuid.uuid4()
    shares = {
        u1: Decimal("20.00"),
        u2: Decimal("20.00"),
    }
    with pytest.raises(SplitValidationError, match="does not match expense total"):
        validate_and_allocate_exact_split(Decimal("50.00"), shares)


def test_exact_split_negative_raises():
    u1 = uuid.uuid4()
    with pytest.raises(SplitValidationError, match="cannot be negative"):
        validate_and_allocate_exact_split(Decimal("10.00"), {u1: Decimal("-5.00")})


def test_multi_payer_validation():
    u1, u2 = uuid.uuid4(), uuid.uuid4()
    payers = {
        u1: "60.00",
        u2: "40.00",
    }
    result = validate_payers("100.00", payers)
    assert result[u1] == Decimal("60.00")
    assert result[u2] == Decimal("40.00")
    assert sum(result.values()) == Decimal("100.00")


def test_multi_payer_mismatch_raises():
    u1, u2 = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(SplitValidationError, match="Sum of payers"):
        validate_payers("100.00", {u1: "50.00", u2: "40.00"})


def test_multi_payer_zero_raises():
    u1 = uuid.uuid4()
    with pytest.raises(SplitValidationError, match="strictly positive"):
        validate_payers("50.00", {u1: "0.00"})
