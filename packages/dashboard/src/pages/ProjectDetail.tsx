import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import {
  GET_PROJECT,
  START_AGENT,
  STOP_AGENT,
  DELETE_PROJECT,
  PROJECT_UPDATED,
} from "@/graphql/operations";
import { GoalTable } from "@/components/GoalTable";
import { SpecView } from "@/components/SpecView";
import { LogStream } from "@/components/LogStream";
import { StatusBadge } from "@/components/StatusBadge";
import { ChatPanel } from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { formatCost } from "@/lib/utils";

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

interface Project {
  id: string;
  name: string;
  path: string;
  phase: string;
  totalCost: number;
  isRunning: boolean;
  createdAt: string;
  spec: Spec | null;
  goals: Goal[];
  interviewNotes: string[];
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 px-4 text-left group"
      >
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {title}
        </span>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery<{ project: Project | null }>(
    GET_PROJECT,
    { variables: { id }, skip: !id }
  );

  // Real-time updates
  useSubscription(PROJECT_UPDATED, {
    variables: { projectId: id },
    skip: !id,
  });

  const [startAgent, { loading: starting }] = useMutation(START_AGENT, {
    refetchQueries: [{ query: GET_PROJECT, variables: { id } }],
  });

  const [stopAgent, { loading: stopping }] = useMutation(STOP_AGENT, {
    refetchQueries: [{ query: GET_PROJECT, variables: { id } }],
  });

  const [deleteProject, { loading: deleting }] = useMutation(DELETE_PROJECT, {
    onCompleted: () => navigate("/"),
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-24 bg-muted rounded-lg animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !data?.project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h3 className="text-lg font-medium mb-1">Project not found</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {error?.message ?? "The project you're looking for doesn't exist."}
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const project = data.project;
  const doneGoals = project.goals.filter((g) => g.status === "done").length;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 57px)" }}>
      {/* ─── Header ─── */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Back to projects"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight truncate">
              {project.name}
            </h1>
            <p className="text-[11px] text-muted-foreground font-mono truncate">
              {project.path}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Start / Stop */}
          {project.isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopAgent({ variables: { projectId: id } })}
              disabled={stopping}
              className="h-8"
            >
              {stopping ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Stopping...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  Stop
                </span>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => startAgent({ variables: { projectId: id } })}
              disabled={starting}
              className="h-8"
            >
              {starting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Starting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Start
                </span>
              )}
            </Button>
          )}

          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            className="h-8"
            onClick={() => {
              if (confirm("Are you sure you want to delete this project?")) {
                deleteProject({ variables: { id } });
              }
            }}
            disabled={deleting || project.isRunning}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* ─── Main area: Sidebar + Chat ─── */}
      <div className="flex-1 flex min-h-0">
        {/* ─── Left Sidebar ─── */}
        <aside className="w-[280px] shrink-0 border-r border-border bg-muted/30 overflow-y-auto">
          {/* Status section */}
          <div className="border-b border-border/50 px-4 py-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Status
            </span>
            <div className="mt-2.5 space-y-2.5">
              {/* Phase */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Phase</span>
                <StatusBadge value={project.phase} type="phase" />
              </div>
              {/* Cost */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cost</span>
                <span className="text-xs font-medium tabular-nums">
                  {formatCost(project.totalCost)}
                </span>
              </div>
              {/* Goals progress */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Goals</span>
                <span className="text-xs font-medium tabular-nums">
                  {doneGoals}/{project.goals.length}
                </span>
              </div>
              {/* Running status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Agent</span>
                {project.isRunning ? (
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs text-emerald-400 font-medium">
                      Running
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Stopped</span>
                )}
              </div>
            </div>
          </div>

          {/* Goals section */}
          <CollapsibleSection title="Goals" defaultOpen={true}>
            <GoalTable
              goals={project.goals}
              projectId={project.id}
              compact
            />
          </CollapsibleSection>

          {/* Spec section */}
          <CollapsibleSection title="Spec" defaultOpen={false}>
            <SpecView
              spec={project.spec}
              projectId={project.id}
              compact
            />
          </CollapsibleSection>

          {/* Logs section */}
          <CollapsibleSection title="Logs" defaultOpen={false}>
            <LogStream projectId={project.id} compact />
          </CollapsibleSection>
        </aside>

        {/* ─── Center: Chat ─── */}
        <main className="flex-1 min-w-0 bg-background">
          <ChatPanel
            projectId={project.id}
            isAgentRunning={project.isRunning}
          />
        </main>
      </div>
    </div>
  );
}
