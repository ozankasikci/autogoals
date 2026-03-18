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
        status
        retries
        costUsd
        error
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
