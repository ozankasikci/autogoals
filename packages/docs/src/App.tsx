import { useState } from "react";
import { cn } from "@/lib/cn";
import { ArchitectureTab } from "@/components/ArchitectureTab";
import { GoalLifecycleTab } from "@/components/GoalLifecycleTab";
import { MessageFlowTab } from "@/components/MessageFlowTab";
import { LiveMonitorTab } from "@/components/LiveMonitorTab";

type Tab = "architecture" | "goal-lifecycle" | "message-flow" | "live-monitor";

const tabs: { id: Tab; label: string }[] = [
  { id: "architecture", label: "Architecture" },
  { id: "goal-lifecycle", label: "Goal Lifecycle" },
  { id: "message-flow", label: "Message Flow" },
  { id: "live-monitor", label: "Live Monitor" },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("architecture");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">SS</span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                Small Singularity
              </span>
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                system docs
              </span>
            </div>
          </div>

          {/* Tab bar */}
          <nav className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-all relative",
                  "hover:text-foreground",
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-[1400px] mx-auto px-6 py-8 w-full">
        <div key={activeTab} className="animate-fade-in">
          {activeTab === "architecture" && <ArchitectureTab />}
          {activeTab === "goal-lifecycle" && <GoalLifecycleTab />}
          {activeTab === "message-flow" && <MessageFlowTab />}
          {activeTab === "live-monitor" && <LiveMonitorTab />}
        </div>
      </main>
    </div>
  );
}

export default App;
