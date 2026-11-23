import { IconSparkles } from "./Icons";

interface LoadingCardProps {
  title?: string;
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingCard({
  title = "Loading PocketCircle",
  message = "Verifying session and synchronizing ledger...",
  fullScreen = false,
}: LoadingCardProps) {
  const containerClasses = fullScreen
    ? "flex min-h-[65vh] w-full items-center justify-center px-4 py-12"
    : "flex w-full items-center justify-center p-6";

  return (
    <div className={containerClasses} role="status" aria-live="polite">
      <div className="relative w-full max-w-sm rounded-[24px] border border-sand bg-parchment p-8 text-center shadow-[0_4px_24px_rgba(27,29,32,0.06)] overflow-hidden">
        {/* Subtle background glow */}
        <div
          className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full opacity-30 blur-2xl"
          style={{
            background:
              "radial-gradient(circle, rgba(81,150,254,0.9) 0%, rgba(249,117,78,0.4) 100%)",
          }}
        />

        {/* Brand Icon with Spinner Halo */}
        <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-sand border-t-electric-blue animate-spin" />
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-white shadow-xs">
            <span className="h-3.5 w-3.5 rounded-full bg-electric-blue animate-pulse" />
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="space-y-1.5 mb-5 relative z-10">
          <div className="inline-flex items-center gap-1.5 mb-1">
            <span className="pc-badge pc-badge-dark text-[11px] py-0.5 px-2.5">
              <IconSparkles size={11} className="text-electric-blue" />
              <span>PocketCircle Ledger</span>
            </span>
          </div>
          <h2 className="text-xl font-semibold text-ink-black">{title}</h2>
          <p className="text-xs text-steel leading-relaxed max-w-[280px] mx-auto">{message}</p>
        </div>

        {/* Sleek Indeterminate Loading Bar */}
        <div className="relative mx-auto h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-sand/70">
          <div className="pc-shimmer-bar h-full w-2/3 rounded-full bg-gradient-to-r from-electric-blue via-ember-orange to-electric-blue" />
        </div>
      </div>
    </div>
  );
}
