import { apiClient } from "./client";
import type { PublicUser } from "./groups";
import type { AuditEventItem } from "./expenses";

export interface UserBalanceItem {
  user: PublicUser;
  net_balance: string;
  total_paid: string;
  total_owed: string;
  status: "owed" | "owes" | "settled";
}

export interface GroupBalancesResponse {
  group_id: string;
  total_group_spending: string;
  my_net_balance: string;
  balances: UserBalanceItem[];
}

export interface SettlementTransferItem {
  from_user: PublicUser;
  to_user: PublicUser;
  amount: string;
}

export interface SettlementPlanResponse {
  group_id: string;
  transfers: SettlementTransferItem[];
  total_settlement_amount: string;
}

export interface GroupBalanceSummaryItem {
  group_id: string;
  group_name: string;
  my_net_balance: string;
  my_role: string;
  member_count: number;
  status: "owed" | "owes" | "settled";
}

export interface UserCrossGroupSummary {
  overall_net_balance: string;
  total_owed_to_me: string;
  total_i_owe: string;
  groups: GroupBalanceSummaryItem[];
  recent_activity: AuditEventItem[];
}

export async function getGroupBalances(groupId: string): Promise<GroupBalancesResponse> {
  const res = await apiClient(`/groups/${groupId}/balances`);
  if (!res.ok) {
    throw new Error("Failed to load circle balances");
  }
  return res.json();
}

export async function getSettlementPlan(groupId: string): Promise<SettlementPlanResponse> {
  const res = await apiClient(`/groups/${groupId}/settlement-plan`);
  if (!res.ok) {
    throw new Error("Failed to load settlement plan");
  }
  return res.json();
}

export async function getUserCrossGroupSummary(): Promise<UserCrossGroupSummary> {
  const res = await apiClient("/balances/summary");
  if (!res.ok) {
    throw new Error("Failed to load cross-circle balance summary");
  }
  return res.json();
}
