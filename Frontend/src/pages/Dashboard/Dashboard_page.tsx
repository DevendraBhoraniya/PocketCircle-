import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import Avatar from "../../components/Avatar";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  async function handleLogout() {
    if (await logout()) {
      navigate("/login");
    }
  }

  if (loading) {
    return <div className="pc-sticker-card pc-sticker-cyan flex min-h-72 items-center justify-center font-bold">Loading your circle...</div>;
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <header className="pc-sticker-card pc-sticker-khaki flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.12em]">Your dashboard</p>
          <h1 className="pc-section-title text-[clamp(2.8rem,8vw,4.5rem)]">Hey, {user.name.split(' ')[0]}.</h1>
          <p className="mt-3 max-w-md font-medium text-hairline-smoke">Here is your PocketCircle snapshot. Groups and expenses will appear here as you add them.</p>
          <button 
            onClick={handleLogout} 
            className="pc-button-ghost mt-5"
          >
            Sign out
          </button>
        </div>
        <Avatar name={user.name} url={user.avatar_url} size="lg" />
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="pc-sticker-card space-y-4 md:col-span-1">
          <h2 className="border-b border-black pb-3 text-lg font-bold">Your details</h2>
          <div className="space-y-3 text-sm">
            <p><span className="text-hairline-smoke">Name:</span> <span className="font-medium">{user.name}</span></p>
            <p><span className="text-hairline-smoke">Username:</span> <span className="font-medium">@{user.username ?? "pending"}</span></p>
            <p className="break-all"><span className="text-hairline-smoke">Email:</span> <span className="font-medium">{user.email}</span></p>
            <div className="mt-4 rounded-2xl border border-black bg-toxic-lime p-3 text-center">
              <p className="mb-1 text-xs font-bold uppercase">Pocket ID</p>
              <p className="font-mono text-lg font-bold tracking-wider">{user.pocket_id}</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="pc-sticker-card pc-sticker-cyan flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-2xl font-bold">Build your circle.</h3><p className="mt-1 font-medium">Find friends using a Pocket ID before creating groups.</p></div>
            <Link to="/friends" className="pc-button">Find friends</Link>
          </div>
          <div className="pc-sticker-card pc-sticker-pink flex h-48 flex-col items-center justify-center text-center">
            <h3 className="mb-2 text-2xl font-bold">No groups yet.</h3>
            <p className="mb-5 font-medium">Your first shared ledger starts with a circle.</p>
            <button className="pc-button" disabled title="Group creation is the next planned feature">
              + Create a Group
            </button>
          </div>

          <div className="pc-panel">
            <h3 className="mb-4 text-xl font-bold">Recent activity</h3>
            <div className="rounded-2xl border border-black bg-card-white px-4 py-5 text-center text-sm font-medium text-hairline-smoke">No expenses yet. Once your circle starts adding them, they will show up here.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
