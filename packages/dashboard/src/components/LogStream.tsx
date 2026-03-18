import { useEffect, useRef, useState } from "react";
import { useSubscription } from "@apollo/client";
import { LOG_EVENTS } from "@/graphql/operations";
import { cn, formatTimestamp } from "@/lib/utils";

interface LogEvent {
  type: string;
  message: string;
  costUsd: number | null;
  timestamp: string;
  projectId: string;
}

interface LogStreamProps {
  projectId: string;
}

const logTypeColors: Record<string, string> = {
  info: "text-blue-400",
  error: "text-red-400",
  warning: "text-amber-400",
  success: "text-emerald-400",
  cost: "text-purple-400",
  phase: "text-cyan-400",
  goal: "text-indigo-400",
};

export function LogStream({ projectId }: LogStreamProps) {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useSubscription(LOG_EVENTS, {
    variables: { projectId },
    onData: ({ data }) => {
      if (data.data?.logEvent) {
        setLogs((prev) => [...prev, data.data.logEvent]);
      }
    },
  });

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {logs.length} event{logs.length !== 1 ? "s" : ""}
        </span>
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Scroll to bottom
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto rounded-lg border border-border bg-black/20 p-4 font-mono text-xs leading-relaxed min-h-[300px] max-h-[500px]"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <div className="text-lg opacity-50">{">"}_</div>
              <p>Waiting for log events...</p>
              <p className="text-xs opacity-60">
                Start the agent to see real-time logs
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, i) => (
              <div
                key={i}
                className="flex gap-3 py-0.5 hover:bg-white/[0.02] rounded px-1 -mx-1"
              >
                <span className="text-muted-foreground/60 shrink-0 select-none tabular-nums">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span
                  className={cn(
                    "shrink-0 w-14 text-right",
                    logTypeColors[log.type] ?? "text-muted-foreground"
                  )}
                >
                  [{log.type}]
                </span>
                <span className="text-foreground/90 break-all">
                  {log.message}
                </span>
                {log.costUsd != null && log.costUsd > 0 && (
                  <span className="shrink-0 text-purple-400/70 ml-auto">
                    ${log.costUsd.toFixed(4)}
                  </span>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
