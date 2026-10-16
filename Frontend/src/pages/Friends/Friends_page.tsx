import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient, getErrorMessage } from "../../api/client";
import Avatar from "../../components/Avatar";
import type { User } from "../../context/auth-context";
import { useAuth } from "../../context/useAuth";

interface FriendRequest {
  id: string;
  user: User;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

interface FriendsData {
  friends: User[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

const emptyData: FriendsData = { friends: [], incoming: [], outgoing: [] };

export default function FriendsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<FriendsData>(emptyData);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    const loadFriends = async () => {
      try {
        const [friendsResponse, requestsResponse] = await Promise.all([
          apiClient("/friends"),
          apiClient("/friends/requests"),
        ]);
        if (!friendsResponse.ok || !requestsResponse.ok) {
          throw new Error("Could not load your friend list.");
        }

        const friends: { friends: User[] } = await friendsResponse.json();
        const requests: { incoming: FriendRequest[]; outgoing: FriendRequest[] } = await requestsResponse.json();
        if (active) {
          setData({ friends: friends.friends, incoming: requests.incoming, outgoing: requests.outgoing });
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load your friend list.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadFriends();
    return () => {
      active = false;
    };
  }, [user]);

  async function refreshFriends() {
    const [friendsResponse, requestsResponse] = await Promise.all([
      apiClient("/friends"),
      apiClient("/friends/requests"),
    ]);
    if (!friendsResponse.ok || !requestsResponse.ok) {
      throw new Error("Could not refresh your friend list.");
    }
    const friends: { friends: User[] } = await friendsResponse.json();
    const requests: { incoming: FriendRequest[]; outgoing: FriendRequest[] } = await requestsResponse.json();
    setData({ friends: friends.friends, incoming: requests.incoming, outgoing: requests.outgoing });
  }

  async function searchUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      return;
    }

    setError("");
    setIsSearching(true);
    try {
      const response = await apiClient(`/users/search?q=${encodeURIComponent(trimmedQuery)}`);
      if (!response.ok) {
        setError(await getErrorMessage(response, "Search is unavailable right now."));
        return;
      }
      const body: { users: User[] } = await response.json();
      setResults(body.users);
    } catch {
      setError("Search is unavailable right now.");
    } finally {
      setIsSearching(false);
    }
  }

  async function performAction(
    id: string,
    endpoint: string,
    method: "POST" | "DELETE",
    message: string,
    payload?: unknown
  ) {
    setActionId(id);
    setError("");
    try {
      const options: RequestInit = { method };
      if (payload !== undefined) {
        options.body = JSON.stringify(payload);
      }
      const response = await apiClient(endpoint, options);
      if (!response.ok) {
        setError(await getErrorMessage(response, message));
        return;
      }
      await refreshFriends();
      setResults([]);
    } catch {
      setError(message);
    } finally {
      setActionId(null);
    }
  }

