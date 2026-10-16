import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient, getErrorMessage } from "../../api/client";
import Avatar from "../../components/Avatar";
import type { User } from "../../context/auth-context";
import { useAuth } from "../../context/useAuth";
import {
  IconSearch,
  IconCopy,
  IconCheck,
  IconUserPlus,
  IconUsers,
  IconClose,
  IconTrash,
  IconClock,
  IconExclamation,
} from "../../components/Icons";

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
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;

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

        const friendsData: { friends: User[] } = await friendsResponse.json();
        const requestsData: { incoming: FriendRequest[]; outgoing: FriendRequest[] } = await requestsResponse.json();

        if (active) {
          setData({
            friends: friendsData.friends,
            incoming: requestsData.incoming,
            outgoing: requestsData.outgoing,
          });
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
    const friendsData: { friends: User[] } = await friendsResponse.json();
    const requestsData: { incoming: FriendRequest[]; outgoing: FriendRequest[] } = await requestsResponse.json();
    setData({
      friends: friendsData.friends,
      incoming: requestsData.incoming,
      outgoing: requestsData.outgoing,
    });
  }

  async function searchUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setError("");
    setIsSearching(true);
    setHasSearched(true);
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
    errorMessage: string,
    successMessage?: string,
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
        setError(await getErrorMessage(response, errorMessage));
        return;
      }
      await refreshFriends();
      if (successMessage) {
        setToast(successMessage);
      }
      setResults([]);
      setHasSearched(false);
      setQuery("");
      setConfirmDeleteId(null);
    } catch {
      setError(errorMessage);
    } finally {
      setActionId(null);
    }
  }

  const copyPocketId = async () => {
    if (!user?.pocket_id) return;
    try {
      await navigator.clipboard.writeText(user.pocket_id);
      setCopied(true);
      setToast("Pocket ID copied to clipboard!");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const isFriend = (targetId: string) => data.friends.some((f) => f.id === targetId);
  const isPendingOutgoing = (targetId: string) => data.outgoing.some((r) => r.user.id === targetId);
  const isPendingIncoming = (targetId: string) => data.incoming.some((r) => r.user.id === targetId);

  if (loading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-12">
        <div className="pc-sticker-card pc-sticker-cyan max-w-sm px-8 py-10 text-center space-y-4">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full border border-black bg-toxic-lime shadow-[2px_2px_0_#000]" />
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
            LOADING CIRCLE...
          </h2>
          <p className="text-sm font-medium text-black">Retrieving your friends and requests.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-[16px] border border-black bg-toxic-lime px-4 py-3 text-sm font-bold text-black shadow-[4px_4px_0_#000] animate-bounce"
          role="status"
        >
          <IconCheck size={18} />
          <span>{toast}</span>
        </div>
      )}

      {/* Header Banner */}
      <header className="pc-sticker-card pc-sticker-pink grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end p-6 sm:p-8">
        <div className="space-y-3">
          <span className="pc-kicker bg-toxic-lime text-black">
            <IconUsers size={13} />
            Your Network
          </span>
          <h1 className="pc-section-title text-black">
            THE CIRCLE<br />STARTS HERE.
          </h1>
          <p className="max-w-xl text-sm sm:text-base font-medium text-black leading-relaxed">
            Find friends by username or their 10-digit Pocket ID, send a request, and build your shared ledger circle.
          </p>
        </div>

        <div className="rounded-[18px] border border-black bg-card-white p-4 text-center shadow-[3px_3px_0_#000]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-hairline-smoke">Your Pocket ID</p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="font-mono text-2xl font-black tracking-wider text-black">{user.pocket_id}</span>
            <button
              onClick={copyPocketId}
              className="grid h-7 w-7 place-items-center rounded-lg border border-black bg-toxic-lime hover:bg-[#9ee602] transition shadow-[1px_1px_0_#000]"
              title="Copy your Pocket ID"
              aria-label="Copy Pocket ID"
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </button>
          </div>
          <p className="text-[10px] font-medium text-hairline-smoke mt-1">Share this with friends to connect</p>
        </div>
      </header>

      {/* Find Someone Search Section */}
      <section className="pc-sticker-card pc-sticker-khaki p-6 sm:p-8 space-y-5">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
            FIND SOMEONE
          </h2>
          <p className="text-sm font-medium text-black mt-0.5">
            Search by username (e.g. <span className="font-bold">alice_12</span>) or their exact 10-digit Pocket ID.
          </p>
        </div>

        <form onSubmit={searchUsers} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-black">
              <IconSearch size={18} />
            </span>
            <input
              id="friend-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pc-input pl-10 pr-10"
              placeholder="e.g. dev_1234 or 5938471620"
              aria-label="Search friends by username or Pocket ID"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setHasSearched(false);
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-hairline-smoke hover:text-black"
                aria-label="Clear search"
              >
                <IconClose size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="pc-btn pc-btn-primary h-11 px-6 shrink-0"
            disabled={isSearching}
          >
            {isSearching ? (
              <span>Searching...</span>
            ) : (
              <>
                <IconSearch size={16} />
                <span>Search</span>
              </>
            )}
          </button>
        </form>

        {/* Search Results */}
        {hasSearched && results.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-black">
              Search Results ({results.length})
            </p>
            <div className="grid gap-3">
              {results.map((result) => {
                const alreadyFriend = isFriend(result.id);
                const pendingOut = isPendingOutgoing(result.id);
                const pendingIn = isPendingIncoming(result.id);

                return (
                  <article
                    key={result.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[16px] border border-black bg-card-white p-4 shadow-[2px_2px_0_#000]"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={result.name} url={result.avatar_url} size="md" />
                      <div>
                        <p className="font-bold text-black leading-tight">{result.name}</p>
                        <p className="text-xs text-hairline-smoke">
                          @{result.username ?? "member"} ·{" "}
                          <span className="font-mono font-medium">{result.pocket_id}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {alreadyFriend ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-black bg-toxic-lime px-3 py-1 text-xs font-bold text-black">
                          <IconCheck size={13} />
                          Already friends
                        </span>
                      ) : pendingOut ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-black bg-paper-cream px-3 py-1 text-xs font-bold text-hairline-smoke">
                          <IconClock size={13} />
                          Request pending
                        </span>
                      ) : pendingIn ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-black bg-voltage-cyan px-3 py-1 text-xs font-bold text-black">
                          Review request below
                        </span>
                      ) : (
                        <button
                          className="pc-btn pc-btn-primary text-xs"
                          disabled={actionId === result.id}
                          onClick={() =>
                            performAction(
                              result.id,
                              "/friends/requests",
                              "POST",
                              "Could not send the friend request.",
                              `Friend request sent to ${result.name}!`,
                              { friend_id: result.id }
                            )
                          }
                        >
                          <IconUserPlus size={14} />
                          <span>{actionId === result.id ? "Sending..." : "Add friend"}</span>
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty Search State */}
        {hasSearched && results.length === 0 && !isSearching && (
          <div className="rounded-[16px] border border-black bg-card-white p-6 text-center space-y-1 shadow-[2px_2px_0_#000]">
            <p className="font-bold text-black text-sm">No members found</p>
            <p className="text-xs text-hairline-smoke">
              No matching username or Pocket ID for "{query}". Check the 10 digits and try again.
            </p>
          </div>
        )}
      </section>

      {/* Error Alert */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-[16px] border border-black bg-riot-pink p-4 text-sm font-bold text-black shadow-[3px_3px_0_#000]"
          role="alert"
        >
          <IconExclamation size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Dual Sections: Requests for You & Your Friends */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Incoming Requests */}
        <section className="pc-panel p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between border-b border-[#555] pb-3">
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">
              REQUESTS FOR YOU
            </h2>
            <span className="rounded-full border border-black bg-voltage-cyan px-2.5 py-0.5 text-xs font-black text-black">
              {data.incoming.length}
            </span>
          </div>

          <div className="space-y-3">
            {data.incoming.length === 0 ? (
              <div className="rounded-[16px] border border-black bg-card-white p-6 text-center text-black space-y-1 shadow-[2px_2px_0_#000]">
                <p className="font-bold text-sm">No pending requests</p>
                <p className="text-xs text-hairline-smoke">When friends add your Pocket ID, their requests show up here.</p>
              </div>
            ) : (
              data.incoming.map((request) => (
                <article
                  key={request.id}
                  className="rounded-[16px] border border-black bg-card-white p-4 text-black space-y-3 shadow-[2px_2px_0_#000]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={request.user.name} url={request.user.avatar_url} size="md" />
                    <div>
                      <p className="font-bold text-black leading-tight">{request.user.name}</p>
                      <p className="text-xs text-hairline-smoke">@{request.user.username ?? "member"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-black/10">
                    <button
                      className="pc-btn pc-btn-primary flex-1 text-xs"
                      disabled={actionId === request.id}
                      onClick={() =>
                        performAction(
                          request.id,
                          `/friends/requests/${request.id}/accept`,
                          "POST",
                          "Could not accept this request.",
                          `You are now friends with ${request.user.name}!`
                        )
                      }
                    >
                      <IconCheck size={14} />
                      <span>Accept</span>
                    </button>
                    <button
                      className="pc-btn pc-btn-ghost flex-1 text-xs"
                      disabled={actionId === request.id}
                      onClick={() =>
                        performAction(
                          request.id,
                          `/friends/requests/${request.id}/reject`,
                          "POST",
                          "Could not reject this request.",
                          "Request declined."
                        )
                      }
                    >
                      <IconClose size={14} />
                      <span>Decline</span>
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* Accepted Friends List */}
        <section className="pc-sticker-card pc-sticker-cyan p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between border-b border-black pb-3">
            <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black">
              YOUR FRIENDS
            </h2>
            <span className="rounded-full border border-black bg-toxic-lime px-2.5 py-0.5 text-xs font-black text-black">
              {data.friends.length}
            </span>
          </div>

          <div className="space-y-3">
            {data.friends.length === 0 ? (
              <div className="rounded-[16px] border border-black bg-card-white p-6 text-center text-black space-y-1 shadow-[2px_2px_0_#000]">
                <p className="font-bold text-sm">No friends added yet</p>
                <p className="text-xs text-hairline-smoke">Search someone above using their Pocket ID to start your circle.</p>
              </div>
            ) : (
              data.friends.map((friend) => (
                <article
                  key={friend.id}
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-black bg-card-white p-3.5 shadow-[2px_2px_0_#000]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={friend.name} url={friend.avatar_url} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-black text-sm">{friend.name}</p>
                      <p className="truncate text-xs text-hairline-smoke">
                        @{friend.username ?? "member"} ·{" "}
                        <span className="font-mono">{friend.pocket_id}</span>
                      </p>
                    </div>
                  </div>

                  {confirmDeleteId === friend.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        className="rounded-lg border border-black bg-riot-pink px-2.5 py-1 text-xs font-bold text-black hover:bg-[#e000e6] transition shadow-[1px_1px_0_#000]"
                        disabled={actionId === friend.id}
                        onClick={() =>
                          performAction(
                            friend.id,
                            `/friends/${friend.id}`,
                            "DELETE",
                            "Could not remove this friend.",
                            `Removed ${friend.name} from circle.`
                          )
                        }
                      >
                        Confirm
                      </button>
                      <button
                        className="rounded-lg border border-black bg-card-white px-2 py-1 text-xs font-bold text-black hover:bg-paper-cream transition shadow-[1px_1px_0_#000]"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="pc-btn pc-btn-ghost text-xs px-2.5 py-1 shrink-0"
                      disabled={actionId === friend.id}
                      onClick={() => setConfirmDeleteId(friend.id)}
                      title="Remove friend"
                      aria-label={`Remove ${friend.name}`}
                    >
                      <IconTrash size={14} />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Outgoing Pending Requests */}
      {data.outgoing.length > 0 && (
        <section className="pc-sticker-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between border-b border-black pb-3">
            <h2 className="font-display text-xl font-black uppercase tracking-tight text-black">
              SENT REQUESTS ({data.outgoing.length})
            </h2>
            <span className="text-xs font-medium text-hairline-smoke">Awaiting approval</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {data.outgoing.map((request) => (
              <article
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-[16px] border border-black bg-card-white p-3.5 shadow-[2px_2px_0_#000]"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={request.user.name} url={request.user.avatar_url} size="sm" />
                  <div>
                    <p className="font-bold text-black text-sm">{request.user.name}</p>
                    <p className="text-xs text-hairline-smoke">Waiting for reply</p>
                  </div>
                </div>

                <button
                  className="pc-btn pc-btn-ghost text-xs px-2.5 py-1"
                  disabled={actionId === request.id}
                  onClick={() =>
                    performAction(
                      request.id,
                      `/friends/requests/${request.id}`,
                      "DELETE",
                      "Could not cancel this request.",
                      "Friend request cancelled."
                    )
                  }
                >
                  <IconClose size={13} />
                  <span>Cancel</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
