import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import {
  GET_PROJECT,
  GET_PROJECTS,
  START_AGENT,
  STOP_AGENT,
  DELETE_PROJECT,
  PROJECT_UPDATED,
  LOG_EVENTS,
  NEW_MESSAGE,
} from "@/graphql/operations";
import { GoalTable } from "@/components/GoalTable";
import { SpecView } from "@/components/SpecView";
import { LogStream } from "@/components/LogStream";
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

interface ProjectListItem {
  id: string;
  name: string;
  phase: string;
  isRunning: boolean;
}

type PanelTab = "goals" | "spec" | "activity";

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Icons                                                                      */
/* ──────────────────────────────────────────────────────────────────────────── */

function IconBack() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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

function IconPlay() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconChecklist() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
    </svg>
  );
}

function IconSpinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function IconSidebar() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Phase Indicator                                                            */
/* ──────────────────────────────────────────────────────────────────────────── */

function PhaseIndicator({ phase }: { phase: string }) {
  const phases = ["interview", "spec", "execution", "standby"];
  const currentIdx = phases.indexOf(phase);

  return (
    <div className="hidden md:flex items-center gap-1">
      {phases.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && (
            <div className={`w-4 h-px ${i <= currentIdx ? "bg-indigo-500/50" : "bg-white/[0.06]"}`} />
          )}
          <div className="flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${
              i < currentIdx ? "bg-emerald-500" :
              i === currentIdx ? "bg-indigo-500" :
              "bg-white/[0.08]"
            }`} />
            <span className={`text-[10px] ${
              i === currentIdx ? "text-foreground font-medium" :
              i < currentIdx ? "text-muted-foreground/60" :
              "text-muted-foreground/30"
            }`}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Project Sidebar                                                            */
/* ──────────────────────────────────────────────────────────────────────────── */

function ProjectSidebar({
  projects,
  activeProjectId,
  expanded,
}: {
  projects: ProjectListItem[];
  activeProjectId: string;
  expanded: boolean;
}) {
  return (
    <aside
      className={`
        shrink-0 border-r border-white/[0.06] bg-[hsl(224,71%,3%)] flex flex-col
        transition-all duration-200 overflow-hidden
        ${expanded ? "w-[220px]" : "w-12"}
      `}
    >
      <div className="flex-1 overflow-y-auto py-2">
        {projects.map((p) => {
          const isActive = p.id === activeProjectId;
          const initial = p.name.charAt(0).toUpperCase();

          return (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className={`
                flex items-center gap-2.5 px-3 py-2 transition-colors relative
                ${isActive
                  ? "bg-white/[0.06] border-l-2 border-indigo-500"
                  : "border-l-2 border-transparent hover:bg-white/[0.03]"
                }
              `}
              title={p.name}
            >
              {/* Status dot + initial */}
              <div className="shrink-0 relative">
                <div className={`
                  h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-semibold
                  ${isActive ? "bg-indigo-500/20 text-indigo-400" : "bg-white/[0.06] text-muted-foreground/60"}
                `}>
                  {initial}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[hsl(224,71%,3%)] ${
                  p.isRunning ? "bg-emerald-500" : "bg-zinc-600"
                }`} />
              </div>

              {/* Name + phase (only when expanded) */}
              {expanded && (
                <div className="min-w-0 flex-1">
                  <div className={`text-xs truncate ${isActive ? "text-foreground font-medium" : "text-muted-foreground/70"}`}>
                    {p.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground/40 truncate">
                    {p.phase}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* New Project link */}
      <div className="shrink-0 border-t border-white/[0.06] py-2 px-3">
        <Link
          to="/projects/new"
          className={`
            flex items-center gap-2 py-1.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors
            ${expanded ? "" : "justify-center"}
          `}
          title="New Project"
        >
          <IconPlus />
          {expanded && <span className="text-[11px]">New Project</span>}
        </Link>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Tab Rail Button                                                            */
/* ──────────────────────────────────────────────────────────────────────────── */

function RailButton({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center gap-1 w-full py-3 transition-colors
        ${active
          ? "bg-white/[0.06] text-foreground border-l-2 border-indigo-500"
          : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/[0.03] border-l-2 border-transparent"
        }
      `}
      title={label}
    >
      <div className="relative">
        {icon}
        {count !== undefined && count > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-medium tabular-nums leading-none px-1">
            {count}
          </span>
        )}
      </div>
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Panel Header                                                               */
/* ──────────────────────────────────────────────────────────────────────────── */

function PanelHeader({
  title,
  onClose,
  action,
}: {
  title: string;
  onClose: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 flex items-center justify-between h-12 px-4 border-b border-white/[0.06]">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <div className="flex items-center gap-2">
        {action}
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.06] transition-colors"
        >
          <IconClose />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Overflow menu                                                              */
/* ──────────────────────────────────────────────────────────────────────────── */

function OverflowMenu({
  onDelete,
  disabled,
}: {
  onDelete: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = () => setOpen(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] transition-colors"
        title="More options"
      >
        <IconMore />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-white/[0.08] bg-[hsl(224,71%,6%)] shadow-xl py-1">
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            disabled={disabled}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.04] transition-colors disabled:opacity-30"
          >
            <IconTrash />
            Delete project
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  Main Component                                                             */
/* ──────────────────────────────────────────────────────────────────────────── */

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState<PanelTab | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const autoOpenedRef = useRef(false);
  const autoOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: projectsData } = useQuery<{ projects: ProjectListItem[] }>(GET_PROJECTS);

  const { data, loading, error } = useQuery<{ project: Project | null }>(
    GET_PROJECT,
    { variables: { id }, skip: !id }
  );

  useSubscription(PROJECT_UPDATED, {
    variables: { projectId: id },
    skip: !id,
  });

  // Auto-open panel (system triggered, won't override user's choice)
  const autoOpenPanel = useCallback((panel: PanelTab) => {
    // Clear any pending auto-open timer
    if (autoOpenTimerRef.current) {
      clearTimeout(autoOpenTimerRef.current);
      autoOpenTimerRef.current = null;
    }
    // Small delay to avoid jarring rapid panel changes
    autoOpenTimerRef.current = setTimeout(() => {
      autoOpenTimerRef.current = null;
      setActivePanel((prev) => {
        if (prev !== null) return prev; // don't override user's choice
        autoOpenedRef.current = true;
        return panel;
      });
    }, 200);
  }, []);

  // Auto-close panel (only if it was auto-opened, not manually)
  const autoClosePanel = useCallback(() => {
    if (autoOpenedRef.current) {
      setActivePanel(null);
      autoOpenedRef.current = false;
    }
  }, []);

  // Cleanup auto-open timer on unmount
  useEffect(() => {
    return () => {
      if (autoOpenTimerRef.current) {
        clearTimeout(autoOpenTimerRef.current);
      }
    };
  }, []);

  // Auto-open activity panel when agent uses tools
  useSubscription(LOG_EVENTS, {
    variables: { projectId: id },
    skip: !id || !data?.project?.isRunning,
    onData: ({ data: subData }) => {
      const event = subData.data?.logEvent;
      if (!event?.message) return;
      // Tool use events: auto-open activity panel
      if (event.message.startsWith("Using ")) {
        autoOpenPanel("activity");
      }
      // Goal completion: switch to goals panel
      if (event.message.includes("→ done")) {
        autoOpenedRef.current = false; // treat goal completion as important
        setActivePanel("goals");
      }
    },
  });

  // Auto-close panel when agent sends a text message
  useSubscription(NEW_MESSAGE, {
    variables: { projectId: id },
    skip: !id,
    onData: ({ data: subData }) => {
      const msg = subData.data?.newMessage;
      if (msg?.role === "agent") {
        // Skip tool_use messages (they are JSON with _type)
        try {
          const parsed = JSON.parse(msg.content);
          if (parsed._type === "tool_use") return;
        } catch {
          // Not JSON = regular text message
        }
        autoClosePanel();
      }
    },
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

  const togglePanel = useCallback((panel: PanelTab) => {
    setActivePanel((prev) => {
      const next = prev === panel ? null : panel;
      autoOpenedRef.current = false; // user took manual control
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "1") {
        e.preventDefault();
        togglePanel("goals");
      } else if (mod && e.key === "2") {
        e.preventDefault();
        togglePanel("spec");
      } else if (mod && e.key === "3") {
        e.preventDefault();
        togglePanel("activity");
      } else if (e.key === "[" && !mod && !isInput) {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "Escape") {
        setActivePanel(null);
        autoOpenedRef.current = false;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePanel, toggleSidebar]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <IconSpinner />
          <span className="text-sm">Loading project...</span>
        </div>
      </div>
    );
  }

  /* ── Error / Not found ── */
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
  const panelOpen = activePanel !== null;

  const panelTitles: Record<PanelTab, string> = {
    goals: "Goals",
    spec: "Spec",
    activity: "Activity",
  };

  return (
    <div className="flex flex-col h-screen">
      {/* ─── Top Bar ─── */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 h-12 border-b border-border/60 bg-background z-30">
        {/* Left: sidebar toggle + back + name + path */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleSidebar}
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Toggle sidebar ( [ )"
          >
            <IconSidebar />
          </button>
          <button
            onClick={() => navigate("/")}
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <IconBack />
          </button>
          <div className="min-w-0 flex items-center gap-3">
            <h1 className="text-[15px] font-semibold tracking-tight truncate">
              {project.name}
            </h1>
            <span className="text-[11px] text-muted-foreground/40 font-mono truncate hidden lg:inline">
              {project.path}
            </span>
          </div>
        </div>

        {/* Center-right: phase + status indicators */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Phase indicator */}
          <PhaseIndicator phase={project.phase} />

          {/* Divider */}
          <span className="hidden md:block h-4 w-px bg-white/[0.06]" />

          {/* Status pill */}
          {project.isRunning ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              Running
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
              <span className="inline-flex rounded-full h-1.5 w-1.5 bg-zinc-500" />
              Stopped
            </span>
          )}

          {/* Divider */}
          <span className="h-4 w-px bg-white/[0.06]" />

          {/* Cost */}
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCost(project.totalCost)}
          </span>

          {/* Goals progress */}
          <span className="text-xs text-muted-foreground tabular-nums">
            {doneGoals}/{project.goals.length}
            <span className="text-muted-foreground/40 ml-0.5 hidden sm:inline">goals</span>
          </span>

          {/* Divider */}
          <span className="h-4 w-px bg-white/[0.06]" />

          {/* Start / Stop button */}
          {project.isRunning ? (
            <button
              onClick={() => stopAgent({ variables: { projectId: id } })}
              disabled={stopping}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {stopping ? (
                <IconSpinner className="h-3 w-3" />
              ) : (
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              )}
              {stopping ? "Stopping..." : "Stop"}
            </button>
          ) : (
            <button
              onClick={() => startAgent({ variables: { projectId: id } })}
              disabled={starting}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              {starting ? <IconSpinner className="h-3 w-3" /> : <IconPlay />}
              {starting ? "Starting..." : "Start"}
            </button>
          )}

          {/* Overflow menu */}
          <OverflowMenu
            onDelete={() => {
              if (confirm("Delete this project and all its data?")) {
                deleteProject({ variables: { id } });
              }
            }}
            disabled={deleting || project.isRunning}
          />
        </div>
      </header>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex min-h-0">
        {/* ── Project Sidebar ── */}
        <ProjectSidebar
          projects={projectsData?.projects ?? []}
          activeProjectId={project.id}
          expanded={sidebarExpanded}
        />

        {/* ── Chat Area (fills remaining space) ── */}
        <main className="flex-1 min-w-0 flex flex-col bg-background transition-all duration-200 ease-out">
          <div
            className={`
              w-full h-full flex flex-col mx-auto transition-all duration-200 ease-out
              ${panelOpen ? "max-w-[600px]" : "max-w-[720px]"}
            `}
          >
            <ChatPanel
              projectId={project.id}
              isAgentRunning={project.isRunning}
            />
          </div>
        </main>

        {/* ── Slide-over Panel ── */}
        <div
          className={`
            shrink-0 overflow-hidden transition-all duration-200 ease-out border-l
            ${panelOpen
              ? "w-[480px] border-white/[0.06]"
              : "w-0 border-transparent"
            }
          `}
        >
          <div className="w-[480px] h-full flex flex-col bg-[hsl(224,71%,4.5%)]">
            {activePanel && (
              <>
                <PanelHeader
                  title={panelTitles[activePanel]}
                  onClose={() => {
                    setActivePanel(null);
                    autoOpenedRef.current = false;
                  }}
                  action={
                    activePanel === "goals" ? (
                      <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                        {doneGoals}/{project.goals.length} done
                      </span>
                    ) : activePanel === "spec" ? (
                      <span className="text-[11px] text-muted-foreground/50">
                        {project.spec ? "Generated" : "Pending"}
                      </span>
                    ) : null
                  }
                />
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {activePanel === "goals" && (
                    <GoalTable
                      goals={project.goals}
                      projectId={project.id}
                      compact
                    />
                  )}
                  {activePanel === "spec" && (
                    <SpecView
                      spec={project.spec}
                      projectId={project.id}
                      compact
                    />
                  )}
                  {activePanel === "activity" && (
                    <LogStream projectId={project.id} compact />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Tab Rail ── */}
        <aside className="shrink-0 w-12 border-l border-white/[0.06] bg-[hsl(224,71%,3%)] flex flex-col pt-2">
          <RailButton
            icon={<IconChecklist />}
            label="Goals"
            count={project.goals.length}
            active={activePanel === "goals"}
            onClick={() => togglePanel("goals")}
          />
          <RailButton
            icon={<IconDocument />}
            label="Spec"
            active={activePanel === "spec"}
            onClick={() => togglePanel("spec")}
          />
          <RailButton
            icon={<IconTerminal />}
            label="Activity"
            active={activePanel === "activity"}
            onClick={() => togglePanel("activity")}
          />
        </aside>
      </div>
    </div>
  );
}
