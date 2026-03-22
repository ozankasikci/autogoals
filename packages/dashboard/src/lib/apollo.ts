import { ApolloClient, InMemoryCache, split, HttpLink } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

const apiPort = (import.meta as any).env?.VITE_API_PORT || "4000";

const httpLink = new HttpLink({
  uri: `http://localhost:${apiPort}/graphql`,
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: `ws://localhost:${apiPort}/graphql`,
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
