import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/useToast";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../api/notifications";
import { IconBell, IconCheck, IconSparkles } from "./Icons";
import Avatar from "./Avatar";
import { formatRelativeTime } from "../utils/date";



export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const previousUnreadRef = useRef<number | null>(null);

  // Poll for unread count periodically (pauses when document is hidden)
  useEffect(() => {
    let active = true;

    async function checkCount() {
      if (document.hidden) return;
      try {
        const count = await getUnreadCount();
        if (active) {
          if (previousUnreadRef.current !== null && count > previousUnreadRef.current) {
            const diff = count - previousUnreadRef.current;
            toast.info(
              `You have ${diff} new notification${diff > 1 ? "s" : ""}`,
              "New Activity"
            );
          }
          previousUnreadRef.current = count;
          setUnreadCount(count);
        }
      } catch {
        // silent fail
      }
    }

    void checkCount();
    const interval = setInterval(checkCount, 25000); // 25s poll

    function handleVisibilityChange() {
      if (!document.hidden && active) {
        void checkCount();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [toast]);

  // Fetch notifications when opened or filter toggled
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    async function loadNotifications() {
      setLoading(true);
      try {
        const data = await getNotifications(unreadOnly, 30);
        if (active) {
          setNotifications(data.notifications);
          setUnreadCount(data.unread_count);
        }
      } catch {
        // silent fail
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadNotifications();
    return () => {
      active = false;
    };
  }, [isOpen, unreadOnly]);

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleMarkRead(notif: NotificationItem) {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // fallback
      }
    }

    setIsOpen(false);
    if (notif.group_id) {
      navigate(`/groups/${notif.group_id}`);
    } else if (notif.event_type.startsWith("FRIEND_")) {
      navigate("/friends");
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read", "Notifications");
    } catch {
      toast.error("Failed to mark all as read", "Notifications");
    }
  }

  function getBadgeColor(eventType: string) {
    if (eventType.startsWith("FRIEND_")) return "bg-electric-blue/15 text-electric-blue border-electric-blue/30";
    if (eventType.startsWith("SETTLEMENT_")) return "bg-cyan-500/15 text-cyan-800 border-cyan-500/30";
    if (eventType.startsWith("EXPENSE_")) return "bg-toxic-lime/30 text-ink-black border-toxic-lime/60";
    return "bg-parchment text-steel border-sand";
  }

  return (

    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative grid h-9 w-9 place-items-center rounded-full border border-sand transition ${
          isOpen ? "bg-parchment text-ink-black" : "bg-white text-steel hover:text-ink-black hover:border-ink-black"
        }`}
        title="Notifications"
        aria-label="Open notifications"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <IconBell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-toxic-lime px-1 text-[10px] font-bold text-ink-black border border-ink-black shadow-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          role="region"
          aria-label="Notifications panel"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[24px] border border-sand bg-white p-4 shadow-[0_12px_36px_rgba(0,0,0,0.12)] z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sand pb-3 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-ink-black">Notifications</h3>
              {unreadCount > 0 && (
                <span className="pc-badge pc-badge-dark text-[10px] py-0 px-1.5 font-mono">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setUnreadOnly(!unreadOnly)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition ${
                  unreadOnly
                    ? "bg-ink-black text-white border-ink-black"
                    : "bg-parchment text-steel border-sand hover:text-ink-black"
                }`}
              >
                {unreadOnly ? "Unread only" : "All"}
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold text-electric-blue hover:underline flex items-center gap-0.5"
                >
                  <IconCheck size={11} />
                  <span>Read all</span>
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="py-10 text-center space-y-2">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-sand border-t-electric-blue" />
                <p className="text-xs text-steel">Loading notifications...</p>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleMarkRead(notif)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void handleMarkRead(notif);
                    }
                  }}
                  aria-label={`Notification: ${notif.payload}`}
                  className={`group relative flex items-start gap-3 rounded-[16px] border p-3 cursor-pointer transition focus-visible:outline-2 focus-visible:outline-electric-blue focus-visible:outline-offset-1 ${
                    notif.is_read
                      ? "border-transparent bg-parchment/60 hover:bg-parchment text-steel"
                      : "border-sand bg-white hover:border-ink-black text-ink-black shadow-xs"
                  }`}
                >
                  {/* Unread dot */}
                  {!notif.is_read && (
                    <span className="absolute top-3.5 left-2 h-1.5 w-1.5 rounded-full bg-toxic-lime ring-2 ring-toxic-lime/30" />
                  )}

                  <div className={`shrink-0 ${!notif.is_read ? "pl-2" : ""}`}>
                    {notif.actor ? (
                      <Avatar name={notif.actor.name} url={notif.actor.avatar_url} size="xs" />
                    ) : (
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-parchment text-steel border border-sand">
                        <IconSparkles size={13} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`pc-badge text-[9px] font-mono uppercase tracking-wider py-0 px-1.5 border ${getBadgeColor(
                          notif.event_type
                        )}`}
                      >
                        {notif.event_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-fog font-mono shrink-0">
                        {formatRelativeTime(notif.created_at)}
                      </span>

                    </div>

                    <p className={`text-xs leading-snug line-clamp-2 ${!notif.is_read ? "font-semibold text-ink-black" : "text-steel"}`}>
                      {notif.payload}
                    </p>

                    {notif.group_name && (
                      <span className="inline-block text-[10px] text-steel font-mono">
                        Circle: <span className="font-semibold text-ink-black">{notif.group_name}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center space-y-2">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-parchment text-steel">
                  <IconBell size={18} />
                </span>
                <p className="text-xs font-semibold text-ink-black">No notifications</p>
                <p className="text-[11px] text-steel max-w-[200px] mx-auto">
                  {unreadOnly ? "You're all caught up! No unread notifications." : "Friend requests, expenses, and settlements will notify you here."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
