import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { HomeSkeleton } from "../../components/skeletons";
import { useDocumentTitle } from "../../utils/useDocumentTitle";

interface ExpenseItem {
  id: string;
  title: string;
  payer: string;
  amount: number;
  participants: string[];
}

export default function HomePage() {
  const { user, loading } = useAuth();
  useDocumentTitle("Shared Ledger for Circles of Trust");

  // Interactive Live Settlement Engine Demonstration
  const [activeTab, setActiveTab] = useState<"simplified" | "raw">("simplified");
  const [hasExtraExpense, setHasExtraExpense] = useState(false);

  // If session is resolving, show layout skeleton
  if (loading) {
    return <HomeSkeleton />;
  }

  // Authenticated users go straight to their active dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const baseExpenses: ExpenseItem[] = [
    {
      id: "exp-1",
      title: "Mountain Villa Booking (3 Nights)",
      payer: "Maya",
      amount: 18400,
      participants: ["Maya", "Dhruv", "Kabir", "Tara"],
    },
    {
      id: "exp-2",
      title: "Groceries & Campfire Wood",
      payer: "Dhruv",
      amount: 4200,
      participants: ["Maya", "Dhruv", "Kabir", "Tara"],
    },
    {
      id: "exp-3",
      title: "Highway Fuel & Fastag Tolls",
      payer: "Kabir",
      amount: 2600,
      participants: ["Maya", "Dhruv", "Kabir", "Tara"],
    },
  ];

  const extraExpense: ExpenseItem = {
    id: "exp-4",
    title: "Riverside Dinner & Drinks",
    payer: "Tara",
    amount: 3600,
    participants: ["Maya", "Dhruv", "Kabir", "Tara"],
  };

  const currentExpenses = hasExtraExpense
    ? [...baseExpenses, extraExpense]
    : baseExpenses;

  const totalSpent = currentExpenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="flex flex-col gap-24 sm:gap-32 py-6 sm:py-10">
      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION: Intentional Asymmetry & Functional Focal Point
          Left: Direct, honest headline and single primary CTA
          Right: Interactive Live Settlement Inspector
          ───────────────────────────────────────────────────────────── */}
      <section className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 pt-2">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="font-['Cal_Sans',-apple-system,sans-serif] text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold text-ink-black tracking-tight leading-[1.08]">
              Shared expenses, settled without ambiguity.
            </h1>
            <p className="max-w-xl text-base sm:text-lg font-normal leading-relaxed text-steel">
              PocketCircle is an exact peer ledger for trips, flats, and circles of friends.
              Log expenses across multiple payers with deterministic single-paisa math, simplify
              complex group debts into minimal transfers, and settle directly on UPI or cash.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <div>
              <Link
                to="/login"
                className="pc-btn pc-btn-primary inline-flex h-11 items-center justify-center px-6 text-sm font-medium tracking-tight rounded-sm"
              >
                Open a Circle
              </Link>
            </div>
            <p className="text-xs text-steel">
              Free to use. Settle directly through UPI or cash. No proprietary wallet lock-in.
            </p>
          </div>
        </div>

        {/* HERO FOCAL POINT: Interactive Live Settlement Machine */}
        <div className="border border-sand bg-paper-white shadow-xs">
          {/* Card Header Bar */}
          <div className="border-b border-sand px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-parchment/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-ink-black">
                  Manali Cabin &amp; Trek
                </span>
                <span className="font-mono text-[11px] text-steel">#4902-TRIP</span>
              </div>
              <p className="text-xs text-steel mt-0.5">
                4 members &bull; ₹{totalSpent.toLocaleString("en-IN")}.00 total logged
              </p>
            </div>

            <button
              type="button"
              onClick={() => setHasExtraExpense((prev) => !prev)}
              className="text-xs font-medium text-ink-black border border-sand bg-paper-white px-2.5 py-1 hover:bg-parchment transition self-start sm:self-auto rounded-xs"
            >
              {hasExtraExpense ? "Reset sample bill" : "+ Add dinner bill (₹3,600)"}
            </button>
          </div>

          {/* Logged Expenses Sheet */}
          <div className="p-5 border-b border-sand space-y-2.5">
            <p className="text-xs font-medium text-steel">Recorded Expenses</p>
            <div className="space-y-1.5">
              {currentExpenses.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-parchment/30 border border-sand/60"
                >
                  <div className="space-y-0.5">
                    <span className="font-medium text-ink-black">{item.title}</span>
                    <span className="block text-[11px] text-steel">
                      Paid by {item.payer} &bull; Split 4 ways
                    </span>
                  </div>
                  <span className="font-mono font-medium text-ink-black tabular-nums">
                    ₹{item.amount.toLocaleString("en-IN")}.00
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Mode Toggle: Raw Debts vs Greedy Resolution */}
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-sand pb-3">
              <span className="text-xs font-semibold text-ink-black">Settlement Engine</span>
              <div className="flex items-center border border-sand bg-parchment p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("simplified")}
                  className={`px-3 py-1 text-xs font-medium transition ${
                    activeTab === "simplified"
                      ? "bg-paper-white text-ink-black shadow-xs font-semibold"
                      : "text-steel hover:text-ink-black"
                  }`}
                >
                  PocketCircle Greedy (N-1)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("raw")}
                  className={`px-3 py-1 text-xs font-medium transition ${
                    activeTab === "raw"
                      ? "bg-paper-white text-ink-black shadow-xs font-semibold"
                      : "text-steel hover:text-ink-black"
                  }`}
                >
                  Unsimplified Debts
                </button>
              </div>
            </div>

            {activeTab === "simplified" ? (
              <div className="space-y-3">
                <p className="text-xs text-steel">
                  Our algorithm collapses circular obligations into the fewest direct transfers.
                  Every member reaches zero balance.
                </p>

                <div className="space-y-2">
                  {!hasExtraExpense ? (
                    <>
                      <div className="flex items-center justify-between p-3 border border-emerald-900/10 bg-emerald-50/60 text-xs">
                        <div>
                          <span className="font-semibold text-ink-black">Tara &rarr; Maya</span>
                          <span className="block text-[11px] text-steel">Full share settlement</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-900 tabular-nums">
                          ₹6,300.00
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-emerald-900/10 bg-emerald-50/60 text-xs">
                        <div>
                          <span className="font-semibold text-ink-black">Kabir &rarr; Maya</span>
                          <span className="block text-[11px] text-steel">Difference after fuel</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-900 tabular-nums">
                          ₹3,700.00
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-emerald-900/10 bg-emerald-50/60 text-xs">
                        <div>
                          <span className="font-semibold text-ink-black">Dhruv &rarr; Maya</span>
                          <span className="block text-[11px] text-steel">Difference after groceries</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-900 tabular-nums">
                          ₹2,100.00
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between p-3 border border-emerald-900/10 bg-emerald-50/60 text-xs">
                        <div>
                          <span className="font-semibold text-ink-black">Tara &rarr; Maya</span>
                          <span className="block text-[11px] text-steel">Adjusted after dinner payment</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-900 tabular-nums">
                          ₹3,600.00
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-emerald-900/10 bg-emerald-50/60 text-xs">
                        <div>
                          <span className="font-semibold text-ink-black">Kabir &rarr; Maya</span>
                          <span className="block text-[11px] text-steel">Share settlement</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-900 tabular-nums">
                          ₹4,600.00
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-emerald-900/10 bg-emerald-50/60 text-xs">
                        <div>
                          <span className="font-semibold text-ink-black">Dhruv &rarr; Maya</span>
                          <span className="block text-[11px] text-steel">Share settlement</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-900 tabular-nums">
                          ₹3,000.00
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-sand flex items-center justify-between text-xs text-steel">
                  <span>3 transfers total</span>
                  <span className="font-mono text-ink-black">Net group balance: ₹0.00</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-steel">
                  Without simplification, 4 people would have to execute 6 separate cross-payments back and forth:
                </p>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between py-1.5 px-2.5 border border-sand bg-parchment/20">
                    <span className="text-steel">Dhruv owes Maya</span>
                    <span className="font-mono tabular-nums text-ink-black">₹4,600.00</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 border border-sand bg-parchment/20">
                    <span className="text-steel">Kabir owes Maya</span>
                    <span className="font-mono tabular-nums text-ink-black">₹4,600.00</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 border border-sand bg-parchment/20">
                    <span className="text-steel">Tara owes Maya</span>
                    <span className="font-mono tabular-nums text-ink-black">₹4,600.00</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 border border-sand bg-parchment/20">
                    <span className="text-steel">Maya owes Dhruv</span>
                    <span className="font-mono tabular-nums text-ink-black">₹1,050.00</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 border border-sand bg-parchment/20">
                    <span className="text-steel">Kabir owes Dhruv</span>
                    <span className="font-mono tabular-nums text-ink-black">₹1,050.00</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-2.5 border border-sand bg-parchment/20">
                    <span className="text-steel">Maya owes Kabir</span>
                    <span className="font-mono tabular-nums text-ink-black">₹650.00</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-sand flex items-center justify-between text-xs text-rose-700">
                  <span>6 redundant transactions</span>
                  <span>Confusing and error-prone</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          2. ANATOMY OF A CLEAN LEDGER: Asymmetric Architectural Units
          No repetitive 3-column cards with icons inside squares!
          ───────────────────────────────────────────────────────────── */}
      <section className="space-y-8">
        <div className="max-w-2xl space-y-2">
          <h2 className="font-['Cal_Sans',-apple-system,sans-serif] text-2xl sm:text-3xl font-semibold text-ink-black tracking-tight">
            The mechanics of deterministic accounting.
          </h2>
          <p className="text-base text-steel">
            Every design decision in PocketCircle is built around mathematical rigor and privacy,
            not advertising engagement or proprietary wallet deposits.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-stretch">
          {/* Unit 1: Single-Paisa Integer Math (Large 7 columns) */}
          <div className="lg:col-span-7 border border-sand bg-paper-white p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-ink-black">
                Deterministic paisa allocation
              </h3>
              <p className="text-sm text-steel leading-relaxed">
                Most split apps use binary floating-point numbers. Dividing ₹1,000 across 3 people produces
                an endless <code className="font-mono text-xs bg-parchment px-1.5 py-0.5 text-ink-black">0.3333333333...</code> float,
                accumulating rounding drift that makes circles impossible to zero out. PocketCircle uses
                fixed-point integers in backend storage. Odd remainders are deterministically distributed
                so that sum of debits exactly matches sum of credits to the single paisa.
              </p>
            </div>

            {/* Visual Math Specimen */}
            <div className="border border-sand bg-parchment/50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-steel border-b border-sand pb-2">
                <span>Transaction: ₹1,000.00 split 3 ways</span>
                <span className="font-mono text-ink-black">100,000 paisa</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-ink-black">
                <div className="p-2 border border-sand bg-paper-white">
                  <span className="block text-[11px] text-steel font-sans">Member 1</span>
                  <span className="font-semibold">₹333.34</span>
                  <span className="block text-[10px] text-steel mt-0.5">+1p remainder</span>
                </div>
                <div className="p-2 border border-sand bg-paper-white">
                  <span className="block text-[11px] text-steel font-sans">Member 2</span>
                  <span className="font-semibold">₹333.33</span>
                  <span className="block text-[10px] text-steel mt-0.5">exact base</span>
                </div>
                <div className="p-2 border border-sand bg-paper-white">
                  <span className="block text-[11px] text-steel font-sans">Member 3</span>
                  <span className="font-semibold">₹333.33</span>
                  <span className="block text-[10px] text-steel mt-0.5">exact base</span>
                </div>
              </div>
              <div className="text-right text-xs font-mono text-emerald-800 pt-1">
                Total: ₹1,000.00 (Zero discrepancy)
              </div>
            </div>
          </div>

          {/* Unit 2: Private 10-Digit Pocket IDs (5 columns) */}
          <div className="lg:col-span-5 border border-sand bg-paper-white p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-ink-black">
                Isolated 10-digit Pocket IDs
              </h3>
              <p className="text-sm text-steel leading-relaxed">
                You should not have to hand over your personal phone number or grant full contact-book
                access to split an Uber or dinner with acquaintances. Each PocketCircle member holds a
                clean, unguessable 10-digit ID.
              </p>
            </div>

            {/* Specimen Tag */}
            <div className="border border-sand bg-parchment/50 p-5 space-y-3">
              <span className="text-xs text-steel">Member Identifier</span>
              <div className="flex items-center justify-between border border-sand bg-paper-white p-3 font-mono text-sm font-semibold text-ink-black tracking-wider">
                <span>9481-2049-18</span>
                <span className="text-[11px] font-sans font-normal text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-steel">
                No phone number exposed. No contact scraping.
              </p>
            </div>
          </div>

          {/* Unit 3: Zero-Custody Direct UPI Settlement (Full 12 columns) */}
          <div className="lg:col-span-12 border border-sand bg-paper-white p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[1fr_1.2fr] items-center">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-ink-black">
                  Zero wallet lock-in, zero holding escrow
                </h3>
                <p className="text-sm text-steel leading-relaxed">
                  Traditional payment apps hold your money in proprietary wallets to capture interest
                  and charge withdrawal fees. PocketCircle is strictly a ledger. We tell you who owes who,
                  and you pay directly through your own bank or UPI app with one confirmation click.
                </p>
              </div>

              {/* Direct Flow Graphic */}
              <div className="border border-sand bg-parchment/40 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-steel pb-1">
                  <span>Settlement path</span>
                  <span className="text-ink-black font-medium">Direct Peer-to-Peer</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-3 border border-sand bg-paper-white space-y-1">
                    <span className="text-[11px] text-steel block">1. Solver Output</span>
                    <span className="font-semibold text-ink-black block">Alex pays Maya ₹4,200</span>
                  </div>
                  <div className="p-3 border border-sand bg-paper-white space-y-1">
                    <span className="text-[11px] text-steel block">2. Direct Payment</span>
                    <span className="font-semibold text-ink-black block">Google Pay / UPI / Cash</span>
                  </div>
                  <div className="p-3 border border-sand bg-paper-white space-y-1">
                    <span className="text-[11px] text-steel block">3. Ledger Confirmation</span>
                    <span className="font-semibold text-emerald-800 block">Balance clears to ₹0.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. DIRECT COMPARISON: An Editorial Ledger vs Walled Gardens
          Structured table, not generic red/green sales cards.
          ───────────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="max-w-2xl space-y-2">
          <h2 className="font-['Cal_Sans',-apple-system,sans-serif] text-2xl sm:text-3xl font-semibold text-ink-black tracking-tight">
            Engineered as a utility, not an ad platform.
          </h2>
          <p className="text-base text-steel">
            How PocketCircle compares to mainstream bill-splitting applications:
          </p>
        </div>

        <div className="border border-sand bg-paper-white overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-sand bg-parchment/60 text-ink-black">
                <th className="py-3.5 px-4 font-semibold w-1/4">Capability</th>
                <th className="py-3.5 px-4 font-semibold text-steel w-3/8">Traditional Split Apps</th>
                <th className="py-3.5 px-4 font-semibold text-ink-black w-3/8">PocketCircle Ledger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand text-steel">
              <tr>
                <td className="py-3.5 px-4 font-medium text-ink-black">Money Custody</td>
                <td className="py-3.5 px-4">Locks money in proprietary wallets with delayed withdrawals</td>
                <td className="py-3.5 px-4 font-medium text-ink-black">Zero custody. You pay friends directly via existing UPI or cash</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-ink-black">Phone Privacy</td>
                <td className="py-3.5 px-4">Demands full address-book access; reveals phone numbers to all members</td>
                <td className="py-3.5 px-4 font-medium text-ink-black">10-digit numeric Pocket IDs. Zero address book scraping</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-ink-black">Rounding Precision</td>
                <td className="py-3.5 px-4">Floating-point division leads to unsolvable fractional paisa drift</td>
                <td className="py-3.5 px-4 font-medium text-ink-black">Integer-paisa remainder allocation guarantees exact zero-sum balance</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-ink-black">Debt Simplification</td>
                <td className="py-3.5 px-4">Leaves pairwise debts unsimplified or charges for &quot;Pro&quot; optimization</td>
                <td className="py-3.5 px-4 font-medium text-ink-black">Greedy bipartite solver compresses debts into &le; N-1 transfers by default</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-ink-black">Business Model</td>
                <td className="py-3.5 px-4">Ad banners, credit card upsells, and subscription paywalls</td>
                <td className="py-3.5 px-4 font-medium text-ink-black">Free, quiet utility with zero advertising and zero transaction fees</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. AUDIT TRAIL: Verifiable Record for Group Trust
          Shows real transaction logging and settlement auditability.
          ───────────────────────────────────────────────────────────── */}
      <section className="border border-sand bg-paper-white p-6 sm:p-10 space-y-6">
        <div className="max-w-xl space-y-2">
          <h2 className="font-['Cal_Sans',-apple-system,sans-serif] text-2xl font-semibold text-ink-black tracking-tight">
            An append-only audit trail.
          </h2>
          <p className="text-sm text-steel">
            Every bill recorded, split adjusted, or settlement confirmed is permanently documented.
            No mystery edits or forgotten payments.
          </p>
        </div>

        <div className="border border-sand divide-y divide-sand text-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-parchment/30 gap-1">
            <div className="flex items-center gap-2">
              <span className="text-steel">10:14 AM</span>
              <span className="font-semibold text-ink-black">EXPENSE_LOGGED</span>
              <span className="text-steel font-sans">Cabin Advance by Maya</span>
            </div>
            <div className="text-ink-black">
              <span>₹18,400.00</span>
              <span className="text-steel font-sans ml-2">(4 participants)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-paper-white gap-1">
            <div className="flex items-center gap-2">
              <span className="text-steel">01:40 PM</span>
              <span className="font-semibold text-ink-black">EXPENSE_LOGGED</span>
              <span className="text-steel font-sans">Groceries by Dhruv</span>
            </div>
            <div className="text-ink-black">
              <span>₹4,200.00</span>
              <span className="text-steel font-sans ml-2">(4 participants)</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-paper-white gap-1">
            <div className="flex items-center gap-2">
              <span className="text-steel">08:20 PM</span>
              <span className="font-semibold text-emerald-800">SETTLEMENT_RECORDED</span>
              <span className="text-steel font-sans">Tara &rarr; Maya (UPI Ref #839102)</span>
            </div>
            <div className="text-emerald-800 font-semibold">
              <span>₹6,300.00 confirmed</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-parchment/60 font-sans text-xs">
            <span className="text-steel">Integrity Check</span>
            <span className="font-mono text-ink-black font-semibold">
              Invariant Verified &bull; &sum;(Debits - Credits) = 0.00
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. CLOSING ACTION: Quiet Confidence, Zero Hype
          ───────────────────────────────────────────────────────────── */}
      <section className="border border-sand bg-parchment/50 p-8 sm:p-12 space-y-6">
        <div className="max-w-xl space-y-3">
          <h2 className="font-['Cal_Sans',-apple-system,sans-serif] text-2xl sm:text-3xl font-semibold text-ink-black tracking-tight">
            Ready for a clean ledger?
          </h2>
          <p className="text-sm sm:text-base text-steel leading-relaxed">
            Create a circle for your upcoming vacation, shared flat, or group dinner.
            Experience split calculations that work down to the exact paisa.
          </p>
        </div>

        <div>
          <Link
            to="/login?mode=register"
            className="pc-btn pc-btn-primary inline-flex h-11 items-center justify-center px-7 text-sm font-medium tracking-tight rounded-sm"
          >
            Create an Account
          </Link>
        </div>
      </section>
    </div>
  );
}
