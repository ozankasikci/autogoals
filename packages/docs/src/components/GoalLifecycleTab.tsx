import { useState } from "react";
import { cn } from "@/lib/cn";

interface GoalState {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  ringColor: string;
  description: string;
  trigger: string;
  userSees: string;
  agentDoes: string;
  codeRef: string;
}

const states: GoalState[] = [
  {
    id: "draft",
    label: "Draft",
    color: "text-violet-400",
    bgColor: "bg-violet-500/15",
    borderColor: "border-violet-500/30",
    ringColor: "ring-violet-500/40",
    description: "User adds a goal with just a name",
    trigger: "User clicks '+ Add Goal' and enters a name and optional description",
    userSees: "Goal appears in the goal list with a 'Draft' badge. A 'Refine with Agent' button is available.",
    agentDoes: "Nothing yet - the agent is not involved at this stage.",
    codeRef: "api/src/schema/resolvers.ts -> addGoal()",
  },
  {
    id: "refined",
    label: "Refined",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/15",
    borderColor: "border-cyan-500/30",
    ringColor: "ring-cyan-500/40",
    description: "Agent interviewed user, generated criteria + approach",
    trigger: "User clicks 'Refine with Agent' on a draft goal, agent sends interview questions, then generates structured output",
    userSees: "Chat shows agent asking questions about the goal. After refinement, the goal shows acceptance criteria and an approach.",
    agentDoes: "Interviews the user via chat, then generates JSON with description, acceptanceCriteria[], and approach.",
    codeRef: "api/src/schema/resolvers.ts -> refineGoal() | core/src/goal-tracker.ts -> refine()",
  },
  {
    id: "ready",
    label: "Ready",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/15",
    borderColor: "border-indigo-500/30",
    ringColor: "ring-indigo-500/40",
    description: "User approved, waiting for execution",
    trigger: "User reviews the refined criteria and clicks 'Approve' or 'Approve & Start'",
    userSees: "Goal badge changes to 'Ready'. If 'Approve & Start' was clicked, the goal immediately moves to pending.",
    agentDoes: "Nothing - waiting for the execution queue.",
    codeRef: "api/src/schema/resolvers.ts -> approveGoal()",
  },
  {
    id: "pending",
    label: "Pending",
    color: "text-gray-400",
    bgColor: "bg-gray-500/15",
    borderColor: "border-gray-500/30",
    ringColor: "ring-gray-500/40",
    description: "In queue for agent execution",
    trigger: "Goal is approved and waiting in the execution queue for the agent to pick it up",
    userSees: "Goal shows 'Pending' badge. The agent may be working on another goal first.",
    agentDoes: "Will pick up this goal when the current one completes. Agent receives the goal context in its system prompt.",
    codeRef: "api/src/agent-manager/manager.ts -> consumeEvents()",
  },
  {
    id: "active",
    label: "Active",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    borderColor: "border-blue-500/30",
    ringColor: "ring-blue-500/40",
    description: "Agent is actively working on it",
    trigger: "Agent's first tool use (file write, bash command, etc.) on this goal",
    userSees: "Goal shows 'Active' badge with a pulsing indicator. Activity panel auto-opens showing real-time tool usage.",
    agentDoes: "Executes code changes, runs commands, reads files - working toward acceptance criteria.",
    codeRef: "api/src/agent-manager/manager.ts -> if first active tool, goal: pending -> active",
  },
  {
    id: "verifying",
    label: "Verifying",
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
    borderColor: "border-amber-500/30",
    ringColor: "ring-amber-500/40",
    description: "Agent checking acceptance criteria",
    trigger: "Agent finishes implementation and begins verification against acceptance criteria",
    userSees: "Goal shows 'Verifying' badge. Chat shows the agent running tests and checking criteria.",
    agentDoes: "Systematically checks each acceptance criterion. Runs tests, verifies behavior, confirms completion.",
    codeRef: "core/src/goal-tracker.ts -> verify() | agent-manager -> verification prompt",
  },
  {
    id: "done",
    label: "Done",
    color: "text-green-400",
    bgColor: "bg-green-500/15",
    borderColor: "border-green-500/30",
    ringColor: "ring-green-500/40",
    description: "All acceptance criteria met",
    trigger: "Agent confirms all acceptance criteria are satisfied",
    userSees: "Goal shows 'Done' badge with a checkmark. The goal is complete and the agent moves to the next one.",
    agentDoes: "Reports success, updates goal status, moves to the next pending goal if any.",
    codeRef: "core/src/goal-tracker.ts -> complete() | api/src/agent-manager/manager.ts",
  },
  {
    id: "failed",
    label: "Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/15",
    borderColor: "border-red-500/30",
    ringColor: "ring-red-500/40",
    description: "Verification failed",
    trigger: "Agent determines one or more acceptance criteria cannot be met with current approach",
    userSees: "Goal shows 'Failed' badge with an error message explaining what went wrong.",
    agentDoes: "Reports the failure reason, logs the error, and transitions to retrying if retries remain.",
    codeRef: "core/src/goal-tracker.ts -> fail() | agent-manager -> error handling",
  },
  {
    id: "retrying",
    label: "Retrying",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
    borderColor: "border-orange-500/30",
    ringColor: "ring-orange-500/40",
    description: "Trying a different approach",
    trigger: "Previous attempt failed, retries remain (max 3 by default)",
    userSees: "Goal shows 'Retrying' badge with retry count. Agent starts working again with a different strategy.",
    agentDoes: "Analyzes what went wrong, formulates a new approach, and re-attempts the goal from scratch.",
    codeRef: "core/src/goal-tracker.ts -> retry() | agent-manager -> retry logic",
  },
  {
    id: "skipped",
    label: "Skipped",
    color: "text-gray-500",
    bgColor: "bg-gray-600/15",
    borderColor: "border-gray-600/30",
    ringColor: "ring-gray-600/40",
    description: "Max retries exceeded",
    trigger: "All retry attempts exhausted without meeting acceptance criteria",
    userSees: "Goal shows 'Skipped' badge. The agent moves on to the next goal. User can manually reset.",
    agentDoes: "Moves on to the next pending goal. Logs skip reason.",
    codeRef: "core/src/goal-tracker.ts -> skip() | agent-manager -> max retries check",
  },
];

