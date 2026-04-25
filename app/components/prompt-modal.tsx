"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Modal } from "@/app/components/modal";

interface PromptModalProps {
  open: boolean;
  title: string;
  label: string;
  inputType: "text" | "number";
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void> | void;
}

export function PromptModal({
  open,
  title,
  label,
  inputType,
  placeholder,
  initialValue,
  submitLabel = "确认",
  cancelLabel = "取消",
  closeLabel,
  loading = false,
  onClose,
  onSubmit
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue ?? "");

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? "");
    }
  }, [open, initialValue]);

  return (
    <Modal open={open} title={title} closeLabel={closeLabel} onClose={onClose}>
      <label className="inline-field">
        <span className="subtle">{label}</span>
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          min={inputType === "number" ? 1 : undefined}
          step={inputType === "number" ? 1 : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <div className="modal-actions">
        <button onClick={onClose} disabled={loading}>
          {cancelLabel}
        </button>
        <button
          className="primary"
          onClick={() => onSubmit(value)}
          disabled={loading || value.trim().length === 0}
        >
          {loading ? <LoaderCircle size={16} className="spin" /> : null}
          {submitLabel}
        </button>
      </div>
    </Modal>
  );
}
