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
  isOpen: boolean;
  onClose: () => void;
  isAgentRunning: boolean;
}

export function ChatPanel({
  projectId,
  isOpen,
  onClose,
  isAgentRunning: _isAgentRunning,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, loading } = useQuery<{ messages: Message[] }>(GET_MESSAGES, {
    variables: { projectId, limit: 100 },
    skip: !isOpen,
    fetchPolicy: "network-only",
  });

  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE);

  useSubscription(NEW_MESSAGE, {
    variables: { projectId },
    skip: !isOpen,
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

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

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
      // Restore the input so user can retry
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
    <>
      {/* Panel */}
      <div
        className={cn(
          "fixed top-14 right-0 bottom-0 z-50 w-[380px] max-w-full flex flex-col",
          "border-l border-border bg-background",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold">Chat with Agent</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-muted-foreground">
                Loading messages...
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <svg
                  className="h-8 w-8 mx-auto text-muted-foreground/40"
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
                <p className="text-sm text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground/60">
                  Send a message to communicate with the agent
                </p>
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
                    "max-w-[85%] rounded-lg px-3 py-2",
                    msg.role === "user"
                      ? "bg-indigo-600/80 text-white"
                      : "bg-muted/80 text-foreground"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm whitespace-pre-wrap break-words",
                      msg.role === "agent" && "font-mono text-[13px]"
                    )}
                  >
                    {msg.content}
                  </p>
                  <p
                    className={cn(
                      "text-[10px] mt-1",
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

        {/* Status hint + Input */}
        <div className="shrink-0 border-t border-border px-4 py-3 space-y-2">
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
              className="flex-1 h-9 text-sm bg-muted/50 border-border"
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || !inputValue.trim()}
              className="h-9 px-3"
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
    </>
  );
}
