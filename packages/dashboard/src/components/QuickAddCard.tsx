import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";

interface QuickAddCardProps {
  placeholder: string;
  buttonLabel: string;
  onAdd: (value: string) => void;
  disabled?: boolean;
}

export function QuickAddCard({ placeholder, buttonLabel, onAdd, disabled }: QuickAddCardProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
    // Keep open for rapid entry
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    }, 50);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setValue("");
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-card transition-all"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>{buttonLabel}</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-card overflow-hidden transition-all">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          autoGrow(e.target);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!value.trim()) {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none resize-none px-3 pt-3 pb-2 min-h-[60px] max-h-[200px]"
      />
      <div className="flex items-center justify-between px-3 pb-2.5">
        <span className="text-xs text-muted-foreground/40">
          Enter to add · Shift+Enter for new line · Esc to cancel
        </span>
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
