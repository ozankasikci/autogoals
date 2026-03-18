import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCost, formatDate } from "@/lib/utils";

interface Goal {
  id: string;
  name: string;
  status: string;
}

interface ProjectCardProps {
  id: string;
  name: string;
  phase: string;
  totalCost: number;
  isRunning: boolean;
  createdAt: string;
  goals: Goal[];
}

export function ProjectCard({
  id,
  name,
  phase,
  totalCost,
  isRunning,
  createdAt,
  goals,
}: ProjectCardProps) {
  const navigate = useNavigate();
  const doneCount = goals.filter((g) => g.status === "done").length;
  const totalGoals = goals.length;

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:border-muted-foreground/30 hover:shadow-md hover:shadow-black/10"
      onClick={() => navigate(`/projects/${id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-base">{name}</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {isRunning && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
            <StatusBadge value={phase} type="phase" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {totalGoals > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Goals</span>
              <span>
                {doneCount}/{totalGoals}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${totalGoals > 0 ? (doneCount / totalGoals) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCost(totalCost)}</span>
          <span>{formatDate(createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
