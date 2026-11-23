import {
  SkeletonBlock,
  SkeletonButton,
} from "./SkeletonPrimitives";

export default function HomeSkeleton() {
  return (
    <div
      className="flex flex-col gap-24 sm:gap-32 py-6 sm:py-10"
      role="status"
      aria-busy="true"
      aria-label="Loading PocketCircle"
    >
      <span className="sr-only">Loading PocketCircle experience...</span>

      {/* 1. Hero Section Skeleton */}
      <section className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 pt-2">
        <div className="space-y-8">
          <div className="space-y-4">
            <SkeletonBlock className="h-12 sm:h-14 w-4/5 rounded-xs" />
            <SkeletonBlock className="h-12 sm:h-14 w-3/4 rounded-xs" />
            <div className="space-y-2 pt-2 max-w-xl">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-5/6" />
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <SkeletonButton className="h-11 w-36 rounded-xs" />
            <SkeletonBlock className="h-3.5 w-64" />
          </div>
        </div>

        {/* Hero Interactive Ledger Preview Placeholder */}
        <div className="border border-sand bg-paper-white p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-sand pb-4">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-6 w-28 rounded-xs" />
          </div>

          <div className="space-y-2.5">
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
            <SkeletonBlock className="h-10 w-full" />
          </div>

          <div className="pt-3 border-t border-sand flex items-center justify-between">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-5 w-20" />
          </div>
        </div>
      </section>
    </div>
  );
}
