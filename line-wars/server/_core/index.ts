import "dotenv/config";
// Ensure NODE_ENV defaults to development when not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureEnoughQuestions } from "../llm-questions";
import { generateQuestionsViaReplicate } from "../lib/replicate";
import { LineWarsWebSocketServer } from "../line-wars/websocket-server";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // OpenRouter API endpoint for question generation
  app.post("/api/generate-questions", async (req, res) => {
    try {
      const { category, difficulty, count } = req.body;
      console.log("[OpenRouter API] Request received:", { category, difficulty, count });
      const { generateQuestionsViaOpenRouter } = await import("../lib/openrouter");
      const result = await generateQuestionsViaOpenRouter(category, difficulty, count);
      console.log("[OpenRouter API] Success:", result.questions.length, "questions generated");
      res.json(result);
    } catch (error) {
      console.error("[OpenRouter API] Error generating questions:", error);
      if (error instanceof Error) {
        console.error("[OpenRouter API] Error message:", error.message);
        console.error("[OpenRouter API] Error stack:", error.stack);
      }
      res.status(500).json({ error: "Failed to generate questions", details: error instanceof Error ? error.message : String(error) });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Comment out automatic question generation to prevent slow startup
    // ensureEnoughQuestions(200).catch(console.error);
    
    // Start Line Wars WebSocket server on separate port
    const lineWarsPort = parseInt(process.env.LINE_WARS_PORT || "8080");
    try {
      const lineWarsServer = new LineWarsWebSocketServer(lineWarsPort);
      console.log(`Line Wars WebSocket server running on ws://localhost:${lineWarsPort}/`);
      
      // Graceful shutdown for Line Wars server
      process.on('SIGINT', () => {
        console.log('Shutting down Line Wars server...');
        lineWarsServer.shutdown();
      });
      process.on('SIGTERM', () => {
        console.log('Shutting down Line Wars server...');
        lineWarsServer.shutdown();
      });
    } catch (error) {
      console.error('Failed to start Line Wars server:', error);
    }
  });
}

startServer().catch(console.error);
