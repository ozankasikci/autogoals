import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/cn";

/* ── Schema diagram data ─────────────────────────────────────── */

interface TableDef {
  id: string;
  name: string;
  columns: { name: string; pk?: boolean; fk?: boolean }[];
  x: number;
  y: number;
  width: number;
  color: string;
  textColor: string;
  borderColor: string;
  bgGradient: string;
}

const tables: TableDef[] = [
  {
    id: "projects",
    name: "projects",
    columns: [
      { name: "id (PK)", pk: true },
      { name: "name" },
      { name: "path" },
      { name: "created_at" },
      { name: "updated_at" },
    ],
    x: 60,
    y: 40,
    width: 170,
    color: "green",
    textColor: "text-green-400",
    borderColor: "border-green-500/40",
    bgGradient: "from-green-500/10 to-green-600/5",
  },
  {
    id: "project_state",
    name: "project_state",
    columns: [
      { name: "project_id (FK)", fk: true },
      { name: "current_phase" },
      { name: "total_cost_usd" },
      { name: "updated_at" },
    ],
    x: 310,
    y: 40,
    width: 180,
    color: "cyan",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/40",
    bgGradient: "from-cyan-500/10 to-cyan-600/5",
  },
  {
    id: "goals",
    name: "goals",
    columns: [
      { name: "id" },
      { name: "project_id (FK)", fk: true },
      { name: "name" },
      { name: "description" },
      { name: "approach" },
      { name: "acceptance_criteria" },
      { name: "depends_on" },
      { name: "status" },
      { name: "retries" },
      { name: "cost_usd" },
      { name: "error" },
    ],
    x: 60,
    y: 240,
    width: 190,
    color: "blue",
    textColor: "text-blue-400",
    borderColor: "border-blue-500/40",
    bgGradient: "from-blue-500/10 to-blue-600/5",
  },
  {
    id: "rules",
    name: "rules",
    columns: [
      { name: "id (PK)", pk: true },
      { name: "project_id (FK)", fk: true },
      { name: "content" },
      { name: "created_at" },
    ],
    x: 310,
    y: 240,
    width: 170,
    color: "amber",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/40",
    bgGradient: "from-amber-500/10 to-amber-600/5",
  },
  {
    id: "messages",
    name: "messages",
    columns: [
      { name: "id (PK)", pk: true },
      { name: "project_id (FK)", fk: true },
      { name: "role" },
      { name: "content" },
      { name: "read" },
      { name: "created_at" },
    ],
    x: 540,
    y: 240,
    width: 170,
    color: "violet",
    textColor: "text-violet-400",
    borderColor: "border-violet-500/40",
    bgGradient: "from-violet-500/10 to-violet-600/5",
  },
  {
    id: "sessions",
    name: "sessions",
    columns: [
      { name: "id (PK)", pk: true },
      { name: "project_id (FK)", fk: true },
      { name: "phase" },
      { name: "session_id" },
      { name: "goal_id" },
      { name: "created_at" },
    ],
    x: 760,
    y: 240,
    width: 170,
    color: "pink",
    textColor: "text-pink-400",
    borderColor: "border-pink-500/40",
    bgGradient: "from-pink-500/10 to-pink-600/5",
  },
  {
    id: "spec",
    name: "spec",
    columns: [
      { name: "project_id (PK/FK)", pk: true, fk: true },
      { name: "overview" },
      { name: "technical_decisions" },
    ],
    x: 560,
    y: 40,
    width: 190,
    color: "indigo",
    textColor: "text-indigo-400",
    borderColor: "border-indigo-500/40",
    bgGradient: "from-indigo-500/10 to-indigo-600/5",
  },
  {
    id: "interview_notes",
    name: "interview_notes",
    columns: [
      { name: "id (PK)", pk: true },
      { name: "project_id (FK)", fk: true },
      { name: "content" },
      { name: "created_at" },
    ],
    x: 810,
    y: 40,
    width: 170,
    color: "gray",
    textColor: "text-gray-400",
    borderColor: "border-gray-500/40",
    bgGradient: "from-gray-500/10 to-gray-600/5",
  },
];

interface Relationship {
  from: string;
  to: string;
  label?: string;
}

