import {
  SkeletonBlock,
  SkeletonButton,
} from "./SkeletonPrimitives";

export default function GroupListSkeleton() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-8 py-4 sm:py-6"
      role="status"
      aria-busy="true"
      aria-label="Loading circles"
    >
      <span className="sr-only">Loading expense circles and balance ledgers...</span>

      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand pb-6">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-8 w-52 rounded-lg" />
          <SkeletonBlock className="h-4 w-80 rounded-md" />
        </div>

        <div>
          <SkeletonButton className="h-9 w-32" />
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-8 w-20 rounded-full" />
        <SkeletonBlock className="h-8 w-24 rounded-full" />
        <SkeletonBlock className="h-8 w-20 rounded-full" />
        <SkeletonBlock className="h-8 w-20 rounded-full" />
      </div>

      {/* Circles Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex flex-col justify-between rounded-xl border border-sand bg-paper-white p-6 min-h-[190px] shadow-xs"
          >
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-5 w-16 rounded-full" />
                <SkeletonBlock className="h-3.5 w-20 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <SkeletonBlock className="h-5 w-3/4 rounded-md" />
                <SkeletonBlock className="h-3.5 w-full rounded-md" />
              </div>
              <SkeletonBlock className="h-6 w-28 rounded-lg" />
            </div>

            <div className="pt-3.5 border-t border-sand/60 flex items-center justify-between mt-4">
              <SkeletonBlock className="h-3.5 w-20 rounded-md" />
              <SkeletonBlock className="h-3.5 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
