import {
  SkeletonBlock,
  SkeletonAvatar,
  SkeletonButton,
} from "./SkeletonPrimitives";

export default function SettlementSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Loading settlement plan"
    >
      <span className="sr-only">Loading simplified settlement plan and balances...</span>

      {/* 1. Overview Ribbon Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Circle Spend", width: "w-24" },
          { label: "Your Net Balance", width: "w-28" },
          { label: "Settlement Efficiency", width: "w-20" },
        ].map((item, i) => (
          <div
            key={i}
            className="rounded-[20px] border border-sand bg-parchment p-5 space-y-2"
          >
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className={`h-8 ${item.width} rounded-md`} />
            <SkeletonBlock className="h-3 w-36" />
          </div>
        ))}
      </div>

      {/* 2. Optimized Settlement Plan Card */}
      <div className="rounded-[24px] border border-sand bg-paper-white p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-5 w-5 rounded-full" />
              <SkeletonBlock className="h-5 w-48 rounded-md" />
            </div>
            <SkeletonBlock className="h-3.5 w-72" />
          </div>
          <SkeletonBlock className="h-3.5 w-28" />
        </div>

        {/* Transfer rows */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-[20px] border border-sand bg-parchment p-4 sm:p-5 gap-4"
            >
              <div className="flex items-center gap-3">
                <SkeletonAvatar size="sm" />
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-3 w-8" />
                <SkeletonAvatar size="sm" />
                <SkeletonBlock className="h-4 w-24" />
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <SkeletonBlock className="h-6 w-20 rounded-md" />
                <SkeletonButton className="h-8 w-24 text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
