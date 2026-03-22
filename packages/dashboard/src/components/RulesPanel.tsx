import { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { GET_RULES, ADD_RULE, UPDATE_RULE, REMOVE_RULE, GET_PROJECT } from "@/graphql/operations";
import { X, Pencil } from "lucide-react";
import { QuickAddCard } from "./QuickAddCard";

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
    <div className="group rounded-lg border border-border bg-card hover:bg-accent/30 transition-all duration-150">
      <div className="flex items-start gap-2.5 px-3 py-3">
        {editing ? (
          <textarea
            className="flex-1 bg-transparent text-sm text-foreground outline-none border-b border-primary/40 py-0.5 resize-none min-h-[40px]"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
            }}
            onBlur={save}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <span className="flex-1 text-sm text-foreground/80 min-w-0">
            {rule.content}
          </span>
        )}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {!editing && (
            <button
              onClick={() => {
                setEditing(true);
                setValue(rule.content);
              }}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit rule"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => removeRule({ variables: { projectId, ruleId: rule.id } })}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Remove rule"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function RulesPanel({ projectId }: RulesPanelProps) {
  const { data, loading } = useQuery<{ rules: Rule[] }>(GET_RULES, {
    variables: { projectId },
  });

  const [addRule] = useMutation(ADD_RULE, {
    refetchQueries: [
      { query: GET_RULES, variables: { projectId } },
      { query: GET_PROJECT, variables: { id: projectId } },
    ],
  });

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

      <QuickAddCard
        placeholder="Add a rule... What should the agent always follow?"
        buttonLabel="Add Rule"
        onAdd={(value) => {
          addRule({ variables: { projectId, content: value } });
        }}
      />
    </div>
  );
}
