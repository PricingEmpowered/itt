/**
 * Document storage on the local filesystem.
 *
 * Replaces Supabase Storage. Only metadata lives in the database
 * (`pricing_documents`); the bytes are written under DOCUMENT_ROOT on the
 * server's own disk, which is what an on-premise install wants anyway.
 *
 * These are plain Express routes rather than tRPC procedures because tRPC
 * carries JSON, and base64-ing file bodies through it would inflate every
 * upload by a third for no benefit.
 */
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import express from 'express';
import { asOwner, asUser } from './db.js';
import { ENV } from './env.js';
import { readSession } from './session.js';

/** Uploads are capped well below the body limit to bound disk use per file. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const DOCUMENT_ROOT = path.resolve(ENV.documentRoot);

/**
 * Derives a safe extension from the client's filename. The stored name is
 * generated here, so the client never influences the path -- only the
 * trailing extension, and only from a conservative character set.
 */
function safeExtension(fileName: string): string {
  const ext = path.extname(fileName).slice(0, 12);
  return /^\.[A-Za-z0-9]+$/.test(ext) ? ext.toLowerCase() : '';
}

/**
 * Resolves a stored relative path inside DOCUMENT_ROOT, refusing anything
 * that escapes it. Paths come from the database, but a traversal check is
 * cheap insurance against a bad row.
 */
function resolveWithinRoot(relativePath: string): string | null {
  const resolved = path.resolve(DOCUMENT_ROOT, relativePath);
  const prefix = DOCUMENT_ROOT + path.sep;
  return resolved === DOCUMENT_ROOT || resolved.startsWith(prefix) ? resolved : null;
}

async function requireUser(req: Request, res: Response): Promise<string | null> {
  const session = await readSession(req);
  if (!session) {
    res.status(401).json({ error: 'Not signed in' });
    return null;
  }
  const user = await asOwner(async (db) => {
    const { rows } = await db.query<{ id: string }>(
      'SELECT id FROM auth.users WHERE id = $1 AND is_active',
      [session.userId]
    );
    return rows[0] ?? null;
  });
  if (!user) {
    res.status(401).json({ error: 'Account is no longer active' });
    return null;
  }
  return user.id;
}

export function registerDocumentRoutes(app: Express): void {
  /**
   * Upload. The body is the file itself; metadata arrives as query
   * parameters, so no multipart parser (and no extra dependency) is needed.
   */
  app.post(
    '/api/documents',
    express.raw({ type: '*/*', limit: MAX_UPLOAD_BYTES }),
    async (req: Request, res: Response) => {
      const userId = await requireUser(req, res);
      if (!userId) return;

      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: 'Empty upload' });
        return;
      }

      const fileName = String(req.query.fileName ?? '').slice(0, 255);
      if (!fileName) {
        res.status(400).json({ error: 'fileName is required' });
        return;
      }
      const category = String(req.query.category ?? 'other').slice(0, 50);
      const description = req.query.description ? String(req.query.description).slice(0, 2000) : null;
      const fileType = req.headers['content-type'] ?? 'application/octet-stream';

      // Stored path is server-generated: <userId>/<uuid><ext>
      const relativePath = path.join(userId, `${randomUUID()}${safeExtension(fileName)}`);
      const absolutePath = resolveWithinRoot(relativePath);
      if (!absolutePath) {
        res.status(400).json({ error: 'Invalid path' });
        return;
      }

      try {
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, body);

        const row = await asUser(userId, async (db) => {
          const { rows } = await db.query(
            `INSERT INTO pricing_documents
               (file_name, file_path, file_size, file_type, category, description, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [fileName, relativePath, body.length, fileType, category, description, userId]
          );
          return rows[0];
        });

        res.status(201).json(row);
      } catch (err) {
        // Do not leave an orphaned file if the metadata insert failed.
        await unlink(absolutePath).catch(() => {});
        console.error('[documents] upload failed:', err);
        res.status(500).json({ error: 'Upload failed' });
      }
    }
  );

  /** Download. The path comes from the row, which RLS decides is visible. */
  app.get('/api/documents/:id/download', async (req: Request, res: Response) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    const row = await asUser(userId, async (db) => {
      const { rows } = await db.query<{ file_name: string; file_path: string; file_type: string }>(
        'SELECT file_name, file_path, file_type FROM pricing_documents WHERE id = $1',
        [req.params.id]
      );
      return rows[0] ?? null;
    });

    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const absolutePath = resolveWithinRoot(row.file_path);
    if (!absolutePath) {
      res.status(400).json({ error: 'Invalid path' });
      return;
    }

    try {
      await stat(absolutePath);
    } catch {
      res.status(404).json({ error: 'File missing from storage' });
      return;
    }

    res.setHeader('Content-Type', row.file_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      // Quotes and backslashes would break out of the quoted filename.
      `attachment; filename="${row.file_name.replace(/["\\]/g, '')}"`
    );
    createReadStream(absolutePath).pipe(res);
  });

  /** Delete both the row and the file. */
  app.delete('/api/documents/:id', async (req: Request, res: Response) => {
    const userId = await requireUser(req, res);
    if (!userId) return;

    // The DELETE is RLS-checked; if it removes nothing the caller may not
    // delete this document, and no file is touched.
    const row = await asUser(userId, async (db) => {
      const { rows } = await db.query<{ file_path: string }>(
        'DELETE FROM pricing_documents WHERE id = $1 RETURNING file_path',
        [req.params.id]
      );
      return rows[0] ?? null;
    });

    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const absolutePath = resolveWithinRoot(row.file_path);
    if (absolutePath) {
      // A missing file should not fail the delete; the row is already gone.
      await unlink(absolutePath).catch(() => {});
    }
    res.json({ success: true });
  });
}
