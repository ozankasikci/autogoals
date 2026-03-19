import { useState, useEffect, useCallback } from "react";
import {
  ApolloProvider,
  useQuery,
  useSubscription,
  gql,
} from "@apollo/client";
import { client } from "@/lib/apollo";
import { cn } from "@/lib/cn";

const GET_PROJECTS = gql`
  query GetProjects {
    projects {
      id
      name
      path
      phase
      totalCost
      isRunning
      createdAt
      goals {
        id
        name
        status
      }
    }
  }
`;

const GET_MESSAGES = gql`
  query GetMessages($projectId: ID!, $limit: Int) {
    messages(projectId: $projectId, limit: $limit) {
      id
    }
  }
`;

const LOG_EVENTS = gql`
  subscription LogEvents($projectId: ID!) {
    logEvent(projectId: $projectId) {
      type
      message
      costUsd
      timestamp
      projectId
    }
  }
`;

const PROJECT_UPDATED = gql`
  subscription ProjectUpdated($projectId: ID!) {
    projectUpdated(projectId: $projectId) {
      id
      phase
      totalCost
      isRunning
      goals {
        id
        name
        status
      }
    }
  }
`;

interface Project {
  id: string;
  name: string;
  path: string;
  phase: string;
  totalCost: number;
  isRunning: boolean;
  createdAt: string;
  goals: { id: string; name: string; status: string }[];
}

interface LogEvent {
  type: string;
  message: string;
  costUsd: number | null;
  timestamp: string;
  projectId: string;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    refined: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    ready: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    pending: "bg-gray-500/15 text-gray-400 border-gray-500/30",
    active: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    verifying: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    done: "bg-green-500/15 text-green-400 border-green-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    retrying: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    skipped: "bg-gray-600/15 text-gray-500 border-gray-600/30",
  };

  return (
    <span
      className={cn(
        "text-[10px] font-medium px-1.5 py-0.5 rounded border",
        colors[status] || colors["draft"]
      )}
    >
      {status}
    </span>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const colors: Record<string, string> = {
    interview: "bg-violet-500/15 text-violet-400",
    planning: "bg-cyan-500/15 text-cyan-400",
    building: "bg-blue-500/15 text-blue-400",
    complete: "bg-green-500/15 text-green-400",
  };

  return (
    <span
      className={cn(
        "text-[10px] font-medium px-1.5 py-0.5 rounded",
        colors[phase] || "bg-muted text-muted-foreground"
      )}
    >
      {phase}
    </span>
  );
}

function ProjectMessageCount({ projectId }: { projectId: string }) {
  const { data } = useQuery(GET_MESSAGES, {
    variables: { projectId, limit: 1000 },
    fetchPolicy: "cache-first",
  });

  return (
    <span className="text-xs text-muted-foreground font-mono">
      {data?.messages?.length ?? "..."}
    </span>
  );
}

function ProjectLogSubscriber({
  projectId,
  onEvent,
}: {
  projectId: string;
  onEvent: (event: LogEvent) => void;
}) {
  useSubscription(LOG_EVENTS, {
    variables: { projectId },
    onData: ({ data }) => {
      if (data.data?.logEvent) {
        onEvent(data.data.logEvent);
      }
    },
  });

  useSubscription(PROJECT_UPDATED, {
    variables: { projectId },
  });

  return null;
}

