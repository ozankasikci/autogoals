import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useSubscription, useApolloClient } from "@apollo/client";
import { GET_ACTIVITY, LOG_EVENTS } from "@/graphql/operations";
import { cn, formatTimestamp } from "@/lib/utils";

interface LogEvent {
  id?: string;
  type: string;
  message: string;
  costUsd: number | null;
  timestamp: string;
  projectId: string;
}

interface LogStreamProps {
  projectId: string;
  compact?: boolean;
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

const LOG_PAGE_SIZE = 100;

export function LogStream({ projectId, compact = false }: LogStreamProps) {
  const client = useApolloClient();
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: historicalData } = useQuery(GET_ACTIVITY, {
    variables: { projectId, limit: LOG_PAGE_SIZE },
    fetchPolicy: "network-only",
  });

  const initialLoadRef = useRef(true);

  // Seed logs from historical data
  useEffect(() => {
    if (historicalData?.activityEvents) {
      setLogs(historicalData.activityEvents);
      if (historicalData.activityEvents.length < LOG_PAGE_SIZE) setHasMore(false);
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "instant" });
        }, 50);
      }
    }
  }, [historicalData]);

  // Subscription adds new events
  useSubscription(LOG_EVENTS, {
    variables: { projectId },
    onData: ({ data }) => {
      if (data.data?.logEvent) {
        setLogs((prev) => {
          const event = data.data.logEvent;
          // Dedup
          if (prev.some(l => l.message === event.message && l.timestamp === event.timestamp)) return prev;
          return [...prev, event];
        });
      }
    },
  });

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Load older activity events when scrolling to top
  const loadOlderLogs = useCallback(async () => {
    if (loadingMore || !hasMore || logs.length === 0) return;
    const firstWithId = logs.find(l => l.id);
    if (!firstWithId) return;
    setLoadingMore(true);

    const { data: olderData } = await client.query<{ activityEvents: LogEvent[] }>({
      query: GET_ACTIVITY,
      variables: { projectId, limit: LOG_PAGE_SIZE, beforeId: firstWithId.id },
      fetchPolicy: "network-only",
    });

    if (olderData?.activityEvents?.length > 0) {
      const scrollEl = scrollRef.current;
      const prevScrollHeight = scrollEl?.scrollHeight ?? 0;

      setLogs(prev => [...olderData.activityEvents, ...prev]);

      requestAnimationFrame(() => {
        if (scrollEl) {
          const newScrollHeight = scrollEl.scrollHeight;
          scrollEl.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });

      if (olderData.activityEvents.length < LOG_PAGE_SIZE) setHasMore(false);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, logs, projectId, client]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);

    // Detect scroll to top for infinite scroll
    if (scrollTop < 100 && hasMore && !loadingMore) {
      loadOlderLogs();
    }
  }, [hasMore, loadingMore, loadOlderLogs]);

  // ── Compact sidebar mode ──
  if (compact) {
    const recentLogs = logs;

    return (
      <div className="flex flex-col h-full min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto rounded-md bg-black/20 p-2 font-mono text-sm leading-relaxed"
        >
          {recentLogs.length === 0 ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <div className="text-center space-y-1">
                <div className="text-sm opacity-50">{">"}_</div>
                <p className="text-sm">Waiting for events...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-px">
              {loadingMore && (
                <div className="flex justify-center py-1">
                  <span className="text-[11px] text-muted-foreground/50">Loading older...</span>
                </div>
              )}
              {!hasMore && logs.length > 0 && (
                <div className="text-center text-[11px] text-muted-foreground/30 py-1">
                  Beginning of activity
                </div>
              )}
              {recentLogs.map((log, i) => (
                <div
                  key={log.id ?? i}
                  className="flex gap-1.5 py-px hover:bg-muted/30 rounded px-1 -mx-1"
                >
                  <span className="shrink-0 text-muted-foreground/50 tabular-nums">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0",
                      logTypeColors[log.type] ?? "text-muted-foreground"
                    )}
                  >
                    [{log.type}]
                  </span>
                  <span className="text-foreground/80 break-all line-clamp-2">
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-muted-foreground">
            {logs.length} event{logs.length !== 1 ? "s" : ""}
          </span>
          {!autoScroll && recentLogs.length > 0 && (
            <button
              onClick={() => {
                setAutoScroll(true);
                bottomRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Scroll to bottom
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Full mode (unchanged) ──
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
            {loadingMore && (
              <div className="flex justify-center py-1">
                <span className="text-[11px] text-muted-foreground/50">Loading older...</span>
              </div>
            )}
            {!hasMore && logs.length > 0 && (
              <div className="text-center text-[11px] text-muted-foreground/30 py-1">
                Beginning of activity
              </div>
            )}
            {logs.map((log, i) => (
              <div
                key={log.id ?? i}
                className="flex gap-3 py-0.5 hover:bg-muted/30 rounded px-1 -mx-1"
              >
                <span className="text-muted-foreground shrink-0 select-none tabular-nums">
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
