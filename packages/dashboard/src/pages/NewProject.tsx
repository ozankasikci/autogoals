import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@apollo/client";
import { CREATE_PROJECT, GET_PROJECTS } from "@/graphql/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Loader2 } from "lucide-react";

export function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const [createProject, { loading, error }] = useMutation(CREATE_PROJECT, {
    refetchQueries: [{ query: GET_PROJECTS }],
    onCompleted: () => navigate("/"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    createProject({ variables: { name: name.trim(), path: path.trim() } });
  };

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to projects
        </button>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Register a new project for AI agent management.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="name"
            className="text-sm font-medium leading-none"
          >
            Project Name
          </label>
          <Input
            id="name"
            placeholder="My AI Project"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            A human-readable name for your project.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="path"
            className="text-sm font-medium leading-none"
          >
            Project Path
          </label>
          <Input
            id="path"
            placeholder="/home/user/projects/my-project"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className="font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground">
            Absolute path to the project directory on the filesystem.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error.message}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={loading || !name.trim() || !path.trim()}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Project"
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