function MonitorContent() {
  const { data, loading, error } = useQuery(GET_PROJECTS, {
    pollInterval: 5000,
  });
  const [logEvents, setLogEvents] = useState<LogEvent[]>([]);

  const handleLogEvent = useCallback((event: LogEvent) => {
    setLogEvents((prev) => [event, ...prev].slice(0, 50));
  }, []);

  const projects: Project[] = data?.projects || [];

  // Stats
  const totalProjects = projects.length;
  const totalGoals = projects.reduce((acc, p) => acc + p.goals.length, 0);
  const doneGoals = projects.reduce(
    (acc, p) => acc + p.goals.filter((g) => g.status === "done").length,
    0
  );
  const runningProjects = projects.filter((p) => p.isRunning).length;
  const totalCost = projects.reduce((acc, p) => acc + p.totalCost, 0);

  if (error) {
    return <ConnectionError />;
  }

  return (
    <div>
      {/* Subscribers for each project */}
      {projects.map((p) => (
        <ProjectLogSubscriber
          key={p.id}
          projectId={p.id}
          onEvent={handleLogEvent}
        />
      ))}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        <StatCard label="Projects" value={totalProjects} loading={loading} />
        <StatCard label="Goals" value={totalGoals} loading={loading} />
        <StatCard label="Done" value={doneGoals} loading={loading} color="text-green-400" />
        <StatCard label="Running" value={runningProjects} loading={loading} color="text-blue-400" pulse={runningProjects > 0} />
        <StatCard label="Total Cost" value={`$${totalCost.toFixed(2)}`} loading={loading} color="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects table */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="px-4 py-3 bg-muted/20 border-b border-border/30">
              <h2 className="text-sm font-semibold text-foreground">
                Projects
              </h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : projects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No projects found. Create one from the CLI or Dashboard.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border/20">
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Phase</th>
                      <th className="px-4 py-2 font-medium">Goals</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Messages</th>
                      <th className="px-4 py-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => {
                      const doneCount = project.goals.filter(
                        (g) => g.status === "done"
                      ).length;
                      return (
                        <tr
                          key={project.id}
                          className="border-b border-border/10 hover:bg-muted/10 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground/90">
                              {project.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                              {project.path}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <PhaseBadge phase={project.phase} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-foreground/70">
                                {doneCount}/{project.goals.length}
                              </span>
                              {project.goals.length > 0 && (
                                <div className="flex-1 max-w-[80px] h-1.5 bg-muted/30 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-green-500/60 rounded-full transition-all"
                                    style={{
                                      width: `${(doneCount / project.goals.length) * 100}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {project.isRunning ? (
                              <span className="flex items-center gap-1.5 text-xs text-blue-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-slow" />
                                Running
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Idle
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <ProjectMessageCount projectId={project.id} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-mono text-amber-400/70">
                              ${project.totalCost.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Goal breakdown */}
          {projects.length > 0 && (
            <div className="mt-4 rounded-lg border border-border/50 overflow-hidden">
              <div className="px-4 py-3 bg-muted/20 border-b border-border/30">
                <h2 className="text-sm font-semibold text-foreground">
                  All Goals
                </h2>
              </div>
              <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
                {projects.flatMap((p) =>
                  p.goals.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-3 text-sm py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {p.name}
                        </span>
                        <span className="text-foreground/70 truncate">
                          {g.name}
                        </span>
                      </div>
                      <StatusBadge status={g.status} />
                    </div>
                  ))
                )}
                {projects.every((p) => p.goals.length === 0) && (
                  <div className="text-center text-muted-foreground text-xs py-4">
                    No goals defined yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="px-4 py-3 bg-muted/20 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Recent Activity
              </h2>
              {logEvents.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow" />
              )}
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {logEvents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  {projects.some((p) => p.isRunning)
                    ? "Waiting for activity..."
                    : "No active agents. Start an agent to see real-time activity."}
                </div>
              ) : (
                <div className="divide-y divide-border/10">
                  {logEvents.map((event, i) => (
                    <div
                      key={`${event.timestamp}-${i}`}
                      className={cn(
                        "px-4 py-2.5 text-xs",
                        i === 0 && "animate-fade-in"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <EventTypeBadge type={event.type} />
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatTime(event.timestamp)}
                        </span>
                        {event.costUsd != null && event.costUsd > 0 && (
                          <span className="text-[10px] text-amber-400/60 font-mono ml-auto">
                            ${event.costUsd.toFixed(4)}
                          </span>
                        )}
                      </div>
                      <p className="text-foreground/60 truncate">
                        {event.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  color,
  pulse,
}: {
  label: string;
  value: string | number;
  loading: boolean;
  color?: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-card/30 p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div
        className={cn(
          "text-xl font-semibold font-mono",
          color || "text-foreground",
          pulse && "animate-pulse-slow"
        )}
      >
        {loading ? "..." : value}
      </div>
    </div>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    tool_use: "bg-violet-500/15 text-violet-400",
    message: "bg-blue-500/15 text-blue-400",
    error: "bg-red-500/15 text-red-400",
    cost: "bg-amber-500/15 text-amber-400",
    goal_update: "bg-green-500/15 text-green-400",
    status: "bg-cyan-500/15 text-cyan-400",
  };

  return (
    <span
      className={cn(
        "text-[10px] font-mono px-1.5 py-0.5 rounded",
        colors[type] || "bg-muted text-muted-foreground"
      )}
    >
      {type}
    </span>
  );
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

function ConnectionError() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Cannot connect to API
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          The Live Monitor requires the API server to be running. Start it with:
        </p>
        <code className="text-xs font-mono bg-muted/50 border border-border/30 px-3 py-2 rounded-md text-foreground/80 block">
          pnpm dev:api
        </code>
        <p className="text-xs text-muted-foreground mt-3">
          API endpoint: <span className="font-mono">http://localhost:4000/graphql</span>
        </p>
      </div>
    </div>
  );
}

// Check if API is reachable
function LiveMonitorWrapper() {
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("http://localhost:4000/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
    })
      .then((res) => {
        setApiAvailable(res.ok);
      })
      .catch(() => {
        setApiAvailable(false);
      });
  }, []);

  if (apiAvailable === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm text-muted-foreground">
          Checking API connection...
        </div>
      </div>
    );
  }

  if (!apiAvailable) {
    return <ConnectionError />;
  }

  return (
    <ApolloProvider client={client}>
      <MonitorContent />
    </ApolloProvider>
  );
}

export function LiveMonitorTab() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Live Monitor
        </h1>
        <p className="text-muted-foreground">
          Real-time view of projects, goals, and agent activity. Connects to the
          API server at localhost:4000.
        </p>
      </div>

      <LiveMonitorWrapper />
    </div>
  );
}
