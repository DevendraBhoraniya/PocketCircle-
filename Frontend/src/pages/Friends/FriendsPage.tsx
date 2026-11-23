import { useEffect, useState } from "react";

import { apiClient, getErrorMessage } from "../../api/client";
import Avatar from "../../components/Avatar";
import type { User } from "../../context/auth-context";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
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
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { FriendsSkeleton } from "../../components/skeletons";

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
  const { toast } = useToast();
  useDocumentTitle("Friends");

  const [data, setData] = useState<FriendsData>(emptyData);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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
        const requestsData: { incoming: FriendRequest[]; outgoing: FriendRequest[] } =
          await requestsResponse.json();

        if (active) {
          setData({
            friends: friendsData.friends,
            incoming: requestsData.incoming,
            outgoing: requestsData.outgoing,
          });
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load your friend list."
          );
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
    const requestsData: { incoming: FriendRequest[]; outgoing: FriendRequest[] } =
      await requestsResponse.json();
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
        const errMsg = await getErrorMessage(response, errorMessage);
        setError(errMsg);
        toast.error(errMsg, "Action Failed");
        return;
      }
      await refreshFriends();
      if (successMessage) {
        toast.success(successMessage);
      }
      setResults([]);
      setHasSearched(false);
      setQuery("");
      setConfirmDeleteId(null);
    } catch {
      setError(errorMessage);
      toast.error(errorMessage, "Network Error");
    } finally {
      setActionId(null);
    }
  }

  const copyPocketId = async () => {
    if (!user?.pocket_id) return;
    try {
      await navigator.clipboard.writeText(user.pocket_id);
      setCopied(true);
      toast.success("Pocket ID copied to clipboard", "Copied");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      toast.info(`Pocket ID: ${user.pocket_id}`);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const isFriend = (targetId: string) => data.friends.some((f) => f.id === targetId);
  const isPendingOutgoing = (targetId: string) => data.outgoing.some((r) => r.user.id === targetId);
  const isPendingIncoming = (targetId: string) => data.incoming.some((r) => r.user.id === targetId);

  if (loading || isLoading) {
    return <FriendsSkeleton />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4 sm:py-6">

      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="pc-heading-sm text-ink-black">
              Circle Friends
            </h1>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-parchment text-steel border border-sand">
              {data.friends.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-steel max-w-lg">
            Connect via 10-digit numeric Pocket IDs. Once linked, you can add friends to shared circles and split expenses.
          </p>
        </div>

        {/* Your Pocket ID Chip */}
        <div className="flex items-center gap-3 rounded-xl border border-sand bg-paper-white px-4 py-2.5 shadow-2xs">
          <div className="space-y-0.5 text-left">
            <p className="text-[11px] font-medium text-steel">Your Pocket ID</p>
            <p className="font-mono text-base font-bold tracking-wider text-ink-black">
              {user.pocket_id}
            </p>
          </div>
          <button
            onClick={copyPocketId}
            className="grid h-8 w-8 place-items-center rounded-lg bg-parchment hover:bg-sand transition text-ink-black border border-sand/80"
            title="Copy Pocket ID"
            aria-label="Copy Pocket ID"
          >
            {copied ? <IconCheck size={14} className="text-emerald-600" /> : <IconCopy size={14} />}
          </button>
        </div>
      </header>

      {/* Find Someone Search Section */}
      <section className="rounded-xl border border-sand bg-paper-white p-6 shadow-xs space-y-4">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold text-ink-black">Find Circle Members</h2>
          <p className="text-xs sm:text-sm text-steel">
            Search by username (e.g. <span className="font-medium text-ink-black">alice_12</span>)
            or exact 10-digit numeric Pocket ID.
          </p>
        </div>

        <form onSubmit={searchUsers} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-steel">
              <IconSearch size={18} />
            </span>
            <input
              id="friend-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pc-input !pl-10 !pr-10"
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
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-steel hover:text-ink-black"
                aria-label="Clear search"
              >
                <IconClose size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="pc-btn pc-btn-primary min-h-[46px] px-7 shrink-0 text-sm"
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
            <p className="text-xs font-medium text-steel">
              Search results ({results.length})
            </p>
            <div className="grid gap-3">
              {results.map((result) => {
                const alreadyFriend = isFriend(result.id);
                const pendingOut = isPendingOutgoing(result.id);
                const pendingIn = isPendingIncoming(result.id);

                return (
                  <article
                    key={result.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[20px] border border-sand bg-parchment p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={result.name} url={result.avatar_url} size="md" />
                      <div>
                        <p className="font-semibold text-ink-black leading-tight">{result.name}</p>
                        <p className="text-xs text-steel">
                          @{result.username ?? "member"} ·{" "}
                          <span className="font-mono">{result.pocket_id}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {alreadyFriend ? (
                        <span className="pc-badge pc-badge-soft text-xs text-steel">
                          <IconCheck size={13} className="text-electric-blue" />
                          <span>Already friends</span>
                        </span>
                      ) : pendingOut ? (
                        <span className="pc-badge pc-badge-soft text-xs text-steel">
                          <IconClock size={13} />
                          <span>Request pending</span>
                        </span>
                      ) : pendingIn ? (
                        <span className="pc-badge pc-badge-blue text-xs">Review request below</span>
                      ) : (
                        <button
                          className="pc-btn pc-btn-primary text-xs py-1.5 px-4 h-9"
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
          <div className="rounded-[18px] border border-sand bg-parchment p-6 text-center space-y-1">
            <p className="font-semibold text-sm text-ink-black">No circle members found</p>
            <p className="text-xs text-steel">
              No matching username or Pocket ID for &quot;{query}&quot;. Verify the digits and try
              again.
            </p>
          </div>
        )}
      </section>

      {/* Error Alert */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          role="alert"
        >
          <IconExclamation size={18} className="shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Dual Sections: Requests for You & Your Friends */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Incoming Requests */}
        <section className="rounded-xl border border-sand bg-paper-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-sand pb-3">
            <h2 className="text-lg font-semibold text-ink-black">Incoming Requests</h2>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-electric-blue/10 text-electric-blue border border-electric-blue/20">
              {data.incoming.length}
            </span>
          </div>

          <div className="space-y-3">
            {data.incoming.length === 0 ? (
              <div className="rounded-lg border border-sand bg-parchment/50 p-6 text-center space-y-1">
                <p className="font-semibold text-sm text-ink-black">No pending requests</p>
                <p className="text-xs text-steel">
                  When someone adds your Pocket ID, their invitation will appear here.
                </p>
              </div>
            ) : (
              data.incoming.map((request) => (
                <article
                  key={request.id}
                  className="rounded-lg border border-sand bg-paper-white p-3.5 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={request.user.name} url={request.user.avatar_url} size="md" />
                    <div>
                      <p className="font-semibold text-ink-black leading-tight text-sm">
                        {request.user.name}
                      </p>
                      <p className="text-xs text-steel">@{request.user.username ?? "member"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-sand">
                    <button
                      className="pc-btn pc-btn-primary flex-1 text-xs h-8"
                      disabled={actionId === request.id}
                      onClick={() =>
                        performAction(
                          request.id,
                          `/friends/requests/${request.id}/accept`,
                          "POST",
                          "Could not accept this request.",
                          `You are now linked with ${request.user.name}!`
                        )
                      }
                    >
                      <IconCheck size={13} />
                      <span>Accept</span>
                    </button>
                    <button
                      className="pc-btn pc-btn-white flex-1 text-xs h-8"
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
                      <IconClose size={13} />
                      <span>Decline</span>
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* Accepted Friends List */}
        <section className="rounded-xl border border-sand bg-paper-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-sand pb-3">
            <div className="flex items-center gap-2">
              <IconUsers size={16} className="text-electric-blue" />
              <h2 className="text-lg font-semibold text-ink-black">Your Circle</h2>
            </div>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-parchment text-steel border border-sand">
              {data.friends.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {data.friends.length === 0 ? (
              <div className="rounded-lg border border-sand bg-parchment/50 p-6 text-center space-y-1">
                <p className="font-semibold text-sm text-ink-black">No friends linked yet</p>
                <p className="text-xs text-steel">
                  Search someone above using their Pocket ID to start your circle.
                </p>
              </div>
            ) : (
              data.friends.map((friend) => (
                <article
                  key={friend.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-sand/80 bg-paper-white hover:border-ink-black transition p-3 shadow-2xs"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={friend.name} url={friend.avatar_url} size="md" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-black text-sm">{friend.name}</p>
                      <p className="truncate text-xs text-steel">
                        @{friend.username ?? "member"} &bull;{" "}
                        <span className="font-mono">{friend.pocket_id}</span>
                      </p>
                    </div>
                  </div>

                  {confirmDeleteId === friend.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        className="pc-btn pc-btn-ember text-xs h-7 px-2.5 py-0.5"
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
                        className="pc-btn pc-btn-white text-xs h-7 px-2 py-0.5"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="pc-btn pc-btn-white text-xs h-8 px-2.5 py-1 shrink-0 text-steel hover:text-rose-600 hover:border-rose-300"
                      disabled={actionId === friend.id}
                      onClick={() => setConfirmDeleteId(friend.id)}
                      title="Remove friend"
                      aria-label={`Remove ${friend.name}`}
                    >
                      <IconTrash size={13} />
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
        <section className="rounded-xl border border-sand bg-paper-white p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-sand pb-3">
            <h2 className="text-base font-semibold text-ink-black">
              Sent Requests ({data.outgoing.length})
            </h2>
            <span className="text-xs text-steel">Awaiting acceptance</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {data.outgoing.map((request) => (
              <article
                key={request.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-sand bg-parchment/40 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={request.user.name} url={request.user.avatar_url} size="sm" />
                  <div>
                    <p className="font-semibold text-ink-black text-xs">{request.user.name}</p>
                    <p className="text-[11px] text-steel">Awaiting approval</p>
                  </div>
                </div>

                <button
                  className="pc-btn pc-btn-white text-xs h-7 px-2.5 py-0.5"
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
                  <IconClose size={12} />
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
