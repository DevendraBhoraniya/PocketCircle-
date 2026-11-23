import { apiClient } from "./client";
import type { PublicUser } from "./groups";

export interface SettlementItem {
  id: string;
  group_id: string;
  payer: PublicUser;
  payee: PublicUser;
  amount: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled";
  notes?: string | null;
  action_by?: PublicUser | null;
  action_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementListResponse {
  group_id: string;
  settlements: SettlementItem[];
}

export interface CreateSettlementPayload {
  payee_id: string;
  amount: string;
  notes?: string;
}

export async function listGroupSettlements(groupId: string): Promise<SettlementItem[]> {
  const res = await apiClient(`/groups/${groupId}/settlements`);
  if (!res.ok) {
    throw new Error("Failed to load settlements");
  }
  const data: SettlementListResponse = await res.json();
  return data.settlements;
}

export async function createSettlement(
  groupId: string,
  payload: CreateSettlementPayload,
): Promise<SettlementItem> {
  const res = await apiClient(`/groups/${groupId}/settlements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to submit settlement");
  }
  return res.json();
}

export async function confirmSettlement(
  groupId: string,
  settlementId: string,
): Promise<SettlementItem> {
  const res = await apiClient(`/groups/${groupId}/settlements/${settlementId}/confirm`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to confirm settlement");
  }
  return res.json();
}

export async function rejectSettlement(
  groupId: string,
  settlementId: string,
): Promise<SettlementItem> {
  const res = await apiClient(`/groups/${groupId}/settlements/${settlementId}/reject`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reject settlement");
  }
  return res.json();
}

export async function cancelSettlement(
  groupId: string,
  settlementId: string,
): Promise<SettlementItem> {
  const res = await apiClient(`/groups/${groupId}/settlements/${settlementId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to cancel settlement");
  }
  return res.json();
}
