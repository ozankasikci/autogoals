import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useMutation } from "@apollo/client";
import { UPDATE_GOAL, REMOVE_GOAL, REFINE_GOAL, APPROVE_GOAL, GET_PROJECT } from "@/graphql/operations";
import { formatCost } from "@/lib/utils";

/* ── Saved indicator hook ── */

function useSavedIndicator() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { visible, flash };
}

/* ── Types ── */

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

interface GoalDetailProps {
  goal: Goal;
  projectId: string;
  allGoals: Goal[];
  onBack: () => void;
  onNavigateToGoal: (goalId: string) => void;
  onSendMessage?: (message: string) => void;
}

/* ── Constants ── */

const GOAL_STATUSES = ["draft", "refined", "ready", "pending", "active", "verifying", "done", "failed", "skipped"] as const;

const STATUS_COLORS: Record<string, string> = {
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

/* ── Helpers ── */

function parseCriterion(text: string): { checked: boolean; label: string } {
  if (text.startsWith("[x] ")) return { checked: true, label: text.slice(4) };
  if (text.startsWith("[ ] ")) return { checked: false, label: text.slice(4) };
  return { checked: false, label: text };
}

function serializeCriterion(checked: boolean, label: string): string {
  return `${checked ? "[x]" : "[ ]"} ${label}`;
}

/* ── Icons ── */

function IconChevronLeft() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconX({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

/* ── Main Component ── */

export function GoalDetail({ goal, projectId, allGoals, onBack, onNavigateToGoal, onSendMessage }: GoalDetailProps) {
  const [name, setName] = useState(goal.name);
  const [description, setDescription] = useState(goal.description);
  const [approach, setApproach] = useState(goal.approach ?? "");
  const [editingApproach, setEditingApproach] = useState(false);
  const [criteria, setCriteria] = useState(goal.acceptanceCriteria);
  const [status, setStatus] = useState(goal.status);
  const [dependencies, setDependencies] = useState(goal.dependsOn);
  const [newCriterion, setNewCriterion] = useState("");
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saved = useSavedIndicator();

  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const approachRef = useRef<HTMLTextAreaElement>(null);
  const newCriterionRef = useRef<HTMLInputElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const depPickerRef = useRef<HTMLDivElement>(null);

  // Sync from props when goal changes externally
  useEffect(() => {
    setName(goal.name);
    setDescription(goal.description);
    setApproach(goal.approach ?? "");
    setCriteria(goal.acceptanceCriteria);
    setStatus(goal.status);
    setDependencies(goal.dependsOn);
  }, [goal.id, goal.name, goal.description, goal.approach, goal.acceptanceCriteria, goal.dependsOn, goal.status]);

  const refetchOpts = {
    refetchQueries: [{ query: GET_PROJECT, variables: { id: projectId } }],
  };

  const [updateGoal] = useMutation(UPDATE_GOAL, refetchOpts);
  const [removeGoal, { loading: removingGoal }] = useMutation(REMOVE_GOAL, refetchOpts);
  const [refineGoal, { loading: refining }] = useMutation(REFINE_GOAL, refetchOpts);
  const [approveGoal, { loading: approving }] = useMutation(APPROVE_GOAL, refetchOpts);

  // Debounced save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveGoal = useCallback(
    (updates: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateGoal({
          variables: { projectId, goalId: goal.id, ...updates },
        }).then(() => saved.flash());
      }, 500);
    },
    [updateGoal, projectId, goal.id, saved]
  );

  // Immediate save (no debounce)
  const saveGoalNow = useCallback(
    (updates: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      updateGoal({
        variables: { projectId, goalId: goal.id, ...updates },
      }).then(() => saved.flash());
    },
    [updateGoal, projectId, goal.id, saved]
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!statusDropdownOpen && !showDepPicker) return;
    function handleClick(e: MouseEvent) {
      if (statusDropdownOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
      if (showDepPicker && depPickerRef.current && !depPickerRef.current.contains(e.target as Node)) {
        setShowDepPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [statusDropdownOpen, showDepPicker]);

  /* ── Handlers ── */

  function handleNameChange(value: string) {
    setName(value);
    saveGoal({ name: value });
  }

  function handleNameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    saveGoal({ description: value });
  }

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    setStatusDropdownOpen(false);
    saveGoalNow({ status: newStatus });
  }

  function handleCriterionToggle(index: number) {
    const updated = [...criteria];
    const parsed = parseCriterion(updated[index]);
    updated[index] = serializeCriterion(!parsed.checked, parsed.label);
    setCriteria(updated);
    saveGoalNow({ acceptanceCriteria: updated });
  }

  function handleCriterionEdit(index: number, newLabel: string) {
    const updated = [...criteria];
    const parsed = parseCriterion(updated[index]);
    updated[index] = serializeCriterion(parsed.checked, newLabel);
    setCriteria(updated);
    saveGoal({ acceptanceCriteria: updated });
  }

  function handleCriterionRemove(index: number) {
    const updated = criteria.filter((_, i) => i !== index);
    setCriteria(updated);
    saveGoalNow({ acceptanceCriteria: updated });
  }

  function handleAddCriterion() {
    if (!newCriterion.trim()) return;
    const updated = [...criteria, serializeCriterion(false, newCriterion.trim())];
    setCriteria(updated);
    setNewCriterion("");
    saveGoalNow({ acceptanceCriteria: updated });
    // Keep focus on input for continuous entry
    requestAnimationFrame(() => newCriterionRef.current?.focus());
  }

  function handleAddDependency(depId: string) {
    if (dependencies.includes(depId)) return;
    const updated = [...dependencies, depId];
    setDependencies(updated);
    setShowDepPicker(false);
    saveGoalNow({ dependsOn: updated });
  }

  function handleRemoveDependency(depId: string) {
    const updated = dependencies.filter((d) => d !== depId);
    setDependencies(updated);
    saveGoalNow({ dependsOn: updated });
  }

  function handleApproachChange(value: string) {
    setApproach(value);
    saveGoal({ approach: value });
  }

  function handleApproachBlur() {
    setEditingApproach(false);
  }

  async function handleRefineGoal() {
    await refineGoal({ variables: { projectId, goalId: goal.id } });
  }

  async function handleApproveGoal(startImmediately: boolean) {
    await approveGoal({ variables: { projectId, goalId: goal.id, startImmediately } });
  }

  function handleReviseGoal() {
    onSendMessage?.(`Please revise goal "${goal.name}" — I'd like to make changes to the approach and criteria.`);
  }

  async function handleDeleteGoal() {
    await removeGoal({ variables: { projectId, goalId: goal.id } });
    onBack();
  }

  // Auto-grow description textarea
  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  useEffect(() => {
    autoGrow(descriptionRef.current);
  }, [description]);

  useEffect(() => {
    if (editingApproach) {
      autoGrow(approachRef.current);
    }
  }, [approach, editingApproach]);

  /* ── Computed ── */

  const parsedCriteria = criteria.map(parseCriterion);
  const checkedCount = parsedCriteria.filter((c) => c.checked).length;
  const totalCriteria = parsedCriteria.length;
  const progressPct = totalCriteria > 0 ? (checkedCount / totalCriteria) * 100 : 0;

  const isDraft = status === "draft";
  const isRefined = status === "refined";
  const isReady = status === "ready";

  const availableDeps = allGoals.filter(
    (g) => g.id !== goal.id && !dependencies.includes(g.id)
  );

  const depGoals = useMemo(() => {
    return dependencies
      .map((depId) => allGoals.find((g) => g.id === depId))
      .filter((g): g is Goal => g != null);
  }, [dependencies, allGoals]);

  return (
    <div className="flex flex-col h-full animate-fade-slide-in">
      {/* ── Back navigation ── */}
      <div className="shrink-0 pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors -ml-0.5 py-1 pr-2 rounded-md hover:bg-white/[0.04]"
        >
          <IconChevronLeft />
          <span>Goals</span>
        </button>
      </div>

      {/* ── Title + Status + Saved indicator ── */}
      <div className="shrink-0 pb-4 border-b border-white/[0.04]">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={handleNameKeyDown}
              className="w-full bg-transparent text-base font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/40 outline-none border-none focus:ring-0 px-0"
              placeholder="Goal name..."
            />
          </div>

          {/* Saved indicator */}
          <span
            className={`shrink-0 text-xs text-emerald-400/70 font-medium mt-1.5 transition-opacity duration-300 ${
              saved.visible ? "opacity-100" : "opacity-0"
            }`}
          >
            Saved
          </span>

          {/* Status dropdown */}
          <div className="relative shrink-0" ref={statusDropdownRef}>
            <button
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className="flex items-center gap-1.5 h-6 px-2 rounded-md text-sm font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[status] ?? "bg-zinc-500"}`} />
              <span className="text-muted-foreground">{status}</span>
              <IconChevronDown />
            </button>
            {statusDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-white/[0.08] bg-[hsl(224,71%,6%)] shadow-xl py-1">
                {GOAL_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/[0.04] transition-colors ${
                      s === status ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[s]}`} />
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Action bar (status-dependent) ── */}
      {isDraft && (
        <div className="shrink-0 py-3 border-b border-white/[0.04]">
          <button
            onClick={handleRefineGoal}
            disabled={refining}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
          >
            {refining ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Refining...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Refine with Agent
              </>
            )}
          </button>
          {refining && (
            <p className="text-xs text-muted-foreground/50 text-center mt-2">
              The agent will ask you questions in the chat...
            </p>
          )}
        </div>
      )}

      {isRefined && (
        <div className="shrink-0 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleApproveGoal(true)}
              disabled={approving}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {approving ? "Approving..." : "Approve & Start"}
            </button>
            <button
              onClick={() => handleApproveGoal(false)}
              disabled={approving}
              className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground border border-white/[0.08] hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={handleReviseGoal}
              disabled={approving}
              className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground border border-white/[0.08] hover:bg-white/[0.04] transition-colors disabled:opacity-50"
            >
              Revise
            </button>
          </div>
        </div>
      )}

      {isReady && (
        <div className="shrink-0 py-3 border-b border-white/[0.04]">
          <div className="flex items-center justify-center gap-2 h-8 rounded-lg bg-indigo-500/[0.06] border border-indigo-500/10">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400" />
            </span>
            <span className="text-xs text-indigo-400/80 font-medium">Waiting to start</span>
          </div>
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto py-4 space-y-5">
        {/* ── Description ── */}
        <section>
          <SectionHeader label="Description" />
          <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
            <textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => {
                handleDescriptionChange(e.target.value);
                autoGrow(e.target);
              }}
              placeholder="Add a description..."
              className="w-full bg-transparent text-xs text-foreground/90 placeholder:text-muted-foreground/30 outline-none border-none focus:ring-0 resize-none min-h-[40px] leading-relaxed"
              rows={1}
            />
          </div>
        </section>

        {/* ── Approach ── */}
        {(goal.approach || isRefined || isReady) && (
          <section>
            <SectionHeader label="Approach" />
            <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
              {editingApproach ? (
                <textarea
                  ref={approachRef}
                  value={approach}
                  onChange={(e) => {
                    handleApproachChange(e.target.value);
                    autoGrow(e.target);
                  }}
                  onBlur={handleApproachBlur}
                  className="w-full bg-transparent text-sm text-foreground/80 placeholder:text-muted-foreground/30 outline-none border-none focus:ring-0 resize-none min-h-[40px] leading-relaxed"
                  rows={1}
                  autoFocus
                />
              ) : (
                <p
                  onClick={() => {
                    if (isRefined || isDraft) setEditingApproach(true);
                  }}
                  className={`text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap ${
                    isRefined || isDraft ? "cursor-text" : ""
                  }`}
                >
                  {approach || "No approach defined yet"}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── Acceptance Criteria ── */}
        <section>
          <div className="flex items-center justify-between">
            <SectionHeader label="Acceptance Criteria" />
            {totalCriteria > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground/50 tabular-nums">
                  {checkedCount}/{totalCriteria}
                </span>
                <div className="w-12 h-[2px] rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.04] overflow-hidden">
            {parsedCriteria.map((criterion, i) => (
              <CriterionRow
                key={i}
                checked={criterion.checked}
                label={criterion.label}
                onToggle={() => handleCriterionToggle(i)}
                onEdit={(newLabel) => handleCriterionEdit(i, newLabel)}
                onRemove={() => handleCriterionRemove(i)}
              />
            ))}
            {/* Continuous entry input */}
            <div className={`flex items-center gap-2 py-1.5 px-2 ${totalCriteria > 0 ? "border-t border-white/[0.04]" : ""}`}>
              <div className="shrink-0 h-3.5 w-3.5 rounded border border-white/[0.1] flex items-center justify-center opacity-30">
                <IconPlus />
              </div>
              <input
                ref={newCriterionRef}
                type="text"
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCriterion();
                  }
                }}
                placeholder="Add a criterion..."
                className="flex-1 bg-transparent text-xs text-foreground/80 placeholder:text-muted-foreground/25 outline-none border-b border-transparent focus:border-white/[0.08] focus:ring-0 pb-0.5 transition-colors"
              />
            </div>
          </div>
        </section>

        {/* ── Dependencies ── */}
        <section>
          <SectionHeader label="Dependencies" />
          <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
            {depGoals.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {depGoals.map((dep) => (
                  <span
                    key={dep.id}
                    className="group inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[dep.status] ?? "bg-zinc-500"}`} />
                    <button
                      onClick={() => onNavigateToGoal(dep.id)}
                      className="truncate max-w-[140px] hover:underline"
                    >
                      {dep.name}
                    </button>
                    <button
                      onClick={() => handleRemoveDependency(dep.id)}
                      className="shrink-0 h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] transition-all"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="relative" ref={depPickerRef}>
              <button
                onClick={() => setShowDepPicker(!showDepPicker)}
                className="flex items-center gap-1 text-sm text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <IconPlus />
                <span>Add dependency</span>
              </button>
              {showDepPicker && availableDeps.length > 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-[180px] overflow-y-auto rounded-lg border border-white/[0.08] bg-[hsl(224,71%,6%)] shadow-xl py-1">
                  {availableDeps.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => handleAddDependency(g.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_COLORS[g.status] ?? "bg-zinc-500"}`} />
                      <span className="truncate">{g.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {showDepPicker && availableDeps.length === 0 && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-white/[0.08] bg-[hsl(224,71%,6%)] shadow-xl py-1">
                  <div className="px-3 py-2 text-sm text-muted-foreground/40">No other goals available</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Details ── */}
        <section>
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="flex items-center gap-1 group"
          >
            <SectionHeader label="Details" />
            <svg
              className={`h-2.5 w-2.5 text-muted-foreground/30 transition-transform duration-150 mt-px ${detailsExpanded ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {detailsExpanded && (
            <div className="mt-2 rounded-lg bg-white/[0.02] border border-white/[0.04] p-3 space-y-1.5 animate-fade-slide-up">
              <DetailRow label="Cost" value={formatCost(goal.costUsd)} />
              <DetailRow label="Retries" value={String(goal.retries)} />
              {goal.error && (
                <div className="pt-1">
                  <span className="text-xs text-muted-foreground/40">Error</span>
                  <p className="text-xs text-red-400/80 mt-0.5 leading-relaxed">{goal.error}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Delete ── */}
        <section className="pt-2">
          {confirmDelete ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-3 space-y-2">
              <p className="text-xs text-red-400">
                Delete "{goal.name}"? This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteGoal}
                  disabled={removingGoal}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <IconTrash />
                  {removingGoal ? "Deleting..." : "Confirm Delete"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={removingGoal}
                  className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs text-red-400/60 hover:text-red-400 border border-white/[0.04] hover:border-red-500/20 hover:bg-red-500/[0.04] transition-all"
            >
              <IconTrash />
              Delete Goal
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SectionHeader({ label }: { label: string }) {
  return (
    <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground/40 font-medium">
      {label}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground/40">{label}</span>
      <span className="text-sm text-muted-foreground/70 tabular-nums">{value}</span>
    </div>
  );
}

function CriterionRow({
  checked,
  label,
  onToggle,
  onEdit,
  onRemove,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  onEdit: (newLabel: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(label);
  }, [label]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitEdit() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      onEdit(trimmed);
    } else {
      setEditValue(label);
    }
  }

  return (
    <div className="group flex items-center gap-2 py-1.5 px-2 hover:bg-white/[0.03] rounded transition-colors border-b border-white/[0.02] last:border-b-0">
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`shrink-0 h-3.5 w-3.5 rounded border flex items-center justify-center transition-all ${
          checked
            ? "bg-emerald-500/20 border-emerald-500/40"
            : "border-white/[0.15] hover:border-white/[0.3]"
        }`}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Label */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            }
            if (e.key === "Escape") {
              setEditing(false);
              setEditValue(label);
            }
          }}
          className="flex-1 bg-transparent text-xs text-foreground/80 outline-none border-none focus:ring-0 min-w-0"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-xs cursor-text min-w-0 truncate transition-colors ${
            checked ? "text-muted-foreground/40 line-through" : "text-foreground/80"
          }`}
        >
          {label}
        </span>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="shrink-0 h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400 hover:bg-white/[0.06] transition-all"
      >
        <IconX className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
