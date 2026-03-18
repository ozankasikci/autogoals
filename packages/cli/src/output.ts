export function printBanner(): string {
  return `
 Small Singularity
 Autonomous Project Agent
`;
}

export function printPhaseHeader(phase: string): string {
  const name = phase.charAt(0).toUpperCase() + phase.slice(1);
  return `\n--- ${name} ${"─".repeat(50 - name.length)}`;
}
