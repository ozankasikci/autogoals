import { gql } from "@apollo/client";

export const GET_PROJECTS = gql`
  query GetProjects {
    projects {
      id
      name
      path
      phase
      totalCost
      isRunning
      createdAt
      goals {
        id
        name
        status
      }
    }
  }
`;

export const GET_PROJECT = gql`
  query GetProject($id: ID!) {
    project(id: $id) {
      id
      name
      path
      phase
      totalCost
      isRunning
      createdAt
      spec {
        overview
        goals {
          id
          name
          description
          acceptanceCriteria
          dependsOn
        }
        technicalDecisions
      }
      goals {
        id
        name
        description
        approach
        acceptanceCriteria
        dependsOn
        status
        retries
        costUsd
        error
      }
      rules {
        id
        content
      }
      interviewNotes
    }
  }
`;

export const CREATE_PROJECT = gql`
  mutation CreateProject($name: String!, $path: String!) {
    createProject(name: $name, path: $path) {
      id
      name
      path
    }
  }
`;

export const DELETE_PROJECT = gql`
  mutation DeleteProject($id: ID!) {
    deleteProject(id: $id)
  }
`;

export const START_AGENT = gql`
  mutation StartAgent($projectId: ID!) {
    startAgent(projectId: $projectId) {
      id
      isRunning
    }
  }
`;

export const STOP_AGENT = gql`
  mutation StopAgent($projectId: ID!) {
    stopAgent(projectId: $projectId) {
      id
      isRunning
    }
  }
`;

export const START_ALL_AGENTS = gql`
  mutation StartAllAgents {
    startAllAgents {
      id
      isRunning
    }
  }
`;

export const STOP_ALL_AGENTS = gql`
  mutation StopAllAgents {
    stopAllAgents {
      id
      isRunning
    }
  }
`;

export const PROJECT_UPDATED = gql`
  subscription ProjectUpdated($projectId: ID!) {
    projectUpdated(projectId: $projectId) {
      id
      phase
      totalCost
      isRunning
      goals {
        id
        name
        status
        costUsd
      }
    }
  }
`;

export const LOG_EVENTS = gql`
  subscription LogEvents($projectId: ID!) {
    logEvent(projectId: $projectId) {
      type
      message
      costUsd
      timestamp
      projectId
    }
  }
`;

export const GET_ACTIVITY = gql`
  query GetActivity($projectId: ID!, $limit: Int, $beforeId: ID) {
    activityEvents(projectId: $projectId, limit: $limit, beforeId: $beforeId) {
      id
      type
      message
      costUsd
      timestamp
      projectId
    }
  }
`;

export const GET_MESSAGES = gql`
  query GetMessages($projectId: ID!, $limit: Int, $beforeId: ID) {
    messages(projectId: $projectId, limit: $limit, beforeId: $beforeId) {
      id
      role
      content
      read
      createdAt
    }
  }
`;

export const SEND_MESSAGE = gql`
  mutation SendMessage($projectId: ID!, $content: String!) {
    sendMessage(projectId: $projectId, content: $content) {
      id
      role
      content
      createdAt
    }
  }
`;

export const NEW_MESSAGE = gql`
  subscription NewMessage($projectId: ID!) {
    newMessage(projectId: $projectId) {
      id
      role
      content
      read
      createdAt
    }
  }
`;

export const UPDATE_SPEC = gql`
  mutation UpdateSpec($projectId: ID!, $overview: String!, $technicalDecisions: [String!]!) {
    updateSpec(projectId: $projectId, overview: $overview, technicalDecisions: $technicalDecisions) {
      overview
      technicalDecisions
    }
  }
`;

export const UPDATE_GOAL = gql`
  mutation UpdateGoal($projectId: ID!, $goalId: ID!, $name: String, $description: String, $approach: String, $acceptanceCriteria: [String!], $dependsOn: [ID!], $status: String) {
    updateGoal(projectId: $projectId, goalId: $goalId, name: $name, description: $description, approach: $approach, acceptanceCriteria: $acceptanceCriteria, dependsOn: $dependsOn, status: $status) {
      id name description approach acceptanceCriteria dependsOn status retries costUsd error
    }
  }
`;

export const ADD_GOAL = gql`
  mutation AddGoal($projectId: ID!, $name: String!, $description: String!, $acceptanceCriteria: [String!]!, $dependsOn: [ID!]!) {
    addGoal(projectId: $projectId, name: $name, description: $description, acceptanceCriteria: $acceptanceCriteria, dependsOn: $dependsOn) {
      id name description acceptanceCriteria dependsOn status retries costUsd
    }
  }
`;

export const REMOVE_GOAL = gql`
  mutation RemoveGoal($projectId: ID!, $goalId: ID!) {
    removeGoal(projectId: $projectId, goalId: $goalId)
  }
`;

export const REFINE_GOAL = gql`
  mutation RefineGoal($projectId: ID!, $goalId: ID!) {
    refineGoal(projectId: $projectId, goalId: $goalId) {
      id name status approach
    }
  }
`;

export const APPROVE_GOAL = gql`
  mutation ApproveGoal($projectId: ID!, $goalId: ID!, $startImmediately: Boolean) {
    approveGoal(projectId: $projectId, goalId: $goalId, startImmediately: $startImmediately) {
      id name status
    }
  }
`;

export const GET_RULES = gql`
  query GetRules($projectId: ID!) {
    rules(projectId: $projectId) { id content }
  }
`;

export const ADD_RULE = gql`
  mutation AddRule($projectId: ID!, $content: String!) {
    addRule(projectId: $projectId, content: $content) { id content }
  }
`;

export const UPDATE_RULE = gql`
  mutation UpdateRule($projectId: ID!, $ruleId: ID!, $content: String!) {
    updateRule(projectId: $projectId, ruleId: $ruleId, content: $content) { id content }
  }
`;

export const REMOVE_RULE = gql`
  mutation RemoveRule($projectId: ID!, $ruleId: ID!) {
    removeRule(projectId: $projectId, ruleId: $ruleId)
  }
`;

export const GET_FILE_TREE = gql`
  query GetFileTree($projectId: ID!, $path: String, $depth: Int) {
    fileTree(projectId: $projectId, path: $path, depth: $depth) {
      name
      path
      type
      size
      children {
        name
        path
        type
        size
        children {
          name
          path
          type
          size
        }
      }
    }
  }
`;

export const GET_FILE_CONTENT = gql`
  query GetFileContent($projectId: ID!, $path: String!) {
    fileContent(projectId: $projectId, path: $path) {
      path
      content
      size
    }
  }
`;

export const WRITE_FILE = gql`
  mutation WriteFile($projectId: ID!, $path: String!, $content: String!) {
    writeFile(projectId: $projectId, path: $path, content: $content) {
      path
      content
      size
    }
  }
`;
