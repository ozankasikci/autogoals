import React from 'react';
import { Box, Text } from 'ink';
import { AgentState } from './types.js';

interface Props {
  agents: AgentState[];
  selectedIndex: number;
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

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
}

export default function AgentListView({ agents, selectedIndex }: Props) {
  const runningCount = agents.filter(a => a.status === 'running').length;
  const completedCount = agents.filter(a => a.status === 'completed').length;
  const failedCount = agents.filter(a => a.status === 'failed').length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" borderColor="cyan" flexDirection="column">
        <Box paddingX={1}>
          <Text bold>AutoGoals - Agent Monitor</Text>
        </Box>
        <Box paddingX={1} paddingY={0}>
          <Text>
            {runningCount} agents running • {completedCount} completed • {failedCount} failed
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {agents.map((agent, index) => {
          const isSelected = index === selectedIndex;
          const duration = formatDuration(agent.startedAt, agent.endedAt);

          return (
            <Box key={agent.id} flexDirection="column" marginY={0}>
              <Box>
                <Text>{isSelected ? '> ' : '  '}</Text>
                <Text bold>{agent.id}</Text>
                <Text>  </Text>
                <Text color={getStatusColor(agent.status)} bold>
                  [{agent.status.toUpperCase()}]
                </Text>
                <Text>  Goal: {agent.goalDescription}</Text>
              </Box>
              <Box paddingLeft={4}>
                <Text dimColor>
                  {agent.endedAt ? `Duration: ${duration}` : `Started: ${duration}`}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor="gray">
        <Box paddingX={1}>
          <Text dimColor>↑↓: Navigate  Enter: View logs  q: Quit</Text>
        </Box>
      </Box>
    </Box>
  );
}
