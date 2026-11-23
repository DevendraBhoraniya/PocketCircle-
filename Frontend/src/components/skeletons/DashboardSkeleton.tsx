import {
  SkeletonBlock,
  SkeletonAvatar,
  SkeletonButton,
} from "./SkeletonPrimitives";

export default function DashboardSkeleton() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-8 py-4 sm:py-6"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <span className="sr-only">Loading dashboard, balances, and circle ledgers...</span>

      {/* 1. Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand pb-6">
        <div className="flex items-center gap-3.5">
          <SkeletonAvatar size="lg" />
          <div className="space-y-1.5">
            <SkeletonBlock className="h-7 w-48 rounded-lg" />
            <SkeletonBlock className="h-4 w-60 rounded-md" />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <SkeletonButton className="h-9 w-28" />
          <SkeletonButton className="h-9 w-24" />
        </div>
      </header>

      {/* 2. Master Balance Vault Card */}
      <section className="rounded-2xl border border-sand bg-paper-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-3">
            <SkeletonBlock className="h-3.5 w-44 rounded-md" />
            <SkeletonBlock className="h-12 w-64 rounded-lg" />
            <SkeletonBlock className="h-3.5 w-80 rounded-md" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-72">
            <div className="rounded-xl border border-sand bg-parchment/60 p-3.5 space-y-1.5">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-5 w-24 rounded-md" />
            </div>
            <div className="rounded-xl border border-sand bg-parchment/60 p-3.5 space-y-1.5">
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-5 w-24 rounded-md" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-6 w-36 rounded-md" />
              <SkeletonBlock className="h-4 w-20 rounded-md" />
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="rounded-xl border border-sand bg-paper-white p-5 space-y-4 shadow-xs">
                <div className="flex items-start justify-between">
                  <SkeletonBlock className="h-5 w-32 rounded-md" />
                  <SkeletonBlock className="h-5 w-20 rounded-full" />
                </div>
                <SkeletonBlock className="h-3.5 w-28 rounded-md" />
                <div className="pt-3 border-t border-sand/60 flex items-center justify-between">
                  <SkeletonBlock className="h-3.5 w-20 rounded-md" />
                  <SkeletonBlock className="h-3.5 w-16 rounded-md" />
                </div>
              </div>
              <div className="rounded-xl border border-sand bg-paper-white p-5 space-y-4 shadow-xs">
                <div className="flex items-start justify-between">
                  <SkeletonBlock className="h-5 w-32 rounded-md" />
                  <SkeletonBlock className="h-5 w-20 rounded-full" />
                </div>
                <SkeletonBlock className="h-3.5 w-28 rounded-md" />
                <div className="pt-3 border-t border-sand/60 flex items-center justify-between">
                  <SkeletonBlock className="h-3.5 w-20 rounded-md" />
                  <SkeletonBlock className="h-3.5 w-16 rounded-md" />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SkeletonBlock className="h-6 w-44 rounded-md" />
            <div className="rounded-xl border border-sand bg-paper-white divide-y divide-sand/70 overflow-hidden shadow-xs">
              <div className="p-4 flex items-center gap-3">
                <SkeletonAvatar size="md" />
                <div className="space-y-1.5 flex-1">
                  <SkeletonBlock className="h-4 w-3/4 rounded-md" />
                  <SkeletonBlock className="h-3 w-1/3 rounded-md" />
                </div>
                <SkeletonBlock className="h-5 w-16 rounded-md" />
              </div>
              <div className="p-4 flex items-center gap-3">
                <SkeletonAvatar size="md" />
                <div className="space-y-1.5 flex-1">
                  <SkeletonBlock className="h-4 w-2/3 rounded-md" />
                  <SkeletonBlock className="h-3 w-1/4 rounded-md" />
                </div>
                <SkeletonBlock className="h-5 w-16 rounded-md" />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (1 Col) */}
        <div className="space-y-6">
          <aside className="rounded-2xl border border-sand bg-paper-white p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-sand pb-4">
              <SkeletonBlock className="h-4 w-24 rounded-md" />
              <SkeletonBlock className="h-4 w-16 rounded-md" />
            </div>
            <div className="rounded-xl border border-sand bg-parchment p-4 space-y-3 text-center">
              <SkeletonBlock className="h-3 w-28 mx-auto" />
              <SkeletonBlock className="h-8 w-44 mx-auto rounded-lg" />
              <SkeletonButton className="h-9 w-full" />
            </div>
            <SkeletonBlock className="h-10 w-full rounded-md" />
          </aside>
        </div>
      </div>
    </div>
  );
}
