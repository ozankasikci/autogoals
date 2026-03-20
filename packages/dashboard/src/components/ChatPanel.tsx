import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useSubscription, useApolloClient } from "@apollo/client";
import { GET_MESSAGES, SEND_MESSAGE, NEW_MESSAGE, LOG_EVENTS } from "@/graphql/operations";
import { cn, formatTimestamp } from "@/lib/utils";
import { MarkdownMessage } from "./MarkdownMessage";
import { Terminal, ChevronDown, Zap, User, Send, Loader2, MessageSquare } from "lucide-react";

interface Message {
  id: string;
  role: string;
  content: string;
  read: boolean;
  createdAt: string;
}

interface ToolUseData {
  _type: "tool_use";
  tool: string;
  summary: string;
  input: Record<string, unknown>;
}

type GroupedItem = Message | { type: "tool_group"; messages: Message[]; tools: ToolUseData[] };

function parseToolUse(content: string): ToolUseData | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed._type === "tool_use") return parsed;
    return null;
  } catch {
    return null;
  }
}

function groupMessages(messages: Message[]): GroupedItem[] {
  const groups: GroupedItem[] = [];
  let currentToolGroup: Message[] = [];
  let currentTools: ToolUseData[] = [];

  for (const msg of messages) {
    const tool = msg.role === "agent" ? parseToolUse(msg.content) : null;
    if (tool) {
      currentToolGroup.push(msg);
      currentTools.push(tool);
    } else {
      if (currentToolGroup.length > 0) {
        groups.push({ type: "tool_group", messages: currentToolGroup, tools: currentTools });
        currentToolGroup = [];
        currentTools = [];
      }
      groups.push(msg);
    }
  }
  if (currentToolGroup.length > 0) {
    groups.push({ type: "tool_group", messages: currentToolGroup, tools: currentTools });
  }
  return groups;
}

