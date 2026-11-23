import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import {
  addGroupMember,
  deleteGroup,
  getGroupOverview,
  leaveGroup,
  removeMember,
  transferOwnership,
  updateGroup,
  updateMemberRole,
  type GroupDetail,
  type PublicUser,
} from "../../api/groups";
import {
  createExpense,
  deleteExpense,
  updateExpense,
  type AuditEventItem,
  type ExpenseItem,
} from "../../api/expenses";
import {
  type GroupBalancesResponse,
  type SettlementPlanResponse,
  type SettlementTransferItem,
} from "../../api/balances";
import {
  cancelSettlement,
  confirmSettlement,
  createSettlement,
  rejectSettlement,
  type SettlementItem,
} from "../../api/settlements";
import ActivityItem from "../../components/ActivityItem";
import { GroupDetailSkeleton } from "../../components/skeletons";
import { useAuth } from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { useDocumentTitle } from "../../utils/useDocumentTitle";
import {
  IconArrowLeft,
  IconPlus,
  IconUsers,
  IconReceipt,
  IconHistory,
  IconTrash,
  IconEdit,
  IconClose,
  IconShield,
} from "../../components/Icons";

import ExpensesTab from "./components/ExpensesTab";
import BalancesTab from "./components/BalancesTab";
import MembersTab from "./components/MembersTab";
import ExpenseModal from "./components/ExpenseModal";
import ExpenseBreakdownModal from "./components/ExpenseBreakdownModal";
import SettleUpModal from "./components/SettleUpModal";
import GroupSettingsModals from "./components/GroupSettingsModals";

