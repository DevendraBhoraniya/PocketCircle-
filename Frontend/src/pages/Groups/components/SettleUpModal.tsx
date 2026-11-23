import { useState } from "react";
import Avatar from "../../../components/Avatar";
import { IconClose, IconCheck, IconCopy } from "../../../components/Icons";
import type { SettlementTransferItem } from "../../../api/balances";
import { formatCurrency } from "../../../utils/currency";
import { useModalAccessibility } from "../../../hooks/useModalAccessibility";

interface SettleUpModalProps {
  transfer: SettlementTransferItem | null;
  onClose: () => void;
  onSubmit: (transfer: SettlementTransferItem, notes: string) => Promise<void>;
}

export default function SettleUpModal({
  transfer,
  onClose,
  onSubmit,
}: SettleUpModalProps) {
  const [settleUpCopied, setSettleUpCopied] = useState(false);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useModalAccessibility({
    isOpen: !!transfer,
    onClose,
  });

  if (!transfer) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transfer.to_user.pocket_id);
      setSettleUpCopied(true);
      setTimeout(() => setSettleUpCopied(false), 2000);
    } catch {
      setSettleUpCopied(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(transfer, notes);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settle-up-title"
        className="w-full max-w-md rounded-[28px] border border-sand bg-white p-6 sm:p-8 shadow-xl space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="pc-badge pc-badge-dark text-[10px] font-mono uppercase tracking-wider">
              Settlement Transfer
            </span>
            <h3 id="settle-up-title" className="text-xl font-bold text-ink-black mt-1">
              Settle Up
            </h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-steel hover:bg-parchment"
            aria-label="Close settle up dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        <div className="rounded-[20px] border border-sand bg-parchment p-5 text-center space-y-3">
          <div className="mx-auto flex justify-center">
            <Avatar
              name={transfer.to_user.name}
              url={transfer.to_user.avatar_url}
              size="lg"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-steel">Transfer to</p>
            <h4 className="text-lg font-bold text-ink-black">
              {transfer.to_user.name}
            </h4>
            <p className="text-xs text-steel">@{transfer.to_user.username ?? "member"}</p>
          </div>

          <div className="rounded-xl border border-sand bg-white p-3 space-y-1">
            <span className="text-xs font-medium text-steel">
              Recipient Pocket ID
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-base font-bold tracking-wider text-ink-black">
                {transfer.to_user.pocket_id}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-parchment hover:bg-sand transition text-ink-black"
                title="Copy Pocket ID"
                aria-label="Copy Pocket ID"
              >
                {settleUpCopied ? (
                  <IconCheck size={14} className="text-electric-blue" />
                ) : (
                  <IconCopy size={14} />
                )}
              </button>
            </div>
            {settleUpCopied && (
              <p className="text-[10px] font-semibold text-electric-blue">
                Copied Pocket ID to clipboard!
              </p>
            )}
          </div>

          <div className="pt-2">
            <span className="text-xs font-medium text-steel">
              Amount due
            </span>
            <p className="font-mono text-3xl font-bold text-ink-black mt-0.5">
              ₹{formatCurrency(transfer.amount)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="settle-notes" className="text-xs font-medium text-steel">
              Payment reference or note (optional)
            </label>
            <input
              id="settle-notes"
              type="text"
              placeholder="e.g. GPay UPI ref #8291, Bank transfer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="pc-input"
              maxLength={255}
            />
          </div>

          <div className="rounded-xl bg-sand/30 p-3.5 text-xs text-steel space-y-1.5">
            <p className="font-semibold text-ink-black">How off-platform settlement works:</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px]">
              <li>Transfer ₹{formatCurrency(transfer.amount)} to {transfer.to_user.name} via your UPI or banking app.</li>
              <li>Click <strong>Record Payment</strong> below to notify {transfer.to_user.name}.</li>
              <li>Once {transfer.to_user.name} confirms receipt, group balances will automatically reconcile to ₹0.00.</li>
            </ol>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
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
              className="pc-btn pc-btn-primary text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <IconCheck size={14} />
              <span>{isSubmitting ? "Recording..." : "Record Payment & Notify Payee"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
