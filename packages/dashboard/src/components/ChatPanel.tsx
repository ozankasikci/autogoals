import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client";
import { GET_MESSAGES, SEND_MESSAGE, NEW_MESSAGE } from "@/graphql/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  // Sync initial query data into state
  useEffect(() => {
    if (data?.messages) {
      setMessages(data.messages);
    }
  }, [data]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input on mount
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
        className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">
              Loading messages...
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <svg
                className="h-10 w-10 mx-auto text-muted-foreground/30"
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
              <div>
                <p className="text-sm text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Send a message to communicate with the agent
                </p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[70%] rounded-lg px-4 py-2.5",
                  msg.role === "user"
                    ? "bg-indigo-600/80 text-white"
                    : "bg-muted/80 text-foreground"
                )}
              >
                <p
                  className={cn(
                    "text-sm whitespace-pre-wrap break-words leading-relaxed",
                    msg.role === "agent" && "font-mono text-[13px]"
                  )}
                >
                  {msg.content}
                </p>
                <p
                  className={cn(
                    "text-[10px] mt-1.5",
                    msg.role === "user"
                      ? "text-indigo-200/60"
                      : "text-muted-foreground/60"
                  )}
                >
                  {formatTimestamp(msg.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-6 py-4 space-y-2">
        <p className="text-[11px] text-muted-foreground/50 text-center">
          Agent reads messages between goals
        </p>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-10 text-sm bg-muted/50 border-border"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !inputValue.trim()}
            className="h-10 px-4"
          >
            {sending ? (
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
