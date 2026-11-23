import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiClient } from "../../api/client";
import { createGroup, listGroups, type GroupSummary, type PublicUser } from "../../api/groups";
import { getUserCrossGroupSummary, type GroupBalanceSummaryItem } from "../../api/balances";
import Avatar from "../../components/Avatar";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { useModalAccessibility } from "../../hooks/useModalAccessibility";
import {
  IconUsers,
  IconPlus,
  IconClose,
  IconChevronRight,
  IconExclamation,
  IconCheck,
  IconTrendingUp,
  IconTrendingDown,
} from "../../components/Icons";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import { GroupListSkeleton } from "../../components/skeletons";

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  useDocumentTitle("Circles");
  const navigate = useNavigate();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [balanceMap, setBalanceMap] = useState<Record<string, GroupBalanceSummaryItem>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Create Group Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "owed" | "owes" | "settled">("all");

  const createModalRef = useModalAccessibility({
    isOpen: isModalOpen,
    onClose: () => setIsModalOpen(false),
  });

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [groupsData, friendsRes, summaryData] = await Promise.all([
        listGroups(),
        apiClient("/friends"),
        getUserCrossGroupSummary().catch(() => null),
      ]);

      setGroups(groupsData);

      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        if (Array.isArray(friendsData.friends)) {
          setFriends(friendsData.friends);
        }
      }

      if (summaryData && Array.isArray(summaryData.groups)) {
        const map: Record<string, GroupBalanceSummaryItem> = {};
        summaryData.groups.forEach((g) => {
          map[g.group_id] = g;
        });
        setBalanceMap(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!user) return;
    let active = true;

    async function fetchData() {
      try {
        const [groupsData, friendsRes, summaryData] = await Promise.all([
          listGroups(),
          apiClient("/friends"),
          getUserCrossGroupSummary().catch(() => null),
        ]);

        if (active) {
          setGroups(groupsData);
        }

        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          if (active && Array.isArray(friendsData.friends)) {
            setFriends(friendsData.friends);
          }
        }

        if (summaryData && Array.isArray(summaryData.groups)) {
          const map: Record<string, GroupBalanceSummaryItem> = {};
          summaryData.groups.forEach((g) => {
            map[g.group_id] = g;
          });
          if (active) {
            setBalanceMap(map);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load groups");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void fetchData();
    return () => {
      active = false;
    };
  }, [user]);

  const handleOpenCreateModal = () => {
    setGroupName("");
    setGroupDesc("");
    setSelectedFriendIds([]);
    setModalError("");
    setIsModalOpen(true);
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setModalError("Please enter a group name");
      return;
    }

    setIsSubmitting(true);
    setModalError("");

    try {
      const newGroup = await createGroup(
        groupName.trim(),
        groupDesc.trim() || undefined,
        selectedFriendIds
      );
      setIsModalOpen(false);
      toast.success(`Created circle "${newGroup.name}"!`, "Circle Created");
      navigate(`/groups/${newGroup.id}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to create group";
      setModalError(errMsg);
      toast.error(errMsg, "Creation Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || (isLoading && groups.length === 0)) {
    return <GroupListSkeleton />;
  }

  const filteredGroups = groups.filter((grp) => {
    const bal = balanceMap[grp.id];
    const net = bal ? parseFloat(bal.my_net_balance) : 0;
    if (activeFilter === "owed") return net > 0;
    if (activeFilter === "owes") return net < 0;
    if (activeFilter === "settled") return net === 0;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4 sm:py-6">
      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sand pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="pc-heading-sm text-ink-black">
              Expense Circles
            </h1>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-parchment text-steel border border-sand">
              {groups.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-steel max-w-lg">
            Shared expense groups and trip ledgers. Track multi-payer expenses with deterministic decimal math.
          </p>
        </div>

        <div>
          <button
            onClick={handleOpenCreateModal}
            className="pc-btn pc-btn-primary flex items-center gap-2 text-sm shadow-sm font-semibold"
          >
            <IconPlus size={16} />
            <span>Create Circle</span>
          </button>
        </div>
      </header>

      {/* Filter Tabs */}
      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "all", label: `All (${groups.length})` },
              { id: "owed", label: "Owed to you" },
              { id: "owes", label: "You owe" },
              { id: "settled", label: "Settled" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition ${
                activeFilter === tab.id
                  ? "bg-ink-black text-white border-ink-black shadow-2xs"
                  : "bg-paper-white text-steel border-sand hover:text-ink-black hover:border-fog"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-center gap-3">
          <IconExclamation size={16} />
          <span>{error}</span>
          <button
            onClick={() => void refreshData()}
            className="ml-auto underline font-semibold hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand bg-parchment/50 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sand/70 text-steel">
            <IconUsers size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="pc-heading-sm text-lg text-ink-black">No circles yet</h3>
            <p className="text-xs sm:text-sm text-steel max-w-sm mx-auto">
              Start by creating your first group circle with your friends to track shared expenses together.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="pc-btn pc-btn-primary inline-flex items-center gap-2 text-sm font-semibold shadow-sm"
          >
            <IconPlus size={16} />
            <span>Create your first circle</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-xl border border-sand bg-paper-white p-8 text-center text-xs text-steel">
          No circles found matching the &ldquo;{activeFilter}&rdquo; filter.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((grp) => {
            const bal = balanceMap[grp.id];
            const net = bal ? parseFloat(bal.my_net_balance) : 0;

            return (
              <Link
                key={grp.id}
                to={`/groups/${grp.id}`}
                className="group flex flex-col justify-between rounded-xl border border-sand bg-paper-white p-6 transition hover:border-ink-black hover:shadow-xs"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${
                        grp.my_role === "owner"
                          ? "bg-electric-blue/10 text-electric-blue border-electric-blue/20"
                          : grp.my_role === "admin"
                          ? "bg-amber-50 text-amber-800 border-amber-200"
                          : "bg-parchment text-steel border-sand"
                      }`}
                    >
                      {grp.my_role}
                    </span>
                    <span className="text-xs text-steel flex items-center gap-1 font-mono">
                      <IconUsers size={13} />
                      <span>{grp.member_count} {grp.member_count === 1 ? "member" : "members"}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-ink-black group-hover:text-electric-blue transition line-clamp-1">
                      {grp.name}
                    </h3>
                    {grp.description && (
                      <p className="text-xs text-steel line-clamp-2 mt-1">
                        {grp.description}
                      </p>
                    )}
                  </div>

                  {bal && (
                    <div className="pt-1">
                      {net > 0 ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          <IconTrendingUp size={13} />
                          +₹{net.toFixed(2)}
                          <span className="text-[10px] font-normal text-emerald-700">(Owed to you)</span>
                        </span>
                      ) : net < 0 ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                          <IconTrendingDown size={13} />
                          -₹{Math.abs(net).toFixed(2)}
                          <span className="text-[10px] font-normal text-rose-700">(You owe)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-steel bg-parchment border border-sand px-2.5 py-1 rounded-lg">
                          <IconCheck size={13} />
                          ₹0.00
                          <span className="text-[10px] font-normal text-steel">(Settled)</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-sand/60 pt-3.5 text-xs font-semibold text-steel group-hover:text-ink-black">
                  <span>
                    {bal?.status === "owes"
                      ? "Settle balance"
                      : bal?.status === "owed"
                      ? "Collect share"
                      : "View ledger"}
                  </span>
                  <IconChevronRight
                    size={15}
                    className="transition transform group-hover:translate-x-1 text-steel group-hover:text-electric-blue"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Group Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 p-4 backdrop-blur-sm animate-fade-in">
          <div
            ref={createModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-circle-title"
            className="w-full max-w-lg rounded-[28px] border border-sand bg-white p-6 sm:p-8 shadow-xl space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 id="create-circle-title" className="text-xl font-semibold text-ink-black">Create New Circle</h2>
                <p className="text-xs text-steel mt-0.5">Start a shared expense group</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-full text-steel hover:bg-parchment hover:text-ink-black transition"
                aria-label="Close create circle dialog"
              >
                <IconClose size={18} />
              </button>
            </div>

            {modalError && (
              <div className="rounded-xl border border-ember-orange/40 bg-ember-orange/10 p-3 text-xs font-medium text-ember-orange flex items-center gap-2">
                <IconExclamation size={14} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="group-name" className="text-xs font-medium text-steel">
                  Circle name <span className="text-ember-orange">*</span>
                </label>
                <input
                  id="group-name"
                  type="text"
                  required
                  placeholder="e.g. Goa Trip 2026, Apartment 4B"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  maxLength={100}
                  className="pc-input"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="group-desc" className="text-xs font-medium text-steel">
                  Description <span className="text-fog font-normal">(optional)</span>
                </label>
                <input
                  id="group-desc"
                  type="text"
                  placeholder="e.g. Shared expenses for hotel and dining"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  maxLength={255}
                  className="pc-input"
                />
              </div>

              {/* Add Initial Friends */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-steel">
                    Add accepted friends
                  </label>
                  <span className="text-xs text-steel">
                    {selectedFriendIds.length} selected
                  </span>
                </div>

                {friends.length === 0 ? (
                  <div className="rounded-xl border border-sand bg-parchment p-4 text-center text-xs text-steel space-y-1">
                    <p>No accepted friends yet.</p>
                    <Link
                      to="/friends"
                      onClick={() => setIsModalOpen(false)}
                      className="font-semibold text-electric-blue hover:underline"
                    >
                      Search & add friends first &rarr;
                    </Link>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-sand bg-parchment p-2">
                    {friends.map((f) => {
                      const isSelected = selectedFriendIds.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFriendSelection(f.id)}
                          className={`w-full flex items-center justify-between rounded-lg p-2 text-left transition ${
                            isSelected
                              ? "bg-white border border-sand font-medium"
                              : "hover:bg-sand/40 text-steel"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Avatar name={f.name} url={f.avatar_url} size="xs" />
                            <div>
                              <p className="text-xs font-bold text-ink-black leading-tight">
                                {f.name}
                              </p>
                              <p className="text-[11px] font-mono text-steel">
                                {f.pocket_id}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`grid h-5 w-5 place-items-center rounded-full border ${
                              isSelected
                                ? "bg-electric-blue border-electric-blue text-white"
                                : "border-sand bg-white"
                            }`}
                          >
                            {isSelected && <IconCheck size={12} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="pc-btn pc-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !groupName.trim()}
                  className="pc-btn pc-btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <IconPlus size={14} />
                  )}
                  <span>Create Circle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
