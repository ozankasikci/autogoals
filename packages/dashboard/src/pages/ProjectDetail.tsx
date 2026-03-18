import { useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import {
  GET_PROJECT,
  START_AGENT,
  STOP_AGENT,
  DELETE_PROJECT,
  PROJECT_UPDATED,
  NEW_MESSAGE,
} from "@/graphql/operations";
import { GoalTable } from "@/components/GoalTable";
import { SpecView } from "@/components/SpecView";
import { LogStream } from "@/components/LogStream";
import { StatusBadge } from "@/components/StatusBadge";
import { ChatPanel } from "@/components/ChatPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCost } from "@/lib/utils";

interface Goal {
  id: string;
  name: string;
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

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatWasOpenRef = useRef(false);

  const { data, loading, error } = useQuery<{ project: Project | null }>(
    GET_PROJECT,
    { variables: { id }, skip: !id }
  );

  // Real-time updates
  useSubscription(PROJECT_UPDATED, {
    variables: { projectId: id },
    skip: !id,
  });

  // Track unread agent messages when chat panel is closed
  useSubscription(NEW_MESSAGE, {
    variables: { projectId: id },
    skip: !id,
    onData: ({ data: subData }) => {
      const msg = subData.data?.newMessage;
      if (msg && msg.role === "agent" && !chatOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    },
  });

  const toggleChat = useCallback(() => {
    setChatOpen((prev) => {
      const opening = !prev;
      if (opening) {
        setUnreadCount(0);
        chatWasOpenRef.current = true;
      }
      return opening;
    });
  }, []);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <svg
              className="h-3.5 w-3.5"
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
            Back to projects
          </button>
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {project.name}
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-1 truncate">
            {project.path}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleChat}
            className="relative inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Chat with Agent"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <Button
            variant="destructive"
            size="sm"
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

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Phase</span>
          <StatusBadge value={project.phase} type="phase" />
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Cost</span>
          <span className="text-sm font-medium tabular-nums">
            {formatCost(project.totalCost)}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Goals</span>
          <span className="text-sm font-medium tabular-nums">
            {doneGoals}/{project.goals.length}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status</span>
          {project.isRunning ? (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm text-emerald-400 font-medium">
                Running
              </span>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Stopped</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {project.isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => stopAgent({ variables: { projectId: id } })}
              disabled={stopping}
            >
              {stopping ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Stopping...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  Stop Agent
                </span>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => startAgent({ variables: { projectId: id } })}
              disabled={starting}
            >
              {starting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Starting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Start Agent
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="goals">
        <TabsList>
          <TabsTrigger value="goals">
            Goals{" "}
            {project.goals.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({project.goals.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="spec">Spec</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <GoalTable goals={project.goals} />
          </div>
        </TabsContent>

        <TabsContent value="spec" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <SpecView spec={project.spec} />
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <LogStream projectId={project.id} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Chat side panel */}
      <ChatPanel
        projectId={project.id}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        isAgentRunning={project.isRunning}
      />
    </div>
  );
}
