import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import Avatar from "../../components/Avatar";
import {
  IconCopy,
  IconCheck,
  IconUsers,
  IconReceipt,
  IconSparkles,
  IconArrowUpRight,
  IconLogOut,
  IconShield,
} from "../../components/Icons";
import { apiClient } from "../../api/client";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [friendCount, setFriendCount] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Load friend count to populate dashboard metrics
  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadStats() {
      try {
        const res = await apiClient("/friends");
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data.friends)) {
            setFriendCount(data.friends.length);
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

  async function handleLogout() {
    if (await logout()) {
      navigate("/login");
    }
  }

  const copyPocketId = async () => {
    if (!user?.pocket_id) return;
    try {
      await navigator.clipboard.writeText(user.pocket_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-12">
        <div className="rounded-[24px] border border-sand bg-parchment max-w-sm px-8 py-10 text-center space-y-4">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sand border-t-electric-blue" />
          <h2 className="text-xl font-bold tracking-tight text-ink-black">
            Loading your circle
          </h2>
          <p className="text-sm text-steel">Fetching your ledgers and profile.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4 sm:py-6">
      {/* 1. Header Profile Banner */}
      <header className="rounded-[24px] border border-sand bg-parchment grid gap-6 sm:grid-cols-[1fr_auto] items-center p-6 sm:p-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2">
            <span className="pc-badge pc-badge-dark text-xs">
              <IconSparkles size={12} className="text-electric-blue" />
              <span>Active Session</span>
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-black">
            Welcome back, {firstName}.
          </h1>
          <p className="max-w-xl text-sm sm:text-base font-normal text-steel leading-relaxed">
            Your personal financial ledger for friend expenses. Monitor active balances, connect
            with circle members, and audit calculations in real time.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/friends" className="pc-btn pc-btn-primary text-sm">
              <IconUsers size={16} />
              <span>Manage friends</span>
            </Link>
            <button onClick={handleLogout} className="pc-btn pc-btn-white text-sm">
              <IconLogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* Pocket ID Passport Chip */}
        <div className="flex flex-col items-center sm:items-end gap-3">
          <Avatar name={user.name} url={user.avatar_url} size="xl" />
          <div className="rounded-[16px] border border-sand bg-paper-white px-4 py-2.5 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">
              Your Pocket ID
            </p>
            <div className="flex items-center gap-2.5 mt-1">
              <span className="font-mono text-base font-bold tracking-widest text-ink-black">
                {user.pocket_id}
              </span>
              <button
                onClick={copyPocketId}
                className="grid h-7 w-7 place-items-center rounded-full bg-parchment hover:bg-sand transition text-ink-black"
                title="Copy Pocket ID"
                aria-label="Copy Pocket ID"
              >
                {copied ? (
                  <IconCheck size={14} className="text-electric-blue" />
                ) : (
                  <IconCopy size={14} />
                )}
              </button>
            </div>
            {copied && (
              <span className="block text-[11px] font-medium text-electric-blue mt-0.5">
                Copied to clipboard
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 2. Metrics Ribbon */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-sand bg-paper-white p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-steel">
              Friends Linked
            </p>
            <p className="pc-stat-number text-3xl font-bold">
              {friendCount !== null ? friendCount : "..."}
            </p>
            <p className="text-xs text-steel">Verified circle members</p>
          </div>
          <div className="pc-icon-tile-soft">
            <IconUsers size={20} />
          </div>
        </div>

        <div className="rounded-[24px] border border-sand bg-paper-white p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-steel">
              Active Groups
            </p>
            <p className="pc-stat-number text-3xl font-bold">0</p>
            <p className="text-xs text-steel">Trips &amp; shared ledgers</p>
          </div>
          <div className="pc-icon-tile-soft">
            <IconReceipt size={20} />
          </div>
        </div>

        <div className="rounded-[24px] border border-sand bg-paper-white p-6 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-steel">
              Net Balance
            </p>
            <p className="pc-stat-number text-3xl font-bold">₹0.00</p>
            <p className="text-xs text-steel">Settled up cleanly</p>
          </div>
          <div className="pc-icon-tile-soft">
            <IconShield size={20} />
          </div>
        </div>
      </section>

      {/* 3. Dashboard Main Grid */}
      <div className="grid gap-8 md:grid-cols-3">
        {/* Left Column: Member Profile Passport */}
        <aside className="rounded-[24px] border border-sand bg-parchment p-6 space-y-6 md:col-span-1">
          <div className="border-b border-sand pb-4">
            <h2 className="text-lg font-bold tracking-tight text-ink-black">Member Profile</h2>
            <p className="text-xs text-steel">Identification credentials</p>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-steel">Full Name</p>
              <p className="font-semibold text-ink-black mt-0.5">{user.name}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-steel">Username</p>
              <p className="font-semibold text-ink-black mt-0.5">@{user.username ?? "member"}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-steel">Email</p>
              <p className="font-medium text-ink-black break-all mt-0.5">{user.email}</p>
            </div>

            {/* Shareable ID Pill Container */}
            <div className="rounded-[18px] border border-sand bg-paper-white p-4 space-y-2 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-steel">
                Your Shareable Pocket ID
              </p>
              <p className="font-mono text-xl font-bold tracking-widest text-ink-black">
                {user.pocket_id}
              </p>
              <button
                onClick={copyPocketId}
                className="mt-1 pc-btn pc-btn-subtle text-xs py-1 px-3 h-8"
              >
                {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                <span>{copied ? "Copied!" : "Copy Pocket ID"}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Right Column: Actions, Next Feature, and Ledger */}
        <div className="md:col-span-2 space-y-6">
          {/* Step 1: Friends Quick Link Card */}
          <article className="rounded-[24px] border border-sand bg-paper-white p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="pc-badge pc-badge-blue text-xs">Step 1</span>
              <h3 className="text-xl font-bold tracking-tight text-ink-black">
                Connect with your friends
              </h3>
              <p className="text-sm font-normal text-steel max-w-md">
                Search for friends using their 10-digit numeric Pocket ID or username to prepare your
                expense circle.
              </p>
            </div>
            <Link to="/friends" className="pc-btn pc-btn-primary shrink-0 text-sm">
              <span>Friends list</span>
              <IconArrowUpRight size={16} />
            </Link>
          </article>

          {/* Groups Milestone (F8) */}
          <article className="rounded-[24px] border border-sand bg-parchment p-6 sm:p-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="pc-badge pc-badge-soft bg-paper-white text-xs">
                Milestone F8 · Next Feature
              </span>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-steel">
                In Development
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-black">
              Group ledgers coming soon
            </h3>
            <p className="text-sm text-steel leading-relaxed">
              Once your friend circle is linked, you&apos;ll be able to launch dedicated group
              ledgers for vacations, shared rentals, and dinners with multi-payer splits and exact
              decimal resolution.
            </p>
            <div className="pt-1">
              <Link to="/friends" className="pc-btn pc-btn-white text-xs">
                Add friends now to be ready
              </Link>
            </div>
          </article>

          {/* Activity Ledger Audit Log Placeholder */}
          <section className="rounded-[24px] border border-sand bg-paper-white p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-sand pb-4">
              <div className="flex items-center gap-2.5">
                <IconReceipt size={18} className="text-electric-blue" />
                <h3 className="text-lg font-bold tracking-tight text-ink-black">
                  Recent Ledger Activity
                </h3>
              </div>
              <span className="font-mono text-xs text-steel">Audit Log</span>
            </div>

            <div className="rounded-[18px] bg-parchment p-8 text-center space-y-2">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-paper-white text-steel">
                <IconReceipt size={22} />
              </span>
              <p className="font-semibold text-sm text-ink-black">No transactions recorded yet.</p>
              <p className="text-xs text-steel max-w-sm mx-auto">
                Every balance change will be logged here with immutable timestamps and payer breakdown.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
