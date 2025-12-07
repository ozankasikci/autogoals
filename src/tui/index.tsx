import React, { useState, useEffect } from 'react';
import { Box, useInput, useApp } from 'ink';
import { AppState } from './types.js';
import AgentListView from './AgentListView.js';
import AgentDetailView from './AgentDetailView.js';
import { SessionManager } from '../session/SessionManager.js';

interface Props {
  projectPath: string;
  sessionManager: SessionManager;
}

export default function AutoGoalsTUI({ projectPath, sessionManager }: Props) {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>({
    agents: [],
    selectedIndex: 0,
    currentView: 'list',
  });
  const [scrollOffset, setScrollOffset] = useState(0);

  // Refresh agent state at 60fps
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        agents: sessionManager.getAgents(),
      }));
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [sessionManager]);

  // Keyboard navigation
  useInput((input, key) => {
    if (state.currentView === 'list') {
      if (key.upArrow) {
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(0, prev.selectedIndex - 1),
        }));
      } else if (key.downArrow) {
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.agents.length - 1, prev.selectedIndex + 1),
        }));
      } else if (key.return) {
        const selectedAgent = state.agents[state.selectedIndex];
        if (selectedAgent) {
          setState(prev => ({
            ...prev,
            currentView: 'detail',
            detailAgentId: selectedAgent.id,
          }));
          setScrollOffset(0);
        }
      } else if (input === 'q') {
        exit();
      }
    } else if (state.currentView === 'detail') {
      if (key.upArrow) {
        setScrollOffset(prev => Math.min(0, prev + 1));
      } else if (key.downArrow) {
        setScrollOffset(prev => Math.max(-50, prev - 1));
      } else if (key.escape || input === 'q') {
        setState(prev => ({
          ...prev,
          currentView: 'list',
          detailAgentId: undefined,
        }));
        setScrollOffset(0);
      }
    }
  });

  if (state.currentView === 'detail' && state.detailAgentId) {
    const agent = state.agents.find(a => a.id === state.detailAgentId);
    if (agent) {
      return <AgentDetailView agent={agent} scrollOffset={scrollOffset} />;
    }
  }

  return <AgentListView agents={state.agents} selectedIndex={state.selectedIndex} />;
}
