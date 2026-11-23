import { SkeletonBlock, SkeletonBadge } from "./SkeletonPrimitives";

export default function ExpenseListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="space-y-3"
      role="status"
      aria-busy="true"
      aria-label="Loading expenses"
    >
      <span className="sr-only">Loading recorded circle expenses...</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row sm:items-center justify-between rounded-[20px] border border-sand bg-parchment p-5 gap-4"
        >
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-5 w-44 rounded-md" />
              <SkeletonBadge className="h-5 w-20" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SkeletonBlock className="h-3.5 w-28" />
              <SkeletonBlock className="h-3.5 w-24" />
              <SkeletonBlock className="h-3.5 w-20" />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4">
            <div className="text-right space-y-1.5">
              <SkeletonBlock className="h-6 w-20 sm:ml-auto rounded-md" />
              <SkeletonBlock className="h-3 w-28 sm:ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