const relationships: Relationship[] = [
  { from: "projects", to: "project_state" },
  { from: "projects", to: "goals" },
  { from: "projects", to: "rules" },
  { from: "projects", to: "messages" },
  { from: "projects", to: "sessions" },
  { from: "projects", to: "spec" },
  { from: "projects", to: "interview_notes" },
];

/* ── Read/Write operations data ──────────────────────────────── */

interface OpRow {
  table: string;
  whoReads: string;
  whoWrites: string;
  when: string;
}

const operations: OpRow[] = [
  {
    table: "projects",
    whoReads: "API resolvers, Dashboard",
    whoWrites: "API (createProject)",
    when: "Project CRUD",
  },
  {
    table: "project_state",
    whoReads: "API resolvers",
    whoWrites: "AgentManager (setPhase)",
    when: "Phase transitions",
  },
  {
    table: "goals",
    whoReads: "API resolvers, AgentManager",
    whoWrites: "API (addGoal, updateGoal), AgentManager (status changes)",
    when: "Goal lifecycle",
  },
  {
    table: "rules",
    whoReads: "API resolvers, AgentManager (system prompt)",
    whoWrites: "API (addRule, updateRule, removeRule)",
    when: "Rule management",
  },
  {
    table: "messages",
    whoReads: "API resolvers",
    whoWrites: "API (sendMessage), AgentManager (agent responses, tool use)",
    when: "Chat",
  },
  {
    table: "sessions",
    whoReads: "API resolvers",
    whoWrites: "CLI phases, AgentManager",
    when: "Session tracking",
  },
  {
    table: "spec",
    whoReads: "API resolvers",
    whoWrites: "API (updateSpec), AgentManager (saveSpec after refinement)",
    when: "Spec management",
  },
  {
    table: "interview_notes",
    whoReads: "API resolvers",
    whoWrites: "CLI interview phase",
    when: "Legacy CLI flow",
  },
];

/* ── Agent start sequence data ───────────────────────────────── */

interface SeqStep {
  label: string;
  detail: string;
  table?: string;
  color: string;
}

const startSequence: SeqStep[] = [
  {
    label: "API receives startAgent mutation",
    detail: "Dashboard sends startAgent(projectId) via GraphQL",
    color: "text-green-400",
  },
  {
    label: "Load project from projects table",
    detail: "projectStore.getProject(projectId) — fetches name, path",
    table: "projects",
    color: "text-green-400",
  },
  {
    label: "Load rules from rules table",
    detail: "store.getRules() — all user-defined constraints",
    table: "rules",
    color: "text-amber-400",
  },
  {
    label: "Load goals from goals table",
    detail: "getGoalViews(db, projectId) — goals with status, criteria",
    table: "goals",
    color: "text-blue-400",
  },
  {
    label: "Build system prompt (rules + goals)",
    detail: '"RULES (you MUST follow ALL):\\n..." + project spec + goals list',
    color: "text-violet-400",
  },
  {
    label: "Create AgentSession",
    detail: "new AgentSession({ cwd, model, systemPrompt, allowedTools, maxTurns })",
    color: "text-pink-400",
  },
  {
    label: "Send initial message",
    detail: '"Start working on the project. Here are the pending goals: ..."',
    color: "text-pink-400",
  },
  {
    label: "Update project_state.current_phase",
    detail: "store.setPhase('execution') or 'interview' based on goal statuses",
    table: "project_state",
    color: "text-cyan-400",
  },
];

/* ── Component ───────────────────────────────────────────────── */

