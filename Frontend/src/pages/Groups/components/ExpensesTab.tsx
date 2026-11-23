import { IconReceipt, IconPlus, IconEdit, IconTrash } from "../../../components/Icons";
import type { ExpenseItem } from "../../../api/expenses";
import type { User } from "../../../context/auth-context";

interface ExpensesTabProps {
  expenses: ExpenseItem[];
  user: User | null;
  isOwner: boolean;
  isAdmin: boolean;
  onOpenExpenseModal: (expense?: ExpenseItem) => void;
  onViewExpenseBreakdown: (expense: ExpenseItem) => void;
  onDeleteExpense: (expenseId: string) => void;
}

export default function ExpensesTab({
  expenses,
  user,
  isOwner,
  isAdmin,
  onOpenExpenseModal,
  onViewExpenseBreakdown,
  onDeleteExpense,
}: ExpensesTabProps) {
  return (
    <div className="space-y-4">
      {expenses.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-sand bg-parchment/60 p-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sand/60 text-steel">
            <IconReceipt size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-ink-black">No Expenses Recorded</h3>
            <p className="text-sm text-steel max-w-sm mx-auto">
              Add your first shared expense to start tracking circle balances.
            </p>
          </div>
          <button
            onClick={() => onOpenExpenseModal()}
            className="pc-btn pc-btn-primary inline-flex items-center gap-2 text-sm"
          >
            <IconPlus size={16} />
            <span>Add First Expense</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((exp) => {
            const canEdit =
              exp.creator.id === user?.id || isOwner || isAdmin;
            const payerSummary =
              exp.payers.length === 1
                ? `Paid by ${exp.payers[0].user.name}`
                : `Paid by ${exp.payers.length} members`;

            return (
              <div
                key={exp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-[20px] border border-sand bg-parchment p-5 transition hover:border-fog gap-4"
              >
                <div
                  className="space-y-1.5 cursor-pointer flex-1"
                  onClick={() => onViewExpenseBreakdown(exp)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-ink-black hover:text-electric-blue transition">
                      {exp.description}
                    </span>
                    <span
                      className={`pc-badge text-[11px] font-medium ${
                        exp.split_type === "equal"
                          ? "bg-sand text-steel border-sand"
                          : "bg-ember-orange/15 text-ember-orange border-ember-orange/30"
                      }`}
                    >
                      {exp.split_type === "equal" ? "Equal split" : "Exact split"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-steel">
                    <span className="font-medium text-ink-black">{payerSummary}</span>
                    <span className="inline-block h-1 w-1 rounded-full bg-sand" />
                    <span>{exp.participants.length} {exp.participants.length === 1 ? "participant" : "participants"}</span>
                    <span className="inline-block h-1 w-1 rounded-full bg-sand" />
                    <span>{new Date(exp.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div
                    className="text-right cursor-pointer"
                    onClick={() => onViewExpenseBreakdown(exp)}
                  >
                    <div className="text-xl font-bold font-mono text-ink-black">
                      ₹{parseFloat(exp.amount).toFixed(2)}
                    </div>
                    <span className="text-[11px] text-electric-blue underline underline-offset-2">
                      View split breakdown &rarr;
                    </span>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1.5 border-l border-sand/60 pl-3">
                      <button
                        onClick={() => onOpenExpenseModal(exp)}
                        className="p-1.5 text-steel hover:text-ink-black rounded-lg hover:bg-sand/40 transition"
                        title="Edit Expense"
                        aria-label="Edit Expense"
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteExpense(exp.id)}
                        className="p-1.5 text-steel hover:text-ember-orange rounded-lg hover:bg-ember-orange/10 transition"
                        title="Delete Expense"
                        aria-label="Delete Expense"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
