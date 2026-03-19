import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";

interface PackageInfo {
  id: string;
  name: string;
  subtitle: string;
  port?: string;
  color: string;
  borderColor: string;
  glowClass: string;
  bgGradient: string;
  textColor: string;
  modules?: { name: string; description: string }[];
  x: number;
  y: number;
  width: number;
  height: number;
}

const packages: PackageInfo[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    subtitle: "React + Vite",
    port: ":5891",
    color: "orange",
    borderColor: "border-orange-500/40",
    glowClass: "glow-orange",
    bgGradient: "from-orange-500/10 to-orange-600/5",
    textColor: "text-orange-400",
    modules: [
      { name: "Apollo Client", description: "GraphQL client with cache + subscriptions" },
      { name: "React Router", description: "Client-side routing for project views" },
      { name: "ChatPanel", description: "Real-time message streaming UI" },
      { name: "GoalTable", description: "Goal management with status tracking" },
      { name: "ActivityPanel", description: "Live agent activity log viewer" },
    ],
    x: 80,
    y: 40,
    width: 220,
    height: 120,
  },
  {
    id: "api",
    name: "API Server",
    subtitle: "Express + Apollo",
    port: ":4000",
    color: "green",
    borderColor: "border-green-500/40",
    glowClass: "glow-green",
    bgGradient: "from-green-500/10 to-green-600/5",
    textColor: "text-green-400",
    modules: [
      { name: "GraphQL Schema", description: "Type definitions for Projects, Goals, Messages" },
      { name: "Resolvers", description: "Query, Mutation, and Subscription handlers" },
      { name: "AgentManager", description: "Orchestrates agent sessions and event consumption" },
      { name: "PubSub", description: "In-memory pub/sub for real-time subscriptions" },
    ],
    x: 380,
    y: 40,
    width: 220,
    height: 120,
  },
  {
    id: "cli",
    name: "CLI",
    subtitle: "Commander",
    port: "Terminal",
    color: "blue",
    borderColor: "border-blue-500/40",
    glowClass: "glow-blue",
    bgGradient: "from-blue-500/10 to-blue-600/5",
    textColor: "text-blue-400",
    modules: [
      { name: "Commands", description: "init, start, goals, chat CLI commands" },
      { name: "Interactive Mode", description: "Terminal-based goal refinement" },
      { name: "Config Loader", description: "Reads .small-singularity/ project config" },
    ],
    x: 680,
    y: 40,
    width: 220,
    height: 120,
  },
  {
    id: "core",
    name: "Core",
    subtitle: "Shared Library",
    color: "violet",
    borderColor: "border-violet-500/40",
    glowClass: "glow-violet",
    bgGradient: "from-violet-500/10 to-violet-600/5",
    textColor: "text-violet-400",
    modules: [
      { name: "StateStore", description: "SQLite-backed state management for projects" },
      { name: "GoalTracker", description: "Goal state machine with transition validation" },
      { name: "AgentSession", description: "Claude Code SDK wrapper with message queue" },
      { name: "SDK Wrapper", description: "Spawns Claude Code CLI via SDK, handles events" },
    ],
    x: 380,
    y: 240,
    width: 220,
    height: 120,
  },
  {
    id: "sqlite",
    name: "SQLite DB",
    subtitle: "~/.small-singularity/",
    color: "amber",
    borderColor: "border-amber-500/40",
    glowClass: "glow-amber",
    bgGradient: "from-amber-500/10 to-amber-600/5",
    textColor: "text-amber-400",
    modules: [
      { name: "projects", description: "Project metadata, path, phase, cost" },
      { name: "goals", description: "Goals with status, criteria, approach, retries" },
      { name: "messages", description: "Chat history between user and agent" },
      { name: "log_events", description: "Agent activity log with timestamps" },
    ],
    x: 280,
    y: 440,
    width: 220,
    height: 120,
  },
  {
    id: "claude",
    name: "Claude Code",
    subtitle: "CLI (SDK spawns)",
    color: "pink",
    borderColor: "border-pink-500/40",
    glowClass: "glow-pink",
    bgGradient: "from-pink-500/10 to-pink-600/5",
    textColor: "text-pink-400",
    modules: [
      { name: "query()", description: "Sends prompts, receives streaming responses" },
      { name: "Tool Use", description: "File read/write, bash, search operations" },
      { name: "System Prompt", description: "Project context with goals and criteria" },
    ],
    x: 580,
    y: 440,
    width: 220,
    height: 120,
  },
];

interface Arrow {
  from: string;
  to: string;
  label?: string;
  color: string;
  bidirectional?: boolean;
}

const arrows: Arrow[] = [
  { from: "dashboard", to: "api", label: "GraphQL", color: "#f97316" },
  { from: "cli", to: "api", label: "", color: "#3b82f6" },
  { from: "api", to: "core", label: "", color: "#22c55e" },
  { from: "cli", to: "core", label: "", color: "#3b82f6" },
  { from: "core", to: "sqlite", label: "", color: "#8b5cf6" },
  { from: "core", to: "claude", label: "", color: "#8b5cf6" },
  { from: "dashboard", to: "sqlite", label: "HTTP + WS", color: "#f97316" },
];

function getCenter(pkg: PackageInfo) {
  return { x: pkg.x + pkg.width / 2, y: pkg.y + pkg.height / 2 };
}

function getEdgePoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  pkg: PackageInfo
) {
  const cx = pkg.x + pkg.width / 2;
  const cy = pkg.y + pkg.height / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const hw = pkg.width / 2;
  const hh = pkg.height / 2;

  if (absDx * hh > absDy * hw) {
    // hits left or right
    const sign = dx > 0 ? 1 : -1;
    return { x: cx + sign * hw, y: cy + (dy / absDx) * hw };
  } else {
    // hits top or bottom
    const sign = dy > 0 ? 1 : -1;
    return { x: cx + (dx / absDy) * hh, y: cy + sign * hh };
  }
}