export function DatabaseTab() {
  const [highlightedTable, setHighlightedTable] = useState<string | null>(null);
  const [activeSeqStep, setActiveSeqStep] = useState(0);
  const [seqPlaying, setSeqPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const diagramWidth = 1020;
      const newScale = Math.min(1, containerWidth / diagramWidth);
      setScale(newScale);
    }
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t]));

  // Compute table card heights
  function getTableHeight(t: TableDef): number {
    return 32 + t.columns.length * 20 + 12;
  }

  // Play sequence animation
  const playSequence = useCallback(() => {
    setActiveSeqStep(0);
    setSeqPlaying(true);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= startSequence.length) {
        clearInterval(interval);
        setSeqPlaying(false);
        return;
      }
      setActiveSeqStep(step);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Get the maximum Y extent of the diagram
  const maxY = Math.max(
    ...tables.map((t) => t.y + getTableHeight(t))
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Database
        </h1>
        <p className="text-muted-foreground">
          How the orchestrator (API / AgentManager) interacts with the SQLite
          database. Hover over any table to highlight its relationships.
        </p>
      </div>

      {/* ── Schema Diagram ──────────────────────────────────── */}
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Schema Diagram
      </h2>

      <div ref={containerRef} className="relative overflow-hidden mb-12">
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: 1020,
            height: maxY + 30,
            transition: "height 0.3s ease",
          }}
          className="relative"
        >
          {/* Background frame */}
          <div className="absolute inset-0 rounded-xl border border-border/30 bg-gradient-to-b from-muted/20 to-transparent">
            <div className="absolute top-3 left-5 text-xs font-mono text-muted-foreground/60">
              ~/.autogoals/state.db
            </div>
          </div>

          {/* SVG relationship lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="1020"
            height={maxY + 30}
            style={{ zIndex: 1 }}
          >
            {relationships.map((rel, i) => {
              const fromT = tableMap[rel.from];
              const toT = tableMap[rel.to];
              if (!fromT || !toT) return null;

              const fromCx = fromT.x + fromT.width / 2;
              const fromBottom = fromT.y + getTableHeight(fromT);
              const toCx = toT.x + toT.width / 2;
              const toTop = toT.y;

              const isHighlighted =
                highlightedTable === rel.from || highlightedTable === rel.to;

              // If same row (both in top row), draw horizontal
              if (Math.abs(fromT.y - toT.y) < 30) {
                const fromRight = fromT.x + fromT.width;
                const toLeft = toT.x;
                return (
                  <line
                    key={i}
                    x1={fromRight}
                    y1={fromT.y + getTableHeight(fromT) / 2}
                    x2={toLeft}
                    y2={toT.y + getTableHeight(toT) / 2}
                    stroke={isHighlighted ? "#8b5cf6" : "#334155"}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeDasharray={isHighlighted ? "none" : "4 3"}
                    opacity={isHighlighted ? 0.8 : 0.3}
                    className={isHighlighted ? "arrow-animated" : ""}
                  />
                );
              }

              // Draw vertical connection from parent bottom to child top
              const midY = (fromBottom + toTop) / 2;
              const path = `M ${fromCx} ${fromBottom} L ${fromCx} ${midY} L ${toCx} ${midY} L ${toCx} ${toTop}`;

              return (
                <g key={i}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isHighlighted ? "#8b5cf6" : "#334155"}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeDasharray={isHighlighted ? "none" : "4 3"}
                    opacity={isHighlighted ? 0.8 : 0.3}
                    className={isHighlighted ? "arrow-animated" : ""}
                  />
                  <circle
                    cx={toCx}
                    cy={toTop}
                    r="3"
                    fill={isHighlighted ? "#8b5cf6" : "#334155"}
                    opacity={isHighlighted ? 0.8 : 0.3}
                  />
                </g>
              );
            })}
          </svg>

          {/* Table cards */}
          {tables.map((t) => {
            const h = getTableHeight(t);
            const isHighlighted =
              highlightedTable === t.id ||
              relationships.some(
                (r) =>
                  (r.from === highlightedTable && r.to === t.id) ||
                  (r.to === highlightedTable && r.from === t.id)
              );

            return (
              <div
                key={t.id}
                className={cn(
                  "absolute rounded-lg border transition-all duration-200",
                  "bg-gradient-to-b",
                  t.bgGradient,
                  t.borderColor,
                  isHighlighted && "ring-1 ring-violet-500/40 scale-[1.02]"
                )}
                style={{
                  left: t.x,
                  top: t.y,
                  width: t.width,
                  height: h,
                  zIndex: isHighlighted ? 10 : 2,
                }}
                onMouseEnter={() => setHighlightedTable(t.id)}
                onMouseLeave={() => setHighlightedTable(null)}
              >
                <div className="px-3 py-2 border-b border-border/20">
                  <h3
                    className={cn(
                      "text-xs font-mono font-semibold",
                      t.textColor
                    )}
                  >
                    {t.name}
                  </h3>
                </div>
                <div className="px-3 py-1.5">
                  {t.columns.map((col) => (
                    <div
                      key={col.name}
                      className="flex items-center gap-1.5 h-5"
                    >
                      {col.pk && (
                        <span className="text-[8px] font-mono text-amber-400/70 bg-amber-500/10 px-1 rounded">
                          PK
                        </span>
                      )}
                      {col.fk && !col.pk && (
                        <span className="text-[8px] font-mono text-cyan-400/70 bg-cyan-500/10 px-1 rounded">
                          FK
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-[10px] font-mono",
                          col.pk
                            ? "text-foreground/80 font-medium"
                            : col.fk
                              ? "text-foreground/60"
                              : "text-muted-foreground"
                        )}
                      >
                        {col.name.replace(" (PK)", "").replace(" (FK)", "").replace(" (PK/FK)", "")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* 1:N label on the projects->children connection area */}
          <div
            className="absolute text-[10px] font-mono text-muted-foreground/50"
            style={{ left: 145, top: getTableHeight(tableMap["projects"]) + 45 }}
          >
            1 : N
          </div>
        </div>
      </div>

      {/* ── Read/Write Operations Table ─────────────────────── */}
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Read/Write Operations
      </h2>

      <div className="rounded-lg border border-border/50 overflow-hidden mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/30 bg-muted/20">
                <th className="px-4 py-3 font-medium">Table</th>
                <th className="px-4 py-3 font-medium">Who Reads</th>
                <th className="px-4 py-3 font-medium">Who Writes</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((op) => (
                <tr
                  key={op.table}
                  className={cn(
                    "border-b border-border/10 transition-colors",
                    highlightedTable === op.table
                      ? "bg-violet-500/5"
                      : "hover:bg-muted/10"
                  )}
                  onMouseEnter={() => setHighlightedTable(op.table)}
                  onMouseLeave={() => setHighlightedTable(null)}
                >
                  <td className="px-4 py-2.5">
                    <code className="text-xs font-mono font-medium text-foreground/90 bg-muted/30 px-1.5 py-0.5 rounded">
                      {op.table}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground/70">
                    {op.whoReads}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground/70">
                    {op.whoWrites}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                      {op.when}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Agent Start Sequence ────────────────────────────── */}
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Data Flow: What Happens When Agent Starts
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Animated sequence of database reads when the <code className="text-xs font-mono bg-muted/30 px-1 py-0.5 rounded">startAgent</code> mutation fires.
      </p>

      <div className="space-y-1 mb-4">
        {startSequence.map((step, i) => {
          const isActive = i === activeSeqStep && seqPlaying;
          const isPast = i < activeSeqStep || !seqPlaying;

          return (
            <div key={i}>
              {i > 0 && (
                <div className="flex items-center ml-[52px] h-3">
                  <div
                    className={cn(
                      "w-0.5 h-full transition-colors duration-300",
                      i <= activeSeqStep
                        ? "bg-violet-500/30"
                        : "bg-border/20"
                    )}
                  />
                </div>
              )}

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-all duration-300",
                  isActive
                    ? "border-violet-500/40 bg-violet-500/5"
                    : isPast && i <= activeSeqStep
                      ? "border-border/30 bg-card/30"
                      : "border-border/10 bg-transparent opacity-40"
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border transition-colors",
                    isActive
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-400"
                      : "bg-muted/30 border-border/30 text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn("text-xs font-medium", step.color)}>
                      {step.label}
                    </span>
                    {step.table && (
                      <code className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-1 py-0.5 rounded">
                        {step.table}
                      </code>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          onClick={playSequence}
          disabled={seqPlaying}
          className={cn(
            "px-4 py-2 text-sm border rounded-lg transition-colors",
            seqPlaying
              ? "text-muted-foreground border-border/30 cursor-not-allowed"
              : "text-muted-foreground hover:text-foreground border-border/50 hover:border-border"
          )}
        >
          {seqPlaying ? "Playing..." : "Play sequence"}
        </button>
      </div>
    </div>
  );
}
