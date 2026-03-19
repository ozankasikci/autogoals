import { useState, useRef } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_RULES, ADD_RULE, UPDATE_RULE, REMOVE_RULE, GET_PROJECT } from "@/graphql/operations";
import { X } from "lucide-react";

interface Rule {
  id: string;
  content: string;
}

interface RulesPanelProps {
  projectId: string;
}

function RuleRow({
  rule,
  projectId,
}: {
  rule: Rule;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(rule.content);
  const inputRef = useRef<HTMLInputElement>(null);

  const [updateRule] = useMutation(UPDATE_RULE, {
    refetchQueries: [
      { query: GET_RULES, variables: { projectId } },
      { query: GET_PROJECT, variables: { id: projectId } },
    ],
  });

  const [removeRule] = useMutation(REMOVE_RULE, {
    refetchQueries: [
      { query: GET_RULES, variables: { projectId } },
      { query: GET_PROJECT, variables: { id: projectId } },
    ],
  });

  function save() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== rule.content) {
      updateRule({
        variables: { projectId, ruleId: rule.id, content: trimmed },
      });
    } else {
      setValue(rule.content);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      setValue(rule.content);
      setEditing(false);
    }
  }

  return (
    <div className="group flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
      <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
      {editing ? (
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-primary/40 py-0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <span
          className="flex-1 text-sm text-foreground/80 cursor-pointer py-0.5"
          onClick={() => {
            setEditing(true);
            setValue(rule.content);
          }}
        >
          {rule.content}
        </span>
      )}
      <button
        onClick={() => removeRule({ variables: { projectId, ruleId: rule.id } })}
        className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground hover:bg-muted transition-all"
        title="Remove rule"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function RulesPanel({ projectId }: RulesPanelProps) {
  const [newRule, setNewRule] = useState("");

  const { data, loading } = useQuery<{ rules: Rule[] }>(GET_RULES, {
    variables: { projectId },
  });

  const [addRule] = useMutation(ADD_RULE, {
    refetchQueries: [
      { query: GET_RULES, variables: { projectId } },
      { query: GET_PROJECT, variables: { id: projectId } },
    ],
  });

  function handleAdd() {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    addRule({ variables: { projectId, content: trimmed } });
    setNewRule("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  const rules = data?.rules ?? [];

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground py-2">Loading rules...</p>
    );
  }

  return (
    <div className="space-y-2">
      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground py-2">
          No rules yet. Add rules to guide how the agent works.
        </p>
      )}

      {rules.map((rule) => (
        <RuleRow key={rule.id} rule={rule} projectId={projectId} />
      ))}

      <div className="pt-1">
        <input
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none border-b border-border focus:border-primary/40 py-1.5 px-2 transition-colors"
          placeholder="Add a rule..."
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
