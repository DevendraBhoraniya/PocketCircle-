import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import Avatar from "../../components/Avatar";
import {
  IconCopy,
  IconCheck,
  IconUsers,
  IconReceipt,
  IconArrowRight,
  IconPlus,
} from "../../components/Icons";
import { apiClient } from "../../api/client";
import { getUserCrossGroupSummary, type UserCrossGroupSummary } from "../../api/balances";
import ActivityItem from "../../components/ActivityItem";
import { DashboardSkeleton } from "../../components/skeletons";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  useDocumentTitle("Dashboard");
  const [copied, setCopied] = useState(false);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [groupCount, setGroupCount] = useState<number | null>(null);
  const [crossSummary, setCrossSummary] = useState<UserCrossGroupSummary | null>(null);

  // Load friend & group counts + cross group balance summary to populate dashboard metrics
  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadStats() {
      try {
        const [friendsRes, groupsRes, summaryData] = await Promise.all([
          apiClient("/friends"),
          apiClient("/groups"),
          getUserCrossGroupSummary().catch(() => null),
        ]);
        if (active) {
          if (friendsRes.ok) {
            const data = await friendsRes.json();
            if (Array.isArray(data.friends)) {
              setFriendCount(data.friends.length);
            }
          }
          if (groupsRes.ok) {
            const grpData = await groupsRes.json();
            if (Array.isArray(grpData)) {
              setGroupCount(grpData.length);
            }
          }
          if (summaryData) {
            setCrossSummary(summaryData);
          }
        }
      } catch {
        // Non-blocking for dashboard
      }
    }

    void loadStats();
    return () => {
      active = false;
    };
  }, [user]);

  const copyPocketId = async () => {
    if (!user?.pocket_id) return;
    try {
      await navigator.clipboard.writeText(user.pocket_id);
      setCopied(true);
      toast.success("Pocket ID copied to clipboard", "Copied");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      toast.info(`Pocket ID: ${user.pocket_id}`);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!user) {
    return null;
  }

  const firstName = user.name.split(" ")[0];
  const netBalanceNum = crossSummary ? parseFloat(crossSummary.overall_net_balance) : 0;
  const isNetPositive = netBalanceNum > 0;
  const isNetNegative = netBalanceNum < 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4 sm:py-6">
      {/* 1. Header & Quick Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand pb-6">
        <div className="flex items-center gap-3.5">
          <Avatar name={user.name} url={user.avatar_url} size="lg" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="pc-heading-sm text-ink-black">
                {firstName}&apos;s Ledger
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Live</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-steel">
              {user.email} &bull; @{user.username ?? "member"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/groups"
            className="pc-btn pc-btn-primary text-xs sm:text-sm font-semibold flex items-center gap-1.5"
          >
            <IconPlus size={15} />
            <span>New Circle</span>
          </Link>
          <Link
            to="/friends"
            className="pc-btn pc-btn-white text-xs sm:text-sm font-medium flex items-center gap-1.5"
          >
            <IconUsers size={15} />
            <span>Friends</span>
          </Link>
        </div>
      </header>

      {/* 2. Master Balance Vault Card */}
      <section className="rounded-xl border border-sand bg-paper-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-steel">
              Cross-circle net position
            </p>
            <div className="flex items-baseline gap-3">
              <span
                className={`font-mono text-4xl sm:text-5xl font-semibold font-tabular ${
                  isNetPositive
                    ? "text-emerald-600"
                    : isNetNegative
                    ? "text-rose-600"
                    : "text-ink-black"
                }`}
              >
                {crossSummary ? (
                  <>
                    {isNetPositive && "+"}
                    ₹{Math.abs(netBalanceNum).toFixed(2)}
                  </>
                ) : (
                  "₹0.00"
                )}
              </span>
              <span
                className={`text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border ${
                  isNetPositive
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : isNetNegative
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : "bg-parchment text-steel border-sand"
                }`}
              >
                {isNetPositive
                  ? "You are owed overall"
                  : isNetNegative
                  ? "You owe overall"
                  : "All settled up cleanly"}
              </span>
            </div>
            <p className="text-xs text-steel">
              Consolidated net total across all {groupCount ?? 0} active circles and trip ledgers.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-72">
            <div className="rounded-lg border border-sand bg-parchment/60 p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-steel">To collect</span>
              <p className="font-mono text-base font-bold font-tabular text-emerald-700">
                +₹{crossSummary?.total_owed_to_me ?? "0.00"}
              </p>
            </div>
            <div className="rounded-lg border border-sand bg-parchment/60 p-3.5 space-y-1">
              <span className="text-[11px] font-medium text-steel">To pay</span>
              <p className="font-mono text-base font-bold font-tabular text-rose-700">
                -₹{crossSummary?.total_i_owe ?? "0.00"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Two-Column Dashboard Main Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Active Circles & Recent Activity (2 Cols) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Active Circles Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="pc-heading-sm text-xl sm:text-2xl text-ink-black">
                  Your Active Circles
                </h2>
                <p className="text-xs text-steel">Groups and trip ledgers you are currently participating in</p>
              </div>
              <Link
                to="/groups"
                className="text-xs font-semibold text-ink-black hover:underline flex items-center gap-1"
              >
                <span>View all ({groupCount ?? 0})</span>
                <IconArrowRight size={13} />
              </Link>
            </div>

            {crossSummary?.groups && crossSummary.groups.length > 0 ? (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {crossSummary.groups.map((grp) => {
                  const net = parseFloat(grp.my_net_balance);
                  return (
                    <Link
                      key={grp.group_id}
                      to={`/groups/${grp.group_id}`}
                      className="group flex flex-col justify-between rounded-xl border border-sand bg-paper-white p-5 transition hover:border-ink-black hover:shadow-xs"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm text-ink-black group-hover:text-electric-blue transition line-clamp-1">
                            {grp.group_name}
                          </h3>
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                              net > 0
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : net < 0
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-parchment text-steel border-sand"
                            }`}
                          >
                            {net > 0
                              ? `+₹${net.toFixed(2)}`
                              : net < 0
                              ? `-₹${Math.abs(net).toFixed(2)}`
                              : "₹0.00"}
                          </span>
                        </div>
                        <span className="text-xs text-steel">
                          {grp.member_count} {grp.member_count === 1 ? "member" : "members"} &bull; Role: {grp.my_role}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-steel border-t border-sand/60 pt-3">
                        <span className="font-medium">
                          {net > 0
                            ? "You are owed"
                            : net < 0
                            ? "You owe circle"
                            : "Settled up"}
                        </span>
                        <span className="font-semibold text-ink-black group-hover:underline transition">
                          View ledger
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-sand bg-parchment/50 p-8 text-center space-y-3">
                <p className="font-bold text-sm text-ink-black">No active circles yet</p>
                <p className="text-xs text-steel max-w-sm mx-auto">
                  Create or join an expense circle with your friends to track shared spending, trips, and flat expenses.
                </p>
                <div className="pt-1">
                  <Link to="/groups" className="pc-btn pc-btn-primary text-xs font-semibold">
                    <IconPlus size={14} />
                    <span>Create your first circle</span>
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* Activity Ledger Stream */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="pc-heading-sm text-xl sm:text-2xl text-ink-black">
                  Recent Ledger Activity
                </h2>
                <p className="text-xs text-steel">Cross-circle transaction audit trail</p>
              </div>
            </div>

            {crossSummary?.recent_activity && crossSummary.recent_activity.length > 0 ? (
              <div className="rounded-xl border border-sand bg-paper-white divide-y divide-sand/70 overflow-hidden shadow-xs">
                {crossSummary.recent_activity.map((ev) => (
                  <ActivityItem key={ev.id} event={ev} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-sand bg-paper-white p-8 text-center space-y-2">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-parchment text-steel">
                  <IconReceipt size={20} />
                </span>
                <p className="font-semibold text-sm text-ink-black">No transactions recorded yet</p>
                <p className="text-xs text-steel max-w-xs mx-auto">
                  Every split, multi-payer expense, and debt settlement will be logged here with immutable timestamps.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Member Identity & Pocket ID Passport (1 Col) */}
        <div className="space-y-6">
          {/* Digital Pocket ID Passport Pass */}
          <aside className="rounded-2xl border border-sand bg-paper-white p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-sand pb-4">
              <div className="space-y-0.5">
                <h3 className="font-semibold text-sm text-ink-black">Pocket ID Pass</h3>
                <p className="text-xs text-steel">Private member identity</p>
              </div>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-parchment text-steel border border-sand">
                Identity
              </span>
            </div>

            <div className="rounded-xl border border-sand bg-parchment p-4 space-y-3 text-center">
              <p className="text-xs font-medium text-steel">Your 10-digit Pocket ID</p>
              <p className="font-mono text-2xl font-semibold tracking-wider text-ink-black">
                {user.pocket_id}
              </p>
              <button
                onClick={copyPocketId}
                className="w-full pc-btn pc-btn-white text-xs py-2 h-9 font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
                title="Copy Pocket ID to clipboard"
              >
                {copied ? <IconCheck size={14} className="text-emerald-600" /> : <IconCopy size={14} />}
                <span>{copied ? "Copied to clipboard" : "Copy Pocket ID"}</span>
              </button>
            </div>

            <p className="text-xs text-steel leading-relaxed">
              Share your Pocket ID with friends so they can add you to expense circles without needing your phone number.
            </p>

            <div className="pt-2 border-t border-sand space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-steel">Account status</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Verified
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-steel">Friends linked</span>
                <span className="font-mono font-bold text-ink-black">{friendCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-steel">Active circles</span>
                <span className="font-mono font-bold text-ink-black">{groupCount ?? 0}</span>
              </div>
            </div>
          </aside>

          {/* Ledger Principles Mini-Card */}
          <div className="rounded-xl border border-sand bg-parchment/60 p-5 space-y-3 text-xs text-steel">
            <h4 className="font-bold text-ink-black">How Settle Up Works</h4>
            <ol className="space-y-2 pl-4 list-decimal leading-relaxed">
              <li>Debts are consolidated into minimal transfers using greedy graph reduction.</li>
              <li>Settle directly with your peer using Google Pay, PhonePe, or cash.</li>
              <li>Mark the transfer complete to record immutable settlement proof.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
