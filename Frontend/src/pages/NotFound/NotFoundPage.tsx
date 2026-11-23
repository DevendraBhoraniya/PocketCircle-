import { Link } from "react-router-dom";
import { IconArrowRight, IconSparkles } from "../../components/Icons";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center py-16 px-4">
      <div className="w-full max-w-md rounded-[28px] border border-sand bg-parchment p-8 sm:p-10 text-center space-y-6">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sand/60 text-ink-black border border-sand">
          <span className="font-mono text-2xl font-semibold">404</span>
        </div>

        <div className="space-y-2">
          <span className="pc-badge pc-badge-dark text-xs uppercase font-mono tracking-wider">
            Page Not Found
          </span>
          <h1 className="text-2xl font-semibold text-ink-black">
            Off the ledger
          </h1>
          <p className="text-xs text-steel leading-relaxed max-w-xs mx-auto">
            The page or circle you are searching for does not exist or has been relocated.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/dashboard"
            className="pc-btn pc-btn-primary w-full sm:w-auto text-xs py-2.5 px-5 font-bold flex items-center justify-center gap-2"
          >
            <span>Your Dashboard</span>
            <IconArrowRight size={14} />
          </Link>
          <Link
            to="/"
            className="pc-btn pc-btn-secondary w-full sm:w-auto text-xs py-2.5 px-5 font-semibold flex items-center justify-center gap-1.5"
          >
            <IconSparkles size={13} />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
