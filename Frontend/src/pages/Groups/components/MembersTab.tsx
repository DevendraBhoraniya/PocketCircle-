import Avatar from "../../../components/Avatar";
import { IconPlus, IconClose, IconCrown } from "../../../components/Icons";
import type { GroupDetail, GroupMemberItem } from "../../../api/groups";
import type { User } from "../../../context/auth-context";

interface MembersTabProps {
  group: GroupDetail;
  user: User | null;
  isOwner: boolean;
  isAdmin: boolean;
  canManageMembers: boolean;
  addableFriendsCount: number;
  onOpenAddMemberModal: () => void;
  onRoleChange: (userId: string, newRole: "admin" | "member") => void;
  onRemoveMember: (userId: string, memberName: string) => void;
  onOpenTransferModal: () => void;
}

export default function MembersTab({
  group,
  user,
  isOwner,
  isAdmin,
  canManageMembers,
  addableFriendsCount,
  onOpenAddMemberModal,
  onRoleChange,
  onRemoveMember,
  onOpenTransferModal,
}: MembersTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink-black">
          Circle Members ({group.members.length})
        </h2>

        {canManageMembers && addableFriendsCount > 0 && (
          <button
            onClick={onOpenAddMemberModal}
            className="pc-btn pc-btn-primary flex items-center gap-1.5 text-xs font-semibold"
          >
            <IconPlus size={14} />
            <span>Add Friend</span>
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {group.members.map((m: GroupMemberItem) => {
          const isMemberSelf = m.user.id === user?.id;
          const isTargetOwner = m.role === "owner";
          const isTargetAdmin = m.role === "admin";

          return (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-[20px] border border-sand bg-parchment p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar name={m.user.name} url={m.user.avatar_url} size="sm" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-ink-black">
                      {m.user.name}
                    </span>
                    {isMemberSelf && (
                      <span className="text-[10px] text-steel font-medium">(You)</span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-steel">
                    {m.user.pocket_id}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`pc-badge text-[10px] uppercase font-mono font-semibold ${
                    isTargetOwner
                      ? "bg-electric-blue/15 text-electric-blue border-electric-blue/30"
                      : isTargetAdmin
                      ? "bg-ember-orange/15 text-ember-orange border-ember-orange/30"
                      : "bg-sand text-steel border-sand"
                  }`}
                >
                  {m.role}
                </span>

                {/* Owner Management Menu */}
                {isOwner && !isMemberSelf && (
                  <div className="flex items-center gap-1 pl-1">
                    {m.role === "admin" ? (
                      <button
                        onClick={() => onRoleChange(m.user.id, "member")}
                        className="p-1 text-xs text-steel hover:text-ink-black"
                        title="Demote to Member"
                      >
                        Demote
                      </button>
                    ) : (
                      <button
                        onClick={() => onRoleChange(m.user.id, "admin")}
                        className="p-1 text-xs text-electric-blue hover:underline"
                        title="Promote to Admin"
                      >
                        Make Admin
                      </button>
                    )}
                    <button
                      onClick={() => onRemoveMember(m.user.id, m.user.name)}
                      className="p-1 text-steel hover:text-ember-orange"
                      title="Remove Member"
                      aria-label={`Remove ${m.user.name}`}
                    >
                      <IconClose size={15} />
                    </button>
                  </div>
                )}

                {/* Admin Management (can remove regular members) */}
                {isAdmin && !isOwner && !isMemberSelf && m.role === "member" && (
                  <button
                    onClick={() => onRemoveMember(m.user.id, m.user.name)}
                    className="p-1 text-steel hover:text-ember-orange"
                    title="Remove Member"
                    aria-label={`Remove ${m.user.name}`}
                  >
                    <IconClose size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transfer Ownership CTA for Owner */}
      {isOwner && group.members.length > 1 && (
        <div className="rounded-[20px] border border-sand bg-parchment p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
          <div>
            <h4 className="text-sm font-bold text-ink-black flex items-center gap-1.5">
              <IconCrown size={16} className="text-electric-blue" />
              <span>Transfer Circle Ownership</span>
            </h4>
            <p className="text-xs text-steel mt-0.5">
              Hand over ownership to another circle member. You will become an admin.
            </p>
          </div>
          <button
            onClick={onOpenTransferModal}
            className="pc-btn pc-btn-secondary text-xs"
          >
            Transfer Ownership
          </button>
        </div>
      )}
    </div>
  );
}
