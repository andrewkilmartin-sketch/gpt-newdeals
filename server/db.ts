import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shared/schema';

let dbReady = false;
let connectionError: string | null = null;

if (!process.env.DATABASE_URL) {
  connectionError = 'DATABASE_URL environment variable is not set';
  console.warn(`[DB] ${connectionError}`);
}

const databaseUrl = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

const client = postgres(databaseUrl, {
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
  onnotice: () => {}, // Suppress notices
});

export const db = drizzle(client, { schema });

// Mark as ready only if we have a real DATABASE_URL
dbReady = !!process.env.DATABASE_URL;

if (dbReady) {
  console.log('[DB] Database connection initialized');
} else {
  console.warn('[DB] Database not configured - queries will fail');
}

export function isDbReady(): boolean {
  return dbReady;
}

export async function ensureSearchIndexes(): Promise<void> {
  if (!dbReady) {
    console.log('[DB] Skipping index check - database not ready');
    return;
  }
  
  try {
    const result = await client`SELECT to_regclass('idx_pv2_search_gin') as idx_exists`;
    
    if (!result[0]?.idx_exists) {
      console.log('[DB] Creating search index on products_v2.search_vector...');
      await client`CREATE INDEX IF NOT EXISTS idx_pv2_search_gin ON products_v2 USING gin (search_vector)`;
      console.log('[DB] Search index created successfully');
    } else {
      console.log('[DB] Search index already exists');
    }
  } catch (error) {
    const err = error as Error;
    console.warn(`[DB] Could not ensure search index: ${err.message}`);
  }
}

export { connectionError };
