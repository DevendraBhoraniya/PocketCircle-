import { useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "../../../components/Avatar";
import { IconClose } from "../../../components/Icons";
import type { GroupDetail, PublicUser } from "../../../api/groups";
import { useModalAccessibility } from "../../../hooks/useModalAccessibility";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  addableFriends: PublicUser[];
  onAddMember: (friendId: string) => Promise<void>;
}

export function AddMemberModal({
  isOpen,
  onClose,
  addableFriends,
  onAddMember,
}: AddMemberModalProps) {
  const modalRef = useModalAccessibility({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        className="w-full max-w-md rounded-[28px] border border-sand bg-white p-6 sm:p-8 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 id="add-member-title" className="text-lg font-bold text-ink-black">Add Friend to Circle</h3>
            <p className="text-xs text-steel">Choose from your accepted friends</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-steel hover:bg-parchment"
            aria-label="Close add member dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        {addableFriends.length === 0 ? (
          <div className="rounded-xl border border-sand bg-parchment p-6 text-center text-xs text-steel space-y-2">
            <p>All your accepted friends are already members of this circle!</p>
            <Link to="/friends" className="font-semibold text-electric-blue hover:underline">
              Find new friends &rarr;
            </Link>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl border border-sand bg-parchment p-2">
            {addableFriends.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-sand/60"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={f.name} url={f.avatar_url} size="xs" />
                  <div>
                    <p className="text-xs font-bold text-ink-black">{f.name}</p>
                    <p className="text-[11px] font-mono text-steel">{f.pocket_id}</p>
                  </div>
                </div>
                <button
                  onClick={() => onAddMember(f.id)}
                  className="pc-btn pc-btn-primary text-xs py-1 px-3"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface TransferOwnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupDetail;
  currentUserId: string | undefined;
  onTransferOwnership: (newOwnerId: string) => Promise<void>;
}

export function TransferOwnershipModal({
  isOpen,
  onClose,
  group,
  currentUserId,
  onTransferOwnership,
}: TransferOwnershipModalProps) {
  const [newOwnerId, setNewOwnerId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useModalAccessibility({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-ownership-title"
        className="w-full max-w-md rounded-[28px] border border-sand bg-white p-6 sm:p-8 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 id="transfer-ownership-title" className="text-lg font-bold text-ink-black">Transfer Ownership</h3>
            <p className="text-xs text-steel">Select new owner from circle members</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-steel hover:bg-parchment"
            aria-label="Close transfer dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newOwnerId) return;
            setIsSubmitting(true);
            try {
              await onTransferOwnership(newOwnerId);
              onClose();
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-4"
        >
          <select
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            required
            className="w-full rounded-xl border border-sand bg-parchment px-4 py-2.5 text-sm text-ink-black focus:border-ink-black focus:outline-none"
          >
            <option value="">Select a member...</option>
            {group.members
              .filter((m) => m.user.id !== currentUserId)
              .map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name} ({m.user.pocket_id})
                </option>
              ))}
          </select>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="pc-btn pc-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newOwnerId || isSubmitting}
              className="pc-btn pc-btn-primary text-xs disabled:opacity-50"
            >
              Confirm Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialDesc: string;
  onUpdateGroup: (name: string, description: string) => Promise<void>;
}

export function EditGroupModal({
  isOpen,
  onClose,
  initialName,
  initialDesc,
  onUpdateGroup,
}: EditGroupModalProps) {
  const [editName, setEditName] = useState(initialName);
  const [editDesc, setEditDesc] = useState(initialDesc);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useModalAccessibility({
    isOpen,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 p-4 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-group-title"
        className="w-full max-w-md rounded-[28px] border border-sand bg-white p-6 sm:p-8 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 id="edit-group-title" className="text-lg font-bold text-ink-black">Edit Circle Details</h3>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-steel hover:bg-parchment"
            aria-label="Close edit group dialog"
          >
            <IconClose size={18} />
          </button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editName.trim()) return;
            setIsSubmitting(true);
            try {
              await onUpdateGroup(editName.trim(), editDesc.trim());
              onClose();
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label htmlFor="edit-circle-name" className="text-xs font-medium text-steel">
              Circle name
            </label>
            <input
              id="edit-circle-name"
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="pc-input"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-circle-desc" className="text-xs font-medium text-steel">
              Description (optional)
            </label>
            <input
              id="edit-circle-desc"
              type="text"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="pc-input"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="pc-btn pc-btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editName.trim() || isSubmitting}
              className="pc-btn pc-btn-primary text-xs disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


interface GroupSettingsModalsProps {
  isAddMemberOpen: boolean;
  onCloseAddMember: () => void;
  addableFriends: PublicUser[];
  onAddMember: (friendId: string) => Promise<void>;

  isTransferOpen: boolean;
  onCloseTransfer: () => void;
  group: GroupDetail;
  currentUserId: string | undefined;
  onTransferOwnership: (newOwnerId: string) => Promise<void>;

  isEditGroupOpen: boolean;
  onCloseEditGroup: () => void;
  initialName: string;
  initialDesc: string;
  onUpdateGroup: (name: string, description: string) => Promise<void>;
}

export default function GroupSettingsModals({
  isAddMemberOpen,
  onCloseAddMember,
  addableFriends,
  onAddMember,
  isTransferOpen,
  onCloseTransfer,
  group,
  currentUserId,
  onTransferOwnership,
  isEditGroupOpen,
  onCloseEditGroup,
  initialName,
  initialDesc,
  onUpdateGroup,
}: GroupSettingsModalsProps) {
  return (
    <>
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={onCloseAddMember}
        addableFriends={addableFriends}
        onAddMember={onAddMember}
      />
      {isTransferOpen && (
        <TransferOwnershipModal
          isOpen={isTransferOpen}
          onClose={onCloseTransfer}
          group={group}
          currentUserId={currentUserId}
          onTransferOwnership={onTransferOwnership}
        />
      )}
      {isEditGroupOpen && (
        <EditGroupModal
          isOpen={isEditGroupOpen}
          onClose={onCloseEditGroup}
          initialName={initialName}
          initialDesc={initialDesc}
          onUpdateGroup={onUpdateGroup}
        />
      )}
    </>
  );
}
