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
import { mkdirSync, existsSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import multer from "multer";
import { SCHEMA_SQL, SQLiteProjectStore, SQLiteStore } from "@autogoals/core";
import { typeDefs, createResolvers } from "./schema/index.js";
import { AgentManager } from "./agent-manager/index.js";
import { ProcessManager } from "./process-manager/index.js";

function resolvePath(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    p = p.replace("~", homedir());
  }
  return resolve(p);
}

export interface ServerInstance {
  app: Express;
  httpServer: Server;
  db: Database.Database;
  agentManager: AgentManager;
  processManager: ProcessManager;
  start(): Promise<void>;
  stop(): Promise<void>;
}

function getDatabase(): Database.Database {
  const dir = join(homedir(), ".autogoals");
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, "db.sqlite");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);
  return db;
}

export async function createServer(port = 17891): Promise<ServerInstance> {
  const app = express();
  const httpServer = createHttpServer(app);

  const db = getDatabase();
  const agentManager = new AgentManager(() => db);
  const processManager = new ProcessManager();

  const resolvers = createResolvers(
    () => db,
    () => agentManager.getRunningIds(),
    agentManager,
    processManager,
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

  // Screenshot upload endpoint (REST, before GraphQL middleware)
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const projectId = req.params.projectId as string;
        const goalId = req.params.goalId as string;
        const projectStore = new SQLiteProjectStore(db);
        const record = projectStore.getProject(projectId);
        if (!record) return cb(new Error("Project not found"), "");
        const resolvedBase = resolvePath(record.path);
        const screenshotDir = join(resolvedBase, ".autogoals", "screenshots", goalId);
        mkdirSync(screenshotDir, { recursive: true });
        cb(null, screenshotDir);
      },
      filename: (_req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith("image/")) cb(null, true);
      else cb(new Error("Only image files allowed"));
    },
  });

  app.use(cors());

  // Serve pre-built dashboard if available
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dashboardPath = join(__dirname, "public");
  if (existsSync(dashboardPath)) {
    app.use(express.static(dashboardPath));
  }

  app.post(
    "/api/projects/:projectId/goals/:goalId/screenshots",
    upload.array("screenshots", 10),
    (req, res) => {
      const projectId = req.params.projectId as string;
      const goalId = req.params.goalId as string;
      const files = req.files as Express.Multer.File[];
      const store = new SQLiteStore(db, projectId);
      const results = files.map((f: Express.Multer.File) => store.addGoalScreenshot(goalId, f.path, f.originalname));
      res.json({ screenshots: results });
    },
  );

  // Serve screenshot files
  app.get("/api/screenshots/:projectId/:goalId/:filename", (req, res) => {
    const { projectId, goalId, filename } = req.params;
    const projectStore = new SQLiteProjectStore(db);
    const record = projectStore.getProject(projectId);
    if (!record) return res.status(404).send("Not found");
    const resolvedBase = resolvePath(record.path);
    const filePath = join(resolvedBase, ".autogoals", "screenshots", goalId, filename);
    res.sendFile(filePath);
  });

  app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(apolloServer) as unknown as express.RequestHandler,
  );

  app.get("/health", (_, res) => res.json({ status: "ok" }));

  // SPA fallback — serve index.html for all unmatched GET routes
  if (existsSync(dashboardPath)) {
    app.get("*", (_, res) => {
      res.sendFile(join(dashboardPath, "index.html"));
    });
  }

  return {
    app,
    httpServer,
    db,
    agentManager,
    processManager,
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
      processManager.stopAll();
      agentManager.stopAll();
      await apolloServer.stop();
      db.close();
    },
  };
}

