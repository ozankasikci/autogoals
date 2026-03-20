import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useApolloClient } from "@apollo/client";
import { GET_FILE_TREE, GET_FILE_CONTENT, WRITE_FILE } from "@/graphql/operations";
import hljs from "highlight.js";
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileJson,
  FileText,
  Image,
  ChevronRight,
  ChevronDown,
  Loader2,
  ArrowLeft,
  Pencil,
  Save,
  X,
} from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: string;
  size: number | null;
  children: FileNode[] | null;
}

interface FileTreeProps {
  projectId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode className="h-4 w-4 text-blue-400" />;
    case "json":
      return <FileJson className="h-4 w-4 text-yellow-400" />;
    case "md":
    case "txt":
      return <FileText className="h-4 w-4 text-muted-foreground" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "gif":
    case "webp":
      return <Image className="h-4 w-4 text-emerald-400" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function getLanguageFromPath(path: string): string | undefined {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    html: "xml",
    xml: "xml",
    md: "markdown",
    py: "python",
    rs: "rust",
    go: "go",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    yaml: "yaml",
    yml: "yaml",
    toml: "ini",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    dockerfile: "dockerfile",
  };
  return ext ? map[ext] : undefined;
}

function TreeNode({
  node,
  level,
  selectedPath,
  onSelect,
  projectId,
}: {
  node: FileNode;
  level: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  projectId: string;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const [loadedChildren, setLoadedChildren] = useState<FileNode[] | null>(node.children);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const client = useApolloClient();
  const isDirectory = node.type === "directory";
  const isSelected = node.path === selectedPath;

  // Keep loadedChildren in sync if parent re-fetches and provides new children
  useEffect(() => {
    if (node.children && node.children.length > 0) {
      setLoadedChildren(node.children);
    }
  }, [node.children]);

  const handleToggle = useCallback(async () => {
    if (!isDirectory) {
      onSelect(node.path);
      return;
    }

    const willExpand = !expanded;
    setExpanded(willExpand);

    // Lazy-load children if expanding and we don't have them yet
    if (willExpand && (!loadedChildren || loadedChildren.length === 0)) {
      // Check if the directory might actually be empty vs not-yet-loaded
      // If node.children is an empty array, it was loaded and is genuinely empty
      if (node.children && node.children.length === 0) return;

      setLoadingChildren(true);
      try {
        const { data } = await client.query<{ fileTree: FileNode[] }>({
          query: GET_FILE_TREE,
          variables: { projectId, path: node.path, depth: 2 },
          fetchPolicy: "network-only",
        });
        if (data?.fileTree) {
          setLoadedChildren(data.fileTree);
        }
      } catch {
        // Failed to load — leave empty
      }
      setLoadingChildren(false);
    }
  }, [isDirectory, expanded, loadedChildren, node.path, node.children, projectId, client, onSelect]);

  return (
    <div>
      <button
        onClick={handleToggle}
        className={`
          flex items-center gap-1.5 w-full text-left py-1 px-1.5 rounded-md transition-colors group
          ${isSelected
            ? "bg-primary/10 text-foreground"
            : "text-foreground/80 hover:bg-muted"
          }
        `}
        style={{ paddingLeft: `${level * 16 + 6}px` }}
      >
        {isDirectory ? (
          <>
            {loadingChildren ? (
              <Loader2 className="h-3 w-3 shrink-0 text-muted-foreground animate-spin" />
            ) : expanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            {expanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-amber-400" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-amber-400" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            {getFileIcon(node.name)}
          </>
        )}
        <span className="font-mono text-[13px] truncate">{node.name}</span>
        {!isDirectory && node.size != null && (
          <span className="ml-auto text-[11px] text-muted-foreground/50 tabular-nums shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatSize(node.size)}
          </span>
        )}
      </button>
      {isDirectory && expanded && loadedChildren && (
        <div>
          {loadedChildren.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FileViewer({
  projectId,
  filePath,
  onBack,
}: {
  projectId: string;
  filePath: string;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const codeRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data, loading, error, refetch } = useQuery<{
    fileContent: { path: string; content: string; size: number } | null;
  }>(GET_FILE_CONTENT, {
    variables: { projectId, path: filePath },
    fetchPolicy: "network-only",
  });

  const [writeFile, { loading: saving }] = useMutation(WRITE_FILE);

  const fileContent = data?.fileContent;

  // Highlight code when content loads or changes
  useEffect(() => {
    if (codeRef.current && fileContent && !editing) {
      codeRef.current.removeAttribute("data-highlighted");
      try {
        hljs.highlightElement(codeRef.current);
      } catch {
        // highlight.js may not support the language — that's fine
      }
    }
  }, [fileContent, editing]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editing]);

  const handleEdit = useCallback(() => {
    if (fileContent) {
      setEditContent(fileContent.content);
      setSaveError(null);
      setEditing(true);
    }
  }, [fileContent]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    try {
      await writeFile({
        variables: { projectId, path: filePath, content: editContent },
      });
      setEditing(false);
      refetch();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Failed to save file");
    }
  }, [writeFile, projectId, filePath, editContent, refetch]);

  const language = getLanguageFromPath(filePath);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading file...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to tree
        </button>
        <div className="text-sm text-red-400">
          Failed to load file: {error.message}
        </div>
      </div>
    );
  }

  if (!fileContent) {
    return (
      <div className="space-y-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to tree
        </button>
        <div className="text-sm text-muted-foreground">
          Unable to read file (binary or inaccessible).
        </div>
      </div>
    );
  }

  const lines = (editing ? editContent : fileContent.content).split("\n");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border mb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-[13px] text-foreground truncate">
            {filePath}
          </span>
          <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0">
            {formatSize(fileContent.size)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>

      {saveError && (
        <div className="text-xs text-red-400 mb-2 shrink-0">
          {saveError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border bg-[hsl(var(--card))]">
        {editing ? (
          <div className="flex min-h-full">
            {/* Line numbers for editor */}
            <div className="select-none py-2 pl-2 pr-3 text-right border-r border-border/50 shrink-0">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className="text-[11px] leading-[1.6] font-mono text-muted-foreground/40 h-[18px]"
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              spellCheck={false}
              className="flex-1 p-2 bg-transparent text-[13px] leading-[1.6] font-mono text-foreground resize-none outline-none min-h-full"
              style={{ tabSize: 2 }}
            />
          </div>
        ) : (
          <div className="flex min-h-full">
            {/* Line numbers */}
            <div className="select-none py-2 pl-2 pr-3 text-right border-r border-border/50 shrink-0">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className="text-[11px] leading-[1.6] font-mono text-muted-foreground/40 h-[18px]"
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <pre className="flex-1 p-2 overflow-x-auto m-0">
              <code
                ref={codeRef}
                className={`text-[13px] leading-[1.6] font-mono ${language ? `language-${language}` : ""}`}
                style={{ background: "transparent", padding: 0 }}
              >
                {fileContent.content}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function FileTree({ projectId }: FileTreeProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<string | null>(null);

  const { data, loading, error } = useQuery<{
    fileTree: FileNode[];
  }>(GET_FILE_TREE, {
    variables: { projectId, depth: 2 },
  });

  const handleFileSelect = useCallback((path: string) => {
    setSelectedPath(path);
    setViewingFile(path);
  }, []);

  const handleBack = useCallback(() => {
    setViewingFile(null);
  }, []);

  // File view mode
  if (viewingFile) {
    return (
      <FileViewer
        projectId={projectId}
        filePath={viewingFile}
        onBack={handleBack}
      />
    );
  }

  // Tree mode
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 py-4">
        Failed to load file tree: {error.message}
      </div>
    );
  }

  const nodes = data?.fileTree ?? [];

  if (nodes.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No files found in project directory.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          level={0}
          selectedPath={selectedPath}
          onSelect={handleFileSelect}
          projectId={projectId}
        />
      ))}
    </div>
  );
}
