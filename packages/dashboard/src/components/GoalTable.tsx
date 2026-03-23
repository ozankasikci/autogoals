import React, { useState, useEffect, useRef } from "react";
import { useMutation } from "@apollo/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCost } from "@/lib/utils";
import { UPDATE_GOAL, ADD_GOAL, REMOVE_GOAL, REFINE_GOAL, GET_PROJECT } from "@/graphql/operations";
import { Plus, X, Pencil, Trash2, CheckCircle2, Undo2, ChevronRight, Lightbulb, Zap } from "lucide-react";

const GOAL_STATUSES = ["pending", "active", "verifying", "done", "failed", "skipped", "regressed", "achieved"];

interface Goal {
  id: string;
  name: string;
  description: string;
  approach?: string | null;
  acceptanceCriteria: string[];
  dependsOn: string[];
  status: string;
  recurring: boolean;
  retries: number;
  costUsd: number;
  error?: string | null;
}

interface GoalTableProps {
  goals: Goal[];
  projectId: string;
  compact?: boolean;
  onSelectGoal?: (goalId: string) => void;
}

interface GoalFormState {
  name: string;
  description: string;
  status: string;
  acceptanceCriteria: string[];
  dependsOn: string;
}

/* -- Status Colors -- */

const STATUS_DOT_COLORS: Record<string, string> = {
  draft: "bg-violet-500",
  refined: "bg-cyan-500",
  ready: "bg-indigo-500",
  done: "bg-emerald-500",
  active: "bg-blue-500",
  pending: "bg-zinc-500",
  failed: "bg-red-500",
  verifying: "bg-amber-500",
  skipped: "bg-orange-500",
  regressed: "bg-orange-500",
  achieved: "bg-emerald-600",
};

/* -- Helpers -- */

function parseCriterion(text: string): { checked: boolean } {
  if (text.startsWith("[x] ")) return { checked: true };
  return { checked: false };
}

function getCriteriaProgress(criteria: string[]): { checked: number; total: number } {
  if (criteria.length === 0) return { checked: 0, total: 0 };
  const checked = criteria.filter((c) => parseCriterion(c).checked).length;
  return { checked, total: criteria.length };
}

/* -- CriteriaEditor (used in full table mode) -- */

function CriteriaEditor({
  criteria,
  onChange,
}: {
  criteria: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {criteria.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="h-8 text-xs"
            value={c}
            onChange={(e) => {
              const next = [...criteria];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder="Acceptance criterion..."
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => onChange(criteria.filter((_, idx) => idx !== i))}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...criteria, ""])}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        + Add criterion
      </button>
    </div>
  );
}

/* -- Main Component -- */

