export const typeDefs = `#graphql
  type Project {
    id: ID!
    name: String!
    path: String!
    phase: String!
    totalCost: Float!
    spec: Spec
    goals: [Goal!]!
    interviewNotes: [String!]!
    isRunning: Boolean!
    createdAt: String!
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
    status: String!
    retries: Int!
    costUsd: Float!
    error: String
  }

  type LogEvent {
    type: String!
    message: String!
    costUsd: Float
    timestamp: String!
    projectId: ID!
  }

  type Query {
    projects: [Project!]!
    project(id: ID!): Project
  }

  type Mutation {
    createProject(name: String!, path: String!): Project!
    deleteProject(id: ID!): Boolean!
    startAgent(projectId: ID!): Project!
    stopAgent(projectId: ID!): Project!
  }

  type Subscription {
    projectUpdated(projectId: ID!): Project!
    logEvent(projectId: ID!): LogEvent!
  }
`;
