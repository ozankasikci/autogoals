import { useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_FILE_TREE } from "@/graphql/operations";
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

function TreeNode({
  node,
  level,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  level: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const isDirectory = node.type === "directory";
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <button
        onClick={() => {
          if (isDirectory) {
            setExpanded((prev) => !prev);
          } else {
            onSelect(node.path);
          }
        }}
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
            {expanded ? (
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
      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ projectId }: FileTreeProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const { data, loading, error } = useQuery<{
    fileTree: FileNode[];
  }>(GET_FILE_TREE, {
    variables: { projectId, depth: 3 },
  });

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
          onSelect={setSelectedPath}
        />
      ))}
    </div>
  );
}
