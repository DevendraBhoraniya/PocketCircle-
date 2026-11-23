import { IconClose } from "../../../components/Icons";
import type { ExpenseItem } from "../../../api/expenses";
import { formatCurrency } from "../../../utils/currency";
import { useModalAccessibility } from "../../../hooks/useModalAccessibility";

interface ExpenseBreakdownModalProps {
  expense: ExpenseItem | null;
  onClose: () => void;
}

export default function ExpenseBreakdownModal({
  expense,
  onClose,
}: ExpenseBreakdownModalProps) {
  const modalRef = useModalAccessibility({
    isOpen: !!expense,
    onClose,
  });

  if (!expense) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-breakdown-title"
        className="w-full max-w-md rounded-[28px] border border-sand bg-white p-6 sm:p-8 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between border-b border-sand pb-4">
          <div>
            <h3 id="expense-breakdown-title" className="text-lg font-bold text-ink-black">
              {expense.description}
            </h3>
            <span className="text-xs font-mono font-bold text-electric-blue">
              Total: ₹{formatCurrency(expense.amount)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-steel hover:bg-parchment"
            aria-label="Close breakdown dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        {/* Payers */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-steel">Paid by</h4>
          <div className="rounded-xl border border-sand bg-parchment p-3 space-y-2">
            {expense.payers.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink-black">{p.user.name}</span>
                <span className="font-mono font-bold text-ink-black">
                  ₹{formatCurrency(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Split Shares */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-steel">
            Split allocation ({expense.split_type === "equal" ? "Equal" : "Exact"})
          </h4>
          <div className="rounded-xl border border-sand bg-parchment p-3 space-y-2 max-h-48 overflow-y-auto">
            {expense.participants.map((pt) => (
              <div key={pt.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink-black">{pt.user.name}</span>
                <span className="font-mono font-bold text-ink-black">
                  ₹{formatCurrency(pt.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full pc-btn pc-btn-secondary text-xs"
        >
          Close
        </button>
      </div>
    </div>
  );
}

