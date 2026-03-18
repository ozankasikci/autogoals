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
}

export function SpecView({ spec }: SpecViewProps) {
  if (!spec) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No spec generated yet. Complete the interview phase first.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Overview
        </h3>
        <p className="text-sm leading-relaxed">{spec.overview}</p>
      </section>

      {/* Goals */}
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
      {spec.technicalDecisions.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Technical Decisions
          </h3>
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
        </section>
      )}
    </div>
  );
}
