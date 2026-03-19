import { useState } from "react";
import { useMutation } from "@apollo/client";
import { UPDATE_SPEC, GET_PROJECT } from "@/graphql/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, X } from "lucide-react";

interface SpecGoal {
  id: string;
  name: string;
  description: string;
  acceptanceCriteria: string[];
  dependsOn: string[];
}

interface Spec {
  overview: string;
  goals: SpecGoal[];
  technicalDecisions: string[];
}

interface SpecViewProps {
  spec: Spec | null | undefined;
  projectId: string;
  compact?: boolean;
}

export function SpecView({ spec, projectId, compact = false }: SpecViewProps) {
  const [editing, setEditing] = useState(false);
  const [overview, setOverview] = useState("");
  const [techDecisions, setTechDecisions] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);

  const [updateSpec, { loading: saving }] = useMutation(UPDATE_SPEC, {
    refetchQueries: [{ query: GET_PROJECT, variables: { id: projectId } }],
  });

  function startEditing() {
    if (!spec) return;
    setOverview(spec.overview);
    setTechDecisions([...spec.technicalDecisions]);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  async function saveEdits() {
    await updateSpec({
      variables: {
        projectId,
        overview,
        technicalDecisions: techDecisions.filter((d) => d.trim() !== ""),
      },
    });
    setEditing(false);
  }

  function updateDecision(index: number, value: string) {
    setTechDecisions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function removeDecision(index: number) {
    setTechDecisions((prev) => prev.filter((_, i) => i !== index));
  }

  function addDecision() {
    setTechDecisions((prev) => [...prev, ""]);
  }

  // -- Compact sidebar mode --
  if (compact) {
    if (!spec) {
      return (
        <p className="text-xs text-muted-foreground py-2">
          No spec yet.
        </p>
      );
    }

    const overviewText = spec.overview || "";
    const truncated = overviewText.length > 150 && !showMore;
    const displayText = truncated
      ? overviewText.slice(0, 150) + "..."
      : overviewText;

    return (
      <div className="space-y-3">
        {/* Overview */}
        <div>
          <p className="text-xs leading-relaxed text-foreground/80">
            {displayText}
          </p>
          {overviewText.length > 150 && (
            <button
              onClick={() => setShowMore(!showMore)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              {showMore ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Tech decisions as pills */}
        {spec.technicalDecisions.length > 0 && (
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Tech Decisions
            </span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {spec.technicalDecisions.map((decision, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-sm text-foreground/70"
                  title={decision}
                >
                  {decision.length > 40 ? decision.slice(0, 40) + "..." : decision}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Edit button */}
        <button
          onClick={startEditing}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" />
          Edit spec
        </button>

        {/* Inline edit form */}
        {editing && (
          <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">Overview</label>
              <Textarea
                className="min-h-[80px] resize-y text-xs"
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">Technical Decisions</label>
              <div className="space-y-1.5">
                {techDecisions.map((decision, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      className="h-7 text-xs"
                      value={decision}
                      onChange={(e) => updateDecision(i, e.target.value)}
                      placeholder="Technical decision..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-6 w-6"
                      onClick={() => removeDecision(i)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDecision}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Add decision
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <Button variant="outline" size="sm" className="h-6 text-sm px-2" onClick={cancelEditing} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" className="h-6 text-sm px-2" onClick={saveEdits} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -- Full mode --
  if (!spec) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No spec generated yet. Complete the interview phase first.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with edit toggle */}
      <div className="flex items-center justify-end gap-2 -mb-4">
        {editing ? (
          <>
            <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveEdits} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <span className="flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </span>
          </Button>
        )}
      </div>

      {/* Overview */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Overview
        </h3>
        {editing ? (
          <Textarea
            className="min-h-[120px] resize-y text-sm"
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
          />
        ) : (
          <p className="text-sm leading-relaxed">{spec.overview}</p>
        )}
      </section>

      {/* Goals (read-only -- goals are edited in the GoalTable) */}
      {spec.goals.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Spec Goals
          </h3>
          <div className="space-y-4">
            {spec.goals.map((goal, idx) => (
              <div
                key={goal.id}
                className="rounded-lg border border-border bg-muted/30 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="space-y-2 min-w-0">
                    <h4 className="text-sm font-medium">{goal.name}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {goal.description}
                    </p>
                    {goal.acceptanceCriteria.length > 0 && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Acceptance Criteria:
                        </span>
                        <ul className="mt-1 space-y-1">
                          {goal.acceptanceCriteria.map((criterion, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs text-muted-foreground"
                            >
                              <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                              {criterion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {goal.dependsOn.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Depends on:{" "}
                        <span className="font-mono">
                          {goal.dependsOn.join(", ")}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Technical Decisions */}
      {(editing || spec.technicalDecisions.length > 0) && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Technical Decisions
          </h3>
          {editing ? (
            <div className="space-y-2">
              {techDecisions.map((decision, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="h-9 text-sm"
                    value={decision}
                    onChange={(e) => updateDecision(i, e.target.value)}
                    placeholder="Technical decision..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9"
                    onClick={() => removeDecision(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <button
                type="button"
                onClick={addDecision}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
              >
                + Add decision
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {spec.technicalDecisions.map((decision, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
                  {decision}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
