import React from 'react';
import { Box, Text } from 'ink';
import { AgentState } from './types.js';

interface Props {
  agent: AgentState;
  scrollOffset: number;
}

function getStatusColor(status: AgentState['status']): string {
  switch (status) {
    case 'running': return 'green';
    case 'completed': return 'gray';
    case 'failed': return 'red';
    case 'paused': return 'yellow';
  }
}

function formatDuration(start: Date, end?: Date): string {
  const endTime = end || new Date();
  const diff = Math.floor((endTime.getTime() - start.getTime()) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

export default function AgentDetailView({ agent, scrollOffset }: Props) {
  const duration = formatDuration(agent.startedAt, agent.endedAt);

  // Get visible log lines (last 20 lines, accounting for scroll)
  const visibleLines = agent.logBuffer.slice(
    Math.max(0, agent.logBuffer.length - 20 + scrollOffset),
    agent.logBuffer.length + scrollOffset
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" borderColor="cyan" flexDirection="column">
        <Box paddingX={1}>
          <Text bold>Agent #{agent.id} - {agent.goalDescription}</Text>
        </Box>
        <Box paddingX={1}>
          <Text>
            Status: <Text color={getStatusColor(agent.status)}>{agent.status.toUpperCase()}</Text>
            {' • '}
            {agent.endedAt ? `Duration: ${duration}` : `Started: ${duration} ago`}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1} height="100%">
        {visibleLines.length === 0 ? (
          <Text dimColor>No output yet...</Text>
        ) : (
          visibleLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))
        )}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor="gray">
        <Box paddingX={1}>
          <Text dimColor>↑↓: Scroll  Esc/q: Back to list</Text>
        </Box>
      </Box>
    </Box>
  );
}
