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
  START_DETECTED_PROCESS,
  STOP_PROCESS,
  REMOVE_PROCESS,
  RESTART_PROCESS,
  GET_ENV_VARS,
  SET_ENV_VAR,
  REMOVE_ENV_VAR,
  GET_DETECTED_ENV_VARS,
  GET_RUNNING_PORTS,
  KILL_PORT,
} from "@/graphql/operations";
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  Plus,
  Settings,
  ChevronDown,
  ExternalLink,
  ChevronRight,
  Loader2,
  Terminal,
  Package,
  FileCode,
  Container,
  X,
  Search,
  Wifi,
  Download,
  Skull,
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

interface DetectedEnvVar {
  key: string;
  value: string;
  source: string;
}

interface RunningPort {
  pid: number;
  port: number;
  command: string;
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

function EnvVarRow({ envVar, projectId, onRemove }: { envVar: { id: string; key: string; value: string }; projectId: string; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(envVar.value);
  const [setEnvVar] = useMutation(SET_ENV_VAR, {
    refetchQueries: [{ query: GET_ENV_VARS, variables: { projectId } }],
  });

  function save() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== envVar.value) {
      setEnvVar({ variables: { projectId, key: envVar.key, value: trimmed } });
    } else {
      setEditValue(envVar.value);
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card/50 group">
      <span className="text-xs font-mono font-medium text-emerald-400">{envVar.key}</span>
      <span className="text-xs text-muted-foreground/50">=</span>
      {editing ? (
        <input
          className="flex-1 text-xs font-mono bg-transparent text-foreground outline-none border-b border-primary/40"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") { setEditValue(envVar.value); setEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <span
          onClick={() => { setEditing(true); setEditValue(envVar.value); }}
          className="text-xs font-mono text-muted-foreground truncate flex-1 cursor-text hover:text-foreground transition-colors"
        >
          {envVar.value}
        </span>
      )}
      <button
        onClick={onRemove}
        className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
        title="Remove"
      >
        <X className="h-3 w-3" />
      </button>
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
  const [removeProcess] = useMutation(REMOVE_PROCESS, {
    onCompleted: () => onRefresh(),
  });

  // Detect port from process output
  const { data: outputData } = useQuery<{ processOutput: { lines: string[] } }>(GET_PROCESS_OUTPUT, {
    variables: { processId: process.id, lastN: 20 },
    skip: process.status !== "running",
    pollInterval: 5000,
  });
  const detectedPort = React.useMemo(() => {
    if (!outputData?.processOutput?.lines) return null;
    for (const line of outputData.processOutput.lines) {
      const match = line.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})/);
      if (match) return match[1];
    }
    return null;
  }, [outputData]);

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
          {/* Open in browser button */}
          {detectedPort && (
            <a
              href={`http://localhost:${detectedPort}`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-6 w-6 flex items-center justify-center rounded text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors"
              title={`Open localhost:${detectedPort}`}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
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
            <>
              <span className="text-[10px] text-muted-foreground/50 capitalize">{process.status}</span>
              <button
                onClick={() => removeProcess({ variables: { processId: process.id } })}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Dismiss"
              >
                <X className="h-3 w-3" />
              </button>
            </>
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

  const [showDetectedEnvVars, setShowDetectedEnvVars] = useState(false);
  const { data: detectedEnvData, refetch: refetchDetectedEnv, loading: loadingDetectedEnv } = useQuery<{ detectedEnvVars: DetectedEnvVar[] }>(
    GET_DETECTED_ENV_VARS,
    { variables: { projectId }, skip: !showDetectedEnvVars, fetchPolicy: "network-only" }
  );

  const { data: portsData, refetch: refetchPorts } = useQuery<{ runningPorts: RunningPort[] }>(
    GET_RUNNING_PORTS,
    { variables: { projectId }, fetchPolicy: "network-only", pollInterval: 5000 }
  );

  const [killPort] = useMutation(KILL_PORT, {
    onCompleted: () => refetchPorts(),
  });

  const [startProcess, { loading: startingSaved }] = useMutation(START_PROCESS, {
    onCompleted: () => refetchProcs(),
  });

  const [startDetectedProcess, { loading: startingDetected }] = useMutation(START_DETECTED_PROCESS, {
    onCompleted: () => refetchProcs(),
  });

  const starting = startingSaved || startingDetected;

  const savedCommands = cmdData?.runCommands ?? [];
  const detectedCommands = detectedData?.detectedCommands ?? [];
  const processes = procData?.processes ?? [];
  const envVars = envData?.envVars ?? [];
  const detectedEnvVars = detectedEnvData?.detectedEnvVars ?? [];
  const runningPorts = portsData?.runningPorts ?? [];

  const handleAddCommand = () => {
    const name = newName.trim();
    const command = newCommand.trim();
    if (!name || !command) return;
    addRunCommand({ variables: { projectId, name, command } });
  };

  const handleImportEnvVar = (detected: DetectedEnvVar) => {
    setEnvVar({ variables: { projectId, key: detected.key, value: detected.value } });
  };

  const handleAutoDetectEnv = () => {
    setShowDetectedEnvVars(true);
    if (showDetectedEnvVars) {
      refetchDetectedEnv();
    }
  };

  const handleAddEnvVar = () => {
    const key = newEnvKey.trim().toUpperCase().replace(/\s+/g, "_");
    const value = newEnvValue.trim();
    if (!key || !value) return;
    setEnvVar({ variables: { projectId, key, value } });
  };

  const handleStartDetected = (cmd: DetectedCommand) => {
    startDetectedProcess({
      variables: { projectId, name: cmd.name, command: cmd.command },
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

      {/* Detected Servers */}
      {runningPorts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Detected Servers
            </h3>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {runningPorts.length} port{runningPorts.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-1.5">
            {runningPorts.map((rp) => (
              <div
                key={rp.port}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card/50"
              >
                <Wifi className="h-3 w-3 text-cyan-400 shrink-0" />
                <span className="text-xs font-mono font-medium text-cyan-400 shrink-0">
                  :{rp.port}
                </span>
                <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums shrink-0">
                  PID {rp.pid}
                </span>
                <span className="text-xs text-muted-foreground font-mono truncate flex-1" title={rp.command}>
                  {rp.command.length > 60 ? rp.command.slice(0, 60) + "..." : rp.command}
                </span>
                <button
                  onClick={() => killPort({ variables: { port: rp.port } })}
                  className="h-6 w-6 flex items-center justify-center rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title={`Kill process on port ${rp.port}`}
                >
                  <Skull className="h-3 w-3" />
                </button>
              </div>
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Environment
          </h3>
          <button
            onClick={handleAutoDetectEnv}
            disabled={loadingDetectedEnv}
            className="flex items-center gap-1 h-6 px-2 rounded text-[10px] font-medium text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            title="Auto-detect env vars from project files"
          >
            {loadingDetectedEnv ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            Auto-detect
          </button>
        </div>
        {envVars.length > 0 && (
          <div className="space-y-1 mb-2">
            {envVars.map((v) => (
              <EnvVarRow key={v.id} envVar={v} projectId={projectId} onRemove={() => removeEnvVar({ variables: { projectId, envVarId: v.id } })} />
            ))}
          </div>
        )}
        {showDetectedEnvVars && detectedEnvVars.length > 0 && (
          <div className="mb-2 rounded-lg border border-dashed border-cyan-500/20 bg-cyan-500/5 p-2 space-y-1">
            <div className="text-[10px] font-medium text-cyan-400/70 mb-1.5">
              Detected from project files
            </div>
            {detectedEnvVars
              .filter((d) => !envVars.some((v) => v.key === d.key))
              .map((d) => (
                <div
                  key={`${d.source}-${d.key}`}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-cyan-500/5 transition-colors"
                >
                  <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0">{d.source}</span>
                  <span className="text-xs font-mono font-medium text-cyan-400">{d.key}</span>
                  <span className="text-xs text-muted-foreground/50">=</span>
                  <span className="text-xs font-mono text-muted-foreground truncate flex-1">{d.value}</span>
                  <button
                    onClick={() => handleImportEnvVar(d)}
                    className="flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                    title="Import this variable"
                  >
                    <Download className="h-2.5 w-2.5" />
                    Import
                  </button>
                </div>
              ))}
            {detectedEnvVars.filter((d) => !envVars.some((v) => v.key === d.key)).length === 0 && (
              <div className="text-[10px] text-muted-foreground/40 px-2 py-1">
                All detected variables are already imported
              </div>
            )}
          </div>
        )}
        {showDetectedEnvVars && !loadingDetectedEnv && detectedEnvVars.length === 0 && (
          <div className="mb-2 rounded-lg border border-dashed border-border p-2">
            <div className="text-[10px] text-muted-foreground/40 text-center py-1">
              No .env files found in project
            </div>
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
