import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./context/useAuth";
import Avatar from "./components/Avatar";
import { IconLogOut, IconUsers } from "./components/Icons";

export default function App() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (await logout()) {
      navigate("/");
    }
  };

  return (
    <div className="pc-shell flex flex-col">
      {/* Top Floating Navigation Bar */}
      <header className="pc-nav-wrap">
        <nav className="pc-nav" aria-label="Main navigation">
          {/* Brand Wordmark */}
          <Link to="/" className="pc-wordmark" aria-label="PocketCircle Home">
            <span className="pc-mark" aria-hidden="true">PC</span>
            <span className="tracking-tight">PocketCircle</span>
          </Link>

          {/* Navigation Actions */}
          <div className="pc-nav-actions">
            {loading ? (
              <div
                className="h-9 w-28 animate-pulse rounded-[16px] border border-black bg-card-white"
                aria-label="Checking session..."
              />
            ) : user ? (
              <>
                {/* Desktop navigation links */}
                <div className="hidden sm:flex items-center gap-2">
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      `pc-btn ${isActive ? "pc-btn-primary" : "pc-btn-white"}`
                    }
                  >
                    Dashboard
                  </NavLink>
                  <NavLink
                    to="/friends"
                    className={({ isActive }) =>
                      `pc-btn ${isActive ? "pc-btn-primary" : "pc-btn-white"}`
                    }
                  >
                    <IconUsers size={16} />
                    Friends
                  </NavLink>
                </div>

                {/* User chip */}
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 rounded-[16px] border border-black bg-paper-cream px-2.5 py-1 text-xs font-bold transition hover:bg-card-white"
                  title={`Signed in as ${user.name}`}
                >
                  <Avatar name={user.name} url={user.avatar_url} size="xs" />
                  <span className="hidden md:inline font-mono">{user.pocket_id}</span>
                </Link>

                {/* Sign out */}
                <button
                  onClick={handleLogout}
                  className="pc-btn pc-btn-ghost text-xs px-2.5 sm:px-3.5"
                  title="Sign out of PocketCircle"
                  aria-label="Sign out"
                >
                  <IconLogOut size={15} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="pc-btn pc-btn-white">
                  Login
                </Link>
                <Link to="/login" className="pc-btn pc-btn-primary">
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
          className="sm:hidden fixed bottom-4 left-4 right-4 z-50 flex items-center justify-around rounded-[20px] border border-black bg-card-white p-2 shadow-[3px_3px_0_#000]"
          aria-label="Mobile Navigation"
        >
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `flex-1 text-center py-2 px-3 text-xs font-bold rounded-[14px] border border-black transition ${
                isActive ? "bg-toxic-lime" : "bg-transparent border-transparent"
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/friends"
            className={({ isActive }) =>
              `flex-1 text-center py-2 px-3 text-xs font-bold rounded-[14px] border border-black transition ${
                isActive ? "bg-toxic-lime" : "bg-transparent border-transparent"
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
          <span className="pc-mark w-6 h-6 text-xs" aria-hidden="true">PC</span>
          <span className="font-bold text-black text-sm">PocketCircle</span>
          <span className="text-hairline-smoke text-xs hidden sm:inline">— Shared expenses for circles of trust</span>
        </div>
        <p className="text-xs text-hairline-smoke font-medium">
          &copy; {new Date().getFullYear()} PocketCircle. Pure ledger math · No UPI handling.
        </p>
      </footer>
    </div>
  );
}