function ToolUseCard({ tools }: { tools: ToolUseData[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex justify-start ml-9">
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Terminal className="h-3 w-3 text-muted-foreground/60" />
          <span>{tools.length} tool{tools.length > 1 ? "s" : ""} used</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        {expanded && (
          <div className="mt-1.5 ml-1 space-y-0.5">
            {tools.map((tool, i) => (
              <div key={i} className="text-sm text-muted-foreground/60 font-mono truncate max-w-[400px]">
                {tool.summary}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const MessageBubble = React.memo(function MessageBubble({ msg }: { msg: Message }) {
  return (
    <div
      className={cn(
        "flex gap-2.5",
        msg.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      {msg.role === "agent" && (
        <div className="shrink-0 h-7 w-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center mt-0.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-3",
          msg.role === "user"
            ? "bg-primary/10 border border-primary/20 text-foreground"
            : "bg-card border border-border text-foreground/90"
        )}
      >
        {msg.role === "agent" ? (
          <MarkdownMessage content={msg.content} />
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {msg.content}
          </p>
        )}
        <p className="text-[11px] mt-2 text-muted-foreground/50">
          {formatTimestamp(msg.createdAt)}
        </p>
      </div>
      {msg.role === "user" && (
        <div className="shrink-0 h-7 w-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center mt-0.5">
          <User className="h-3.5 w-3.5 text-primary/70" />
        </div>
      )}
    </div>
  );
});

interface ChatPanelProps {
  projectId: string;
  isAgentRunning: boolean;
}

const PAGE_SIZE = 100;

export function ChatPanel({
  projectId,
  isAgentRunning,
}: ChatPanelProps) {
  const client = useApolloClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data, loading } = useQuery<{ messages: Message[] }>(GET_MESSAGES, {
    variables: { projectId, limit: PAGE_SIZE },
    fetchPolicy: "network-only",
  });

  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE);

  const [agentTyping, setAgentTyping] = useState(false);
  const [agentAction, setAgentAction] = useState("");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useSubscription(NEW_MESSAGE, {
    variables: { projectId },
    onData: ({ data: subData }) => {
      if (subData.data?.newMessage) {
        const incoming = subData.data.newMessage as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        // Agent sent a text message — stop typing indicator
        if (incoming.role === "agent") {
          try {
            const parsed = JSON.parse(incoming.content);
            if (parsed._type === "tool_use") {
              // Tool use — agent is still working, update action text
              setAgentTyping(true);
              setAgentAction(parsed.summary || `Using ${parsed.tool}`);
              // Reset timeout
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setAgentTyping(false), 120000);
              return;
            }
          } catch {
            // Not JSON — it's a real text response
          }
          setAgentTyping(false);
          setAgentAction("");
        }
      }
    },
  });

  // Log events also indicate agent is working
  useSubscription(LOG_EVENTS, {
    variables: { projectId },
    skip: !isAgentRunning,
    onData: ({ data: subData }) => {
      const event = subData.data?.logEvent;
      if (event?.message) {
        if (event.message.startsWith("Using ") || event.message.includes("→ active")) {
          setAgentTyping(true);
          setAgentAction(event.message.slice(0, 60));
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setAgentTyping(false), 120000);
        } else if (event.message.includes("Task done") || event.message.includes("All clear") || event.message.includes("Sleeping")) {
          setAgentTyping(false);
          setAgentAction("");
        }
      }
    },
  });

  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (data?.messages) {
      setMessages(data.messages);
      if (data.messages.length < PAGE_SIZE) setHasMore(false);
      // Jump to bottom instantly on initial load — use setTimeout to ensure DOM is rendered
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "instant" });
        }, 50);
      }
    }
  }, [data]);

  // Load older messages when scrolling to top
  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);

    const oldestId = messages[0].id;
    const { data: olderData } = await client.query<{ messages: Message[] }>({
      query: GET_MESSAGES,
      variables: { projectId, limit: PAGE_SIZE, beforeId: oldestId },
      fetchPolicy: "network-only",
    });

    if (olderData?.messages?.length > 0) {
      // Preserve scroll position
      const scrollEl = scrollRef.current;
      const prevScrollHeight = scrollEl?.scrollHeight ?? 0;

      setMessages(prev => [...olderData.messages, ...prev]);

      // Restore scroll position after prepending
      requestAnimationFrame(() => {
        if (scrollEl) {
          const newScrollHeight = scrollEl.scrollHeight;
          scrollEl.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });

      if (olderData.messages.length < PAGE_SIZE) setHasMore(false);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, messages, projectId, client]);

  // Detect scroll to top
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    // Check if user is near bottom
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    // Infinite scroll: load older when near top
    if (scrollTop < 100 && hasMore && !loadingMore) {
      loadOlder();
    }
  }, [hasMore, loadingMore, loadOlder]);

  useEffect(() => {
    if (!initialLoadRef.current && isNearBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, []);

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || sending) return;

    setInputValue("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const { data: mutData } = await sendMessage({
        variables: { projectId, content },
      });
      if (mutData?.sendMessage) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === mutData.sendMessage.id)) return prev;
          return [...prev, { ...mutData.sendMessage, read: true }];
        });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setInputValue(content);
    }
  }, [inputValue, sending, sendMessage, projectId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-sm text-muted-foreground/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-card border border-border flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground/70">No messages yet</p>
                <p className="text-xs text-muted-foreground/40 mt-1.5 max-w-[240px] mx-auto leading-relaxed">
                  Start the agent and send a message to begin building your project
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {loadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!hasMore && messages.length > 0 && (
              <div className="text-center text-xs text-muted-foreground/30 py-2">
                Beginning of conversation
              </div>
            )}
            {grouped.map((item) => {
              if ("type" in item && item.type === "tool_group") {
                return <ToolUseCard key={`tg-${item.messages[0].id}`} tools={item.tools} />;
              }
              const msg = item as Message;
              return <MessageBubble key={msg.id} msg={msg} />;
            })}
            {/* Typing indicator */}
            {agentTyping && (
              <div className="flex gap-2.5 justify-start">
                <div className="shrink-0 h-7 w-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center mt-0.5">
                  <Zap className="h-3.5 w-3.5 text-primary animate-pulse" />
                </div>
                <div className="rounded-xl px-4 py-3 bg-card border border-border max-w-[85%]">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    {agentAction && (
                      <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                        {agentAction}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-6 pb-5 pt-2">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message the agent..."
            rows={1}
            className="w-full min-h-[44px] max-h-[160px] pl-4 pr-12 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputValue.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none transition-colors"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground/30 text-center mt-2">
          {isAgentRunning
            ? "Agent responds in real-time"
            : "Start the agent to get responses"
          }
        </p>
      </div>
    </div>
  );
}
