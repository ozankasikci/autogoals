import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@apollo/client";
import {
  GET_RUN_COMMANDS,
  GET_DETECTED_COMMANDS,
  GET_PROCESSES,
  GET_PROCESS_OUTPUT,
  ADD_RUN_COMMAND,
  REMOVE_RUN_COMMAND,
  START_PROCESS,
  STOP_PROCESS,
  RESTART_PROCESS,
  GET_ENV_VARS,
  SET_ENV_VAR,
  REMOVE_ENV_VAR,
} from "@/graphql/operations";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Plus,
  Settings,
  ChevronDown,
  ChevronRight,
  Loader2,
  Terminal,
  Package,
  FileCode,
  Container,
  X,
} from "lucide-react";

interface RunCommand {
  id: string;
  name: string;
  command: string;
  autoStart: boolean;
}

interface DetectedCommand {
  name: string;
  command: string;
  source: string;
}

interface ProcessInfo {
  id: string;
  name: string;
  command: string;
  pid: number | null;
  status: string;
  startedAt: string | null;
  outputLines: number;
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  "package.json": <Package className="h-3 w-3" />,
  Makefile: <FileCode className="h-3 w-3" />,
  "docker-compose.yml": <Container className="h-3 w-3" />,
};

const SOURCE_COLORS: Record<string, string> = {
  "package.json": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Makefile: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "docker-compose.yml": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

function StatusDot({ status }: { status: string }) {
  if (status === "running") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
    );
  }
  if (status === "crashed") {
    return <span className="inline-flex rounded-full h-2 w-2 bg-red-400" />;
  }
  return <span className="inline-flex rounded-full h-2 w-2 bg-zinc-500" />;
}

