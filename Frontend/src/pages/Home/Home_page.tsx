import { Link } from "react-router-dom";
import {
  IconArrowUpRight,
  IconShield,
  IconUsers,
  IconReceipt,
  IconSparkles,
} from "../../components/Icons";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-16 sm:gap-24 py-4 sm:py-8">
      {/* 1. Hero Section (Two-Column on White) */}
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] pt-4">
        <div className="space-y-6">
          {/* Pre-headline Tagline Badge */}
          <div className="inline-flex items-center gap-2">
            <span className="pc-badge pc-badge-dark">
              <IconSparkles size={14} className="text-electric-blue" />
              <span>Fintech Ledger for Friend Circles</span>
            </span>
          </div>

          {/* Hero Headline with Signature Gambetta Italic Flourish */}
          <h1 className="pc-display text-ink-black">
            Shared expenses, <br className="hidden sm:inline" />
            settled with <br />
            <span className="pc-serif-flourish text-electric-blue">frictionless</span> clarity.
          </h1>

          {/* Subtitle */}
          <p className="max-w-xl text-lg sm:text-xl font-normal leading-relaxed text-steel">
            Banker&apos;s ledger accuracy meets effortless group trust. Track who paid, calculate
            exact debts with zero paisa remainder, and settle up externally on your own terms.
          </p>

          {/* Action CTAs (Ember Orange as the single conversion accent) */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link to="/login" className="pc-btn pc-btn-ember min-h-[48px] px-7 text-base shadow-sm">
              <span>Start your circle</span>
              <IconArrowUpRight size={18} />
            </Link>
            <Link to="/login" className="pc-btn pc-btn-ghost min-h-[48px] px-7 text-base">
              <span>Explore demo ledger</span>
            </Link>
          </div>

          <div className="flex items-center gap-6 pt-2 text-xs text-steel">
            <div className="flex items-center gap-2">
              <IconShield size={15} className="text-electric-blue" />
              <span>No bank login or UPI routing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-electric-blue" />
              <span>10-digit numeric Pocket IDs</span>
            </div>
          </div>
        </div>

        {/* Hero Credit Card Product Visual Showcase */}
        <div className="relative">
          <div className="rounded-[32px] border border-sand bg-parchment p-5 sm:p-7">
            {/* The Signature Dark Product Card Visual */}
            <div className="relative aspect-[1.586/1] w-full rounded-[24px] bg-ink-black p-6 sm:p-8 text-white overflow-hidden shadow-[0_12px_32px_rgba(27,29,32,0.18)]">
              {/* Product Card Gradient Overlay (Blue -> Orange -> Pink/Coral) */}
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-40 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(81,150,254,0.9) 0%, rgba(249,117,78,0.7) 60%, rgba(255,82,143,0.4) 100%)",
                }}
              />
              <div
                className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full opacity-25 blur-2xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(249,117,78,0.8) 0%, rgba(81,150,254,0.5) 100%)",
                }}
              />

              {/* Card Header */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full bg-electric-blue" />
                  <span className="font-semibold text-xs tracking-wider uppercase text-paper-white/80">
                    PocketCircle Ledger
                  </span>
                </div>
                <span className="pc-badge pc-badge-dark text-[11px] bg-graphite border border-white/10 text-white">
                  Active
                </span>
              </div>

              {/* Card Chip Visual */}
              <div className="relative z-10 mt-6 sm:mt-8 flex items-center gap-3">
                <div className="h-7 w-10 rounded-md border border-white/20 bg-white/10 flex items-center justify-center">
                  <div className="h-4 w-6 border-y border-white/30" />
                </div>
                <span className="font-mono text-xs tracking-widest text-white/60">
                  ID: 4892 0184 92
                </span>
              </div>

              {/* Card Footer / Balance Info */}
              <div className="relative z-10 mt-8 sm:mt-10 flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                    Ledger Pool
                  </p>
                  <p className="font-semibold text-lg sm:text-xl text-white">
                    Goa Villa &amp; Meals
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
                    Net Balance
                  </p>
                  <p className="font-mono font-bold text-xl sm:text-2xl text-paper-white">
                    +₹12,000.00
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-card ticker info */}
            <div className="mt-4 flex items-center justify-between px-2 text-xs text-steel">
              <span className="font-medium">Deterministic zero-remainder engine</span>
              <span className="font-mono text-ink-black font-semibold">4 members settled</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Stat Block Row (4-column row with thin vertical dividers) */}
      <section className="rounded-[24px] border border-sand bg-parchment p-8 sm:p-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="md:border-r md:border-sand md:pr-6 space-y-1">
            <p className="pc-stat-number">100%</p>
            <p className="text-sm font-normal text-steel">
              Mathematical accuracy with zero decimal round-off errors
            </p>
          </div>

          <div className="md:border-r md:border-sand md:pr-6 space-y-1">
            <p className="pc-stat-number">0.00%</p>
            <p className="text-sm font-normal text-steel">
              Platform transaction or settlement convenience fees
            </p>
          </div>

          <div className="md:border-r md:border-sand md:pr-6 space-y-1">
            <p className="pc-stat-number">10</p>
            <p className="text-sm font-normal text-steel">
              Digit numeric Pocket ID for instant phone-free connection
            </p>
          </div>

          <div className="space-y-1">
            <p className="pc-stat-number">&lt; 1s</p>
            <p className="text-sm font-normal text-steel">
              Instant balance recomputation across any split structure
            </p>
          </div>
        </div>
      </section>

      {/* 3. Dark Section Panel (Ink Black Contrast Break) */}
      <section className="pc-full-bleed-dark">
        <div className="pc-page space-y-8 text-center sm:text-left">
          <div className="max-w-3xl space-y-4">
            <span className="pc-badge pc-badge-dark bg-graphite text-white text-xs">
              The Ledger Philosophy
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              The financial system wasn&apos;t built for{" "}
              <span className="pc-serif-flourish text-electric-blue">friends</span> who trust each
              other.
            </h2>
            <p className="text-base sm:text-lg text-paper-white/80 font-normal leading-relaxed">
              Traditional apps lock your funds in walled wallets, delay settlements, and bombard you
              with payment spam. PocketCircle is an immutable, quiet ledger: you track the math,
              verify balances, and settle via whatever method you prefer.
            </p>
          </div>

          <div className="pt-2">
            <Link to="/login" className="pc-btn pc-btn-primary min-h-[46px] px-7 text-sm">
              Create your account in 30 seconds
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Full-Bleed Electric Blue Feature Section with 3-Column White Card Grid */}
      <section className="pc-full-bleed-blue">
        <div className="pc-page space-y-12">
          {/* Section Header */}
          <div className="space-y-3">
            <span className="pc-badge bg-white/20 text-white font-medium text-xs">
              Product Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Engineered for absolute clarity.
            </h2>
            <p className="max-w-2xl text-base text-white/90 font-normal">
              Every feature in PocketCircle is built around three core pillars: privacy,
              mathematical rigor, and zero friction.
            </p>
          </div>

          {/* 3-Column White Card Grid (24px radius, lifts purely by color contrast) */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Feature Card 1 */}
            <article className="rounded-[24px] bg-paper-white p-6 sm:p-8 space-y-5">
              <div className="pc-icon-tile">
                <IconUsers size={22} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-ink-black tracking-tight">
                  Numeric Pocket IDs
                </h3>
                <p className="text-sm font-normal text-steel leading-relaxed">
                  No need to share personal phone numbers or social profiles. Every user gets a
                  clean 10-digit ID to link friend circles securely.
                </p>
              </div>
            </article>

            {/* Feature Card 2 */}
            <article className="rounded-[24px] bg-paper-white p-6 sm:p-8 space-y-5">
              <div className="pc-icon-tile">
                <IconReceipt size={22} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-ink-black tracking-tight">
                  Multi-Payer Calculations
                </h3>
                <p className="text-sm font-normal text-steel leading-relaxed">
                  Split expenses between multiple spenders and consumers with exact decimal
                  precision and zero rounding discrepancy.
                </p>
              </div>
            </article>

            {/* Feature Card 3 */}
            <article className="rounded-[24px] bg-paper-white p-6 sm:p-8 space-y-5">
              <div className="pc-icon-tile">
                <IconShield size={22} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-ink-black tracking-tight">
                  Transparent Settlements
                </h3>
                <p className="text-sm font-normal text-steel leading-relaxed">
                  Debts simplify into minimal transactions so fewer payments happen. Settle via cash
                  or UPI and mark complete mutually.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 5. Pre-footer Conversion Banner */}
      <section className="rounded-[24px] border border-sand bg-parchment p-8 sm:p-12 text-center space-y-6">
        <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-ink-black">
          Ready to bring honesty back to your group bills?
        </h2>
        <p className="max-w-xl mx-auto text-base text-steel">
          Join friend groups who track vacations, apartment rent, and dinners without financial friction.
        </p>
        <div className="pt-2">
          <Link to="/login" className="pc-btn pc-btn-primary min-h-[48px] px-8 text-base">
            Get started for free
          </Link>
        </div>
      </section>
    </div>
  );
}
