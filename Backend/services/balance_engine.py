from decimal import Decimal
from typing import NamedTuple
import uuid

from services.split_engine import quantize_currency


class SettlementTransfer(NamedTuple):
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    amount: Decimal


def simplify_debts(
    net_balances: dict[uuid.UUID, Decimal]
) -> list[SettlementTransfer]:
    """
    Greedy Minimum Cash Flow Algorithm for debt simplification.
    
    Given net balances where sum(net_balances.values()) == 0.00:
    Minimizes the number of transactions required to settle all debts.
    
    Returns a list of SettlementTransfer(from_user_id, to_user_id, amount).
    """
    # Filter out zero balances and separate into debtors and creditors
    debtors: list[list] = []  # [[user_id, abs(net)]]
    creditors: list[list] = []  # [[user_id, net]]

    for uid, net in net_balances.items():
        quantized = quantize_currency(net)
        if quantized < Decimal("0.00"):
            debtors.append([uid, abs(quantized)])
        elif quantized > Decimal("0.00"):
            creditors.append([uid, quantized])

    transfers: list[SettlementTransfer] = []

    # Greedy settlement matching largest debtor with largest creditor
    while debtors and creditors:
        # Sort so largest amounts are at the end (for O(1) pop), breaking ties deterministically by UUID string
        debtors.sort(key=lambda x: (x[1], str(x[0])))
        creditors.sort(key=lambda x: (x[1], str(x[0])))

        debtor = debtors[-1]
        creditor = creditors[-1]

        debtor_id, amount_owed = debtor[0], debtor[1]
        creditor_id, amount_to_receive = creditor[0], creditor[1]

        transfer_amt = min(amount_owed, amount_to_receive)
        transfers.append(
            SettlementTransfer(
                from_user_id=debtor_id,
                to_user_id=creditor_id,
                amount=transfer_amt,
            )
        )

        debtor[1] -= transfer_amt
        creditor[1] -= transfer_amt

        if debtor[1] <= Decimal("0.00"):
            debtors.pop()
        if creditor[1] <= Decimal("0.00"):
            creditors.pop()

    return transfers
