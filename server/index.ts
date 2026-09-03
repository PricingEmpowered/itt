/**
 * Price Space API server.
 *
 * One process serves both the tRPC API and, in production, the built
 * frontend, so an on-premise install is a single service behind one port
 * rather than two things to configure.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { registerAiAnalyticsRoutes } from './aiAnalytics.js';
import { closePool, pool } from './db.js';
import { registerDocumentRoutes } from './documents.js';
import { ENV } from './env.js';
import { appRouter } from './routers/index.js';
import { createContext } from './trpc.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  /**
   * Readiness probe that actually touches the database, so a misconfigured
   * DATABASE_URL shows up here instead of as a failure on every request.
   */
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(503).json({
        status: 'unavailable',
        error: err instanceof Error ? err.message : 'database unreachable',
      });
    }
  });

  registerDocumentRoutes(app);
  registerAiAnalyticsRoutes(app);

  app.use(
    '/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path: procedurePath }) {
        // Client-fault codes are expected; only log genuine server errors.
        if (error.code === 'INTERNAL_SERVER_ERROR') {
          console.error(`[trpc] ${procedurePath ?? '<no path>'}:`, error.cause ?? error);
        }
      },
    })
  );

  if (ENV.isProduction) {
    const clientDir = path.join(ROOT, 'dist');
    app.use(express.static(clientDir));
    // SPA fallback: anything not matched above renders the app shell.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  const server = app.listen(ENV.port, () => {
    console.log(`Price Space API listening on http://localhost:${ENV.port}`);
    if (!ENV.isProduction) {
      console.log('Development mode: run `npm run dev` separately for the frontend.');
    }
  });

  // Finish in-flight requests and close database connections on shutdown so
  // a restart under systemd does not drop live requests.
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down.`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