  if (loading || isLoading) {
    return <div className="pc-sticker-card pc-sticker-cyan flex min-h-72 items-center justify-center font-bold">Loading your circle...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-8">
      <header className="pc-sticker-card pc-sticker-pink grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <span className="pc-kicker bg-toxic-lime">Your people</span>
          <h1 className="pc-section-title mt-6 text-[clamp(3rem,10vw,5.5rem)]">THE CIRCLE<br />STARTS HERE.</h1>
          <p className="mt-5 max-w-xl text-lg font-medium leading-7">Find friends by username or Pocket ID, then send a request before you share a group.</p>
        </div>
        <div className="rounded-[16px] border border-black bg-card-white px-5 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-hairline-smoke">Your Pocket ID</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-wider">{user.pocket_id}</p>
        </div>
      </header>

      <section className="pc-sticker-card pc-sticker-khaki">
        <h2 className="text-2xl font-bold tracking-tight">Find someone</h2>
        <p className="mt-1 text-sm font-medium text-hairline-smoke">Use their username or their 10-digit Pocket ID.</p>
        <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={searchUsers}>
          <label className="sr-only" htmlFor="friend-search">Username or Pocket ID</label>
          <input
            id="friend-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 flex-1 rounded-2xl border border-black bg-card-white px-4 text-sm font-medium outline-none placeholder:text-placeholder-ash"
            placeholder="e.g. dev_1234 or 5938471620"
          />
          <button className="pc-button" type="submit" disabled={isSearching}>{isSearching ? "Searching..." : "Search"}</button>
        </form>

        {results.length > 0 && (
          <div className="mt-5 grid gap-3">
            {results.map((result) => (
              <article key={result.id} className="flex flex-col gap-4 rounded-2xl border border-black bg-card-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={result.name} url={result.avatar_url} size="md" />
                  <div>
                    <p className="font-bold">{result.name}</p>
                    <p className="text-sm text-hairline-smoke">@{result.username ?? "new member"} · {result.pocket_id}</p>
                  </div>
                </div>
                <button
                  className="pc-button"
                  disabled={actionId === result.id}
                  onClick={() => performAction(result.id, "/friends/requests", "POST", "Could not send the friend request.", { friend_id: result.id })}
                >
                  Add friend
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {error && <p className="rounded-2xl border border-black bg-riot-pink px-4 py-3 text-sm font-bold" role="alert">{error}</p>}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="pc-panel">
          <h2 className="text-2xl font-bold">Requests for you</h2>
          <div className="mt-5 space-y-3">
            {data.incoming.length === 0 ? <p className="rounded-2xl border border-black bg-card-white p-4 text-sm font-medium text-hairline-smoke">No new requests right now.</p> : data.incoming.map((request) => (
              <article key={request.id} className="rounded-2xl border border-black bg-card-white p-4 text-black">
                <div className="flex items-center gap-3"><Avatar name={request.user.name} url={request.user.avatar_url} size="sm" /><p className="font-bold">{request.user.name}</p></div>
                <p className="mt-2 text-sm text-hairline-smoke">@{request.user.username ?? "new member"}</p>
                <div className="mt-4 flex gap-2">
                  <button className="pc-button" disabled={actionId === request.id} onClick={() => performAction(request.id, `/friends/requests/${request.id}/accept`, "POST", "Could not accept this request.")}>Accept</button>
                  <button className="pc-button-ghost" disabled={actionId === request.id} onClick={() => performAction(request.id, `/friends/requests/${request.id}/reject`, "POST", "Could not reject this request.")}>Decline</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="pc-sticker-card pc-sticker-cyan">
          <h2 className="text-2xl font-bold">Your friends</h2>
          <div className="mt-5 space-y-3">
            {data.friends.length === 0 ? <p className="rounded-2xl border border-black bg-card-white p-4 text-sm font-medium text-hairline-smoke">Search for a friend to start your circle.</p> : data.friends.map((friend) => (
              <article key={friend.id} className="flex items-center justify-between gap-3 rounded-2xl border border-black bg-card-white p-4">
                <div className="flex min-w-0 items-center gap-3"><Avatar name={friend.name} url={friend.avatar_url} size="sm" /><div className="min-w-0"><p className="truncate font-bold">{friend.name}</p><p className="truncate text-sm text-hairline-smoke">@{friend.username ?? "new member"}</p></div></div>
                <button className="pc-button-ghost" disabled={actionId === friend.id} onClick={() => performAction(friend.id, `/friends/${friend.id}`, "DELETE", "Could not remove this friend.")}>Remove</button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {data.outgoing.length > 0 && (
        <section className="pc-sticker-card">
          <h2 className="text-2xl font-bold">Sent requests</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.outgoing.map((request) => (
              <article key={request.id} className="flex items-center justify-between gap-3 rounded-2xl border border-black bg-card-white p-4">
                <div><p className="font-bold">{request.user.name}</p><p className="text-sm text-hairline-smoke">Waiting for a reply</p></div>
                <button className="pc-button-ghost" disabled={actionId === request.id} onClick={() => performAction(request.id, `/friends/requests/${request.id}`, "DELETE", "Could not cancel this request.")}>Cancel</button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
