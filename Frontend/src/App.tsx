import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./context/useAuth";
import { useToast } from "./context/useToast";
import Avatar from "./components/Avatar";
import { IconLogOut, IconUsers, IconClose } from "./components/Icons";
import NotificationCenter from "./components/NotificationCenter";
import TopProgressBar from "./components/TopProgressBar";


export default function App() {
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  const handleLogout = async () => {
    if (await logout()) {
      toast.info("You have been signed out safely.", "Signed Out");
      navigate("/");
    }
  };

  return (
    <div className="pc-shell flex flex-col">
      {/* Top Progress Loading Bar */}
      <TopProgressBar active={loading} />

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
              Learn more
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
                className="flex items-center gap-2 rounded-full border border-sand bg-parchment py-1.5 px-3.5 text-xs text-steel"
                role="status"
                aria-label="Checking session"
              >
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sand border-t-electric-blue" />
                <span className="font-medium text-ink-black">Loading...</span>
              </div>
            ) : user ? (
              <>
                {/* Desktop navigation links — Nav-Pill-Group from DESIGN.md */}
                <div className="hidden sm:flex items-center gap-1 rounded-full border border-sand bg-parchment p-1 mr-2">
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      `px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                        isActive
                          ? "bg-paper-white text-ink-black shadow-xs"
                          : "text-steel hover:text-ink-black"
                      }`
                    }
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/groups"
                    className={({ isActive }) =>
                      `px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                        isActive
                          ? "bg-paper-white text-ink-black shadow-xs"
                          : "text-steel hover:text-ink-black"
                      }`
                    }
                  >
                    Circles
                  </NavLink>
                  <NavLink
                    to="/friends"
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                        isActive
                          ? "bg-paper-white text-ink-black shadow-xs"
                          : "text-steel hover:text-ink-black"
                      }`
                    }
                  >
                    <IconUsers size={14} />
                    <span>Friends</span>
                  </NavLink>
                </div>

                {/* Notifications Center */}
                <NotificationCenter />

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
                <Link to="/login?mode=register" className="pc-btn pc-btn-primary text-sm">
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
            to="/groups"
            className={({ isActive }) =>
              `flex-1 text-center py-2 px-3 text-xs font-medium rounded-full transition ${
                isActive
                  ? "bg-electric-blue text-white"
                  : "text-steel hover:text-ink-black"
              }`
            }
          >
            Circles
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

      {/* Footer from DESIGN.md: Dark near-black closing band */}
      <footer className="mt-auto border-t border-sand bg-[#101010] text-[#a1a1aa] py-14 px-6 sm:px-12">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="grid gap-8 grid-cols-2 sm:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <span className="h-2 w-2 rounded-full bg-white" />
                <span className="font-semibold text-sm">PocketCircle</span>
              </div>
              <p className="text-xs text-[#898989] leading-relaxed">
                Banker&apos;s ledger accounting for friend circles with exact integer decimal math.
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="font-semibold text-white">Product</p>
              <ul className="space-y-2">
                <li><Link to="/groups" className="hover:text-white transition">Expense Circles</Link></li>
                <li><Link to="/friends" className="hover:text-white transition">Pocket IDs</Link></li>
                <li><Link to="/dashboard" className="hover:text-white transition">Cross-Circle Vault</Link></li>
              </ul>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="font-semibold text-white">Architecture</p>
              <ul className="space-y-2 text-[#898989]">
                <li>N-1 Greedy Resolution</li>
                <li>Zero Wallet Lock-in</li>
                <li>Single-Paisa Precision</li>
              </ul>
            </div>

            <div className="space-y-2.5 text-xs">
              <p className="font-semibold text-white">Trust &amp; Privacy</p>
              <ul className="space-y-2 text-[#898989]">
                <li>No Bank Login Required</li>
                <li>Zero Advertising</li>
                <li>Direct UPI Settlement</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#898989]">
            <p>&copy; {new Date().getFullYear()} PocketCircle Inc. All rights reserved.</p>
            <p className="flex items-center gap-4">
              <span>Zero transaction fees</span>
              <span>&bull;</span>
              <span>10-digit numeric IDs</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
