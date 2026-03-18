import { PubSub } from "graphql-subscriptions";

export const pubsub = new PubSub();

export const EVENTS = {
  PROJECT_UPDATED: "PROJECT_UPDATED",
  LOG_EVENT: "LOG_EVENT",
  NEW_MESSAGE: "NEW_MESSAGE",
} as const;
