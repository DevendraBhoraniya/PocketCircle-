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
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-12">
        <div className="pc-sticker-card pc-sticker-cyan max-w-sm px-8 py-10 text-center space-y-4">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-black bg-toxic-lime shadow-[2px_2px_0_#000]" />
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
            LOADING CIRCLE...
          </h2>
          <p className="text-sm font-medium text-black">Fetching your ledgers and profile.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      {/* Header Profile Banner */}
      <header className="pc-sticker-card pc-sticker-khaki grid gap-6 sm:grid-cols-[1fr_auto] items-center p-6 sm:p-8">
        <div className="space-y-3">
          <span className="pc-kicker">
            <IconSparkles size={12} />
            Active Session
          </span>
          <h1 className="pc-section-title text-black">
            HEY, {firstName.toUpperCase()}.
          </h1>
          <p className="max-w-xl text-sm sm:text-base font-medium text-black leading-relaxed">
            Welcome to your shared expense command center. Check balances, organize trips, and manage friend circles.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleLogout}
              className="pc-btn pc-btn-white text-xs"
            >
              <IconLogOut size={14} />
              <span>Sign out</span>
            </button>
            <Link to="/friends" className="pc-btn pc-btn-primary text-xs">
              <IconUsers size={14} />
              <span>Find friends</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-end gap-3">
          <Avatar name={user.name} url={user.avatar_url} size="xl" />
          <div className="rounded-[16px] border border-black bg-card-white px-4 py-2 text-center shadow-[2px_2px_0_#000]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-hairline-smoke">Your Pocket ID</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-lg font-black tracking-wider text-black">{user.pocket_id}</span>
              <button
                onClick={copyPocketId}
                className="grid h-6 w-6 place-items-center rounded border border-black bg-toxic-lime hover:bg-[#9ee602] transition"
                title="Copy Pocket ID"
                aria-label="Copy Pocket ID"
              >
                {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
              </button>
            </div>
            {copied && <span className="block text-[10px] font-bold text-black mt-1">Copied to clipboard!</span>}
          </div>
        </div>
      </header>

      {/* Metrics Strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[18px] border border-black bg-card-white p-5 shadow-[2px_2px_0_#000] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-hairline-smoke">Friends Linked</p>
            <p className="font-display text-3xl font-black text-black mt-1">
              {friendCount !== null ? friendCount : "..."}
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-black bg-voltage-cyan text-black">
            <IconUsers size={20} />
          </span>
        </div>

        <div className="rounded-[18px] border border-black bg-card-white p-5 shadow-[2px_2px_0_#000] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-hairline-smoke">Active Groups</p>
            <p className="font-display text-3xl font-black text-black mt-1">0</p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-black bg-riot-pink text-black">
            <IconReceipt size={20} />
          </span>
        </div>

        <div className="rounded-[18px] border border-black bg-card-white p-5 shadow-[2px_2px_0_#000] flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-hairline-smoke">Net Balance</p>
            <p className="font-display text-3xl font-black text-black mt-1">₹0.00</p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-black bg-toxic-lime text-black font-black text-sm">
            ALL GOOD
          </span>
        </div>
      </section>

      {/* Dashboard Main Grid */}
      <div className="grid gap-8 md:grid-cols-3">
        {/* Left Column: Profile Passport */}
        <aside className="pc-sticker-card space-y-5 md:col-span-1">
          <div className="border-b border-black pb-3">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-black">
              MEMBER PROFILE
            </h2>
            <p className="text-xs text-hairline-smoke">Public identification details</p>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-hairline-smoke">Full Name</p>
              <p className="font-bold text-black mt-0.5">{user.name}</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-hairline-smoke">Username</p>
              <p className="font-bold text-black mt-0.5">@{user.username ?? "member"}</p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-hairline-smoke">Email</p>
              <p className="font-medium text-black break-all mt-0.5">{user.email}</p>
            </div>

            <div className="rounded-[16px] border border-black bg-toxic-lime p-4 text-center space-y-1 shadow-[2px_2px_0_#000]">
              <p className="text-[10px] font-black uppercase tracking-widest text-black">Your Shareable Pocket ID</p>
              <p className="font-mono text-xl font-black tracking-widest text-black">{user.pocket_id}</p>
              <button
                onClick={copyPocketId}
                className="mt-2 inline-flex items-center gap-1.5 rounded-[12px] border border-black bg-card-white px-3 py-1 text-xs font-bold text-black hover:bg-paper-cream transition shadow-[1px_1px_0_#000]"
              >
                {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                <span>{copied ? "Copied!" : "Copy Pocket ID"}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Right Column: Circles, Next Feature, and Ledger */}
        <div className="md:col-span-2 space-y-6">
          {/* Friends Quick Link Card */}
          <article className="pc-sticker-card pc-sticker-cyan flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="pc-kicker bg-card-white text-black mb-2">Step 1</span>
              <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black">
                BUILD YOUR CIRCLE
              </h3>
              <p className="text-sm font-medium text-black mt-1">
                Link with your friends using their 10-digit Pocket ID before creating groups.
              </p>
            </div>
            <Link to="/friends" className="pc-btn pc-btn-primary shrink-0">
              <span>Friends list</span>
              <IconArrowUpRight size={16} />
            </Link>
          </article>

          {/* Groups Coming Soon Card (Milestone F8) */}
          <article className="pc-sticker-card pc-sticker-pink p-6 text-black space-y-3">
            <div className="flex items-center justify-between">
              <span className="pc-kicker bg-card-white text-black">Next Milestone · F8</span>
              <span className="font-mono text-xs font-black uppercase tracking-wider">In Progress</span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
              GROUP LEDGERS COMING NEXT
            </h3>
            <p className="text-sm font-medium text-black leading-relaxed">
              Once you and your friends are linked, you'll be able to create shared circles for trips, room expenses, and dinners with multi-payer splits and zero-remainder decimal math.
            </p>
            <div className="pt-2">
              <Link to="/friends" className="pc-btn pc-btn-white text-xs">
                Add friends now so you're ready
              </Link>
            </div>
          </article>

          {/* Activity Ledger Mock */}
          <section className="pc-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#555] pb-3">
              <div className="flex items-center gap-2">
                <IconReceipt size={18} />
                <h3 className="font-display text-xl font-black uppercase tracking-tight text-white">
                  RECENT LEDGER ACTIVITY
                </h3>
              </div>
              <span className="font-mono text-xs text-[#aaa]">AUDIT LOGS</span>
            </div>

            <div className="rounded-[16px] border border-black bg-card-white p-6 text-center text-black space-y-2 shadow-[2px_2px_0_#000]">
              <span className="inline-block rounded-full border border-black bg-paper-cream p-3">
                <IconReceipt size={24} className="text-hairline-smoke" />
              </span>
              <p className="font-bold text-base text-black">No expenses recorded yet.</p>
              <p className="text-xs text-hairline-smoke max-w-sm mx-auto">
                Once group ledgers are initialized, every balance-affecting action will appear here with an immutable timestamp.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
