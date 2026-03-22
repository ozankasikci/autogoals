export const typeDefs = `#graphql
  type Project {
    id: ID!
    name: String!
    path: String!
    phase: String!
    totalCost: Float!
    spec: Spec
    goals: [Goal!]!
    rules: [Rule!]!
    interviewNotes: [String!]!
    isRunning: Boolean!
    createdAt: String!
  }

  type Rule {
    id: ID!
    content: String!
  }

  type Spec {
    overview: String!
    goals: [SpecGoal!]!
    technicalDecisions: [String!]!
  }

  type SpecGoal {
    id: ID!
    name: String!
    description: String!
    acceptanceCriteria: [String!]!
    dependsOn: [ID!]!
  }

  type Goal {
    id: ID!
    name: String!
    description: String!
    approach: String
    acceptanceCriteria: [String!]!
    dependsOn: [ID!]!
    status: String!
    recurring: Boolean!
    retries: Int!
    costUsd: Float!
    error: String
  }

  type LogEvent {
    id: ID
    type: String!
    message: String!
    costUsd: Float
    timestamp: String!
    projectId: ID!
  }

  type Message {
    id: ID!
    role: String!
    content: String!
    read: Boolean!
    createdAt: String!
  }

  type FileNode {
    name: String!
    path: String!
    type: String!
    size: Int
    children: [FileNode!]
  }

  type FileContent {
    path: String!
    content: String!
    size: Int!
  }

  type Checkpoint {
    id: ID!
    goalId: ID
    goalName: String!
    commitHash: String!
    tag: String!
    message: String!
    createdAt: String!
  }

  type RunCommand {
    id: ID!
    name: String!
    command: String!
    autoStart: Boolean!
  }

  type EnvVar {
    id: ID!
    key: String!
    value: String!
  }

  type DetectedCommand {
    name: String!
    command: String!
    source: String!
  }

  type ProcessInfo {
    id: ID!
    name: String!
    command: String!
    pid: Int
    status: String!
    startedAt: String
    outputLines: Int!
  }

  type ProcessOutput {
    lines: [String!]!
  }

  type DetectedEnvVar {
    key: String!
    value: String!
    source: String!
  }

  type RunningPort {
    pid: Int!
    port: Int!
    command: String!
  }

  type Query {
    projects: [Project!]!
    project(id: ID!): Project
    messages(projectId: ID!, limit: Int, beforeId: ID): [Message!]!
    activityEvents(projectId: ID!, limit: Int, beforeId: ID): [LogEvent!]!
    rules(projectId: ID!): [Rule!]!
    fileTree(projectId: ID!, path: String, depth: Int): [FileNode!]!
    fileContent(projectId: ID!, path: String!): FileContent
    checkpoints(projectId: ID!): [Checkpoint!]!
    runCommands(projectId: ID!): [RunCommand!]!
    detectedCommands(projectId: ID!): [DetectedCommand!]!
    envVars(projectId: ID!): [EnvVar!]!
    processes(projectId: ID!): [ProcessInfo!]!
    processOutput(processId: ID!, lastN: Int): ProcessOutput!
    detectedEnvVars(projectId: ID!): [DetectedEnvVar!]!
    runningPorts(projectId: ID!): [RunningPort!]!
  }

  type Mutation {
    createProject(name: String!, path: String!): Project!
    deleteProject(id: ID!): Boolean!
    startAgent(projectId: ID!): Project!
    stopAgent(projectId: ID!): Project!
    startAllAgents: [Project!]!
    stopAllAgents: [Project!]!
    sendMessage(projectId: ID!, content: String!): Message!
    updateSpec(projectId: ID!, overview: String!, technicalDecisions: [String!]!): Spec!
    updateGoal(projectId: ID!, goalId: ID!, name: String, description: String, approach: String, acceptanceCriteria: [String!], dependsOn: [ID!], status: String, recurring: Boolean): Goal!
    addGoal(projectId: ID!, name: String!, description: String!, acceptanceCriteria: [String!]!, dependsOn: [ID!]!, recurring: Boolean): Goal!
    refineGoal(projectId: ID!, goalId: ID!): Goal!
    approveGoal(projectId: ID!, goalId: ID!, startImmediately: Boolean): Goal!
    removeGoal(projectId: ID!, goalId: ID!): Boolean!
    addRule(projectId: ID!, content: String!): Rule!
    updateRule(projectId: ID!, ruleId: ID!, content: String!): Rule!
    removeRule(projectId: ID!, ruleId: ID!): Boolean!
    writeFile(projectId: ID!, path: String!, content: String!): FileContent!
    restoreCheckpoint(projectId: ID!, tag: String!): Boolean!
    addRunCommand(projectId: ID!, name: String!, command: String!): RunCommand!
    updateRunCommand(projectId: ID!, commandId: ID!, name: String, command: String, autoStart: Boolean): RunCommand!
    removeRunCommand(projectId: ID!, commandId: ID!): Boolean!
    setEnvVar(projectId: ID!, key: String!, value: String!): EnvVar!
    removeEnvVar(projectId: ID!, envVarId: ID!): Boolean!
    startProcess(projectId: ID!, commandId: ID!): ProcessInfo!
    startDetectedProcess(projectId: ID!, name: String!, command: String!): ProcessInfo!
    stopProcess(processId: ID!): Boolean!
    removeProcess(processId: ID!): Boolean!
    restartProcess(projectId: ID!, processId: ID!): ProcessInfo!
    openInFinder(projectId: ID!): Boolean!
    killPort(port: Int!): Boolean!
  }

  type Subscription {
    projectUpdated(projectId: ID!): Project!
    logEvent(projectId: ID!): LogEvent!
    newMessage(projectId: ID!): Message!
  }
`;
