import { useState } from "react";
import { useMutation } from "@apollo/client";
import { UPDATE_SPEC, GET_PROJECT } from "@/graphql/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
}

export function SpecView({ spec, projectId }: SpecViewProps) {
  const [editing, setEditing] = useState(false);
  const [overview, setOverview] = useState("");
  const [techDecisions, setTechDecisions] = useState<string[]>([]);

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
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
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
          <textarea
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y"
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
                  <button
                    type="button"
                    onClick={() => removeDecision(i)}
                    className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-muted transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
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
