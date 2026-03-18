import type { Spec, SpecGoal } from "@small-singularity/core";

export function parseSpec(markdown: string): Spec {
  const overview = extractSection(markdown, "## Overview", "##") ?? "";
  const goalsSection = extractSection(markdown, "## Goals", "## Technical") ?? "";
  const techSection = extractSection(markdown, "## Technical Decisions", null) ?? "";

  const goals = parseGoals(goalsSection);
  const technicalDecisions = techSection
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());

  return { overview: overview.trim(), goals, technicalDecisions };
}

function extractSection(
  markdown: string,
  startMarker: string,
  endMarker: string | null
): string | null {
  const startIdx = markdown.indexOf(startMarker);
  if (startIdx === -1) return null;
  const contentStart = startIdx + startMarker.length;
  if (endMarker === null) {
    return markdown.slice(contentStart);
  }
  const endIdx = markdown.indexOf(endMarker, contentStart);
  if (endIdx === -1) return markdown.slice(contentStart);
  return markdown.slice(contentStart, endIdx);
}

function parseGoals(section: string): SpecGoal[] {
  const goals: SpecGoal[] = [];
  const goalBlocks = section.split(/### Goal /);

  for (const block of goalBlocks) {
    if (!block.trim()) continue;

    const firstLine = block.split("\n")[0];
    const match = firstLine.match(/^(\S+):\s*(.+)/);
    if (!match) continue;

    const id = match[1];
    const name = match[2].trim();
    const description = extractGoalDescription(block);
    const acceptanceCriteria = extractListAfter(block, "**Acceptance Criteria:**");
    const dependsOn = extractDependsOn(block);

    goals.push({ id, name, description, acceptanceCriteria, dependsOn });
  }

  return goals;
}

function extractGoalDescription(block: string): string {
  const lines = block.split("\n").slice(1);
  const descLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("**")) break;
    if (line.trim()) descLines.push(line.trim());
  }
  return descLines.join(" ");
}

function extractListAfter(block: string, marker: string): string[] {
  const idx = block.indexOf(marker);
  if (idx === -1) return [];
  const after = block.slice(idx + marker.length);
  const items: string[] = [];
  for (const line of after.split("\n")) {
    if (line.startsWith("- ")) {
      items.push(line.slice(2).trim());
    } else if (line.startsWith("**") || (line.startsWith("###") && items.length > 0)) {
      break;
    }
  }
  return items;
}

function extractDependsOn(block: string): string[] {
  const match = block.match(/\*\*Depends on:\*\*\s*(.+)/);
  if (!match) return [];
  return match[1].split(",").map((s) => s.trim());
}