interface Transition {
  from: string;
  to: string;
  label?: string;
}

const transitions: Transition[] = [
  { from: "draft", to: "refined", label: "refine" },
  { from: "refined", to: "ready", label: "approve" },
  { from: "ready", to: "pending", label: "queue" },
  { from: "pending", to: "active", label: "start" },
  { from: "active", to: "verifying", label: "verify" },
  { from: "verifying", to: "done", label: "pass" },
  { from: "verifying", to: "failed", label: "fail" },
  { from: "failed", to: "retrying", label: "retry" },
  { from: "retrying", to: "active", label: "re-run" },
  { from: "retrying", to: "skipped", label: "max retries" },
  { from: "refined", to: "draft", label: "revise" },
];

// Layout positions for the flowchart
const nodePositions: Record<string, { x: number; y: number }> = {
  draft: { x: 60, y: 60 },
  refined: { x: 210, y: 60 },
  ready: { x: 380, y: 60 },
  pending: { x: 530, y: 60 },
  active: { x: 680, y: 60 },
  verifying: { x: 680, y: 200 },
  done: { x: 850, y: 60 },
  failed: { x: 530, y: 200 },
  retrying: { x: 530, y: 320 },
  skipped: { x: 380, y: 320 },
};

const NODE_W = 110;
const NODE_H = 40;

function getNodeCenter(id: string) {
  const pos = nodePositions[id];
  return { x: pos.x + NODE_W / 2, y: pos.y + NODE_H / 2 };
}

