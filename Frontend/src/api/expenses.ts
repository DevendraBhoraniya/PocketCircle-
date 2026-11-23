import { apiClient } from "./client";
import type { PublicUser } from "./groups";

export interface ExpensePayerItem {
  id: string;
  user: PublicUser;
  amount: string;
}

export interface ExpenseParticipantItem {
  id: string;
  user: PublicUser;
  amount: string;
}

export interface ExpenseItem {
  id: string;
  group_id: string;
  description: string;
  amount: string;
  split_type: "equal" | "exact";
  creator: PublicUser;
  payers: ExpensePayerItem[];
  participants: ExpenseParticipantItem[];
  created_at: string;
  updated_at: string;
}

export interface AuditEventItem {
  id: string;
  group_id: string | null;
  actor: PublicUser;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string;
}

export interface CreateExpensePayload {
  description: string;
  amount: string;
  split_type: "equal" | "exact";
  payers?: { user_id: string; amount: string }[];
  participants?: { user_id: string; amount?: string }[];
}

export interface UpdateExpensePayload {
  description?: string;
  amount?: string;
  split_type?: "equal" | "exact";
  payers?: { user_id: string; amount: string }[];
  participants?: { user_id: string; amount?: string }[];
}

export async function listExpenses(groupId: string): Promise<ExpenseItem[]> {
  const res = await apiClient(`/groups/${groupId}/expenses`);
  if (!res.ok) {
    throw new Error("Failed to load expenses");
  }
  return res.json();
}

export async function createExpense(
  groupId: string,
  data: CreateExpensePayload
): Promise<ExpenseItem> {
  const res = await apiClient(`/groups/${groupId}/expenses`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create expense");
  }
  return res.json();
}

export async function getExpense(
  groupId: string,
  expenseId: string
): Promise<ExpenseItem> {
  const res = await apiClient(`/groups/${groupId}/expenses/${expenseId}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch expense details");
  }
  return res.json();
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  data: UpdateExpensePayload
): Promise<ExpenseItem> {
  const res = await apiClient(`/groups/${groupId}/expenses/${expenseId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update expense");
  }
  return res.json();
}

export async function deleteExpense(
  groupId: string,
  expenseId: string
): Promise<void> {
  const res = await apiClient(`/groups/${groupId}/expenses/${expenseId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to delete expense");
  }
}

export async function getGroupActivity(groupId: string): Promise<AuditEventItem[]> {
  const res = await apiClient(`/groups/${groupId}/activity`);
  if (!res.ok) {
    throw new Error("Failed to load group activity");
  }
  return res.json();
}