export function ArchitectureTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const diagramWidth = 980;
      const newScale = Math.min(1, containerWidth / diagramWidth);
      setScale(newScale);
    }
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  const pkgMap = Object.fromEntries(packages.map((p) => [p.id, p]));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          System Architecture
        </h1>
        <p className="text-muted-foreground">
          Click any package to expand its internal modules. Animated connections
          show data flow between components.
        </p>
      </div>

      <div ref={containerRef} className="relative overflow-hidden">
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: 980,
            height: expanded ? 680 : 620,
            transition: "height 0.3s ease",
          }}
          className="relative"
        >
          {/* Background frame */}
          <div className="absolute inset-0 rounded-xl border border-border/30 bg-gradient-to-b from-muted/20 to-transparent">
            <div className="absolute top-4 left-6 text-xs font-mono text-muted-foreground/60">
              Small Singularity
            </div>
          </div>

          {/* SVG arrows layer */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="980"
            height={expanded ? 680 : 620}
            style={{ zIndex: 1 }}
          >
            {arrows.map((arrow, i) => {
              const fromPkg = pkgMap[arrow.from];
              const toPkg = pkgMap[arrow.to];
              if (!fromPkg || !toPkg) return null;

              const fromCenter = getCenter(fromPkg);
              const toCenter = getCenter(toPkg);
              const start = getEdgePoint(fromCenter, toCenter, fromPkg);
              const end = getEdgePoint(toCenter, fromCenter, toPkg);

              // For dashboard→sqlite, create a curved path
              if (arrow.from === "dashboard" && arrow.to === "sqlite") {
                const path = `M ${start.x} ${start.y} C ${start.x - 60} ${start.y + 200}, ${end.x - 80} ${end.y - 80}, ${end.x} ${end.y}`;
                return (
                  <g key={i}>
                    <path
                      d={path}
                      fill="none"
                      stroke={arrow.color}
                      strokeWidth="1.5"
                      className="arrow-animated-slow connection-pulse"
                      opacity="0.5"
                    />
                    {arrow.label && (
                      <text
                        x={start.x - 90}
                        y={(start.y + end.y) / 2 - 20}
                        fill={arrow.color}
                        fontSize="10"
                        fontFamily="JetBrains Mono, monospace"
                        opacity="0.7"
                      >
                        {arrow.label}
                      </text>
                    )}
                  </g>
                );
              }

              // For cli→core, create a curved path on the right
              if (arrow.from === "cli" && arrow.to === "core") {
                const path = `M ${start.x} ${start.y} C ${start.x + 60} ${start.y + 100}, ${end.x + 80} ${end.y - 60}, ${end.x} ${end.y}`;
                return (
                  <g key={i}>
                    <path
                      d={path}
                      fill="none"
                      stroke={arrow.color}
                      strokeWidth="1.5"
                      className="arrow-animated connection-pulse"
                      opacity="0.5"
                    />
                  </g>
                );
              }

              return (
                <g key={i}>
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={arrow.color}
                    strokeWidth="1.5"
                    className="arrow-animated connection-pulse"
                    opacity="0.5"
                  />
                  {/* Arrow head */}
                  {!arrow.bidirectional && (
                    <circle
                      cx={end.x}
                      cy={end.y}
                      r="3"
                      fill={arrow.color}
                      opacity="0.7"
                    />
                  )}
                  {arrow.label && (
                    <text
                      x={(start.x + end.x) / 2}
                      y={(start.y + end.y) / 2 - 8}
                      fill={arrow.color}
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                      opacity="0.7"
                    >
                      {arrow.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Package cards */}
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={cn(
                "absolute rounded-lg border cursor-pointer transition-all duration-300",
                "bg-gradient-to-b",
                pkg.bgGradient,
                pkg.borderColor,
                expanded === pkg.id ? pkg.glowClass : "hover:scale-[1.02]"
              )}
              style={{
                left: pkg.x,
                top: pkg.y,
                width: pkg.width,
                height: expanded === pkg.id ? "auto" : pkg.height,
                minHeight: pkg.height,
                zIndex: expanded === pkg.id ? 10 : 2,
              }}
              onClick={() =>
                setExpanded(expanded === pkg.id ? null : pkg.id)
              }
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className={cn("font-semibold text-sm", pkg.textColor)}>
                    {pkg.name}
                  </h3>
                  {pkg.port && (
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {pkg.port}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{pkg.subtitle}</p>

                {/* Expand indicator */}
                <div className="mt-3 flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      expanded === pkg.id ? "bg-current" : "bg-muted-foreground/30"
                    )}
                    style={{
                      color: expanded === pkg.id ? undefined : undefined,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {expanded === pkg.id
                      ? "click to collapse"
                      : `${pkg.modules?.length || 0} modules`}
                  </span>
                </div>

                {/* Expanded modules */}
                {expanded === pkg.id && pkg.modules && (
                  <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
                    {pkg.modules.map((mod, i) => (
                      <div
                        key={mod.name}
                        className="step-appear"
                        style={{ animationDelay: `${i * 60}ms` }}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "w-1 h-1 rounded-full mt-1.5 shrink-0",
                              pkg.textColor
                            )}
                            style={{ opacity: 0.6 }}
                          />
                          <div>
                            <span className="text-xs font-mono font-medium text-foreground/80">
                              {mod.name}
                            </span>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              {mod.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-orange-500/50" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, hsl(var(--background)) 4px, hsl(var(--background)) 6px)" }} />
          <span>Data flow (animated)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-500/50" />
          <span>Click to expand modules</span>
        </div>
      </div>
    </div>
  );
}
