import {
  SkeletonBlock,
  SkeletonAvatar,
  SkeletonButton,
} from "./SkeletonPrimitives";

export default function FriendsSkeleton() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-8 py-4 sm:py-6"
      role="status"
      aria-busy="true"
      aria-label="Loading friends"
    >
      <span className="sr-only">Loading friends directory and connection requests...</span>

      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand pb-6">
        <div className="space-y-1.5">
          <SkeletonBlock className="h-8 w-48 rounded-lg" />
          <SkeletonBlock className="h-4 w-72 rounded-md" />
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-sand bg-paper-white px-4 py-2.5 shadow-2xs">
          <div className="space-y-1">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-5 w-28 rounded-md" />
          </div>
          <SkeletonBlock className="h-8 w-8 rounded-lg" />
        </div>
      </header>

      {/* Search Input Card */}
      <div className="rounded-xl border border-sand bg-paper-white p-6 shadow-xs space-y-4">
        <SkeletonBlock className="h-5 w-36 rounded-md" />
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-10 flex-1 rounded-xl" />
          <SkeletonButton className="h-10 w-28" />
        </div>
      </div>

      {/* Main Dual Sections */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Incoming */}
        <div className="rounded-xl border border-sand bg-paper-white p-6 space-y-4 shadow-xs">
          <SkeletonBlock className="h-6 w-36 rounded-md" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-sand bg-paper-white p-3.5 space-y-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <SkeletonAvatar size="md" />
                  <div className="space-y-1.5 flex-1">
                    <SkeletonBlock className="h-4 w-32 rounded-md" />
                    <SkeletonBlock className="h-3 w-20 rounded-md" />
                  </div>
                </div>
                <div className="pt-2 border-t border-sand flex gap-2">
                  <SkeletonButton className="h-8 flex-1" />
                  <SkeletonButton className="h-8 flex-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Your Circle */}
        <div className="rounded-xl border border-sand bg-paper-white p-6 space-y-4 shadow-xs">
          <SkeletonBlock className="h-6 w-28 rounded-md" />
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-sand/80 bg-paper-white p-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <SkeletonAvatar size="md" />
                  <div className="space-y-1.5">
                    <SkeletonBlock className="h-4 w-32 rounded-md" />
                    <SkeletonBlock className="h-3 w-24 rounded-md" />
                  </div>
                </div>
                <SkeletonBlock className="h-8 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
