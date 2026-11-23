import {
  SkeletonBlock,
  SkeletonBadge,
  SkeletonButton,
} from "./SkeletonPrimitives";
import ExpenseListSkeleton from "./ExpenseListSkeleton";

export default function GroupDetailSkeleton() {
  return (
    <div
      className="mx-auto max-w-4xl space-y-6 pb-20"
      role="status"
      aria-busy="true"
      aria-label="Loading circle details"
    >
      <span className="sr-only">Loading circle details, ledger, and balances...</span>

      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-4 w-4 rounded-full" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-7 w-20 rounded-md" />
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="rounded-[28px] border border-sand bg-parchment p-6 sm:p-8 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <SkeletonBadge className="h-5 w-14" />
              <SkeletonBlock className="h-8 sm:h-9 w-48 sm:w-60 rounded-lg" />
            </div>
            <SkeletonBlock className="h-4 w-72 max-w-xl" />
            <div className="flex items-center gap-4 pt-1">
              <SkeletonBlock className="h-3.5 w-32" />
              <SkeletonBlock className="h-3.5 w-24" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SkeletonButton className="h-9 w-32" />
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-sand pb-2 overflow-x-auto">
        <SkeletonBlock className="h-8 w-28 rounded-full shrink-0" />
        <SkeletonBlock className="h-8 w-36 rounded-full shrink-0" />
        <SkeletonBlock className="h-8 w-24 rounded-full shrink-0" />
        <SkeletonBlock className="h-8 w-28 rounded-full shrink-0" />
      </div>

      {/* Default Tab Body Skeleton (Expenses list) */}
      <ExpenseListSkeleton count={4} />
    </div>
  );
}
