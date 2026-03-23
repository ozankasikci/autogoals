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
        recurring
        retries
        costUsd
        error
        planningMode
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
        recurring
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
  mutation UpdateGoal($projectId: ID!, $goalId: ID!, $name: String, $description: String, $approach: String, $acceptanceCriteria: [String!], $dependsOn: [ID!], $status: String, $recurring: Boolean) {
    updateGoal(projectId: $projectId, goalId: $goalId, name: $name, description: $description, approach: $approach, acceptanceCriteria: $acceptanceCriteria, dependsOn: $dependsOn, status: $status, recurring: $recurring) {
      id name description approach acceptanceCriteria dependsOn status recurring retries costUsd error
    }
  }
`;

export const ADD_GOAL = gql`
  mutation AddGoal($projectId: ID!, $name: String!, $description: String!, $acceptanceCriteria: [String!]!, $dependsOn: [ID!]!, $recurring: Boolean) {
    addGoal(projectId: $projectId, name: $name, description: $description, acceptanceCriteria: $acceptanceCriteria, dependsOn: $dependsOn, recurring: $recurring) {
      id name description acceptanceCriteria dependsOn status recurring retries costUsd
    }
  }
`;

export const REMOVE_GOAL = gql`
  mutation RemoveGoal($projectId: ID!, $goalId: ID!) {
    removeGoal(projectId: $projectId, goalId: $goalId)
  }
`;

export const REFINE_GOAL = gql`
  mutation RefineGoal($projectId: ID!, $goalId: ID!, $mode: String) {
    refineGoal(projectId: $projectId, goalId: $goalId, mode: $mode) {
      id name status approach planningMode
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

export const GET_CHECKPOINTS = gql`
  query GetCheckpoints($projectId: ID!) {
    checkpoints(projectId: $projectId) {
      id
      goalId
      goalName
      commitHash
      tag
      message
      createdAt
    }
  }
`;

export const RESTORE_CHECKPOINT = gql`
  mutation RestoreCheckpoint($projectId: ID!, $tag: String!) {
    restoreCheckpoint(projectId: $projectId, tag: $tag)
  }
`;

export const GET_RUN_COMMANDS = gql`
  query GetRunCommands($projectId: ID!) {
    runCommands(projectId: $projectId) {
      id
      name
      command
      autoStart
    }
  }
`;

export const GET_DETECTED_COMMANDS = gql`
  query GetDetectedCommands($projectId: ID!) {
    detectedCommands(projectId: $projectId) {
      name
      command
      source
    }
  }
`;

export const GET_PROCESSES = gql`
  query GetProcesses($projectId: ID!) {
    processes(projectId: $projectId) {
      id
      name
      command
      pid
      status
      startedAt
      outputLines
    }
  }
`;

export const GET_PROCESS_OUTPUT = gql`
  query GetProcessOutput($processId: ID!, $lastN: Int) {
    processOutput(processId: $processId, lastN: $lastN) {
      lines
    }
  }
`;

export const ADD_RUN_COMMAND = gql`
  mutation AddRunCommand($projectId: ID!, $name: String!, $command: String!) {
    addRunCommand(projectId: $projectId, name: $name, command: $command) {
      id
      name
      command
      autoStart
    }
  }
`;

export const REMOVE_RUN_COMMAND = gql`
  mutation RemoveRunCommand($projectId: ID!, $commandId: ID!) {
    removeRunCommand(projectId: $projectId, commandId: $commandId)
  }
`;

export const UPDATE_RUN_COMMAND = gql`
  mutation UpdateRunCommand($projectId: ID!, $commandId: ID!, $name: String, $command: String) {
    updateRunCommand(projectId: $projectId, commandId: $commandId, name: $name, command: $command) {
      id
      name
      command
      autoStart
    }
  }
`;

export const START_PROCESS = gql`
  mutation StartProcess($projectId: ID!, $commandId: ID!) {
    startProcess(projectId: $projectId, commandId: $commandId) {
      id
      name
      command
      pid
      status
      startedAt
      outputLines
    }
  }
`;

export const STOP_PROCESS = gql`
  mutation StopProcess($processId: ID!) {
    stopProcess(processId: $processId)
  }
`;

export const RESTART_PROCESS = gql`
  mutation RestartProcess($projectId: ID!, $processId: ID!) {
    restartProcess(projectId: $projectId, processId: $processId) {
      id
      name
      command
      pid
      status
      startedAt
      outputLines
    }
  }
`;

export const GET_ENV_VARS = gql`
  query GetEnvVars($projectId: ID!) {
    envVars(projectId: $projectId) {
      id
      key
      value
    }
  }
`;

export const SET_ENV_VAR = gql`
  mutation SetEnvVar($projectId: ID!, $key: String!, $value: String!) {
    setEnvVar(projectId: $projectId, key: $key, value: $value) {
      id
      key
      value
    }
  }
`;

export const REMOVE_ENV_VAR = gql`
  mutation RemoveEnvVar($projectId: ID!, $envVarId: ID!) {
    removeEnvVar(projectId: $projectId, envVarId: $envVarId)
  }
`;

export const GET_DETECTED_ENV_VARS = gql`
  query GetDetectedEnvVars($projectId: ID!) {
    detectedEnvVars(projectId: $projectId) { key value source }
  }
`;

export const GET_RUNNING_PORTS = gql`
  query GetRunningPorts($projectId: ID!) {
    runningPorts(projectId: $projectId) { pid port command }
  }
`;

export const START_DETECTED_PROCESS = gql`
  mutation StartDetectedProcess($projectId: ID!, $name: String!, $command: String!) {
    startDetectedProcess(projectId: $projectId, name: $name, command: $command) {
      id
      name
      command
      pid
      status
      startedAt
      outputLines
    }
  }
`;

export const REMOVE_PROCESS = gql`
  mutation RemoveProcess($processId: ID!) {
    removeProcess(processId: $processId)
  }
`;

export const OPEN_IN_FINDER = gql`
  mutation OpenInFinder($projectId: ID!) {
    openInFinder(projectId: $projectId)
  }
`;

export const KILL_PORT = gql`
  mutation KillPort($port: Int!) {
    killPort(port: $port)
  }
`;

export const GET_GOAL_SCREENSHOTS = gql`
  query GetGoalScreenshots($projectId: ID!, $goalId: ID!) {
    goalScreenshots(projectId: $projectId, goalId: $goalId) {
      id
      filePath
      fileName
    }
  }
`;

export const REMOVE_GOAL_SCREENSHOT = gql`
  mutation RemoveGoalScreenshot($projectId: ID!, $screenshotId: ID!) {
    removeGoalScreenshot(projectId: $projectId, screenshotId: $screenshotId)
  }
`;

export const AUTO_SETUP_PROJECT = gql`
  mutation AutoSetupProject($projectId: ID!) {
    autoSetupProject(projectId: $projectId)
  }
`;

export const GET_GLOBAL_RULES = gql`
  query GetGlobalRules {
    globalRules { id content }
  }
`;

export const ADD_GLOBAL_RULE = gql`
  mutation AddGlobalRule($content: String!) {
    addGlobalRule(content: $content) { id content }
  }
`;

export const UPDATE_GLOBAL_RULE = gql`
  mutation UpdateGlobalRule($ruleId: ID!, $content: String!) {
    updateGlobalRule(ruleId: $ruleId, content: $content) { id content }
  }
`;

export const REMOVE_GLOBAL_RULE = gql`
  mutation RemoveGlobalRule($ruleId: ID!) {
    removeGlobalRule(ruleId: $ruleId)
  }
`;