// Extracted helper to avoid duplicated fetch logic between initial load and mutation reloads
async function fetchGroupOverviewAndFriends(groupId: string) {
  const [overview, fRes] = await Promise.all([
    getGroupOverview(groupId),
    apiClient("/friends").catch(() => null),
  ]);
  let friendsList = null;
  if (fRes && fRes.ok) {
    const data = await fRes.json().catch(() => null);
    if (data && Array.isArray(data.friends)) {
      friendsList = data.friends;
    }
  }
  return { overview, friendsList };
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [activity, setActivity] = useState<AuditEventItem[]>([]);
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [balances, setBalances] = useState<GroupBalancesResponse | null>(null);
  const [settlementPlan, setSettlementPlan] = useState<SettlementPlanResponse | null>(null);
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);

  const [activeTab, setActiveTab] = useState<"expenses" | "balances" | "members" | "activity">("expenses");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [viewExpenseBreakdown, setViewExpenseBreakdown] = useState<ExpenseItem | null>(null);
  const [settleUpModalTransfer, setSettleUpModalTransfer] = useState<SettlementTransferItem | null>(null);

  useDocumentTitle(group ? `${group.name} | Circle` : "Circle Details");

  const loadAll = async () => {
    if (!groupId) return;
    try {
      const { overview, friendsList } = await fetchGroupOverviewAndFriends(groupId);
      setGroup(overview.group);
      setExpenses(overview.expenses);
      setActivity(overview.activity);
      setBalances(overview.balances);
      setSettlementPlan(overview.settlement_plan);
      setSettlements(overview.settlements);
      if (friendsList) {
        setFriends(friendsList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !groupId) return;
    let active = true;

    async function initialFetch() {
      try {
        const { overview, friendsList } = await fetchGroupOverviewAndFriends(groupId!);
        if (active) {
          setGroup(overview.group);
          setExpenses(overview.expenses);
          setActivity(overview.activity);
          setBalances(overview.balances);
          setSettlementPlan(overview.settlement_plan);
          setSettlements(overview.settlements);
          if (friendsList) {
            setFriends(friendsList);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load group details");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void initialFetch();
    return () => {
      active = false;
    };
  }, [user, groupId]);

  // Ownership & Roles
  const currentMember = group?.members.find((m) => m.user.id === user?.id);
  const isOwner = currentMember?.role === "owner";
  const isAdmin = currentMember?.role === "admin";
  const canManageMembers = isOwner || isAdmin;

  // Addable friends
  const memberUserIds = new Set(group?.members.map((m) => m.user.id) || []);
  const addableFriends = friends.filter((f) => !memberUserIds.has(f.id));

  // Expense Handlers
  const handleOpenExpenseModal = (expenseToEdit?: ExpenseItem) => {
    setEditingExpense(expenseToEdit ?? null);
    setIsExpenseModalOpen(true);
  };

  const handleSaveExpense = async (payload: {
    description: string;
    amount: string;
    split_type: "equal" | "exact";
    payers?: { user_id: string; amount: string }[];
    participants: { user_id: string; amount?: string }[];
  }) => {
    if (!groupId) return;
    try {
      if (editingExpense) {
        await updateExpense(groupId, editingExpense.id, payload);
        toast.success("Expense updated successfully", "Expense Saved");
      } else {
        await createExpense(groupId, payload);
        toast.success("Expense recorded in circle ledger", "Expense Added");
      }
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to save expense";
      setError(errMsg);
      toast.error(errMsg, "Expense Error");
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!groupId || !window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await deleteExpense(groupId, expenseId);
      toast.success("Expense deleted from ledger", "Expense Removed");
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete expense";
      setError(errMsg);
      toast.error(errMsg, "Delete Failed");
    }
  };

  // Member Handlers
  const handleAddMember = async (friendId: string) => {
    if (!groupId) return;
    try {
      await addGroupMember(groupId, friendId);
      toast.success("Friend added to circle", "Member Added");
      setIsAddMemberModalOpen(false);
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to add member";
      setError(errMsg);
      toast.error(errMsg, "Member Add Failed");
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!groupId || !window.confirm(`Remove ${memberName} from this circle?`)) return;
    try {
      await removeMember(groupId, userId);
      toast.info(`Removed ${memberName} from circle`, "Member Removed");
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to remove member";
      setError(errMsg);
      toast.error(errMsg, "Action Failed");
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "member") => {
    if (!groupId) return;
    try {
      await updateMemberRole(groupId, userId, newRole);
      toast.success(`Role updated to ${newRole}`, "Role Updated");
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to update role";
      setError(errMsg);
      toast.error(errMsg, "Update Failed");
    }
  };

  const handleTransferOwnership = async (newOwnerId: string) => {
    if (!groupId || !newOwnerId) return;
    try {
      await transferOwnership(groupId, newOwnerId);
      toast.success("Circle ownership transferred successfully", "Ownership Transferred");
      setIsTransferModalOpen(false);
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to transfer ownership";
      setError(errMsg);
      toast.error(errMsg, "Transfer Failed");
    }
  };

  // Group Handlers
  const handleUpdateGroup = async (name: string, description: string) => {
    if (!groupId) return;
    try {
      await updateGroup(groupId, name, description);
      toast.success("Circle details updated", "Circle Updated");
      setIsEditGroupModalOpen(false);
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to update group";
      setError(errMsg);
      toast.error(errMsg, "Update Failed");
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId || !window.confirm("Permanently delete this circle and its entire ledger? This cannot be undone.")) return;
    try {
      await deleteGroup(groupId);
      toast.success("Circle deleted permanently", "Circle Deleted");
      navigate("/groups");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to delete circle";
      setError(errMsg);
      toast.error(errMsg, "Delete Failed");
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !window.confirm("Are you sure you want to leave this circle?")) return;
    try {
      await leaveGroup(groupId);
      toast.info("You have left the circle", "Departed");
      navigate("/groups");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to leave circle";
      setError(errMsg);
      toast.error(errMsg, "Departure Blocked");
    }
  };

  // Settlement Handlers
  const handleCreateSettlement = async (transfer: SettlementTransferItem, notes: string) => {
    if (!groupId) return;
    try {
      await createSettlement(groupId, {
        payee_id: transfer.to_user.id,
        amount: transfer.amount,
        notes: notes.trim() || undefined,
      });
      toast.success("Settlement payment recorded! Waiting for payee confirmation.", "Settlement Recorded");
      setSettleUpModalTransfer(null);
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to record payment";
      setError(errMsg);
      toast.error(errMsg, "Settlement Failed");
    }
  };

  const handleConfirmSettlement = async (settlementId: string) => {
    if (!groupId) return;
    try {
      await confirmSettlement(groupId, settlementId);
      toast.success("Settlement payment confirmed! Ledger updated.", "Settlement Confirmed");
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to confirm settlement";
      setError(errMsg);
      toast.error(errMsg, "Confirmation Failed");
    }
  };

  const handleRejectSettlement = async (settlementId: string) => {
    if (!groupId || !window.confirm("Reject this payment? The payer will be notified.")) return;
    try {
      await rejectSettlement(groupId, settlementId);
      toast.info("Settlement payment rejected", "Settlement Rejected");
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to reject settlement";
      setError(errMsg);
      toast.error(errMsg, "Action Failed");
    }
  };

  const handleCancelSettlement = async (settlementId: string) => {
    if (!groupId || !window.confirm("Cancel this pending settlement request?")) return;
    try {
      await cancelSettlement(groupId, settlementId);
      toast.info("Settlement request cancelled", "Request Cancelled");
      await loadAll();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to cancel settlement";
      setError(errMsg);
      toast.error(errMsg, "Action Failed");
    }
  };

  if (loading || isLoading) {
    return <GroupDetailSkeleton />;
  }

  if (error && !group) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <div className="rounded-[28px] border border-sand bg-parchment p-8 space-y-4">
          <h2 className="text-xl font-bold text-ink-black">Unable to Load Circle</h2>
          <p className="text-sm text-steel">{error}</p>
          <Link to="/groups" className="pc-btn pc-btn-primary inline-flex text-xs">
            Back to Circles
          </Link>
        </div>
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/groups"
          className="inline-flex items-center gap-2 text-xs font-semibold text-steel hover:text-ink-black transition"
        >
          <IconArrowLeft size={16} />
          <span>Back to Circles</span>
        </Link>
        <div className="flex items-center gap-2">
          {isOwner ? (
            <button
              onClick={handleDeleteGroup}
              className="pc-btn pc-btn-secondary text-xs text-ember-orange hover:bg-ember-orange/10"
              title="Delete Circle"
            >
              <IconTrash size={14} />
              <span className="hidden sm:inline">Delete Circle</span>
            </button>
          ) : (
            <button
              onClick={handleLeaveGroup}
              className="pc-btn pc-btn-secondary text-xs text-steel hover:text-ember-orange"
              title="Leave Circle"
            >
              <IconClose size={14} />
              <span className="hidden sm:inline">Leave Circle</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Info Banner */}
      <div className="rounded-2xl border border-sand bg-paper-white p-6 sm:p-7 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-parchment text-steel border border-sand">
                Circle Ledger
              </span>
              <h1 className="pc-heading-sm text-ink-black">
                {group.name}
              </h1>
              {canManageMembers && (
                <button
                  onClick={() => setIsEditGroupModalOpen(true)}
                  className="p-1 text-steel hover:text-ink-black rounded-md hover:bg-parchment transition"
                  title="Edit Circle Details"
                  aria-label="Edit Circle Details"
                >
                  <IconEdit size={16} />
                </button>
              )}
            </div>
            {group.description && (
              <p className="text-sm text-steel max-w-xl">{group.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-steel pt-1">
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Deterministic Ledger</span>
              </span>
              <span className="inline-block h-1 w-1 rounded-full bg-sand" />
              <span>Created {new Date(group.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenExpenseModal()}
              className="pc-btn pc-btn-primary flex items-center gap-1.5 text-xs py-2 px-3 sm:px-4 font-bold shadow-xs"
            >
              <IconPlus size={15} />
              <span>Add Expense</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-sand pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
            activeTab === "expenses"
              ? "bg-ink-black text-paper-white"
              : "text-steel hover:text-ink-black hover:bg-sand/40"
          }`}
        >
          <IconReceipt size={14} />
          <span>Expenses ({expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("balances")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
            activeTab === "balances"
              ? "bg-ink-black text-paper-white"
              : "text-steel hover:text-ink-black hover:bg-sand/40"
          }`}
        >
          <IconShield size={14} />
          <span>Balances &amp; Settle Up</span>
          {settlementPlan && settlementPlan.transfers.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                activeTab === "balances" ? "bg-electric-blue text-paper-white" : "bg-sand text-ink-black"
              }`}
            >
              {settlementPlan.transfers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("members")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
            activeTab === "members"
              ? "bg-ink-black text-paper-white"
              : "text-steel hover:text-ink-black hover:bg-sand/40"
          }`}
        >
          <IconUsers size={14} />
          <span>Members ({group.members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition ${
            activeTab === "activity"
              ? "bg-ink-black text-paper-white"
              : "text-steel hover:text-ink-black hover:bg-sand/40"
          }`}
        >
          <IconHistory size={14} />
          <span>Audit Log ({activity.length})</span>
        </button>
      </div>

      {/* TAB 1: EXPENSES LEDGER */}
      {activeTab === "expenses" && (
        <ExpensesTab
          expenses={expenses}
          user={user}
          isOwner={isOwner}
          isAdmin={isAdmin}
          onOpenExpenseModal={handleOpenExpenseModal}
          onViewExpenseBreakdown={(exp) => setViewExpenseBreakdown(exp)}
          onDeleteExpense={handleDeleteExpense}
        />
      )}

      {/* TAB 2: BALANCES & SETTLEMENT */}
      {activeTab === "balances" && (
        <BalancesTab
          balances={balances}
          expensesCount={expenses.length}
          settlementPlan={settlementPlan}
          settlements={settlements}
          groupMembersCount={group.members.length}
          user={user}
          onSettleUp={(t) => setSettleUpModalTransfer(t)}
          onConfirmSettlement={handleConfirmSettlement}
          onRejectSettlement={handleRejectSettlement}
          onCancelSettlement={handleCancelSettlement}
        />
      )}

      {/* TAB 3: MEMBERS */}
      {activeTab === "members" && (
        <MembersTab
          group={group}
          user={user}
          isOwner={isOwner}
          isAdmin={isAdmin}
          canManageMembers={canManageMembers}
          addableFriendsCount={addableFriends.length}
          onOpenAddMemberModal={() => setIsAddMemberModalOpen(true)}
          onRoleChange={handleRoleChange}
          onRemoveMember={handleRemoveMember}
          onOpenTransferModal={() => setIsTransferModalOpen(true)}
        />
      )}

      {/* TAB 4: ACTIVITY / AUDIT TIMELINE */}
      {activeTab === "activity" && (
        <div className="space-y-3">
          {activity.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-sand bg-parchment/60 p-8 text-center text-xs text-steel">
              No activity recorded yet in this circle.
            </div>
          ) : (
            <div className="rounded-[24px] border border-sand bg-white divide-y divide-sand/60 overflow-hidden">
              {activity.map((ev) => (
                <ActivityItem key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ADD / EDIT EXPENSE */}
      {isExpenseModalOpen && (
        <ExpenseModal
          key={editingExpense ? editingExpense.id : "new"}
          editingExpense={editingExpense}
          group={group}
          user={user}
          onClose={() => setIsExpenseModalOpen(false)}
          onSave={handleSaveExpense}
        />
      )}

      {/* MODAL: EXPENSE BREAKDOWN */}
      <ExpenseBreakdownModal
        expense={viewExpenseBreakdown}
        onClose={() => setViewExpenseBreakdown(null)}
      />

      {/* MODAL: SETTLE UP / DIRECT PAYMENT */}
      <SettleUpModal
        transfer={settleUpModalTransfer}
        onClose={() => setSettleUpModalTransfer(null)}
        onSubmit={handleCreateSettlement}
      />

      {/* MODALS: ADD MEMBER, TRANSFER, EDIT */}
      <GroupSettingsModals
        isAddMemberOpen={isAddMemberModalOpen}
        onCloseAddMember={() => setIsAddMemberModalOpen(false)}
        addableFriends={addableFriends}
        onAddMember={handleAddMember}
        isTransferOpen={isTransferModalOpen}
        onCloseTransfer={() => setIsTransferModalOpen(false)}
        group={group}
        currentUserId={user?.id}
        onTransferOwnership={handleTransferOwnership}
        isEditGroupOpen={isEditGroupModalOpen}
        onCloseEditGroup={() => setIsEditGroupModalOpen(false)}
        initialName={group.name}
        initialDesc={group.description || ""}
        onUpdateGroup={handleUpdateGroup}
      />
    </div>
  );
}
