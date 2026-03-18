import { useState } from "react";
import { useMutation } from "@apollo/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCost } from "@/lib/utils";
import { UPDATE_GOAL, ADD_GOAL, REMOVE_GOAL, GET_PROJECT } from "@/graphql/operations";

const GOAL_STATUSES = ["pending", "active", "verifying", "done", "failed", "skipped"];

interface Goal {
  id: string;
  name: string;
  description: string;
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
}

interface GoalFormState {
  name: string;
  description: string;
  status: string;
  acceptanceCriteria: string[];
  dependsOn: string;
}

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
          <button
            type="button"
            onClick={() => onChange(criteria.filter((_, idx) => idx !== i))}
            className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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

export function GoalTable({ goals, projectId, compact = false }: GoalTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GoalFormState | null>(null);
  const [addingGoal, setAddingGoal] = useState(false);
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

  // ── Compact sidebar mode ──
  if (compact) {
    return (
      <div className="space-y-1">
        {goals.length === 0 && !addingGoal && (
          <p className="text-xs text-muted-foreground py-2">
            No goals yet.
          </p>
        )}

        {goals.map((goal) =>
          editingId === goal.id && editForm ? (
            <div key={goal.id} className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Name</label>
                <Input
                  className="h-7 text-xs"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Status</label>
                <select
                  className="flex h-7 w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                >
                  {GOAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px] resize-y"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Acceptance Criteria</label>
                <CriteriaEditor
                  criteria={editForm.acceptanceCriteria}
                  onChange={(next) => setEditForm({ ...editForm, acceptanceCriteria: next })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Dependencies</label>
                <Input
                  className="h-7 text-xs font-mono"
                  value={editForm.dependsOn}
                  onChange={(e) => setEditForm({ ...editForm, dependsOn: e.target.value })}
                  placeholder="goal-id-1, goal-id-2"
                />
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={cancelEditing} disabled={updatingGoal}>
                  Cancel
                </Button>
                <Button size="sm" className="h-6 text-[11px] px-2" onClick={() => saveGoalEdit(goal.id)} disabled={updatingGoal}>
                  {updatingGoal ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={goal.id}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <StatusBadge value={goal.status} type="goal" className="text-[10px] px-1.5 py-0" />
              <span className="text-xs font-medium truncate flex-1 min-w-0">
                {goal.name}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={() => startEditing(goal)}
                  className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Edit goal"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveGoal(goal.id, goal.name)}
                  disabled={removingGoal}
                  className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
                  title="Delete goal"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )
        )}

        {/* Add goal inline */}
        {addingGoal ? (
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3 mt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Name</label>
              <Input
                className="h-7 text-xs"
                value={newGoalForm.name}
                onChange={(e) => setNewGoalForm({ ...newGoalForm, name: e.target.value })}
                placeholder="Goal name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px] resize-y"
                value={newGoalForm.description}
                onChange={(e) => setNewGoalForm({ ...newGoalForm, description: e.target.value })}
                placeholder="Goal description..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Acceptance Criteria</label>
              <CriteriaEditor
                criteria={newGoalForm.acceptanceCriteria}
                onChange={(next) => setNewGoalForm({ ...newGoalForm, acceptanceCriteria: next })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Dependencies</label>
              <Input
                className="h-7 text-xs font-mono"
                value={newGoalForm.dependsOn}
                onChange={(e) => setNewGoalForm({ ...newGoalForm, dependsOn: e.target.value })}
                placeholder="goal-id-1, goal-id-2"
              />
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => setAddingGoal(false)} disabled={addingGoalMut}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={handleAddGoal}
                disabled={addingGoalMut || !newGoalForm.name.trim() || !newGoalForm.description.trim()}
              >
                {addingGoalMut ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingGoal(true)}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 text-left px-2"
          >
            + Add goal
          </button>
        )}
      </div>
    );
  }

  // ── Full table mode (unchanged) ──
  if (goals.length === 0 && !addingGoal) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          No goals defined yet. Goals appear after the spec phase.
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setAddingGoal(true)}>
            + Add Goal
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
                        <textarea
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-y"
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
                      <button
                        type="button"
                        onClick={() => startEditing(goal)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Edit goal"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal(goal.id, goal.name)}
                        disabled={removingGoal}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
                        title="Delete goal"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
            + Add Goal
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
        <textarea
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-y"
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
