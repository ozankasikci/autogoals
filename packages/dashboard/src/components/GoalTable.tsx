import { StatusBadge } from "@/components/StatusBadge";
import { formatCost } from "@/lib/utils";

interface Goal {
  id: string;
  name: string;
  status: string;
  retries: number;
  costUsd: number;
  error?: string | null;
}

interface GoalTableProps {
  goals: Goal[];
}

export function GoalTable({ goals }: GoalTableProps) {
  if (goals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No goals defined yet. Goals appear after the spec phase.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Name
            </th>
            <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="pb-3 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
              Retries
            </th>
            <th className="pb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
              Cost
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {goals.map((goal) => (
            <tr
              key={goal.id}
              className="group hover:bg-muted/50 transition-colors"
            >
              <td className="py-3 pr-4">
                <div>
                  <span className="text-sm font-medium">{goal.name}</span>
                  {goal.error && (
                    <p className="mt-1 text-xs text-red-400 line-clamp-2">
                      {goal.error}
                    </p>
                  )}
                </div>
              </td>
              <td className="py-3 pr-4">
                <StatusBadge value={goal.status} type="goal" />
              </td>
              <td className="py-3 pr-4 text-right text-sm text-muted-foreground tabular-nums">
                {goal.retries}
              </td>
              <td className="py-3 text-right text-sm text-muted-foreground tabular-nums">
                {formatCost(goal.costUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
