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
import { GoalDetail } from "@/components/GoalDetail";
import { RulesPanel } from "@/components/RulesPanel";
import { LogStream } from "@/components/LogStream";
import { ChatPanel } from "@/components/ChatPanel";
import { FileTree } from "@/components/FileTree";
import { HistoryPanel } from "@/components/HistoryPanel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { formatCost } from "@/lib/utils";
import {
  ChevronLeft,
  Trash2,
  Play,
  Square,
  ClipboardCheck,
  FileText,
  Terminal,
  X,
  MoreVertical,
  Loader2,
  Menu,
  Plus,
  FolderTree,
  History,
} from "lucide-react";

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

interface Rule {
  id: string;
  content: string;
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
  rules: Rule[];
  interviewNotes: string[];
}

interface ProjectListItem {
  id: string;
  name: string;
  phase: string;
  isRunning: boolean;
}

type PanelTab = "goals" | "rules" | "activity" | "history" | "project";

/* ------------------------------------------------------------------ */
/*  Phase Indicator                                                    */
/* ------------------------------------------------------------------ */

const PHASE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  interview: { label: "Interviewing", color: "text-violet-400", bgColor: "bg-violet-500/10" },
  spec: { label: "Refining", color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
  execution: { label: "Executing", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  monitoring: { label: "Monitoring", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  standby: { label: "Standby", color: "text-muted-foreground", bgColor: "bg-muted" },
  done: { label: "Done", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
};

function PhaseIndicator({ phase, activeGoalName }: { phase: string; activeGoalName?: string }) {
  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG.standby;

  // Build the detail text based on phase
  let detail = "";
  if (phase === "execution" && activeGoalName) {
    detail = activeGoalName;
  } else if (phase === "monitoring") {
    detail = "Verifying goals";
  } else if (phase === "interview") {
    detail = "Refining goal";
  } else if (phase === "spec") {
    detail = "Generating criteria";
  } else if (phase === "standby") {
    detail = "Idle";
  }

  return (
    <div className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bgColor}`}>
      {phase === "execution" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color.replace("text-", "bg-")} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.color.replace("text-", "bg-")}`} />
        </span>
      )}
      {phase !== "execution" && (
        <span className={`h-1.5 w-1.5 rounded-full ${config.color.replace("text-", "bg-")}`} />
      )}
      <span className={`text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
      {detail && (
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
          {detail}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Project Sidebar                                                    */
/* ------------------------------------------------------------------ */

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
        shrink-0 border-r border-border bg-sidebar flex flex-col
        transition-all duration-200 overflow-hidden
        ${expanded ? "w-[220px]" : "w-12"}
      `}
    >
      <div className="flex-1 overflow-y-auto">
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
                  ? "bg-muted border-l-2 border-primary"
                  : "border-l-2 border-transparent hover:bg-muted/50"
                }
              `}
              title={p.name}
            >
              {/* Status dot + initial */}
              <div className="shrink-0 relative">
                <div className={`
                  h-6 w-6 rounded-md flex items-center justify-center text-sm font-semibold
                  ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}
                `}>
                  {initial}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-sidebar ${
                  p.isRunning ? "bg-emerald-500" : "bg-zinc-600"
                }`} />
              </div>

              {/* Name + phase (only when expanded) */}
              {expanded && (
                <div className="min-w-0 flex-1">
                  <div className={`text-sm truncate ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground/60 truncate">
                    {p.phase}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* New Project link */}
      <div className="shrink-0 border-t border-border py-2 px-3">
        <Link
          to="/projects/new"
          className={`
            flex items-center gap-2 py-1.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors
            ${expanded ? "" : "justify-center"}
          `}
          title="New Project"
        >
          <Plus className="h-3.5 w-3.5" />
          {expanded && <span className="text-sm">New Project</span>}
        </Link>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab Rail Button                                                    */
/* ------------------------------------------------------------------ */

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
          ? "bg-muted text-foreground border-l-2 border-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-l-2 border-transparent"
        }
      `}
      title={label}
    >
      <div className="relative">
        {icon}
        {count !== undefined && count > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-border text-xs font-medium tabular-nums leading-none px-1">
            {count}
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Panel Header                                                       */
/* ------------------------------------------------------------------ */

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
    <div className="shrink-0 flex items-center justify-between h-12 px-4 border-b border-border">
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      <div className="flex items-center gap-2">
        {action}
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState<PanelTab | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [panelWidth, setPanelWidth] = useState(480);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const autoOpenedRef = useRef(false);
  const autoOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: projectsData } = useQuery<{ projects: ProjectListItem[] }>(GET_PROJECTS);

  const [isAgentRunning, setIsAgentRunning] = useState(false);

  const { data, loading, error, refetch } = useQuery<{ project: Project | null }>(
    GET_PROJECT,
    { variables: { id }, skip: !id, pollInterval: isAgentRunning ? 5000 : 0 }
  );

  useEffect(() => {
    setIsAgentRunning(data?.project?.isRunning ?? false);
  }, [data?.project?.isRunning]);

  useSubscription(PROJECT_UPDATED, {
    variables: { projectId: id },
    skip: !id,
    onData: () => {
      refetch();
    },
  });

  // Clear selectedGoalId when the goal no longer exists (e.g. after deletion)
  useEffect(() => {
    if (selectedGoalId && data?.project) {
      const exists = data.project.goals.some((g: Goal) => g.id === selectedGoalId);
      if (!exists) setSelectedGoalId(null);
    }
  }, [selectedGoalId, data?.project?.goals]);

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
      // Goal completion: switch to goals panel and refetch
      if (event.message.includes("\u2192 done") || event.message.includes("\u2192 active")) {
        autoOpenedRef.current = false;
        setActivePanel("goals");
        refetch();
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
    setSelectedGoalId(null);
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
        togglePanel("rules");
      } else if (mod && e.key === "3") {
        e.preventDefault();
        togglePanel("activity");
      } else if (mod && e.key === "4") {
        e.preventDefault();
        togglePanel("history");
      } else if (mod && e.key === "5") {
        e.preventDefault();
        togglePanel("project");
      } else if (e.key === "[" && !mod && !isInput) {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "Escape") {
        // If viewing a goal detail, go back to list first
        setSelectedGoalId((prevGoalId) => {
          if (prevGoalId !== null) return null;
          // Only close the panel if we weren't in goal detail
          setActivePanel(null);
          autoOpenedRef.current = false;
          return null;
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePanel, toggleSidebar]);

  /* -- Loading -- */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading project...</span>
        </div>
      </div>
    );
  }

  /* -- Error / Not found -- */
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
  const activeGoals = project.goals.filter((g: Goal) => g.status === "active").length;
  const panelOpen = activePanel !== null;

  const panelTitles: Record<PanelTab, string> = {
    project: "Project Files",
    goals: "Goals",
    rules: "Rules",
    activity: "Activity",
    history: "History",
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen">
        {/* --- Top Bar --- */}
        <header className="shrink-0 flex items-center justify-between gap-4 px-4 h-12 border-b border-border/60 bg-background z-30">
          {/* Left: sidebar toggle + back + name + path */}
          <div className="flex items-center gap-3 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Toggle sidebar ( [ )</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/")}
                  className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Back to projects</TooltipContent>
            </Tooltip>
            <div className="min-w-0 flex items-center gap-3">
              <h1 className="text-[15px] font-semibold tracking-tight truncate">
                {project.name}
              </h1>
              <span className="text-[11px] text-muted-foreground/60 font-mono truncate hidden lg:inline">
                {project.path}
              </span>
            </div>
          </div>

          {/* Center-right: phase + status indicators */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Phase indicator */}
            <PhaseIndicator
              phase={project.phase}
              activeGoalName={project.goals.find((g: Goal) => g.status === "active")?.name}
            />

            {/* Divider */}
            <Separator orientation="vertical" className="hidden md:block h-4" />

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
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-zinc-500" />
                Stopped
              </span>
            )}

            {/* Divider */}
            <Separator orientation="vertical" className="h-4" />

            {/* Cost */}
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatCost(project.totalCost)}
            </span>

            {/* Goals progress */}
            <span className="text-xs text-muted-foreground tabular-nums">
              {activeGoals > 0 ? (
                <>
                  {activeGoals} active
                  <span className="text-muted-foreground/60 ml-0.5 hidden sm:inline">
                    · {project.goals.length} total
                  </span>
                </>
              ) : (
                <>
                  {project.goals.length}
                  <span className="text-muted-foreground/60 ml-0.5 hidden sm:inline">goals</span>
                </>
              )}
            </span>

            {/* Divider */}
            <Separator orientation="vertical" className="h-4" />

            {/* Start / Stop button */}
            {project.isRunning ? (
              <button
                onClick={() => stopAgent({ variables: { projectId: id } })}
                disabled={stopping}
                className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {stopping ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
                {stopping ? "Stopping..." : "Stop"}
              </button>
            ) : (
              <button
                onClick={() => startAgent({ variables: { projectId: id } })}
                disabled={starting}
                className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {starting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                {starting ? "Starting..." : "Start"}
              </button>
            )}

            {/* Overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                  disabled={deleting || project.isRunning}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete confirmation dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete project</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete "{project.name}" and all its data? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={deleting}
                    onClick={() => {
                      deleteProject({ variables: { id } });
                      setDeleteDialogOpen(false);
                    }}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* --- Main Area --- */}
        <div className="flex-1 flex min-h-0">
          {/* -- Project Sidebar -- */}
          <ProjectSidebar
            projects={projectsData?.projects ?? []}
            activeProjectId={project.id}
            expanded={sidebarExpanded}
          />

          {/* -- Chat Area (fills remaining space) -- */}
          <main className="flex-1 min-w-0 flex flex-col bg-background transition-all duration-200 ease-out">
            <div
              className="w-full h-full flex flex-col mx-auto transition-all duration-200 ease-out"
              style={{ maxWidth: panelOpen ? Math.max(600, 900 - (panelWidth - 360) * 0.5) : 900 }}
            >
              <ChatPanel
                projectId={project.id}
                isAgentRunning={project.isRunning}
              />
            </div>
          </main>

          {/* -- Slide-over Panel -- */}
          <div
            className={`
              shrink-0 overflow-hidden transition-all duration-200 ease-out border-l
              ${panelOpen
                ? "border-border"
                : "w-0 border-transparent"
              }
            `}
            style={panelOpen ? { width: panelWidth } : undefined}
          >
            <div className="h-full flex flex-col bg-card relative" style={{ width: panelWidth }}>
              {/* Drag handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = panelWidth;

                  const onMouseMove = (ev: MouseEvent) => {
                    const delta = startX - ev.clientX;
                    const newWidth = Math.max(360, Math.min(800, startWidth + delta));
                    setPanelWidth(newWidth);
                  };

                  const onMouseUp = () => {
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                    document.body.style.cursor = "";
                    document.body.style.userSelect = "";
                  };

                  document.addEventListener("mousemove", onMouseMove);
                  document.addEventListener("mouseup", onMouseUp);
                  document.body.style.cursor = "col-resize";
                  document.body.style.userSelect = "none";
                }}
              />
              {activePanel && (
                <>
                  {/* Hide panel header when viewing goal detail (GoalDetail has its own back nav) */}
                  {!(activePanel === "goals" && selectedGoalId) && (
                    <PanelHeader
                      title={panelTitles[activePanel]}
                      onClose={() => {
                        setActivePanel(null);
                        setSelectedGoalId(null);
                        autoOpenedRef.current = false;
                      }}
                      action={
                        activePanel === "goals" ? (
                          <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                            {activeGoals > 0 ? `${activeGoals} active · ` : ""}{project.goals.length} goals
                          </span>
                        ) : activePanel === "rules" ? (
                          <span className="text-[11px] text-muted-foreground/70">
                            {project.rules?.length ?? 0} rules
                          </span>
                        ) : null
                      }
                    />
                  )}
                  {/* Goal detail header with close button */}
                  {activePanel === "goals" && selectedGoalId && (
                    <div className="shrink-0 flex items-center justify-end h-12 px-4 border-b border-border">
                      <button
                        onClick={() => {
                          setActivePanel(null);
                          setSelectedGoalId(null);
                          autoOpenedRef.current = false;
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className={`flex-1 overflow-y-auto px-4 py-4 ${activePanel === "activity" ? "hidden" : ""}`}>
                    {activePanel === "goals" && !selectedGoalId && (
                      <GoalTable
                        goals={project.goals}
                        projectId={project.id}
                        compact
                        onSelectGoal={(goalId) => setSelectedGoalId(goalId)}
                      />
                    )}
                    {activePanel === "goals" && selectedGoalId && (
                      project.goals.find((g: Goal) => g.id === selectedGoalId) ? (
                        <GoalDetail
                          goal={project.goals.find((g: Goal) => g.id === selectedGoalId)!}
                          projectId={project.id}
                          allGoals={project.goals}
                          onBack={() => setSelectedGoalId(null)}
                          onNavigateToGoal={(goalId) => setSelectedGoalId(goalId)}
                        />
                      ) : null
                    )}
                    {activePanel === "rules" && (
                      <RulesPanel projectId={project.id} />
                    )}
                    {activePanel === "history" && (
                      <HistoryPanel projectId={project.id} />
                    )}
                    {activePanel === "project" && (
                      <FileTree projectId={project.id} />
                    )}
                  </div>
                </>
              )}
              {/* LogStream always mounted to preserve state + subscription */}
              <div className={`flex-1 min-h-0 px-4 py-4 flex flex-col ${activePanel === "activity" ? "" : "hidden"}`}>
                <LogStream projectId={project.id} compact visible={activePanel === "activity"} />
              </div>
            </div>
          </div>

          {/* -- Tab Rail -- */}
          <aside className="shrink-0 w-12 border-l border-border bg-sidebar flex flex-col">
            <RailButton
              icon={<ClipboardCheck className="h-4 w-4" />}
              label="Goals"
              count={project.goals.length}
              active={activePanel === "goals"}
              onClick={() => togglePanel("goals")}
            />
            <RailButton
              icon={<FileText className="h-4 w-4" />}
              label="Rules"
              active={activePanel === "rules"}
              onClick={() => togglePanel("rules")}
            />
            <RailButton
              icon={<Terminal className="h-4 w-4" />}
              label="Activity"
              active={activePanel === "activity"}
              onClick={() => togglePanel("activity")}
            />
            <RailButton
              icon={<History className="h-4 w-4" />}
              label="History"
              active={activePanel === "history"}
              onClick={() => togglePanel("history")}
            />
            <RailButton
              icon={<FolderTree className="h-4 w-4" />}
              label="Project"
              active={activePanel === "project"}
              onClick={() => togglePanel("project")}
            />
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
