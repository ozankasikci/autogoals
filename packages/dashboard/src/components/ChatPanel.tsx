import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import { GET_MESSAGES, SEND_MESSAGE, NEW_MESSAGE } from "@/graphql/operations";
import { cn, formatTimestamp } from "@/lib/utils";

interface Message {
  id: string;
  role: string;
  content: string;
  read: boolean;
  createdAt: string;
}

interface ChatPanelProps {
  projectId: string;
  isAgentRunning: boolean;
}

export function ChatPanel({
  projectId,
  isAgentRunning: _isAgentRunning,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, loading } = useQuery<{ messages: Message[] }>(GET_MESSAGES, {
    variables: { projectId, limit: 100 },
    fetchPolicy: "network-only",
  });

  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE);

  useSubscription(NEW_MESSAGE, {
    variables: { projectId },
    onData: ({ data: subData }) => {
      if (subData.data?.newMessage) {
        const incoming = subData.data.newMessage as Message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      }
    },
  });

  useEffect(() => {
    if (data?.messages) {
      setMessages(data.messages);
    }
  }, [data]);

  useEffect(() => {
    if (bottomRef.current) {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
              <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-muted-foreground/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-muted-foreground/60">No messages yet</p>
                <p className="text-xs text-muted-foreground/30 mt-1">
                  Start the agent and send a message
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "agent" && (
                  <div className="shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center mr-2.5 mt-1">
                    <svg className="h-3 w-3 text-violet-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-indigo-500/15 border border-indigo-500/20 text-foreground"
                      : "bg-white/[0.03] border border-white/[0.06] text-foreground/90"
                  )}
                >
                  <p
                    className={cn(
                      "text-[13px] whitespace-pre-wrap break-words leading-relaxed",
                      msg.role === "agent" && "font-mono text-[12.5px] leading-[1.7]"
                    )}
                  >
                    {msg.content}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] mt-2 opacity-30",
                    )}
                  >
                    {formatTimestamp(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-6 pb-5 pt-2">
        <div className="relative">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the agent..."
            className="w-full h-11 pl-4 pr-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={sending || !inputValue.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-white/[0.06] disabled:opacity-20 disabled:pointer-events-none transition-colors"
          >
            {sending ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/25 text-center mt-2">
          Agent responds in real-time when running
        </p>
      </div>
    </div>
  );
}
