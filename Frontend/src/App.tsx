import { Link, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "./context/useAuth"

function App() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (await logout()) {
      navigate("/");
    }
  };

  return (
    <div className="pc-shell flex flex-col">
      <div className="pc-nav-wrap">
        <nav className="pc-nav" aria-label="Main navigation">
          <Link to="/" className="pc-wordmark">
            <span className="pc-mark">PC</span>
            <span>PocketCircle</span>
        </Link>
          <div className="pc-nav-actions">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-[16px] border border-black bg-card-white" aria-label="Checking session" />
          ) : user ? (
            <>
              <Link to="/dashboard" className="pc-link">
                Dashboard
              </Link>
              <Link to="/friends" className="pc-link">
                Friends
              </Link>
              <button
                onClick={handleLogout}
                className="pc-button-ghost"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="pc-link">
                Login
              </Link>
              <Link to="/login" className="pc-button">
                Get started
              </Link>
            </>
          )}
          </div>
        </nav>
      </div>

      <main className="pc-page flex-1">
        <Outlet />
      </main>

      <footer className="pc-footer">
        <p>&copy; {new Date().getFullYear()} Pocket Circle. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
