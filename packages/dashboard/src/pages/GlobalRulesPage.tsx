import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  GET_GLOBAL_RULES,
  ADD_GLOBAL_RULE,
  UPDATE_GLOBAL_RULE,
  REMOVE_GLOBAL_RULE,
} from "@/graphql/operations";
import { Shield, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Rule {
  id: string;
  content: string;
}

/* ── Rule Card ── */

function RuleCard({ rule, onClick }: { rule: Rule; onClick: () => void }) {
  // Show first line as "title", rest as preview
  const lines = rule.content.split("\n");
  const title = lines[0];
  const rest = lines.slice(1).join("\n").trim();

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:border-muted-foreground/30 hover:shadow-md hover:shadow-black/10"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {title}
        </p>
      </CardHeader>
      {rest && (
        <CardContent>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {rest}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

/* ── Rule Dialog (create + edit) ── */

function RuleDialog({
  open,
  rule,
  onClose,
}: {
  open: boolean;
  rule: Rule | null;
  onClose: () => void;
}) {
  const isNew = rule === null;
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refetchOpts = { refetchQueries: [{ query: GET_GLOBAL_RULES }] };
  const [addRule, { loading: adding }] = useMutation(ADD_GLOBAL_RULE, refetchOpts);
  const [updateRule, { loading: updating }] = useMutation(UPDATE_GLOBAL_RULE, refetchOpts);
  const [removeRule, { loading: removing }] = useMutation(REMOVE_GLOBAL_RULE, refetchOpts);

  const saving = adding || updating;

  useEffect(() => {
    if (open) {
      setValue(rule?.content ?? "");
      setConfirmDelete(false);
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [open, rule]);

  // Auto-size textarea whenever value changes while dialog is open
  useEffect(() => {
    if (open && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [open, value]);

  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;

    if (isNew) {
      await addRule({ variables: { content: trimmed } });
    } else {
      await updateRule({ variables: { ruleId: rule.id, content: trimmed } });
    }
    onClose();
  }

  async function handleDelete() {
    if (!rule) return;
    await removeRule({ variables: { ruleId: rule.id } });
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New Rule" : "Edit Rule"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "This rule will be enforced across every project."
              : "Edit this global rule. Changes apply to all projects."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Always use TypeScript strict mode and never use any..."
            rows={4}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-y min-h-[200px] max-h-[60vh] leading-relaxed transition-colors"
          />
          <p className="text-xs text-muted-foreground/40 mt-2">
            {"\u2318"}+Enter to save
          </p>
        </div>

        <DialogFooter className="flex items-center sm:justify-between">
          {/* Delete (edit only) */}
          <div>
            {!isNew && !confirmDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
            )}
            {!isNew && confirmDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={removing}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                {removing ? "Deleting..." : "Confirm Delete"}
              </Button>
            )}
          </div>

          {/* Save / Cancel */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !value.trim()}
            >
              {saving ? "Saving..." : isNew ? "Add Rule" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page ── */

export function GlobalRulesPage() {
  const { data, loading } = useQuery<{ globalRules: Rule[] }>(GET_GLOBAL_RULES);
  const rules = data?.globalRules ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  function openNew() {
    setEditingRule(null);
    setDialogOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingRule(null);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rules enforced across every project
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      {/* Content */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[100px] rounded-lg border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No global rules yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Add rules that every agent must follow across all projects.
          </p>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Rule
          </Button>
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} onClick={() => openEdit(rule)} />
          ))}
        </div>
      )}

      {/* Dialog */}
      <RuleDialog open={dialogOpen} rule={editingRule} onClose={closeDialog} />
    </div>
  );
}
