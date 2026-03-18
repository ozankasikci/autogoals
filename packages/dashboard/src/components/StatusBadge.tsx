import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

const phaseColors: Record<string, BadgeProps["variant"]> = {
  interview: "info",
  spec: "info",
  execution: "warning",
  standby: "secondary",
  done: "success",
  failed: "destructive",
};

const goalStatusColors: Record<string, BadgeProps["variant"]> = {
  pending: "secondary",
  active: "info",
  verifying: "warning",
  done: "success",
  failed: "destructive",
  skipped: "outline",
};

interface StatusBadgeProps {
  value: string;
  type?: "phase" | "goal";
  className?: string;
}

export function StatusBadge({
  value,
  type = "phase",
  className,
}: StatusBadgeProps) {
  const colorMap = type === "phase" ? phaseColors : goalStatusColors;
  const variant = colorMap[value] ?? "secondary";

  return (
    <Badge variant={variant} className={className}>
      {value}
    </Badge>
  );
}