export function GoalLifecycleTab() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const selected = states.find((s) => s.id === selectedState);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Goal Lifecycle
        </h1>
        <p className="text-muted-foreground">
          Every goal transitions through defined states. Click any state to see
          what triggers it, what users see, and what code runs.
        </p>
      </div>

      {/* Flowchart */}
      <div className="relative overflow-x-auto pb-4">
        <div style={{ width: 980, height: 400 }} className="relative">
          {/* SVG transitions */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width="980"
            height="400"
          >
            {transitions.map((t, i) => {
              const from = getNodeCenter(t.from);
              const to = getNodeCenter(t.to);

              // Determine arrow path
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const isHorizontal = Math.abs(dx) > Math.abs(dy);

              let path: string;

              // Special curved paths for backward transitions
              if (t.from === "refined" && t.to === "draft") {
                path = `M ${from.x - NODE_W / 2} ${from.y} C ${from.x - NODE_W / 2 - 30} ${from.y + 60}, ${to.x + NODE_W / 2 + 30} ${to.y + 60}, ${to.x + NODE_W / 2} ${to.y}`;
              } else if (t.from === "retrying" && t.to === "active") {
                path = `M ${from.x + NODE_W / 2} ${from.y} C ${from.x + NODE_W / 2 + 60} ${from.y - 60}, ${to.x + NODE_W / 2 + 60} ${to.y + 60}, ${to.x + NODE_W / 2} ${to.y}`;
              } else if (isHorizontal) {
                const startX = dx > 0 ? from.x + NODE_W / 2 : from.x - NODE_W / 2;
                const endX = dx > 0 ? to.x - NODE_W / 2 : to.x + NODE_W / 2;
                path = `M ${startX} ${from.y} L ${endX} ${to.y}`;
              } else {
                const startY = dy > 0 ? from.y + NODE_H / 2 : from.y - NODE_H / 2;
                const endY = dy > 0 ? to.y - NODE_H / 2 : to.y + NODE_H / 2;
                path = `M ${from.x} ${startY} L ${to.x} ${endY}`;
              }

              const isHighlighted =
                selectedState === t.from || selectedState === t.to;

              return (
                <g key={i}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isHighlighted ? "#8b5cf6" : "#334155"}
                    strokeWidth={isHighlighted ? 2 : 1}
                    className={isHighlighted ? "arrow-animated" : ""}
                    opacity={isHighlighted ? 0.8 : 0.4}
                    markerEnd="url(#arrowhead)"
                  />
                  {t.label && (
                    <text
                      x={(from.x + to.x) / 2}
                      y={
                        t.from === "refined" && t.to === "draft"
                          ? from.y + 55
                          : t.from === "retrying" && t.to === "active"
                            ? (from.y + to.y) / 2
                            : isHorizontal
                              ? from.y - 10
                              : (from.y + to.y) / 2
                      }
                      fill={isHighlighted ? "#8b5cf6" : "#64748b"}
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                      opacity={isHighlighted ? 1 : 0.6}
                    >
                      {t.label}
                    </text>
                  )}
                </g>
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 8 3, 0 6"
                  fill="#64748b"
                  opacity="0.6"
                />
              </marker>
            </defs>
          </svg>

          {/* State nodes */}
          {states.map((state) => {
            const pos = nodePositions[state.id];
            const isSelected = selectedState === state.id;
            return (
              <button
                key={state.id}
                className={cn(
                  "absolute rounded-full border-2 transition-all duration-200",
                  "flex items-center justify-center",
                  "text-xs font-semibold cursor-pointer",
                  state.bgColor,
                  state.borderColor,
                  state.color,
                  isSelected && `ring-2 ${state.ringColor} scale-110`,
                  !isSelected && "hover:scale-105"
                )}
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: NODE_W,
                  height: NODE_H,
                  zIndex: isSelected ? 10 : 2,
                }}
                onClick={() =>
                  setSelectedState(isSelected ? null : state.id)
                }
              >
                {state.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div
          className={cn(
            "mt-4 rounded-lg border p-6 animate-fade-slide-up",
            selected.borderColor,
            selected.bgColor
          )}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                "px-3 py-1 rounded-full text-sm font-semibold border",
                selected.bgColor,
                selected.borderColor,
                selected.color
              )}
            >
              {selected.label}
            </div>
            <span className="text-muted-foreground text-sm">
              {selected.description}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailCard
              title="What triggers this state"
              content={selected.trigger}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            />
            <DetailCard
              title="What the user sees"
              content={selected.userSees}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
            />
            <DetailCard
              title="What the agent does"
              content={selected.agentDoes}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
            <DetailCard
              title="Code reference"
              content={selected.codeRef}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              }
              mono
            />
          </div>
        </div>
      )}

      {!selected && (
        <div className="mt-4 text-center text-sm text-muted-foreground py-8 border border-dashed border-border/50 rounded-lg">
          Click any state above to see its details
        </div>
      )}

      {/* Rules context section */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          How Rules Interact with Goals
        </h2>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-400 mb-1">Rules are injected into the system prompt at EVERY phase</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Whenever the agent starts or receives a new goal, the system prompt is composed as:
              </p>
              <div className="mt-2 bg-background/40 rounded-md border border-border/30 p-3 font-mono text-[11px] text-foreground/70 leading-relaxed whitespace-pre-wrap">
{`RULES (you MUST follow ALL of these):
- rule 1
- rule 2

GOAL: [goal name]
DESCRIPTION: [goal description]
APPROACH: [approach]
ACCEPTANCE CRITERIA:
- criterion 1
- criterion 2`}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-400 mb-1">Rules always win over goals</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If a goal's requirements conflict with a rule, the agent must comply with the rule and flag the conflict in chat instead of breaking it.
                This is enforced via the system prompt instruction:
              </p>
              <p className="mt-1 text-[11px] font-mono text-foreground/60 italic">
                "If a goal conflicts with a rule, the rule wins — flag the conflict instead of breaking the rule."
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-400 mb-1">Live rule updates reach the running agent</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When a user adds, edits, or removes a rule while the agent is running, the resolver sends a
                <code className="mx-1 text-[11px] font-mono bg-muted/30 px-1 py-0.5 rounded">[System]</code>
                message with the full updated rules list to the live agent session.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  content,
  icon,
  mono,
}: {
  title: string;
  content: string;
  icon: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="bg-background/40 rounded-md border border-border/30 p-4">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {title}
        </span>
      </div>
      <p
        className={cn(
          "text-sm text-foreground/80 leading-relaxed",
          mono && "font-mono text-xs"
        )}
      >
        {content}
      </p>
    </div>
  );
}
