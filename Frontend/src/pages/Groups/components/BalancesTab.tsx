import Avatar from "../../../components/Avatar";
import {
  IconShield,
  IconCheckCircle,
  IconArrowRight,
  IconClock,
  IconCheck,
} from "../../../components/Icons";
import type { GroupBalancesResponse, SettlementPlanResponse, SettlementTransferItem } from "../../../api/balances";
import type { SettlementItem } from "../../../api/settlements";
import type { User } from "../../../context/auth-context";

interface BalancesTabProps {
  balances: GroupBalancesResponse | null;
  expensesCount: number;
  settlementPlan: SettlementPlanResponse | null;
  settlements: SettlementItem[];
  groupMembersCount: number;
  user: User | null;
  onSettleUp: (transfer: SettlementTransferItem) => void;
  onConfirmSettlement: (settlementId: string) => void;
  onRejectSettlement: (settlementId: string) => void;
  onCancelSettlement: (settlementId: string) => void;
}

export default function BalancesTab({
  balances,
  expensesCount,
  settlementPlan,
  settlements,
  groupMembersCount,
  user,
  onSettleUp,
  onConfirmSettlement,
  onRejectSettlement,
  onCancelSettlement,
}: BalancesTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Overview Ribbon Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[20px] border border-sand bg-parchment p-5 space-y-1">
          <span className="text-xs font-medium text-steel">
            Total circle spend
          </span>
          <p className="font-mono text-2xl font-bold text-ink-black">
            ₹{parseFloat(balances?.total_group_spending ?? "0").toFixed(2)}
          </p>
          <p className="text-xs text-steel">Across {expensesCount} recorded items</p>
        </div>

        <div className="rounded-[20px] border border-sand bg-parchment p-5 space-y-1">
          <span className="text-xs font-medium text-steel">
            Your net balance
          </span>
          <div className="flex items-center gap-2">
            <p
              className={`font-mono text-2xl font-bold ${
                parseFloat(balances?.my_net_balance ?? "0") > 0
                  ? "text-ink-black"
                  : parseFloat(balances?.my_net_balance ?? "0") < 0
                  ? "text-ember-orange"
                  : "text-steel"
              }`}
            >
              {parseFloat(balances?.my_net_balance ?? "0") > 0 && "+"}
              ₹{parseFloat(balances?.my_net_balance ?? "0").toFixed(2)}
            </p>
          </div>
          <p className="text-xs text-steel">
            {parseFloat(balances?.my_net_balance ?? "0") > 0
              ? "You are owed money back"
              : parseFloat(balances?.my_net_balance ?? "0") < 0
              ? "You owe money to the circle"
              : "You are completely settled up"}
          </p>
        </div>

        <div className="rounded-[20px] border border-sand bg-parchment p-5 space-y-1">
          <span className="text-xs font-medium text-steel">
            Settlement efficiency
          </span>
          <p className="font-mono text-2xl font-bold text-ink-black">
            {settlementPlan?.transfers.length ?? 0}{" "}
            {settlementPlan?.transfers.length === 1 ? "transfer" : "transfers"}
          </p>
          <p className="text-xs text-steel">
            ₹{parseFloat(settlementPlan?.total_settlement_amount ?? "0").toFixed(2)} total settlement flow
          </p>
        </div>
      </div>

      {/* 2. Optimized Settlement Plan */}
      <div className="rounded-[24px] border border-sand bg-paper-white p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand pb-4">
          <div>
            <div className="flex items-center gap-2">
              <IconShield size={18} className="text-electric-blue" />
              <h2 className="text-lg font-bold text-ink-black">Simplified Settlement Plan</h2>
            </div>
            <p className="text-xs text-steel mt-0.5">
              Greedy debt simplification reduces circular debts into minimal direct payments (&le; N-1 transactions).
            </p>
          </div>
          <span className="font-mono text-xs text-steel">
            Max {Math.max(0, groupMembersCount - 1)} transfers
          </span>
        </div>

        {!settlementPlan || settlementPlan.transfers.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-sand bg-parchment/60 p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-toxic-lime/25 text-ink-black">
              <IconCheckCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-ink-black">Circle is Fully Settled</h3>
            <p className="text-xs text-steel max-w-sm mx-auto">
              Every member has a zero net balance. No pending payments or debt transfers required!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {settlementPlan.transfers.map((t, idx) => {
              const isFromMe = t.from_user.id === user?.id;
              const isToMe = t.to_user.id === user?.id;

              return (
                <div
                  key={idx}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-[20px] border p-4 sm:p-5 gap-4 transition ${
                    isFromMe
                      ? "border-ember-orange/40 bg-ember-orange/5"
                      : isToMe
                      ? "border-sand bg-sand/15"
                      : "border-sand bg-parchment"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3 sm:gap-5 flex-1">
                    {/* Payer (From) */}
                    <div className="flex items-center gap-2.5 min-w-[130px]">
                      <Avatar name={t.from_user.name} url={t.from_user.avatar_url} size="sm" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-ink-black flex items-center gap-1.5">
                          <span>{t.from_user.name}</span>
                          {isFromMe && (
                            <span className="pc-badge text-[9px] font-bold uppercase tracking-wider bg-ember-orange/15 text-ember-orange border-ember-orange/30">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-steel">
                          {t.from_user.pocket_id}
                        </span>
                      </div>
                    </div>

                    {/* Arrow & Amount */}
                    <div className="flex items-center gap-2 px-2">
                      <span className="font-mono text-sm sm:text-base font-bold text-ink-black bg-white px-3 py-1 rounded-full border border-sand shadow-2xs">
                        ₹{parseFloat(t.amount).toFixed(2)}
                      </span>
                      <IconArrowRight size={16} className="text-steel" />
                    </div>

                    {/* Payee (To) */}
                    <div className="flex items-center gap-2.5 min-w-[130px]">
                      <Avatar name={t.to_user.name} url={t.to_user.avatar_url} size="sm" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-ink-black flex items-center gap-1.5">
                          <span>{t.to_user.name}</span>
                          {isToMe && (
                            <span className="pc-badge text-[9px] font-bold uppercase tracking-wider bg-toxic-lime/30 text-ink-black border-toxic-lime/50">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-steel">
                          {t.to_user.pocket_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex items-center justify-end">
                    {isFromMe ? (
                      <button
                        onClick={() => onSettleUp(t)}
                        className="pc-btn pc-btn-primary text-xs py-2 px-4 font-semibold shadow-sm flex items-center gap-1.5"
                      >
                        <span>Settle Up</span>
                        <IconArrowRight size={14} />
                      </button>
                    ) : isToMe ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-black bg-toxic-lime/25 border border-toxic-lime/40 px-3 py-1.5 rounded-full">
                        <IconClock size={13} />
                        <span>Awaiting Payment</span>
                      </span>
                    ) : (
                      <span className="text-xs text-steel font-mono px-3 py-1.5">
                        Peer settlement
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Member Balances Breakdown Table */}
      <div className="rounded-[24px] border border-sand bg-parchment p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between border-b border-sand pb-4">
          <div>
            <h2 className="text-lg font-bold text-ink-black">Member Balances</h2>
            <p className="text-xs text-steel mt-0.5">
              Detailed total paid into group vs allocated share for every member.
            </p>
          </div>
          <span className="font-mono text-xs text-steel">&Sigma; Net = ₹0.00</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {balances?.balances.map((b) => {
            const isMemberSelf = b.user.id === user?.id;
            const net = parseFloat(b.net_balance);
            return (
              <div
                key={b.user.id}
                className="flex flex-col justify-between rounded-[20px] border border-sand bg-paper-white p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={b.user.name} url={b.user.avatar_url} size="sm" />
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-ink-black flex items-center gap-1">
                        <span>{b.user.name}</span>
                        {isMemberSelf && <span className="text-[10px] text-steel font-normal">(You)</span>}
                      </div>
                      <span className="text-[11px] font-mono text-steel">{b.user.pocket_id}</span>
                    </div>
                  </div>

                  <span
                    className={`pc-badge font-mono text-xs font-bold ${
                      net > 0
                        ? "bg-toxic-lime/30 text-ink-black border-toxic-lime/50"
                        : net < 0
                        ? "bg-ember-orange/15 text-ember-orange border-ember-orange/30"
                        : "bg-sand text-steel border-sand"
                    }`}
                  >
                    {net > 0 ? `+₹${net.toFixed(2)}` : net < 0 ? `-₹${Math.abs(net).toFixed(2)}` : "₹0.00"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-sand/40 pt-2 text-[11px]">
                  <div>
                    <span className="text-steel">Paid into circle:</span>
                    <p className="font-mono font-bold text-ink-black">
                      ₹{parseFloat(b.total_paid).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-steel">Expense share:</span>
                    <p className="font-mono font-bold text-ink-black">
                      ₹{parseFloat(b.total_owed).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Settlement History & Confirmation Requests */}
      <div className="rounded-[24px] border border-sand bg-paper-white p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between border-b border-sand pb-4">
          <div>
            <h2 className="text-lg font-bold text-ink-black">Settlement History &amp; Confirmations</h2>
            <p className="text-xs text-steel mt-0.5">
              Confirm receipt of payments made to you, or review settled off-platform transactions.
            </p>
          </div>
          <span className="font-mono text-xs text-steel">
            {settlements.length} {settlements.length === 1 ? "record" : "records"}
          </span>
        </div>

        {settlements.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-sand bg-parchment/60 p-8 text-center text-xs text-steel">
            No settlement payments recorded yet in this circle.
          </div>
        ) : (
          <div className="space-y-3">
            {settlements.map((s) => {
              const isPayerMe = s.payer.id === user?.id;
              const isPayeeMe = s.payee.id === user?.id;
              const isPending = s.status === "pending";

              return (
                <div
                  key={s.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-[20px] border p-4 sm:p-5 gap-4 transition ${
                    isPending && isPayeeMe
                      ? "border-toxic-lime/50 bg-toxic-lime/10"
                      : isPending && isPayerMe
                      ? "border-ember-orange/40 bg-ember-orange/5"
                      : "border-sand bg-parchment"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3 sm:gap-5 flex-1">
                    {/* Payer (From) */}
                    <div className="flex items-center gap-2.5 min-w-[120px]">
                      <Avatar name={s.payer.name} url={s.payer.avatar_url} size="sm" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-ink-black flex items-center gap-1.5">
                          <span>{s.payer.name}</span>
                          {isPayerMe && (
                            <span className="pc-badge text-[9px] font-bold uppercase bg-sand text-steel">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-steel">
                          {s.payer.pocket_id}
                        </span>
                      </div>
                    </div>

                    {/* Arrow & Amount */}
                    <div className="flex items-center gap-2 px-1">
                      <span className="font-mono text-sm sm:text-base font-bold text-ink-black bg-white px-3 py-1 rounded-full border border-sand">
                        ₹{parseFloat(s.amount).toFixed(2)}
                      </span>
                      <IconArrowRight size={15} className="text-steel" />
                    </div>

                    {/* Payee (To) */}
                    <div className="flex items-center gap-2.5 min-w-[120px]">
                      <Avatar name={s.payee.name} url={s.payee.avatar_url} size="sm" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-ink-black flex items-center gap-1.5">
                          <span>{s.payee.name}</span>
                          {isPayeeMe && (
                            <span className="pc-badge text-[9px] font-bold uppercase bg-toxic-lime/30 text-ink-black">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-steel">
                          {s.payee.pocket_id}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge & Notes */}
                    <div className="flex flex-col gap-0.5 pl-2">
                      <span
                        className={`pc-badge text-[10px] font-mono uppercase font-bold w-fit ${
                          s.status === "confirmed"
                            ? "bg-toxic-lime/30 text-ink-black border-toxic-lime/50"
                            : s.status === "pending"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : s.status === "rejected"
                            ? "bg-ember-orange/15 text-ember-orange border-ember-orange/30"
                            : "bg-sand text-steel border-sand"
                        }`}
                      >
                        {s.status}
                      </span>
                      {s.notes && (
                        <span className="text-[11px] text-steel italic">
                          "{s.notes}"
                        </span>
                      )}
                      <span className="text-[10px] text-fog">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    {isPending && isPayeeMe && (
                      <>
                        <button
                          onClick={() => onConfirmSettlement(s.id)}
                          className="pc-btn pc-btn-primary text-xs py-1.5 px-3 font-semibold flex items-center gap-1"
                        >
                          <IconCheck size={13} />
                          <span>Confirm Receipt</span>
                        </button>
                        <button
                          onClick={() => onRejectSettlement(s.id)}
                          className="pc-btn pc-btn-secondary text-xs py-1.5 px-3 text-ember-orange hover:bg-ember-orange/10"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {isPending && isPayerMe && (
                      <button
                        onClick={() => onCancelSettlement(s.id)}
                        className="pc-btn pc-btn-secondary text-xs py-1.5 px-3 text-steel hover:text-ember-orange"
                      >
                        Cancel Request
                      </button>
                    )}

                    {isPending && !isPayeeMe && !isPayerMe && (
                      <span className="text-xs text-steel font-mono italic">
                        Awaiting payee confirmation
                      </span>
                    )}

                    {!isPending && (
                      <span className="text-xs text-steel font-mono">
                        {s.status === "confirmed"
                          ? `Confirmed by ${s.action_by?.name ?? s.payee.name}`
                          : s.status === "rejected"
                          ? "Rejected"
                          : "Cancelled"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
