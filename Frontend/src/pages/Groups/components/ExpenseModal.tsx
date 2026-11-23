import { useState } from "react";
import { IconCheck, IconClose, IconExclamation } from "../../../components/Icons";
import type { ExpenseItem } from "../../../api/expenses";
import type { GroupDetail } from "../../../api/groups";
import type { User } from "../../../context/auth-context";
import { parseToPaisa, formatPaisaToString } from "../../../utils/currency";
import { useModalAccessibility } from "../../../hooks/useModalAccessibility";

interface ExpenseModalProps {
  editingExpense: ExpenseItem | null;
  group: GroupDetail;
  user: User | null;
  onClose: () => void;
  onSave: (payload: {
    description: string;
    amount: string;
    split_type: "equal" | "exact";
    payers?: { user_id: string; amount: string }[];
    participants: { user_id: string; amount?: string }[];
  }) => Promise<void>;
}

export default function ExpenseModal({
  editingExpense,
  group,
  user,
  onClose,
  onSave,
}: ExpenseModalProps) {
  const [expDesc, setExpDesc] = useState(() => editingExpense?.description ?? "");
  const [expAmount, setExpAmount] = useState(() => editingExpense?.amount ?? "");
  const [expSplitType, setExpSplitType] = useState<"equal" | "exact">(
    () => (editingExpense?.split_type as "equal" | "exact") ?? "equal"
  );
  const [isMultiPayer, setIsMultiPayer] = useState(
    () => (editingExpense?.payers.length ?? 0) > 1
  );
  const [singlePayerId, setSinglePayerId] = useState<string>(
    () => editingExpense?.payers[0]?.user.id ?? user?.id ?? group.members[0]?.user.id ?? ""
  );
  const [multiPayerAmounts, setMultiPayerAmounts] = useState<Record<string, string>>(() => {
    if (editingExpense && editingExpense.payers.length > 1) {
      const pMap: Record<string, string> = {};
      for (const p of editingExpense.payers) {
        pMap[p.user.id] = p.amount;
      }
      return pMap;
    }
    return {};
  });
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(() => {
    if (editingExpense) {
      return editingExpense.participants.map((pt) => pt.user.id);
    }
    return group.members.map((m) => m.user.id);
  });
  const [exactParticipantAmounts, setExactParticipantAmounts] = useState<Record<string, string>>(() => {
    if (editingExpense && editingExpense.split_type === "exact") {
      const ptMap: Record<string, string> = {};
      for (const pt of editingExpense.participants) {
        ptMap[pt.user.id] = pt.amount;
      }
      return ptMap;
    }
    return {};
  });
  const [expenseFormError, setExpenseFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useModalAccessibility({
    isOpen: true,
    onClose,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Exact integer paisa parsing (Zero floating-point math)
    const totalPaisa = parseToPaisa(expAmount);
    if (totalPaisa === null || totalPaisa <= 0) {
      setExpenseFormError("Please enter a valid expense amount greater than ₹0.00");
      return;
    }

    if (!expDesc.trim()) {
      setExpenseFormError("Please provide an expense description");
      return;
    }

    if (selectedParticipants.length === 0) {
      setExpenseFormError("Select at least one participant");
      return;
    }

    let payersPayload: { user_id: string; amount: string }[] | undefined;
    if (isMultiPayer) {
      let sumPayersPaisa = 0;
      payersPayload = [];
      for (const m of group.members) {
        const amtStr = multiPayerAmounts[m.user.id];
        if (amtStr && amtStr.trim()) {
          const payerPaisa = parseToPaisa(amtStr);
          if (payerPaisa === null) {
            setExpenseFormError(`Invalid amount format for payer ${m.user.name}`);
            return;
          }
          if (payerPaisa > 0) {
            sumPayersPaisa += payerPaisa;
            payersPayload.push({ user_id: m.user.id, amount: formatPaisaToString(payerPaisa) });
          }
        }
      }
      if (sumPayersPaisa !== totalPaisa) {
        setExpenseFormError(
          `Sum of payers (₹${formatPaisaToString(sumPayersPaisa)}) must exactly match expense total (₹${formatPaisaToString(totalPaisa)})`
        );
        return;
      }
    } else {
      payersPayload = [{ user_id: singlePayerId || user.id, amount: formatPaisaToString(totalPaisa) }];
    }

    let participantsPayload: { user_id: string; amount?: string }[];
    if (expSplitType === "equal") {
      participantsPayload = selectedParticipants.map((uid) => ({ user_id: uid }));
    } else {
      let sumPartsPaisa = 0;
      participantsPayload = [];
      for (const uid of selectedParticipants) {
        const amtStr = exactParticipantAmounts[uid] || "0";
        const partPaisa = parseToPaisa(amtStr);
        if (partPaisa === null) {
          const member = group.members.find((m) => m.user.id === uid);
          setExpenseFormError(`Invalid amount format for participant ${member?.user.name || uid}`);
          return;
        }
        sumPartsPaisa += partPaisa;
        participantsPayload.push({ user_id: uid, amount: formatPaisaToString(partPaisa) });
      }
      if (sumPartsPaisa !== totalPaisa) {
        setExpenseFormError(
          `Sum of participant shares (₹${formatPaisaToString(sumPartsPaisa)}) must exactly match expense total (₹${formatPaisaToString(totalPaisa)})`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setExpenseFormError("");

    try {
      await onSave({
        description: expDesc.trim(),
        amount: formatPaisaToString(totalPaisa),
        split_type: expSplitType,
        payers: payersPayload,
        participants: participantsPayload,
      });
      onClose();
    } catch (err) {
      setExpenseFormError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        className="w-full max-w-lg rounded-[28px] border border-sand bg-white p-6 sm:p-8 shadow-xl space-y-6 my-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="expense-modal-title" className="text-xl font-semibold text-ink-black">
              {editingExpense ? "Edit Ledger Expense" : "Add Circle Expense"}
            </h2>
            <p className="text-xs text-steel mt-0.5">
              Multi-payer and deterministic split allocation
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-steel hover:bg-parchment hover:text-ink-black transition"
            aria-label="Close dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        {expenseFormError && (
          <div className="rounded-xl border border-ember-orange/40 bg-ember-orange/10 p-3 text-xs font-medium text-ember-orange flex items-center gap-2">
            <IconExclamation size={14} />
            <span>{expenseFormError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="expense-desc" className="text-xs font-medium text-steel">
              Description <span className="text-ember-orange">*</span>
            </label>
            <input
              id="expense-desc"
              type="text"
              required
              placeholder="e.g. Dinner at Social, Uber ride"
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              className="pc-input"
            />
          </div>

          {/* Total Amount */}
          <div className="space-y-1.5">
            <label htmlFor="expense-amount" className="text-xs font-medium text-steel">
              Total amount (₹) <span className="text-ember-orange">*</span>
            </label>
            <input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="pc-input font-mono text-base font-bold"
            />
          </div>

          {/* Paid By Section */}
          <div className="space-y-2 border-t border-sand/60 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-steel">
                Paid by
              </label>
              <button
                type="button"
                onClick={() => setIsMultiPayer(!isMultiPayer)}
                className="text-xs text-electric-blue hover:underline font-semibold"
              >
                {isMultiPayer ? "Single payer" : "Multiple payers"}
              </button>
            </div>

            {!isMultiPayer ? (
              <select
                value={singlePayerId}
                onChange={(e) => setSinglePayerId(e.target.value)}
                className="pc-input py-2 text-sm"
              >
                {group.members.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name} {m.user.id === user?.id ? "(You)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2 rounded-xl border border-sand bg-parchment p-3 max-h-40 overflow-y-auto">
                {group.members.map((m) => (
                  <div key={m.user.id} className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-ink-black truncate">
                      {m.user.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-steel font-mono">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={multiPayerAmounts[m.user.id] || ""}
                        onChange={(e) =>
                          setMultiPayerAmounts({
                            ...multiPayerAmounts,
                            [m.user.id]: e.target.value,
                          })
                        }
                        className="w-24 rounded-lg border border-sand bg-white px-2 py-1 text-xs font-mono text-right text-ink-black focus:border-ink-black focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Split Type Toggle */}
          <div className="space-y-2 border-t border-sand/60 pt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-steel">
              Split Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExpSplitType("equal")}
                className={`rounded-xl border py-2 text-xs font-semibold transition ${
                  expSplitType === "equal"
                    ? "border-ink-black bg-ink-black text-paper-white"
                    : "border-sand bg-parchment text-steel hover:text-ink-black"
                }`}
              >
                Split Equally
              </button>
              <button
                type="button"
                onClick={() => setExpSplitType("exact")}
                className={`rounded-xl border py-2 text-xs font-semibold transition ${
                  expSplitType === "exact"
                    ? "border-ink-black bg-ink-black text-paper-white"
                    : "border-sand bg-parchment text-steel hover:text-ink-black"
                }`}
              >
                Exact Amounts
              </button>
            </div>
          </div>

          {/* Participants Section */}
          <div className="space-y-2 border-t border-sand/60 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-steel">
                Split For ({selectedParticipants.length} selected)
              </label>
              {expSplitType === "equal" && selectedParticipants.length > 0 && expAmount && (
                <span className="text-xs font-mono font-semibold text-electric-blue">
                  ~₹{(parseFloat(expAmount) / selectedParticipants.length).toFixed(2)} / person
                </span>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-sand bg-parchment p-3 max-h-48 overflow-y-auto">
              {group.members.map((m) => {
                const isSelected = selectedParticipants.includes(m.user.id);
                return (
                  <div
                    key={m.user.id}
                    className="flex items-center justify-between gap-3 py-1"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedParticipants([...selectedParticipants, m.user.id]);
                          } else {
                            setSelectedParticipants(
                              selectedParticipants.filter((id) => id !== m.user.id)
                            );
                          }
                        }}
                        className="rounded border-sand text-ink-black focus:ring-0"
                      />
                      <span className="text-xs font-medium text-ink-black truncate">
                        {m.user.name} {m.user.id === user?.id ? "(You)" : ""}
                      </span>
                    </label>

                    {expSplitType === "exact" && isSelected && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-steel font-mono">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={exactParticipantAmounts[m.user.id] || ""}
                          onChange={(e) =>
                            setExactParticipantAmounts({
                              ...exactParticipantAmounts,
                              [m.user.id]: e.target.value,
                            })
                          }
                          className="w-24 rounded-lg border border-sand bg-white px-2 py-1 text-xs font-mono text-right text-ink-black focus:border-ink-black focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-sand">
            <button
              type="button"
              onClick={onClose}
              className="pc-btn pc-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="pc-btn pc-btn-primary text-xs flex items-center gap-2"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <IconCheck size={14} />
              )}
              <span>Save to Ledger</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
