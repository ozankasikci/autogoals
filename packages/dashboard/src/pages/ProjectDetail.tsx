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

function SidebarSection({
  title,
  defaultOpen = true,
  children,
  count,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="sidebar-section">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-2.5 px-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground/40 bg-white/[0.04] rounded px-1.5 py-0.5 tabular-nums">
              {count}
            </span>
          )}
        </div>
        <svg
          className={`h-3 w-3 text-muted-foreground/30 transition-transform duration-200 ${
            open ? "" : "-rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-4">{children}</div>
      </div>
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
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 57px)" }}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading project...</span>
        </div>
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
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 h-12 border-b border-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex items-center gap-3">
            <h1 className="text-[15px] font-semibold tracking-tight truncate">
              {project.name}
            </h1>
            <span className="text-[11px] text-muted-foreground/40 font-mono truncate hidden sm:inline">
              {project.path}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {project.isRunning ? (
            <button
              onClick={() => stopAgent({ variables: { projectId: id } })}
              disabled={stopping}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
              </span>
              {stopping ? "Stopping..." : "Running"}
            </button>
          ) : (
            <button
              onClick={() => startAgent({ variables: { projectId: id } })}
              disabled={starting}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-muted-foreground border border-border hover:bg-muted/50 hover:text-foreground transition-colors disabled:opacity-50"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {starting ? "Starting..." : "Start Agent"}
            </button>
          )}
          <button
            onClick={() => {
              if (confirm("Delete this project and all its data?")) {
                deleteProject({ variables: { id } });
              }
            }}
            disabled={deleting || project.isRunning}
            className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Delete project"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Main layout: sidebar + chat ─── */}
      <div className="flex-1 flex min-h-0">

        {/* ─── Left Sidebar ─── */}
        <aside className="w-[300px] shrink-0 border-r border-border/40 overflow-y-auto bg-[hsl(224,71%,3%)]">

          {/* Status panel */}
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Phase</p>
                <StatusBadge value={project.phase} type="phase" />
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Cost</p>
                <span className="text-sm font-medium tabular-nums text-foreground/90">
                  {formatCost(project.totalCost)}
                </span>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Goals</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium tabular-nums text-foreground/90">
                    {doneGoals}/{project.goals.length}
                  </span>
                  {project.goals.length > 0 && (
                    <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
                        style={{ width: `${project.goals.length > 0 ? (doneGoals / project.goals.length) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Agent</p>
                {project.isRunning ? (
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-sm text-emerald-400 font-medium">Active</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/60">Idle</span>
                )}
              </div>
            </div>
          </div>

          {/* Goals */}
          <SidebarSection title="Goals" defaultOpen={true} count={project.goals.length}>
            <GoalTable goals={project.goals} projectId={project.id} compact />
          </SidebarSection>

          {/* Spec */}
          <SidebarSection title="Spec" defaultOpen={false}>
            <SpecView spec={project.spec} projectId={project.id} compact />
          </SidebarSection>

          {/* Activity */}
          <SidebarSection title="Activity" defaultOpen={false}>
            <LogStream projectId={project.id} compact />
          </SidebarSection>
        </aside>

        {/* ─── Center: Chat ─── */}
        <main className="flex-1 min-w-0 flex justify-center bg-background">
          <div className="w-full max-w-[760px] flex flex-col h-full">
            <ChatPanel
              projectId={project.id}
              isAgentRunning={project.isRunning}
            />
          </div>
        </main>

      </div>
    </div>
  );
}
