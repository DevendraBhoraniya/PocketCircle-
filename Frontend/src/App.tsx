import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./context/useAuth";
import Avatar from "./components/Avatar";
import { IconLogOut, IconUsers, IconClose } from "./components/Icons";

export default function App() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  const handleLogout = async () => {
    if (await logout()) {
      navigate("/");
    }
  };

  return (
    <div className="pc-shell flex flex-col">
      {/* Top Announcement Bar (Full-bleed Electric Blue) */}
      {showAnnouncement && (
        <div className="pc-announcement relative">
          <div className="flex items-center justify-center gap-2 text-center px-8">
            <span>
              PocketCircle 2.0 is live — Peer ledger calculation with zero platform fees.
            </span>
            <Link
              to="/"
              className="hidden sm:inline font-semibold underline underline-offset-2 hover:opacity-90"
            >
              Learn more &rarr;
            </Link>
          </div>
          <button
            onClick={() => setShowAnnouncement(false)}
            className="absolute right-4 grid h-6 w-6 place-items-center rounded-full text-white/80 hover:text-white transition"
            aria-label="Dismiss announcement"
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      {/* Sticky Navigation Header */}
      <header className="pc-nav-wrap">
        <nav className="pc-nav" aria-label="Main navigation">
          {/* Brand Wordmark */}
          <Link to="/" className="pc-wordmark" aria-label="PocketCircle Home">
            <span className="pc-wordmark-dot" aria-hidden="true" />
            <span>PocketCircle</span>
          </Link>

          {/* Navigation Actions */}
          <div className="pc-nav-actions">
            {loading ? (
              <div
                className="h-9 w-24 animate-pulse rounded-full bg-parchment"
                aria-label="Checking session..."
              />
            ) : user ? (
              <>
                {/* Desktop navigation links */}
                <div className="hidden sm:flex items-center gap-1.5 mr-2">
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      `pc-btn text-sm ${
                        isActive
                          ? "bg-parchment text-ink-black font-semibold"
                          : "bg-transparent text-steel hover:text-ink-black"
                      }`
                    }
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/friends"
                    className={({ isActive }) =>
                      `pc-btn text-sm ${
                        isActive
                          ? "bg-parchment text-ink-black font-semibold"
                          : "bg-transparent text-steel hover:text-ink-black"
                      }`
                    }
                  >
                    <IconUsers size={16} />
                    <span>Friends</span>
                  </NavLink>
                </div>

                {/* User chip */}
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 rounded-full border border-sand bg-parchment py-1 pl-1.5 pr-3 text-xs font-medium text-ink-black transition hover:border-fog"
                  title={`Signed in as ${user.name}`}
                >
                  <Avatar name={user.name} url={user.avatar_url} size="xs" />
                  <span className="hidden md:inline font-mono text-[13px]">{user.pocket_id}</span>
                </Link>

                {/* Sign out */}
                <button
                  onClick={handleLogout}
                  className="pc-btn pc-btn-white text-xs px-3"
                  title="Sign out of PocketCircle"
                  aria-label="Sign out"
                >
                  <IconLogOut size={14} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="pc-btn pc-btn-ghost text-sm">
                  Sign in
                </Link>
                <Link to="/login" className="pc-btn pc-btn-primary text-sm">
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Page Canvas */}
      <main className="pc-page flex-1">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (When Authenticated) */}
      {user && (
        <aside
          className="sm:hidden fixed bottom-4 left-4 right-4 z-50 flex items-center justify-around rounded-full border border-sand bg-paper-white/95 backdrop-blur-md p-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]"
          aria-label="Mobile Navigation"
        >
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex-1 text-center py-2 px-3 text-xs font-medium rounded-full transition ${
                isActive
                  ? "bg-electric-blue text-white"
                  : "text-steel hover:text-ink-black"
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/friends"
            className={({ isActive }) =>
              `flex-1 text-center py-2 px-3 text-xs font-medium rounded-full transition ${
                isActive
                  ? "bg-electric-blue text-white"
                  : "text-steel hover:text-ink-black"
              }`
            }
          >
            Friends
          </NavLink>
        </aside>
      )}

      {/* Footer */}
      <footer className="pc-footer flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="pc-wordmark-dot" aria-hidden="true" />
          <span className="font-semibold text-ink-black">PocketCircle</span>
          <span className="text-steel hidden sm:inline">— Peer ledger accounting for friend circles</span>
        </div>
        <p className="text-xs text-steel">
          &copy; {new Date().getFullYear()} PocketCircle. Deterministic decimal math. No banking credentials stored.
        </p>
      </footer>
    </div>
  );
}
