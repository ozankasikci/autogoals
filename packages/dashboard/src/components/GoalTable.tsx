import { useState, useRef, useEffect } from "react";
import { useMutation } from "@apollo/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCost } from "@/lib/utils";
import { UPDATE_GOAL, ADD_GOAL, REMOVE_GOAL, GET_PROJECT } from "@/graphql/operations";
import { Plus, X, Pencil, Trash2 } from "lucide-react";

const GOAL_STATUSES = ["pending", "active", "verifying", "done", "failed", "skipped"];

interface Goal {
  id: string;
  name: string;
  description: string;
  approach?: string | null;
  acceptanceCriteria: string[];
  dependsOn: string[];
  status: string;
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
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalForm, setNewGoalForm] = useState<GoalFormState>({
    name: "",
    description: "",
    status: "pending",
    acceptanceCriteria: [""],
    dependsOn: "",
  });
  const addInputRef = useRef<HTMLInputElement>(null);

  const refetchOpts = {
    refetchQueries: [{ query: GET_PROJECT, variables: { id: projectId } }],
  };

  const [updateGoal, { loading: updatingGoal }] = useMutation(UPDATE_GOAL, refetchOpts);
  const [addGoal, { loading: addingGoalMut }] = useMutation(ADD_GOAL, refetchOpts);
  const [removeGoal, { loading: removingGoal }] = useMutation(REMOVE_GOAL, refetchOpts);

  // Focus the quick-add input when it appears
  useEffect(() => {
    if (addingGoal && compact && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [addingGoal, compact]);

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

  async function handleQuickAddGoal() {
    const trimmed = newGoalName.trim();
    if (!trimmed) return;
    await addGoal({
      variables: {
        projectId,
        name: trimmed,
        description: "",
        acceptanceCriteria: [],
        dependsOn: [],
      },
    });
    setNewGoalName("");
    setAddingGoal(false);
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
    return (
      <div className="space-y-2">
        {goals.length === 0 && !addingGoal && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No goals yet.
          </p>
        )}

        {goals.map((goal) => {
          const progress = getCriteriaProgress(goal.acceptanceCriteria);
          const progressPct = progress.total > 0 ? (progress.checked / progress.total) * 100 : 0;
          const isComplete = goal.status === "done";
          const isActive = goal.status === "active";

          return (
            <button
              key={goal.id}
              onClick={() => onSelectGoal?.(goal.id)}
              className={`
                w-full text-left group rounded-lg border transition-all duration-150 cursor-pointer
                ${isActive
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                  : isComplete
                    ? "border-border/60 bg-card/50 hover:bg-card"
                    : "border-border hover:border-border bg-card hover:bg-accent/30"
                }
              `}
            >
              {/* Top row: status + name + cost */}
              <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
                <span
                  className={`shrink-0 h-2.5 w-2.5 rounded-full ring-2 ring-background ${STATUS_DOT_COLORS[goal.status] ?? "bg-zinc-500"}`}
                />
                <span className={`text-sm font-medium truncate flex-1 min-w-0 ${isComplete ? "text-muted-foreground line-through decoration-muted-foreground/30" : "text-foreground"}`}>
                  {goal.name}
                </span>
                {goal.costUsd > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatCost(goal.costUsd)}
                  </span>
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
                {goal.status === "active" && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 rounded px-1.5 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Working...
                  </span>
                )}
                {goal.status !== "draft" && goal.status !== "refined" && goal.status !== "ready" && goal.status !== "active" && progress.total > 0 && (
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
                {goal.status !== "draft" && goal.status !== "refined" && goal.status !== "ready" && goal.status !== "active" && goal.acceptanceCriteria.length > 0 && progress.total === 0 && (
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
        })}

        {/* Quick-add goal */}
        {addingGoal ? (
          <div className="mt-1 px-2.5 py-1.5">
            <input
              ref={addInputRef}
              type="text"
              value={newGoalName}
              onChange={(e) => setNewGoalName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleQuickAddGoal();
                }
                if (e.key === "Escape") {
                  setAddingGoal(false);
                  setNewGoalName("");
                }
              }}
              onBlur={() => {
                if (!newGoalName.trim()) {
                  setAddingGoal(false);
                  setNewGoalName("");
                }
              }}
              placeholder="Goal name... (Enter to add)"
              disabled={addingGoalMut}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border focus:border-primary/40 pb-1.5 transition-colors"
            />
          </div>
        ) : (
          <button
            onClick={() => setAddingGoal(true)}
            className="w-full flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors py-2 px-2.5 mt-1"
          >
            <Plus className="h-3 w-3" />
            <span>Add Goal</span>
          </button>
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
