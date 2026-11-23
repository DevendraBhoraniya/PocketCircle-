import {
  SkeletonBlock,
} from "./SkeletonPrimitives";

export default function LoginSkeleton() {
  return (
    <div
      className="mx-auto grid min-h-[65vh] max-w-5xl items-center gap-12 py-8 lg:grid-cols-2"
      role="status"
      aria-busy="true"
      aria-label="Loading authentication"
    >
      <span className="sr-only">Loading authentication and session verification...</span>

      {/* Left Column: Brand & Security Value Proposition */}
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2">
          <SkeletonBlock className="h-6 w-36 rounded-full" />
        </div>

        <div className="space-y-2">
          <SkeletonBlock className="h-10 sm:h-12 w-4/5 rounded-lg" />
          <SkeletonBlock className="h-10 sm:h-12 w-3/5 rounded-lg" />
        </div>

        <div className="space-y-2 max-w-xl">
          <SkeletonBlock className="h-4.5 w-full" />
          <SkeletonBlock className="h-4.5 w-5/6" />
          <SkeletonBlock className="h-4.5 w-4/6" />
        </div>

        <div className="space-y-3 pt-3">
          {[
            "h-4 w-52",
            "h-4 w-60",
            "h-4 w-48",
          ].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock className="h-5 w-5 rounded-full shrink-0" />
              <SkeletonBlock className={w} />
            </div>
          ))}
        </div>
      </section>

      {/* Right Column: Auth Card */}
      <div className="rounded-[24px] border border-sand bg-paper-white p-8 sm:p-10 shadow-xs space-y-6">
        <div className="space-y-3">
          <div className="inline-flex rounded-full bg-sand/60 p-1">
            <SkeletonBlock className="h-7 w-20 rounded-full" />
            <SkeletonBlock className="h-7 w-28 rounded-full ml-1" />
          </div>

          <SkeletonBlock className="h-8 w-56 rounded-lg" />
          <SkeletonBlock className="h-4 w-full max-w-sm" />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </div>
          <SkeletonBlock className="h-11 w-full rounded-xl mt-2" />
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-sand/80" />
          <SkeletonBlock className="h-3 w-24" />
          <div className="h-px flex-1 bg-sand/80" />
        </div>

        <SkeletonBlock className="h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
