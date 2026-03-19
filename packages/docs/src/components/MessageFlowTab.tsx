import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";

interface FlowStep {
  component: string;
  action: string;
  detail: string;
  file?: string;
  componentColor: string;
}

interface Flow {
  id: string;
  title: string;
  description: string;
  steps: FlowStep[];
}

const componentColors: Record<string, { bg: string; text: string; border: string }> = {
  User: { bg: "bg-gray-500/10", text: "text-gray-300", border: "border-gray-500/30" },
  Dashboard: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  API: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
  AgentSession: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30" },
  AgentManager: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30" },
  "Claude SDK": { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/30" },
  "Claude Code CLI": { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/30" },
  ChatPanel: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  Agent: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/30" },
  SDK: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/30" },
};

const flows: Flow[] = [
  {
    id: "send-message",
    title: "Send a Message",
    description: "End-to-end flow of a user message through the system and back",
    steps: [
      {
        component: "User",
        action: "Types message in chat input",
        detail: "User writes a message and presses Enter or clicks Send",
        componentColor: "User",
      },
      {
        component: "Dashboard",
        action: "SEND_MESSAGE mutation",
        detail: "Apollo Client sends GraphQL mutation with projectId and content",
        file: "dashboard/src/graphql/operations.ts",
        componentColor: "Dashboard",
      },
      {
        component: "API",
        action: "resolvers.sendMessage()",
        detail: "Stores message in SQLite with role='user', pushes to AgentSession",
        file: "api/src/schema/resolvers.ts",
        componentColor: "API",
      },
      {
        component: "AgentSession",
        action: "MessageQueue.push()",
        detail: "Message queued for the Claude SDK to process",
        file: "core/src/agent-session.ts",
        componentColor: "AgentSession",
      },
      {
        component: "Claude SDK",
        action: "query() processes message",
        detail: "Claude Code SDK sends the message to the model with full conversation context",
        file: "core/src/agent-session.ts",
        componentColor: "Claude SDK",
      },
      {
        component: "Claude Code CLI",
        action: "Generates response",
        detail: "Model produces response text, potentially with tool use",
        componentColor: "Claude Code CLI",
      },
      {
        component: "AgentSession",
        action: "events() yields text",
        detail: "Streaming events emitted as the response is generated",
        file: "core/src/agent-session.ts",
        componentColor: "AgentSession",
      },
      {
        component: "AgentManager",
        action: "Stores response in DB",
        detail: "Consumes events, stores assistant message, publishes NEW_MESSAGE subscription",
        file: "api/src/agent-manager/manager.ts",
        componentColor: "AgentManager",
      },
      {
        component: "Dashboard",
        action: "Subscription receives message",
        detail: "GraphQL subscription delivers the new message to the client",
        file: "dashboard/src/graphql/operations.ts",
        componentColor: "Dashboard",
      },
      {
        component: "ChatPanel",
        action: "Renders in message list",
        detail: "New message appears in the chat with markdown rendering",
        file: "dashboard/src/components/ChatPanel.tsx",
        componentColor: "ChatPanel",
      },
    ],
  },
  {
    id: "start-agent",
    title: "Start Agent",
    description: "What happens when the user clicks the Start button",
    steps: [
      {
        component: "User",
        action: "Clicks Start button",
        detail: "User clicks the Start Agent button on the project detail page",
        componentColor: "User",
      },
      {
        component: "Dashboard",
        action: "START_AGENT mutation",
        detail: "Apollo Client sends startAgent mutation with projectId",
        file: "dashboard/src/graphql/operations.ts",
        componentColor: "Dashboard",
      },
      {
        component: "API",
        action: "resolvers.startAgent()",
        detail: "Creates a new AgentSession, sets project.isRunning = true",
        file: "api/src/schema/resolvers.ts",
        componentColor: "API",
      },
      {
        component: "AgentManager",
        action: "Creates AgentSession",
        detail: "Instantiates SDK wrapper with project context, goals, and system prompt",
        file: "api/src/agent-manager/manager.ts",
        componentColor: "AgentManager",
      },
      {
        component: "AgentManager",
        action: "Sends initial message with goals",
        detail: "Constructs prompt with pending goals, criteria, and project context",
        file: "api/src/agent-manager/manager.ts",
        componentColor: "AgentManager",
      },
      {
        component: "AgentManager",
        action: "consumeEvents() loop starts",
        detail: "Async loop begins consuming streaming events from the SDK",
        file: "api/src/agent-manager/manager.ts",
        componentColor: "AgentManager",
      },
      {
        component: "Agent",
        action: "Starts working...",
        detail: "Claude Code receives the prompt and begins executing goals",
        componentColor: "Agent",
      },
    ],
  },
  {
    id: "add-goal",
    title: "Add Goal",
    description: "The full lifecycle from adding a goal to agent execution",
    steps: [
      {
        component: "User",
        action: "Clicks + Add Goal",
        detail: "Opens the add goal form with name and description fields",
        componentColor: "User",
      },
      {
        component: "Dashboard",
        action: "ADD_GOAL mutation",
        detail: "Sends goal name, description, empty criteria and dependencies",
        file: "dashboard/src/graphql/operations.ts",
        componentColor: "Dashboard",
      },
      {
        component: "API",
        action: "Stores goal (status: draft)",
        detail: "Creates goal record in SQLite with status='draft'",
        file: "api/src/schema/resolvers.ts",
        componentColor: "API",
      },
      {
        component: "User",
        action: "Clicks 'Refine with Agent'",
        detail: "Triggers the refinement process where the agent interviews the user",
        componentColor: "User",
      },
      {
        component: "Dashboard",
        action: "REFINE_GOAL mutation",
        detail: "Sends refineGoal mutation with projectId and goalId",
        file: "dashboard/src/graphql/operations.ts",
        componentColor: "Dashboard",
      },
      {
        component: "API",
        action: "Sends interview prompt to agent",
        detail: "Constructs a prompt asking the agent to interview the user about the goal",
        file: "api/src/schema/resolvers.ts",
        componentColor: "API",
      },
      {
        component: "Agent",
        action: "Asks questions in chat",
        detail: "Agent sends clarifying questions about scope, requirements, and edge cases",
        componentColor: "Agent",
      },
      {
        component: "User",
        action: "Answers questions",
        detail: "User responds to agent's interview questions in the chat",
        componentColor: "User",
      },
      {
        component: "Agent",
        action: "Generates criteria + approach (JSON)",
        detail: "Produces structured JSON with description, acceptanceCriteria[], and approach",
        componentColor: "Agent",
      },
      {
        component: "AgentManager",
        action: "Parses JSON, updates goal",
        detail: "Extracts structured data, updates goal record. Status: draft -> refined",
        file: "api/src/agent-manager/manager.ts",
        componentColor: "AgentManager",
      },
      {
        component: "User",
        action: "Clicks 'Approve & Start'",
        detail: "Reviews the refined goal and approves it for execution",
        componentColor: "User",
      },
      {
        component: "API",
        action: "Goal status: refined -> pending",
        detail: "Updates goal status, agent picks it up from the execution queue",
        file: "api/src/schema/resolvers.ts",
        componentColor: "API",
      },
      {
        component: "Agent",
        action: "Picks up goal and executes",
        detail: "Agent receives updated goals in context and begins working",
        componentColor: "Agent",
      },
    ],
  },
  {
    id: "tool-use",
    title: "Agent Uses a Tool",
    description: "What happens when the agent decides to use a tool (file write, bash, etc.)",
    steps: [
      {
        component: "Agent",
        action: "Decides to use Write tool",
        detail: "Claude Code determines it needs to write/modify a file to complete the goal",
        componentColor: "Agent",
      },
      {
        component: "SDK",
        action: "Executes tool",
        detail: "Claude Code SDK executes the tool operation (write, read, bash, etc.)",
        componentColor: "SDK",
      },
      {
        component: "AgentSession",
        action: "events() yields tool_use",
        detail: "Streaming event with tool name, input, and result emitted",
        file: "core/src/agent-session.ts",
        componentColor: "AgentSession",
      },
      {
        component: "AgentManager",
        action: "Stores tool-use message in DB",
        detail: "Saves the tool use event as a message record for the chat history",
        file: "api/src/agent-manager/manager.ts",
        componentColor: "AgentManager",
      },
      {
        component: "AgentManager",
        action: "Publishes LOG_EVENT + NEW_MESSAGE",
        detail: "PubSub emits events for both activity log and chat message subscribers",
        file: "api/src/agent-manager/manager.ts",
        componentColor: "AgentManager",
      },
      {
        component: "AgentManager",
        action: "If first active tool: goal pending -> active",
        detail: "On first tool use for a goal, transitions status from pending to active",
        file: "api/src/agent-manager/manager.ts",
        componentColor: "AgentManager",
      },
      {
        component: "Dashboard",
        action: "Activity panel auto-opens",
        detail: "Subscription triggers UI update, activity panel slides open if closed",
        file: "dashboard/src/pages/ProjectDetail.tsx",
        componentColor: "Dashboard",
      },
      {
        component: "ChatPanel",
        action: "Shows collapsed tool indicator",
        detail: "Chat renders a compact tool-use indicator instead of raw JSON",
        file: "dashboard/src/components/ChatPanel.tsx",
        componentColor: "ChatPanel",
      },
    ],
  },
];

export function MessageFlowTab() {
  const [activeFlow, setActiveFlow] = useState("send-message");
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);

  const flow = flows.find((f) => f.id === activeFlow)!;

  const resetAnimation = useCallback(() => {
    setVisibleSteps(0);
    setSelectedStep(null);
  }, []);

  useEffect(() => {
    resetAnimation();
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step > flow.steps.length) {
        clearInterval(interval);
        return;
      }
      setVisibleSteps(step);
    }, 200);
    return () => clearInterval(interval);
  }, [activeFlow, flow.steps.length, resetAnimation]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Message Flow
        </h1>
        <p className="text-muted-foreground">
          Step-by-step animated diagrams showing how data flows through the
          system. Click any step for details.
        </p>
      </div>

      {/* Flow selector */}
      <div className="flex flex-wrap gap-2 mb-8">
        {flows.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFlow(f.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
              activeFlow === f.id
                ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
                : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {f.title}
          </button>
        ))}
      </div>

      {/* Flow description */}
      <p className="text-sm text-muted-foreground mb-6">{flow.description}</p>

      {/* Flow steps */}
      <div className="space-y-1">
        {flow.steps.map((step, i) => {
          const colors = componentColors[step.componentColor] || componentColors["User"];
          const isVisible = i < visibleSteps;
          const isSelected = selectedStep === i;
          const isActive = i === visibleSteps - 1 && visibleSteps <= flow.steps.length;

          return (
            <div key={`${activeFlow}-${i}`}>
              {/* Connector line */}
              {i > 0 && (
                <div className="flex items-center ml-[68px] h-4">
                  <div
                    className={cn(
                      "w-0.5 h-full transition-colors duration-300",
                      isVisible ? "bg-violet-500/30" : "bg-border/20"
                    )}
                  />
                </div>
              )}

              {/* Step card */}
              <button
                className={cn(
                  "w-full text-left flex items-start gap-4 rounded-lg border p-4 transition-all duration-300",
                  !isVisible && "opacity-0 translate-y-3",
                  isVisible && "step-appear",
                  isActive && !isSelected && "border-violet-500/40 bg-violet-500/5",
                  isSelected
                    ? `${colors.border} ${colors.bg}`
                    : isVisible && !isActive
                      ? "border-border/30 bg-card/30 hover:border-border/50"
                      : "border-transparent"
                )}
                style={{
                  animationDelay: `${i * 200}ms`,
                  animationFillMode: "forwards",
                }}
                onClick={() =>
                  setSelectedStep(isSelected ? null : i)
                }
                disabled={!isVisible}
              >
                {/* Step number */}
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold border transition-colors",
                    isActive && !isSelected
                      ? "bg-violet-500/20 border-violet-500/40 text-violet-400"
                      : isSelected
                        ? `${colors.bg} ${colors.border} ${colors.text}`
                        : "bg-muted/30 border-border/30 text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={cn(
                        "text-xs font-mono font-medium px-1.5 py-0.5 rounded",
                        colors.bg,
                        colors.text
                      )}
                    >
                      {step.component}
                    </span>
                    <span className="text-sm font-medium text-foreground/90">
                      {step.action}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="mt-3 space-y-2 animate-fade-in">
                      <p className="text-sm text-foreground/70 leading-relaxed">
                        {step.detail}
                      </p>
                      {step.file && (
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-3.5 h-3.5 text-muted-foreground"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                            />
                          </svg>
                          <code className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded">
                            {step.file}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Replay button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => {
            resetAnimation();
            // Re-trigger animation
            setTimeout(() => {
              let step = 0;
              const interval = setInterval(() => {
                step++;
                if (step > flow.steps.length) {
                  clearInterval(interval);
                  return;
                }
                setVisibleSteps(step);
              }, 200);
            }, 100);
          }}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:border-border transition-colors"
        >
          Replay animation
        </button>
      </div>
    </div>
  );
}
