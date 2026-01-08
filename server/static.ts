import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "../dist/public");
  if (!fs.existsSync(distPath)) {
    console.log(`Warning: Public directory not found at ${distPath}, skipping static file serving`);
    return;
  }

  app.use(express.static(distPath));

  // SPA fallback: serve index.html for non-API routes only
  // This prevents the catch-all from intercepting /api/* routes
  app.use("*", (req, res, next) => {
    // Don't intercept API routes - let them 404 naturally
    if (req.originalUrl.startsWith('/api/') ||
        req.originalUrl.startsWith('/shopping/') ||
        req.originalUrl.startsWith('/cinema/') ||
        req.originalUrl.startsWith('/attractions/') ||
        req.originalUrl.startsWith('/activities/') ||
        req.originalUrl.startsWith('/nightin/') ||
        req.originalUrl.startsWith('/hintsandtips/') ||
        req.originalUrl.startsWith('/sunny/') ||
        req.originalUrl === '/healthz') {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
