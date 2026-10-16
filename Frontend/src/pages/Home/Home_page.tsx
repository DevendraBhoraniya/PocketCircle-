import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-24 py-8">
      <section className="grid items-end gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <span className="pc-kicker">PocketCircle / shared expenses</span>
          <h1 className="pc-display">
            SPLIT<br />WITH YOUR<br /><span className="inline-block -rotate-2 rounded-[16px] border border-black bg-riot-pink px-3 py-1">CIRCLE.</span>
          </h1>
        </div>
        <div className="pc-sticker-card pc-sticker-cyan rotate-2 space-y-5">
          <p className="text-2xl font-bold tracking-tight">No more “who paid for that?”</p>
          <p className="text-base font-medium leading-7">Track shared costs, stay transparent, and settle up when it makes sense.</p>
          <Link to="/login" className="pc-button w-full">Start your circle <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="pc-sticker-card pc-sticker-khaki min-h-64 space-y-5">
          <div className="inline-flex rotate-[-7deg] rounded-full border border-black bg-toxic-lime px-4 py-2 text-2xl">👥</div>
          <h2 className="text-2xl font-bold tracking-tight">Make a circle.</h2>
          <p className="font-medium leading-6">Create a group for flatmates, a trip, or the friends who always share a bill.</p>
        </div>
        <div className="pc-sticker-card pc-sticker-pink min-h-64 space-y-5 md:translate-y-8">
          <div className="inline-flex rotate-[8deg] rounded-full border border-black bg-card-white px-4 py-2 text-2xl">✦</div>
          <h2 className="text-2xl font-bold tracking-tight">Add what happened.</h2>
          <p className="font-medium leading-6">Keep each expense in one place, with everyone able to see the same ledger.</p>
        </div>
        <div className="pc-sticker-card pc-sticker-cyan min-h-64 space-y-5">
          <div className="inline-flex rotate-[-5deg] rounded-full border border-black bg-card-white px-4 py-2 text-2xl">₹</div>
          <h2 className="text-2xl font-bold tracking-tight">Know the balance.</h2>
          <p className="font-medium leading-6">PocketCircle calculates what is owed. You settle externally, on your terms.</p>
        </div>
      </section>
    </div>
  );
}
