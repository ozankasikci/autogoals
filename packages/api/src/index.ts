import express, { type Express } from "express";
import cors from "cors";
import { createServer as createHttpServer, type Server } from "http";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/use/ws";
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { SCHEMA_SQL } from "@small-singularity/core";
import { typeDefs, createResolvers } from "./schema/index.js";
import { AgentManager } from "./agent-manager/index.js";

export interface ServerInstance {
  app: Express;
  httpServer: Server;
  db: Database.Database;
  agentManager: AgentManager;
  start(): Promise<void>;
  stop(): Promise<void>;
}

function getDatabase(): Database.Database {
  const dir = join(homedir(), ".small-singularity");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "db.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return db;
}

export async function createServer(port = 4000): Promise<ServerInstance> {
  const app = express();
  const httpServer = createHttpServer(app);

  const db = getDatabase();
  const agentManager = new AgentManager(() => db);

  const resolvers = createResolvers(
    () => db,
    () => agentManager.getRunningIds(),
    agentManager,
  );

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });
  const serverCleanup = useServer({ schema }, wsServer);

  const apolloServer = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await apolloServer.start();

  app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(apolloServer) as unknown as express.RequestHandler,
  );

  app.get("/health", (_, res) => res.json({ status: "ok" }));

  return {
    app,
    httpServer,
    db,
    agentManager,
    async start() {
      return new Promise<void>((resolve) => {
        httpServer.listen(port, () => {
          console.log(`API server at http://localhost:${port}/graphql`);
          console.log(`Subscriptions at ws://localhost:${port}/graphql`);
          resolve();
        });
      });
    },
    async stop() {
      agentManager.stopAll();
      await apolloServer.stop();
      db.close();
    },
  };
}

// Auto-start if run directly
if (process.argv[1] && !process.argv[1].includes("vitest")) {
  createServer().then(({ start }) => start());
}