function ProcessOutputView({ processId }: { processId: string }) {
  const { data, refetch } = useQuery<{ processOutput: { lines: string[] } }>(
    GET_PROCESS_OUTPUT,
    { variables: { processId, lastN: 200 }, fetchPolicy: "network-only" }
  );
  const outputRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    const interval = setInterval(() => refetch(), 2000);
    return () => clearInterval(interval);
  }, [refetch]);

  useEffect(() => {
    if (wasAtBottomRef.current && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [data?.processOutput?.lines]);

  const handleScroll = useCallback(() => {
    if (!outputRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
    wasAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const lines = data?.processOutput?.lines ?? [];

  return (
    <div
      ref={outputRef}
      onScroll={handleScroll}
      className="mt-2 max-h-[300px] overflow-y-auto rounded-md bg-zinc-950 border border-border/40 p-3 font-mono text-xs leading-relaxed text-zinc-300"
    >
      {lines.length === 0 ? (
        <span className="text-muted-foreground/40">No output yet</span>
      ) : (
        lines.map((line, i) => (
          <div key={i} className={line.startsWith("[stderr]") ? "text-red-400/80" : ""}>
            {line}
          </div>
        ))
      )}
    </div>
  );
}

function ProcessCard({
  process,
  projectId,
  onRefresh,
}: {
  process: ProcessInfo;
  projectId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const [stopProcess, { loading: stopping }] = useMutation(STOP_PROCESS, {
    onCompleted: () => onRefresh(),
  });
  const [restartProcess, { loading: restarting }] = useMutation(RESTART_PROCESS, {
    onCompleted: () => onRefresh(),
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <StatusDot status={process.status} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{process.name}</div>
          <div className="text-xs text-muted-foreground/60 font-mono truncate">
            {process.command}
          </div>
        </div>
        {process.pid && (
          <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
            PID {process.pid}
          </span>
        )}
        <div className="flex items-center gap-1">
          {process.status === "running" ? (
            <>
              <button
                onClick={() => restartProcess({ variables: { projectId, processId: process.id } })}
                disabled={restarting}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                title="Restart"
              >
                {restarting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
              </button>
              <button
                onClick={() => stopProcess({ variables: { processId: process.id } })}
                disabled={stopping}
                className="h-6 w-6 flex items-center justify-center rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                title="Stop"
              >
                {stopping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
              </button>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground/50 capitalize">{process.status}</span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3">
          <ProcessOutputView processId={process.id} />
        </div>
      )}
    </div>
  );
}

interface RunPanelProps {
  projectId: string;
}

export function RunPanel({ projectId }: RunPanelProps) {
  const [setupMode, setSetupMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");

  const { data: cmdData, refetch: refetchCmds } = useQuery<{ runCommands: RunCommand[] }>(
    GET_RUN_COMMANDS,
    { variables: { projectId }, fetchPolicy: "network-only" }
  );

  const { data: detectedData } = useQuery<{ detectedCommands: DetectedCommand[] }>(
    GET_DETECTED_COMMANDS,
    { variables: { projectId } }
  );

  const { data: procData, refetch: refetchProcs } = useQuery<{ processes: ProcessInfo[] }>(
    GET_PROCESSES,
    { variables: { projectId }, fetchPolicy: "network-only", pollInterval: 3000 }
  );

  const [addRunCommand] = useMutation(ADD_RUN_COMMAND, {
    onCompleted: () => {
      refetchCmds();
      setNewName("");
      setNewCommand("");
    },
  });

  const [removeRunCommand] = useMutation(REMOVE_RUN_COMMAND, {
    onCompleted: () => refetchCmds(),
  });

  const { data: envData, refetch: refetchEnvVars } = useQuery<{ envVars: EnvVar[] }>(
    GET_ENV_VARS,
    { variables: { projectId }, fetchPolicy: "network-only" }
  );

  const [setEnvVar] = useMutation(SET_ENV_VAR, {
    onCompleted: () => {
      refetchEnvVars();
      setNewEnvKey("");
      setNewEnvValue("");
    },
  });

  const [removeEnvVar] = useMutation(REMOVE_ENV_VAR, {
    onCompleted: () => refetchEnvVars(),
  });

  const [startProcess, { loading: starting }] = useMutation(START_PROCESS, {
    onCompleted: () => refetchProcs(),
  });

  const savedCommands = cmdData?.runCommands ?? [];
  const detectedCommands = detectedData?.detectedCommands ?? [];
  const processes = procData?.processes ?? [];
  const envVars = envData?.envVars ?? [];

  const handleAddCommand = () => {
    const name = newName.trim();
    const command = newCommand.trim();
    if (!name || !command) return;
    addRunCommand({ variables: { projectId, name, command } });
  };

  const handleAddEnvVar = () => {
    const key = newEnvKey.trim().toUpperCase().replace(/\s+/g, "_");
    const value = newEnvValue.trim();
    if (!key || !value) return;
    setEnvVar({ variables: { projectId, key, value } });
  };

  const handleStartDetected = (cmd: DetectedCommand) => {
    // First add as a run command, then start it
    addRunCommand({
      variables: { projectId, name: cmd.name, command: cmd.command },
    }).then(({ data }) => {
      if (data?.addRunCommand?.id) {
        startProcess({ variables: { projectId, commandId: data.addRunCommand.id } });
      }
    });
  };

  const handleStartSaved = (cmd: RunCommand) => {
    startProcess({ variables: { projectId, commandId: cmd.id } });
  };

  const runningProcessIds = new Set(
    processes.filter((p) => p.status === "running").map((p) => p.command)
  );

  const hasAnything =
    savedCommands.length > 0 || detectedCommands.length > 0 || processes.length > 0;

  return (
    <div className="space-y-5">
      {/* Running Processes */}
      {processes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Processes
            </h3>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {processes.filter((p) => p.status === "running").length} running
            </span>
          </div>
          <div className="space-y-2">
            {processes.map((proc) => (
              <ProcessCard
                key={proc.id}
                process={proc}
                projectId={projectId}
                onRefresh={refetchProcs}
              />
            ))}
          </div>
        </div>
      )}

      {/* Saved Commands */}
      {savedCommands.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Commands
            </h3>
            <button
              onClick={() => setSetupMode(!setupMode)}
              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                setupMode
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
              }`}
              title="Manage commands"
            >
              <Settings className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            {savedCommands.map((cmd) => {
              const isRunning = runningProcessIds.has(cmd.command);
              return (
                <div
                  key={cmd.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card/50 hover:bg-card transition-colors"
                >
                  <Terminal className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{cmd.name}</div>
                    <div className="text-[11px] text-muted-foreground/50 font-mono truncate">
                      {cmd.command}
                    </div>
                  </div>
                  {setupMode ? (
                    <button
                      onClick={() =>
                        removeRunCommand({ variables: { projectId, commandId: cmd.id } })
                      }
                      className="h-6 w-6 flex items-center justify-center rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartSaved(cmd)}
                      disabled={starting || isRunning}
                      className="h-6 w-6 flex items-center justify-center rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-30"
                      title={isRunning ? "Already running" : "Start"}
                    >
                      <Play className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Custom Command */}
      {setupMode && (
        <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Add command</h4>
          <input
            type="text"
            placeholder="Name (e.g. dev server)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full h-8 px-2.5 rounded-md bg-secondary border border-border text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
          />
          <input
            type="text"
            placeholder="Command (e.g. npm run dev)"
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCommand();
            }}
            className="w-full h-8 px-2.5 rounded-md bg-secondary border border-border text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
          />
          <button
            onClick={handleAddCommand}
            disabled={!newName.trim() || !newCommand.trim()}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      )}

      {/* Detected Commands */}
      {detectedCommands.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Detected
          </h3>
          <div className="space-y-1">
            {detectedCommands.map((cmd, i) => {
              const isRunning = runningProcessIds.has(cmd.command);
              const isSaved = savedCommands.some((s) => s.command === cmd.command);
              return (
                <div
                  key={`${cmd.source}-${i}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-muted/30 transition-colors"
                >
                  <span
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                      SOURCE_COLORS[cmd.source] ?? "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {SOURCE_ICONS[cmd.source] ?? <FileCode className="h-3 w-3" />}
                    {cmd.source}
                  </span>
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {cmd.name}
                  </span>
                  {!isSaved && (
                    <button
                      onClick={() => handleStartDetected(cmd)}
                      disabled={starting || isRunning}
                      className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-30"
                      title={isRunning ? "Already running" : "Start"}
                    >
                      <Play className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Environment Variables */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Environment
        </h3>
        {envVars.length > 0 && (
          <div className="space-y-1 mb-2">
            {envVars.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card/50 group"
              >
                <span className="text-xs font-mono font-medium text-emerald-400">{v.key}</span>
                <span className="text-xs text-muted-foreground/50">=</span>
                <span className="text-xs font-mono text-muted-foreground truncate flex-1">{v.value}</span>
                <button
                  onClick={() => removeEnvVar({ variables: { projectId, envVarId: v.id } })}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="KEY"
            value={newEnvKey}
            onChange={(e) => setNewEnvKey(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
            className="w-24 h-7 px-2 rounded-md bg-secondary border border-border text-xs font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
          />
          <span className="text-xs text-muted-foreground/40">=</span>
          <input
            type="text"
            placeholder="value"
            value={newEnvValue}
            onChange={(e) => setNewEnvValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddEnvVar();
            }}
            className="flex-1 h-7 px-2 rounded-md bg-secondary border border-border text-xs font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
          />
          <button
            onClick={handleAddEnvVar}
            disabled={!newEnvKey.trim() || !newEnvValue.trim()}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            Add
          </button>
        </div>
      </div>

      {/* Empty state */}
      {!hasAnything && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted border border-border flex items-center justify-center mb-4">
            <Terminal className="h-5 w-5 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-medium text-muted-foreground/70">No commands found</p>
          <p className="text-xs text-muted-foreground/40 mt-1 max-w-[220px] leading-relaxed">
            Add a package.json, Makefile, or docker-compose.yml to detect commands automatically
          </p>
          <button
            onClick={() => setSetupMode(true)}
            className="mt-4 flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add command manually
          </button>
        </div>
      )}
    </div>
  );
}
