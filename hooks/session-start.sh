#!/usr/bin/env bash
set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Check if goals.yaml exists in current project
if [ -f "goals.yaml" ]; then
  # Load orchestrator skill
  orchestrator_content=$(cat "${PLUGIN_ROOT}/skills/goal-orchestrator/SKILL.md" 2>&1 || echo "Error reading goal-orchestrator skill")

  # Escape for JSON using pure bash
  escape_for_json() {
    local input="$1"
    local output=""
    local i char
    for (( i=0; i<${#input}; i++ )); do
      char="${input:$i:1}"
      case "$char" in
        $'\\') output+='\\\\' ;;
        '"') output+='\"' ;;
        $'\n') output+='\n' ;;
        $'\r') output+='\r' ;;
        $'\t') output+='\t' ;;
        *) output+="$char" ;;
      esac
    done
    printf '%s' "$output"
  }

  orchestrator_escaped=$(escape_for_json "$orchestrator_content")

  # Output context injection as JSON
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<EXTREMELY_IMPORTANT>\n🎯 AutoGoals System Active\n\n${orchestrator_escaped}\n</EXTREMELY_IMPORTANT>"
  }
}
EOF
else
  # No goals.yaml, don't activate
  echo '{"hookSpecificOutput": null}'
fi

exit 0
