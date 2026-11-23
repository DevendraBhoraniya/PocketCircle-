import { apiClient } from "./client";
import type { ExpenseItem, AuditEventItem } from "./expenses";
import type { GroupBalancesResponse, SettlementPlanResponse } from "./balances";
import type { SettlementItem } from "./settlements";

export interface GroupOverview {
  group: GroupDetail;
  expenses: ExpenseItem[];
  activity: AuditEventItem[];
  balances: GroupBalancesResponse;
  settlement_plan: SettlementPlanResponse;
  settlements: SettlementItem[];
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  pocket_id: string;
  avatar_url: string | null;
}

export interface GroupMemberItem {
  id: string;
  user: PublicUser;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  my_role: "owner" | "admin" | "member";
  member_count: number;
  created_at: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  my_role: "owner" | "admin" | "member";
  members: GroupMemberItem[];
  created_at: string;
}

export async function listGroups(): Promise<GroupSummary[]> {
  const res = await apiClient("/groups");
  if (!res.ok) {
    throw new Error("Failed to fetch groups");
  }
  return res.json();
}

export async function createGroup(
  name: string,
  description?: string,
  initialMemberIds?: string[]
): Promise<GroupDetail> {
  const res = await apiClient("/groups", {
    method: "POST",
    body: JSON.stringify({
      name,
      description: description || null,
      initial_member_ids: initialMemberIds || [],
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create group");
  }
  return res.json();
}

export async function getGroup(groupId: string): Promise<GroupDetail> {
  const res = await apiClient(`/groups/${groupId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch group details");
  }
  return res.json();
}

export async function updateGroup(
  groupId: string,
  name?: string,
  description?: string
): Promise<GroupDetail> {
  const res = await apiClient(`/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update group");
  }
  return res.json();
}

export async function deleteGroup(groupId: string): Promise<void> {
  const res = await apiClient(`/groups/${groupId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to delete group");
  }
}

export async function addGroupMember(
  groupId: string,
  userId: string
): Promise<GroupDetail> {
  const res = await apiClient(`/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to add member");
  }
  return res.json();
}

export async function updateMemberRole(
  groupId: string,
  userId: string,
  role: "admin" | "member"
): Promise<GroupDetail> {
  const res = await apiClient(`/groups/${groupId}/members/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update role");
  }
  return res.json();
}

export async function transferOwnership(
  groupId: string,
  newOwnerId: string
): Promise<GroupDetail> {
  const res = await apiClient(`/groups/${groupId}/transfer-ownership`, {
    method: "POST",
    body: JSON.stringify({ new_owner_id: newOwnerId }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to transfer ownership");
  }
  return res.json();
}

export async function removeMember(
  groupId: string,
  userId: string
): Promise<GroupDetail> {
  const res = await apiClient(`/groups/${groupId}/members/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to remove member");
  }
  return res.json();
}

export async function leaveGroup(groupId: string): Promise<void> {
  const res = await apiClient(`/groups/${groupId}/leave`, {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to leave group");
  }
}

export async function getGroupOverview(groupId: string): Promise<GroupOverview> {
  const res = await apiClient(`/groups/${groupId}/overview`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch group overview");
  }
  return res.json();
}
