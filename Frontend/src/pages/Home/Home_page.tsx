import { Link } from "react-router-dom";
import { IconArrowUpRight, IconShield, IconUsers, IconReceipt, IconSparkles } from "../../components/Icons";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-20 sm:gap-28 py-6">
      {/* Hero Section */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2">
            <span className="pc-kicker">
              <IconSparkles size={13} />
              Open Ledger for Friends
            </span>
          </div>

          <h1 className="pc-display text-black">
            SPLIT<br />
            WITH YOUR<br />
            <span className="inline-block -rotate-2 rounded-[18px] border border-black bg-riot-pink px-4 py-1 text-black shadow-[3px_3px_0_#000]">
              CIRCLE.
            </span>
          </h1>

          <p className="max-w-xl text-lg sm:text-xl font-medium leading-relaxed text-black">
            The no-nonsense shared expense ledger for roommates, trips, and weekend plans.
            Track who paid, see exact balances, and settle up externally on your own terms.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link to="/login" className="pc-btn pc-btn-primary min-h-[48px] px-6 text-base">
              <span>Start your circle</span>
              <IconArrowUpRight size={18} />
            </Link>
            <Link to="/login" className="pc-btn pc-btn-white min-h-[48px] px-6 text-base">
              <span>Join with Pocket ID</span>
            </Link>
          </div>
        </div>

        {/* Hero Interactive Ledger Preview Card */}
        <div className="relative">
          {/* Background offset frame for peeled sticker aesthetic */}
          <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[24px] border border-black bg-color-hardware-ink opacity-15" />

          <article className="relative rounded-[24px] border border-black bg-card-white p-6 sm:p-7 shadow-[4px_4px_0_#000]">
            {/* Header chip */}
            <div className="flex items-center justify-between border-b border-black pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-full border border-black bg-voltage-cyan text-xs font-black">
                  ₹
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-hairline-smoke">
                  LEDGER #84920
                </span>
              </div>
              <span className="rounded-full border border-black bg-toxic-lime px-2.5 py-0.5 text-[11px] font-black uppercase">
                Active Group
              </span>
            </div>

            {/* Bill Title */}
            <div className="mt-5 space-y-1">
              <h2 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
                GOA VILLA & DINNER
              </h2>
              <p className="text-xs font-medium text-hairline-smoke">4 members · Split equally · 0 paisa remainder</p>
            </div>

            {/* Visual Breakdown Rows */}
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center justify-between rounded-[14px] border border-black bg-paper-cream p-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full border border-black bg-riot-pink text-[10px] font-black text-black">
                    DB
                  </span>
                  <div>
                    <p className="font-bold text-black leading-tight">Devendra</p>
                    <p className="text-[11px] text-hairline-smoke">Paid ₹16,000 upfront</p>
                  </div>
                </div>
                <span className="font-mono font-black text-black">+₹12,000</span>
              </div>

              <div className="flex items-center justify-between rounded-[14px] border border-black bg-card-white p-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-6 w-6 place-items-center rounded-full border border-black bg-voltage-cyan text-[10px] font-black text-black">
                    NF
                  </span>
                  <div>
                    <p className="font-bold text-black leading-tight">Null Forge</p>
                    <p className="text-[11px] text-hairline-smoke">Owes Devendra</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-hairline-smoke">-₹4,000</span>
              </div>
            </div>

            {/* Bottom Callout */}
            <div className="mt-6 flex items-center justify-between rounded-[16px] border border-black bg-sticker-khaki p-3.5">
              <div className="flex items-center gap-2">
                <IconShield size={16} />
                <span className="text-xs font-bold text-black">Zero platform fee · Peer settlement</span>
              </div>
              <span className="font-mono text-xs font-black">100% Honest</span>
            </div>
          </article>
        </div>
      </section>

      {/* Feature Pillar Grid */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="pc-kicker">How it works</span>
            <h2 className="pc-section-title mt-2">
              FINANCE WITHOUT THE FRICTION.
            </h2>
          </div>
          <p className="max-w-md text-sm font-medium text-hairline-smoke leading-relaxed">
            PocketCircle strips out all the bloated fintech garbage. No virtual wallets. No ads. Just pure math for friends who trust each other.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1: Khaki */}
          <article className="pc-sticker-card pc-sticker-khaki flex flex-col justify-between gap-6 min-h-[260px]">
            <div>
              <div className="inline-flex -rotate-3 rounded-full border border-black bg-toxic-lime p-2.5 shadow-[1px_1px_0_#000]">
                <IconUsers size={22} />
              </div>
              <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black mt-4">
                01. Build your circle
              </h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-black">
                Find friends instantly using their unique 10-digit Pocket ID or username. Send a request, accept, and you're linked.
              </p>
            </div>
            <div className="border-t border-black/30 pt-3 text-xs font-mono font-bold uppercase tracking-wider text-black">
              Search by 10 digits
            </div>
          </article>

          {/* Card 2: Riot Pink */}
          <article className="pc-sticker-card pc-sticker-pink flex flex-col justify-between gap-6 min-h-[260px] md:-translate-y-3">
            <div>
              <div className="inline-flex rotate-3 rounded-full border border-black bg-card-white p-2.5 shadow-[1px_1px_0_#000]">
                <IconReceipt size={22} />
              </div>
              <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black mt-4">
                02. Multi-Payer Expenses
              </h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-black">
                Did two people split the groceries while three paid for cabs? Add multiple payers and custom splits in seconds.
              </p>
            </div>
            <div className="border-t border-black/30 pt-3 text-xs font-mono font-bold uppercase tracking-wider text-black">
              Deterministic decimal math
            </div>
          </article>

          {/* Card 3: Voltage Cyan */}
          <article className="pc-sticker-card pc-sticker-cyan flex flex-col justify-between gap-6 min-h-[260px]">
            <div>
              <div className="inline-flex -rotate-2 rounded-full border border-black bg-card-white p-2.5 shadow-[1px_1px_0_#000]">
                <IconSparkles size={22} />
              </div>
              <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black mt-4">
                03. Clean Settlements
              </h3>
              <p className="mt-2 text-sm font-medium leading-relaxed text-black">
                PocketCircle computes minimal transactions so debts cancel out. Pay each other via UPI or cash, confirm in one tap.
              </p>
            </div>
            <div className="border-t border-black/30 pt-3 text-xs font-mono font-bold uppercase tracking-wider text-black">
              Mutual confirmation
            </div>
          </article>
        </div>
      </section>

      {/* Dark Manifesto Section */}
      <section className="pc-panel p-8 sm:p-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-4">
            <span className="pc-kicker bg-voltage-cyan text-black">The PocketCircle Rule</span>
            <h2 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
              WE DON'T TOUCH YOUR MONEY.<br />
              WE SOLVE THE ARGUMENTS.
            </h2>
            <p className="max-w-2xl text-base text-[#e0e0e0] font-medium leading-relaxed">
              Traditional apps lock your funds in closed wallets, spam payment reminders, or charge processing percentages.
              PocketCircle is an immutable, shared paper notebook for the digital age. Transparent, fast, and respectful.
            </p>
          </div>
          <Link to="/login" className="pc-btn pc-btn-primary min-h-[48px] px-8 text-base">
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
