import { useQuery, useMutation } from "@apollo/client";
import { Link } from "react-router-dom";
import { GET_PROJECTS, START_ALL_AGENTS, STOP_ALL_AGENTS } from "@/graphql/operations";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, PlayCircle, StopCircle } from "lucide-react";

interface Goal {
  id: string;
  name: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
  path: string;
  phase: string;
  totalCost: number;
  isRunning: boolean;
  createdAt: string;
  goals: Goal[];
}

export function ProjectList() {
  const { data, loading, error } = useQuery<{ projects: Project[] }>(
    GET_PROJECTS,
    { pollInterval: 5000 }
  );

  const [startAll, { loading: startingAll }] = useMutation(START_ALL_AGENTS, {
    refetchQueries: [{ query: GET_PROJECTS }],
  });
  const [stopAll, { loading: stoppingAll }] = useMutation(STOP_ALL_AGENTS, {
    refetchQueries: [{ query: GET_PROJECTS }],
  });

  const anyRunning = data?.projects?.some(p => p.isRunning) ?? false;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AI agent projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anyRunning ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => stopAll()}
              disabled={stoppingAll}
              className="text-red-400 border-red-500/20 hover:bg-red-500/10"
            >
              <StopCircle className="mr-2 h-4 w-4" />
              {stoppingAll ? "Stopping..." : "Stop All"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => startAll()}
              disabled={startingAll}
              className="text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {startingAll ? "Starting..." : "Start All"}
            </Button>
          )}
          <Link to="/projects/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[160px] rounded-lg border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load projects. Make sure the API server is running at
            localhost:4000.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {error.message}
          </p>
        </div>
      )}

      {data && data.projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-1">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Create your first project to get started with AI agents.
          </p>
          <Link to="/projects/new">
            <Button>Create a Project</Button>
          </Link>
        </div>
      )}

      {data && data.projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.projects.map((project) => (
            <ProjectCard key={project.id} {...project} />
          ))}
        </div>
      )}
    </div>
  );
}
