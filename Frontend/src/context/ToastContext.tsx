import React, { useState, useCallback, useMemo } from "react";
import {
  IconCheck,
  IconExclamation,
  IconSparkles,
  IconClose,
} from "../components/Icons";
import {
  ToastContext,
  type ToastType,
  type ToastItem,
  type ToastContextType,
} from "./toast-context";

export type { ToastType, ToastItem, ToastContextType };

// Standalone Toast Card Component
function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const duration = toast.duration ?? 4000;

  React.useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast.id, duration, onDismiss]);

  const config = {
    success: {
      border: "border-emerald-500/30",
      bg: "bg-paper-white/95 dark:bg-[#1f2228]/95",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      progressBg: "bg-emerald-500",
      icon: <IconCheck size={18} />,
      defaultTitle: "Success",
    },
    error: {
      border: "border-rose-500/30",
      bg: "bg-paper-white/95 dark:bg-[#1f2228]/95",
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      progressBg: "bg-rose-500",
      icon: <IconExclamation size={18} />,
      defaultTitle: "Error",
    },
    warning: {
      border: "border-amber-500/30",
      bg: "bg-paper-white/95 dark:bg-[#1f2228]/95",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      progressBg: "bg-amber-500",
      icon: <IconExclamation size={18} />,
      defaultTitle: "Notice",
    },
    info: {
      border: "border-electric-blue/30",
      bg: "bg-paper-white/95 dark:bg-[#1f2228]/95",
      iconBg: "bg-electric-blue/10 text-electric-blue",
      progressBg: "bg-electric-blue",
      icon: <IconSparkles size={18} />,
      defaultTitle: "Information",
    },
  }[toast.type];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`pointer-events-auto relative overflow-hidden flex items-start gap-3 w-full p-4 rounded-2xl border ${config.border} ${config.bg} shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-top-3`}
    >
      {/* Icon badge */}
      <div
        className={`flex-shrink-0 grid h-8 w-8 place-items-center rounded-xl ${config.iconBg}`}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="text-xs font-semibold tracking-wide uppercase text-ink-black dark:text-white">
          {toast.title || config.defaultTitle}
        </h4>
        <p className="mt-0.5 text-xs text-steel dark:text-gray-300 leading-relaxed break-words">
          {toast.message}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 grid h-6 w-6 place-items-center rounded-lg text-steel hover:text-ink-black dark:hover:text-white transition-colors"
        aria-label="Close notification"
      >
        <IconClose size={13} />
      </button>

      {/* Progress timer indicator */}
      {duration > 0 && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${config.progressBg} opacity-40`}
          style={{
            animation: `pc-toast-progress ${duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration?: number) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = {
        id,
        type,
        message,
        title,
        duration: duration ?? 4000,
      };

      setToasts((prev) => {
        // Keep at most 4 simultaneous toasts to avoid screen clutter
        const next = [newToast, ...prev];
        return next.slice(0, 4);
      });

      return id;
    },
    []
  );

  const toast = useMemo(
    () => ({
      success: (message: string, title?: string, duration?: number) =>
        addToast("success", message, title, duration),
      error: (message: string, title?: string, duration?: number) =>
        addToast("error", message, title, duration),
      info: (message: string, title?: string, duration?: number) =>
        addToast("info", message, title, duration),
      warning: (message: string, title?: string, duration?: number) =>
        addToast("warning", message, title, duration),
      dismiss: removeToast,
      clear: clearToasts,
    }),
    [addToast, removeToast, clearToasts]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, clearToasts, toast }}
    >
      {children}

      {/* Floating Global Toast Container */}
      <aside
        aria-label="Notifications"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </aside>
    </ToastContext.Provider>
  );
}


