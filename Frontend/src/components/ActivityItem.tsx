import { memo } from "react";
import Avatar from "./Avatar";
import { formatRelativeTime } from "../utils/date";


export interface ActivityEventData {
  id: string;
  actor: {
    id?: string;
    name: string;
    avatar_url?: string | null;
    pocket_id?: string;
  };
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string | null;
  created_at: string;
  group_id?: string | null;
}

interface ActivityItemProps {
  event: ActivityEventData;
}

export default memo(function ActivityItem({ event }: ActivityItemProps) {
  // Parse details
  let parsedDetails: Record<string, unknown> | null = null;
  if (event.details) {
    try {
      if (typeof event.details === "string" && (event.details.startsWith("{") || event.details.startsWith("["))) {
        parsedDetails = JSON.parse(event.details);
      }
    } catch {
      parsedDetails = null;
    }
  }

  function getActionInfo(action: string) {
    switch (action.toLowerCase()) {
      case "expense_created":
        return { label: "Expense Added", badge: "bg-toxic-lime/30 text-ink-black border-toxic-lime/50" };
      case "expense_updated":
        return { label: "Expense Edited", badge: "bg-amber-100 text-amber-800 border-amber-300" };
      case "expense_deleted":
        return { label: "Expense Deleted", badge: "bg-ember-orange/15 text-ember-orange border-ember-orange/30" };
      case "settlement_requested":
        return { label: "Settlement Requested", badge: "bg-cyan-100 text-cyan-800 border-cyan-300" };
      case "settlement_confirmed":
        return { label: "Payment Confirmed", badge: "bg-toxic-lime/30 text-ink-black border-toxic-lime/50" };
      case "settlement_rejected":
        return { label: "Payment Rejected", badge: "bg-ember-orange/15 text-ember-orange border-ember-orange/30" };
      case "settlement_cancelled":
        return { label: "Request Cancelled", badge: "bg-sand text-steel border-sand" };
      case "member_added":
        return { label: "Member Added", badge: "bg-electric-blue/15 text-electric-blue border-electric-blue/30" };
      case "group_created":
        return { label: "Circle Created", badge: "bg-electric-blue/15 text-electric-blue border-electric-blue/30" };
      case "group_updated":
        return { label: "Circle Updated", badge: "bg-parchment text-steel border-sand" };
      default:
        return { label: action.replace(/_/g, " "), badge: "bg-parchment text-steel border-sand" };
    }
  }

  function renderSummary() {
    if (parsedDetails) {
      if (parsedDetails.amount && parsedDetails.description) {
        return (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-black font-medium">
            <span className="font-mono font-bold text-ink-black bg-white px-2 py-0.5 rounded-md border border-sand">
              ₹{Number(parsedDetails.amount).toFixed(2)}
            </span>
            <span className="text-steel font-normal">for</span>
            <span className="font-semibold">{String(parsedDetails.description)}</span>
          </div>
        );
      }
      if (parsedDetails.amount && parsedDetails.payer && parsedDetails.payee) {
        return (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-black font-medium">
            <span className="font-mono font-bold text-ink-black bg-white px-2 py-0.5 rounded-md border border-sand">
              ₹{Number(parsedDetails.amount).toFixed(2)}
            </span>
            <span className="text-steel font-normal">
              {String(parsedDetails.payer)} &rarr; {String(parsedDetails.payee)}
            </span>
          </div>
        );
      }
      if (parsedDetails.name && parsedDetails.member_count) {
        return (
          <span className="text-xs text-ink-black">
            Circle <strong>{String(parsedDetails.name)}</strong> ({String(parsedDetails.member_count)} members)
          </span>
        );
      }
      if (parsedDetails.username || parsedDetails.name) {
        return (
          <span className="text-xs text-ink-black">
            Member: <strong>{String(parsedDetails.name || parsedDetails.username)}</strong>
          </span>
        );
      }
    }

    if (event.details) {
      return (
        <span className="text-[11px] font-mono text-steel bg-white/60 px-2 py-0.5 rounded-md border border-sand/40 inline-block">
          {event.details}
        </span>
      );
    }
    return null;
  }

  const { label, badge } = getActionInfo(event.action);

  return (
    <div className="p-4 flex items-start gap-3.5 transition hover:bg-parchment/40">
      <Avatar name={event.actor.name} url={event.actor.avatar_url} size="xs" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-black">{event.actor.name}</span>
            <span className={`pc-badge text-[9px] font-mono uppercase tracking-wider py-0 px-1.5 border ${badge}`}>
              {label}
            </span>
          </div>
          <span className="text-[10px] text-fog font-mono shrink-0">
            {formatRelativeTime(event.created_at)}
          </span>
        </div>


        <div>{renderSummary()}</div>
      </div>
    </div>
  );
});
