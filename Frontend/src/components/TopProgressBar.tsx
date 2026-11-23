interface TopProgressBarProps {
  active?: boolean;
}

export default function TopProgressBar({ active = false }: TopProgressBarProps) {
  if (!active) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] bg-sand/30 overflow-hidden pointer-events-none"
      role="progressbar"
      aria-label="Page loading"
      aria-busy="true"
    >
      <div className="pc-shimmer-bar h-full w-1/2 bg-gradient-to-r from-electric-blue via-ember-orange to-electric-blue rounded-full shadow-[0_0_8px_rgba(81,150,254,0.6)]" />
    </div>
  );
}
