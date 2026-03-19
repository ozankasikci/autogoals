import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "success"
    | "warning"
    | "info"
    | "violet"
    | "cyan"
    | "indigo";
}

const badgeVariants = {
  default:
    "border-transparent bg-primary text-primary-foreground",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground",
  destructive:
    "border-transparent bg-destructive text-destructive-foreground",
  outline: "text-foreground",
  success:
    "border-transparent bg-emerald-500/15 text-emerald-400",
  warning:
    "border-transparent bg-amber-500/15 text-amber-400",
  info:
    "border-transparent bg-blue-500/15 text-blue-400",
  violet:
    "border-transparent bg-violet-500/15 text-violet-400",
  cyan:
    "border-transparent bg-cyan-500/15 text-cyan-400",
  indigo:
    "border-transparent bg-indigo-500/15 text-indigo-400",
};

function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
