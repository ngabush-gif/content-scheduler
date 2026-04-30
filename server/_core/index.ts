import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startResilientScheduler } from "../jobs/resilientScheduler";
import { registerScheduledPublishEndpoint } from "../scheduledPublishEndpoint";
  // Note: The scheduled publish endpoint is kept as a fallback for manual triggering

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
  console.log('[Startup] Initializing Express app...');
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Scheduled publish endpoint for external scheduler
  registerScheduledPublishEndpoint(app);
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

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Hybrid scheduling architecture:
    // 1. PRIMARY: External cron calls /api/scheduled/publish-due-posts every 5 minutes (guaranteed execution)
    // 2. FALLBACK: Internal scheduler runs every 60 seconds when app is active (catches posts if cron fails)
    
    console.log('[Server] 🔄 Hybrid scheduler enabled:');
    console.log('[Server]   PRIMARY: External cron → /api/scheduled/publish-due-posts (every 5 minutes)');
    console.log('[Server]   FALLBACK: Internal scheduler (every 60 seconds when app is active)');
    
    // Start internal scheduler as fallback
    startResilientScheduler();
    console.log('[Server] ✓ Fallback scheduler started');
  });
}

// Add explicit error handling to catch startup errors
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('[Startup] Starting server...');
startServer().catch((error) => {
  console.error('[FATAL] Failed to start server:', error);
  process.exit(1);
});