export function GoalTable({ goals, projectId, compact = false, onSelectGoal }: GoalTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GoalFormState | null>(null);
  const [addingGoal, setAddingGoal] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const quickAddRef = useRef<HTMLTextAreaElement>(null);
  const [newGoalForm, setNewGoalForm] = useState<GoalFormState>({
    name: "",
    description: "",
    status: "pending",
    acceptanceCriteria: [""],
    dependsOn: "",
  });

  const refetchOpts = {
    refetchQueries: [{ query: GET_PROJECT, variables: { id: projectId } }],
  };

  const [updateGoal, { loading: updatingGoal }] = useMutation(UPDATE_GOAL, refetchOpts);
  const [addGoal, { loading: addingGoalMut }] = useMutation(ADD_GOAL, refetchOpts);
  const [removeGoal, { loading: removingGoal }] = useMutation(REMOVE_GOAL, refetchOpts);
  const [refineGoal] = useMutation(REFINE_GOAL, refetchOpts);

  useEffect(() => {
    if (quickAddOpen && quickAddRef.current) quickAddRef.current.focus();
  }, [quickAddOpen]);

  async function handleQuickAdd(mode: "interview" | "yolo") {
    const name = quickAddValue.trim();
    if (!name) return;
    setQuickAddSubmitting(true);
    try {
      const { data } = await addGoal({
        variables: { projectId, name, description: "", acceptanceCriteria: [], dependsOn: [] },
      });
      const goalId = data?.addGoal?.id;
      if (goalId) {
        await refineGoal({ variables: { projectId, goalId, mode } });
      }
      setQuickAddValue("");
      setQuickAddOpen(false);
    } finally {
      setQuickAddSubmitting(false);
    }
  }

  function startEditing(goal: Goal) {
    setEditingId(goal.id);
    setEditForm({
      name: goal.name,
      description: goal.description,
      status: goal.status,
      acceptanceCriteria: [...goal.acceptanceCriteria],
      dependsOn: goal.dependsOn.join(", "),
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveGoalEdit(goalId: string) {
    if (!editForm) return;
    const depArray = editForm.dependsOn
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d !== "");
    await updateGoal({
      variables: {
        projectId,
        goalId,
        name: editForm.name,
        description: editForm.description,
        status: editForm.status,
        acceptanceCriteria: editForm.acceptanceCriteria.filter((c) => c.trim() !== ""),
        dependsOn: depArray,
      },
    });
    setEditingId(null);
    setEditForm(null);
  }


  async function handleAddGoal() {
    const depArray = newGoalForm.dependsOn
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d !== "");
    await addGoal({
      variables: {
        projectId,
        name: newGoalForm.name,
        description: newGoalForm.description,
        acceptanceCriteria: newGoalForm.acceptanceCriteria.filter((c) => c.trim() !== ""),
        dependsOn: depArray,
      },
    });
    setAddingGoal(false);
    setNewGoalForm({
      name: "",
      description: "",
      status: "pending",
      acceptanceCriteria: [""],
      dependsOn: "",
    });
  }

  async function handleRemoveGoal(goalId: string, goalName: string) {
    if (!window.confirm(`Delete goal "${goalName}"? This cannot be undone.`)) return;
    await removeGoal({ variables: { projectId, goalId } });
  }

  // -- Compact sidebar mode --
  if (compact) {
    const activeGoals = goals.filter(g => g.status !== "achieved");
    const achievedGoals = goals.filter(g => g.status === "achieved");
    const [showAchieved, setShowAchieved] = useState(false);

    const renderGoalCard = (goal: Goal) => {
          const progress = getCriteriaProgress(goal.acceptanceCriteria);
          const progressPct = progress.total > 0 ? (progress.checked / progress.total) * 100 : 0;
          const isComplete = goal.status === "done";
          const isActive = goal.status === "active";
          const isAchieved = goal.status === "achieved";

          return (
            <button
              key={goal.id}
              onClick={() => onSelectGoal?.(goal.id)}
              className={`
                w-full text-left group rounded-lg border transition-all duration-150 cursor-pointer
                ${isAchieved
                  ? "border-emerald-500/20 bg-emerald-500/5 opacity-60 hover:opacity-80"
                  : isActive
                    ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                    : isComplete
                      ? "border-border/60 bg-card/50 hover:bg-card"
                      : "border-border hover:border-border bg-card hover:bg-accent/30"
                }
              `}
            >
              {/* Top row: status + name + archive button */}
              <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
                <span
                  className={`shrink-0 h-2.5 w-2.5 rounded-full ring-2 ring-background ${STATUS_DOT_COLORS[goal.status] ?? "bg-zinc-500"}`}
                />
                <span className={`text-sm font-medium truncate flex-1 min-w-0 ${isAchieved ? "text-muted-foreground line-through decoration-muted-foreground/30" : isComplete ? "text-muted-foreground" : "text-foreground"}`}>
                  {goal.name}
                </span>
                {goal.recurring && (
                  <span className="shrink-0 text-xs text-teal-400 bg-teal-500/10 rounded px-1.5 py-0.5" title="Recurring">
                    ♻️
                  </span>
                )}
                {goal.costUsd > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatCost(goal.costUsd)}
                  </span>
                )}
                {/* Quick archive/unarchive button */}
                {(goal.status === "done" || goal.status === "achieved") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newStatus = goal.status === "achieved" ? "done" : "achieved";
                      updateGoal({
                        variables: { projectId, goalId: goal.id, status: newStatus },
                      });
                    }}
                    disabled={updatingGoal}
                    className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                      goal.status === "achieved"
                        ? "text-emerald-400 hover:bg-emerald-500/20"
                        : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-emerald-400 hover:bg-emerald-500/10"
                    }`}
                    title={goal.status === "achieved" ? "Unarchive" : "Mark as achieved"}
                  >
                    {goal.status === "achieved" ? (
                      <Undo2 className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>

              {/* Bottom row: status label or progress */}
              <div className="px-3 pb-3 pl-8">
                {goal.status === "draft" && (
                  <span className="inline-flex items-center gap-1 text-xs text-violet-400 bg-violet-500/10 rounded px-1.5 py-0.5">
                    Draft
                  </span>
                )}
                {goal.status === "refined" && (
                  <span className="inline-flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/10 rounded px-1.5 py-0.5">
                    Needs approval
                  </span>
                )}
                {goal.status === "ready" && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 rounded px-1.5 py-0.5">
                    Ready
                  </span>
                )}
                {goal.status === "regressed" && (
                  <span className="inline-flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 rounded px-1.5 py-0.5">
                    Regressed
                  </span>
                )}
                {goal.status === "active" && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 rounded px-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Working...
                  </span>
                )}
                {goal.status === "achieved" && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5">
                    ✓ Achieved
                  </span>
                )}
                {goal.status !== "draft" && goal.status !== "refined" && goal.status !== "ready" && goal.status !== "active" && goal.status !== "regressed" && progress.total > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-[80px] h-1 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {progress.checked}/{progress.total}
                    </span>
                  </div>
                )}
                {goal.status !== "draft" && goal.status !== "refined" && goal.status !== "ready" && goal.status !== "active" && goal.status !== "regressed" && goal.acceptanceCriteria.length > 0 && progress.total === 0 && (
                  <span className="text-xs text-muted-foreground">
                    {goal.acceptanceCriteria.length} {goal.acceptanceCriteria.length === 1 ? "criterion" : "criteria"}
                  </span>
                )}
                {goal.status === "done" && progress.total === 0 && goal.acceptanceCriteria.length === 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5">
                    Complete
                  </span>
                )}
              </div>
            </button>
          );
        };

    return (
      <div className="space-y-2">
        {activeGoals.length === 0 && achievedGoals.length === 0 && !addingGoal && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No goals yet.
          </p>
        )}

        {activeGoals.map(renderGoalCard)}

        {/* Achieved goals — collapsible section */}
        {achievedGoals.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowAchieved(!showAchieved)}
              className="w-full flex items-center gap-2 py-2 px-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showAchieved ? "rotate-90" : ""}`} />
              <span>{achievedGoals.length} achieved</span>
            </button>
            {showAchieved && (
              <div className="space-y-2 mt-1">
                {achievedGoals.map(renderGoalCard)}
              </div>
            )}
          </div>
        )}

        {/* Quick-add goal with mode selection */}
        {!quickAddOpen ? (
          <button
            onClick={() => setQuickAddOpen(true)}
            className="w-full flex items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-card transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Goal</span>
          </button>
        ) : (
          <div className="rounded-lg border border-primary/30 bg-card overflow-hidden transition-all">
            <textarea
              ref={quickAddRef}
              value={quickAddValue}
              onChange={(e) => {
                setQuickAddValue(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuickAdd("yolo"); }
                if (e.key === "Escape") { setQuickAddValue(""); setQuickAddOpen(false); }
              }}
              onBlur={() => { if (!quickAddValue.trim()) setQuickAddOpen(false); }}
              placeholder="Describe a goal... What should the agent work on?"
              disabled={quickAddSubmitting}
              rows={2}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none resize-none px-3 pt-3 pb-2 min-h-[60px] max-h-[200px]"
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <span className="text-xs text-muted-foreground/40">
                Enter to auto-plan · Esc to cancel
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleQuickAdd("interview")}
                  disabled={quickAddSubmitting || !quickAddValue.trim()}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Lightbulb className="h-3 w-3" />
                  Interview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -- Full table mode --
  if (goals.length === 0 && !addingGoal) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          No goals defined yet. Goals appear after the spec phase.
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setAddingGoal(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Goal
          </Button>
        </div>
        {addingGoal && (
          <AddGoalForm
            form={newGoalForm}
            onChange={setNewGoalForm}
            onSave={handleAddGoal}
            onCancel={() => setAddingGoal(false)}
            saving={addingGoalMut}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name
              </th>
              <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                Retries
              </th>
              <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                Cost
              </th>
              <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {goals.map((goal) => (
              editingId === goal.id && editForm ? (
                <tr key={goal.id}>
                  <td colSpan={5} className="py-4">
                    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Name</label>
                          <Input
                            className="h-9 text-sm"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Status</label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          >
                            {GOAL_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Description</label>
                        <Textarea
                          className="min-h-[80px] resize-y text-sm"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Acceptance Criteria</label>
                        <CriteriaEditor
                          criteria={editForm.acceptanceCriteria}
                          onChange={(next) => setEditForm({ ...editForm, acceptanceCriteria: next })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Dependencies (comma-separated IDs)</label>
                        <Input
                          className="h-9 text-sm font-mono"
                          value={editForm.dependsOn}
                          onChange={(e) => setEditForm({ ...editForm, dependsOn: e.target.value })}
                          placeholder="goal-id-1, goal-id-2"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={cancelEditing} disabled={updatingGoal}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => saveGoalEdit(goal.id)} disabled={updatingGoal}>
                          {updatingGoal ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={goal.id}
                  className="group hover:bg-muted/50 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <div>
                      <span className="text-sm font-medium">{goal.name}</span>
                      {goal.error && (
                        <p className="mt-1 text-xs text-red-400 line-clamp-2">
                          {goal.error}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge value={goal.status} type="goal" />
                  </td>
                  <td className="py-3 pr-4 text-right text-sm text-muted-foreground tabular-nums">
                    {goal.retries}
                  </td>
                  <td className="py-3 pr-4 text-right text-sm text-muted-foreground tabular-nums">
                    {formatCost(goal.costUsd)}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEditing(goal)}
                        title="Edit goal"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-red-400"
                        onClick={() => handleRemoveGoal(goal.id, goal.name)}
                        disabled={removingGoal}
                        title="Delete goal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Goal */}
      {addingGoal ? (
        <AddGoalForm
          form={newGoalForm}
          onChange={setNewGoalForm}
          onSave={handleAddGoal}
          onCancel={() => setAddingGoal(false)}
          saving={addingGoalMut}
        />
      ) : (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setAddingGoal(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Goal
          </Button>
        </div>
      )}
    </div>
  );
}

function AddGoalForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  form: GoalFormState;
  onChange: (f: GoalFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
      <h4 className="text-sm font-medium">New Goal</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Name</label>
          <Input
            className="h-9 text-sm"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="Goal name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Dependencies (comma-separated IDs)</label>
          <Input
            className="h-9 text-sm font-mono"
            value={form.dependsOn}
            onChange={(e) => onChange({ ...form, dependsOn: e.target.value })}
            placeholder="goal-id-1, goal-id-2"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <Textarea
          className="min-h-[80px] resize-y text-sm"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Goal description..."
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Acceptance Criteria</label>
        <CriteriaEditor
          criteria={form.acceptanceCriteria}
          onChange={(next) => onChange({ ...form, acceptanceCriteria: next })}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving || !form.name.trim() || !form.description.trim()}
        >
          {saving ? "Adding..." : "Add Goal"}
        </Button>
      </div>
    </div>
  );
}
