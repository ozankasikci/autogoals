import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_CHECKPOINTS, RESTORE_CHECKPOINT } from "@/graphql/operations";
import { Loader2, RotateCcw, GitCommit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Checkpoint {
  id: string;
  goalId: string | null;
  goalName: string;
  commitHash: string;
  tag: string;
  message: string;
  createdAt: string;
}

interface HistoryPanelProps {
  projectId: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + "Z");
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function HistoryPanel({ projectId }: HistoryPanelProps) {
  const { data, loading, refetch } = useQuery<{ checkpoints: Checkpoint[] }>(GET_CHECKPOINTS, {
    variables: { projectId },
  });

  const [restoreCheckpoint, { loading: restoring }] = useMutation(RESTORE_CHECKPOINT, {
    onCompleted: () => {
      refetch();
      setConfirmTag(null);
    },
  });

  const [confirmTag, setConfirmTag] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const checkpoints = data?.checkpoints ?? [];

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <GitCommit className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No checkpoints yet.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Checkpoints are created automatically when goals complete.
        </p>
      </div>
    );
  }

  const confirmCheckpoint = checkpoints.find((c) => c.tag === confirmTag);

  return (
    <div className="relative">
      {/* Timeline */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

        {checkpoints.map((checkpoint, index) => {
          const isRecent = index < 3;
          const isHovered = hoveredId === checkpoint.id;

          return (
            <div
              key={checkpoint.id}
              className="relative pb-6 last:pb-0 group"
              onMouseEnter={() => setHoveredId(checkpoint.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Dot */}
              <div
                className={`absolute left-[-15px] top-1.5 h-3 w-3 rounded-full border-2 ${
                  isRecent
                    ? "border-primary bg-primary/20"
                    : "border-muted-foreground/40 bg-card"
                }`}
              />

              {/* Content */}
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground leading-tight">
                    {checkpoint.goalName}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums">
                    {timeAgo(checkpoint.createdAt)}
                  </span>
                </div>

                {/* File changes (diff stats) */}
                {checkpoint.message && (
                  <div className="mt-1.5 rounded bg-muted/50 px-2 py-1.5">
                    <pre className="text-[11px] font-mono text-muted-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {checkpoint.message}
                    </pre>
                  </div>
                )}

                <div className="mt-1.5 flex items-center gap-2">
                  <code className="text-[11px] font-mono text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
                    {checkpoint.commitHash}
                  </code>
                </div>

                {/* Restore button — visible on hover */}
                <div
                  className={`mt-2 transition-opacity duration-150 ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <button
                    onClick={() => setConfirmTag(checkpoint.tag)}
                    disabled={restoring}
                    className="inline-flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation dialog */}
      <Dialog open={confirmTag !== null} onOpenChange={(open) => !open && setConfirmTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore checkpoint</DialogTitle>
            <DialogDescription>
              This will stop the agent (if running), stash any uncommitted changes, and check out the code at this checkpoint.
              {confirmCheckpoint && (
                <>
                  <br /><br />
                  <strong>{confirmCheckpoint.goalName}</strong>
                  <br />
                  <code className="text-xs">{confirmCheckpoint.tag}</code>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTag(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={restoring}
              onClick={() => {
                if (confirmTag) {
                  restoreCheckpoint({ variables: { projectId, tag: confirmTag } });
                }
              }}
            >
              {restoring ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                "Restore"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
