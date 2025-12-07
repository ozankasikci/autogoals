import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  projectPath: string;
}

export default function AutoGoalsTUI({ projectPath }: Props) {
  return (
    <Box flexDirection="column">
      <Text>AutoGoals TUI - {projectPath}</Text>
    </Box>
  );
}
