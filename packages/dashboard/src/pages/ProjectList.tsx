import { useQuery } from "@apollo/client";
import { Link } from "react-router-dom";
import { GET_PROJECTS } from "@/graphql/operations";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";

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
        <Link to="/projects/new">
          <Button size="sm">
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Project
          </Button>
        </Link>
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
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
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
