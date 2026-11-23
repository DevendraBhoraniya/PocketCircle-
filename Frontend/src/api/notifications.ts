import { apiClient } from "./client";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  pocket_id: string;
  avatar_url: string | null;
}

export interface NotificationItem {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  group_id: string | null;
  group_name: string | null;
  event_type: string;
  payload: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  actor: PublicUser | null;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  total_count: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface MarkReadResponse {
  message: string;
  updated_count: number;
}

export async function getNotifications(
  unreadOnly: boolean = false,
  limit: number = 50,
  offset: number = 0,
): Promise<NotificationListResponse> {
  const params = new URLSearchParams({
    unread_only: unreadOnly ? "true" : "false",
    limit: limit.toString(),
    offset: offset.toString(),
  });
  const res = await apiClient(`/notifications?${params.toString()}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to load notifications");
  }
  return res.json();
}

export async function getUnreadCount(): Promise<number> {
  const res = await apiClient("/notifications/unread-count");
  if (!res.ok) {
    return 0;
  }
  const data: UnreadCountResponse = await res.json();
  return data.unread_count;
}

export async function markNotificationRead(notificationId: string): Promise<NotificationItem> {
  const res = await apiClient(`/notifications/${notificationId}/read`, {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to mark notification as read");
  }
  return res.json();
}

export async function markAllNotificationsRead(): Promise<MarkReadResponse> {
  const res = await apiClient("/notifications/read-all", {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to mark all notifications as read");
  }
  return res.json();
}
