import { useState, useRef } from "react";
import { Check, Send } from "lucide-react";

interface Option {
  id: string;
  label: string;
  description?: string;
}

interface OptionsData {
  mode: "single" | "multi";
  options: Option[];
}

interface OptionsPickerProps {
  data: OptionsData;
  onSelect: (text: string) => void;
}

export function OptionsPicker({ data, onSelect }: OptionsPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [customText, setCustomText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSingleSelect(option: Option) {
    if (submitted) return;
    setSelected(new Set([option.id]));
    setSubmitted(true);
    onSelect(`${option.id}) ${option.label}`);
  }

  function handleMultiToggle(option: Option) {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(option.id)) next.delete(option.id);
      else next.add(option.id);
      return next;
    });
  }

  function handleMultiSubmit() {
    if (submitted || selected.size === 0) return;
    setSubmitted(true);
    const selectedOptions = data.options.filter((o) => selected.has(o.id));
    const text = selectedOptions.map((o) => `${o.id}) ${o.label}`).join(", ");
    onSelect(text);
  }

  function handleCustomSubmit() {
    const trimmed = customText.trim();
    if (!trimmed || submitted) return;
    setSubmitted(true);
    onSelect(trimmed);
  }

  return (
    <div className="my-2 space-y-1.5">
      {data.options.map((option) => {
        const isSelected = selected.has(option.id);
        const isDimmed = submitted && !isSelected;

        return (
          <button
            key={option.id}
            onClick={() =>
              data.mode === "single"
                ? handleSingleSelect(option)
                : handleMultiToggle(option)
            }
            disabled={submitted}
            className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all duration-200 ${
              isSelected
                ? "border-primary/40 bg-primary/10"
                : isDimmed
                  ? "border-border/30 bg-transparent opacity-40"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
            } ${submitted ? "cursor-default" : "cursor-pointer"}`}
          >
            <div className="flex items-start gap-2.5">
              {/* Checkbox / radio indicator */}
              <div
                className={`shrink-0 mt-0.5 h-4 w-4 rounded${data.mode === "single" ? "-full" : ""} border flex items-center justify-center transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/20"
                    : "border-muted-foreground/30"
                }`}
              >
                {isSelected && (
                  <Check className="h-2.5 w-2.5 text-primary" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground/50">
                    {option.id})
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {option.label}
                  </span>
                </div>
                {option.description && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5 ml-6">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {/* Multi-select submit button */}
      {data.mode === "multi" && !submitted && selected.size > 0 && (
        <button
          onClick={handleMultiSubmit}
          className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
        >
          <Send className="h-3 w-3" />
          Submit {selected.size} selected
        </button>
      )}

      {/* Custom text input */}
      {!submitted && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
            placeholder="Or type your own..."
            className="flex-1 h-7 px-2.5 rounded-md bg-muted/30 border border-border text-xs text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/30 transition-colors"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customText.trim()}
            className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function parseOptionsBlock(text: string): { before: string; data: OptionsData; after: string } | null {
  const match = text.match(/```options\s*([\s\S]*?)\s*```/);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]) as OptionsData;
    if (!data.options || !Array.isArray(data.options)) return null;
    if (!data.mode) data.mode = "single";

    const before = text.slice(0, match.index!).trim();
    const after = text.slice(match.index! + match[0].length).trim();
    return { before, data, after };
  } catch {
    return null;
  }
}
