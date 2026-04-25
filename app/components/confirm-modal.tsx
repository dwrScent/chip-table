"use client";

import { LoaderCircle, ShieldAlert } from "lucide-react";
import { Modal } from "@/app/components/modal";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  closeLabel,
  danger = false,
  loading = false,
  onClose,
  onConfirm
}: ConfirmModalProps) {
  return (
    <Modal open={open} title={title} closeLabel={closeLabel} onClose={onClose}>
      <div className="subtle" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
        <ShieldAlert size={16} />
        {description}
      </div>
      <div className="modal-actions">
        <button onClick={onClose} disabled={loading}>
          {cancelLabel}
        </button>
        <button className={danger ? "danger" : "warning"} onClick={onConfirm} disabled={loading}>
          {loading ? <LoaderCircle size={16} className="spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
