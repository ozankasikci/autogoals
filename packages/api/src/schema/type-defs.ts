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

  type Query {
    projects: [Project!]!
    project(id: ID!): Project
    messages(projectId: ID!, limit: Int, beforeId: ID): [Message!]!
    activityEvents(projectId: ID!, limit: Int, beforeId: ID): [LogEvent!]!
    rules(projectId: ID!): [Rule!]!
    fileTree(projectId: ID!, path: String, depth: Int): [FileNode!]!
    fileContent(projectId: ID!, path: String!): FileContent
    checkpoints(projectId: ID!): [Checkpoint!]!
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
  }

  type Subscription {
    projectUpdated(projectId: ID!): Project!
    logEvent(projectId: ID!): LogEvent!
    newMessage(projectId: ID!): Message!
  }
`;
