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

export async function ensureMovieTables(): Promise<void> {
  if (!dbReady) {
    console.log('[DB] Skipping movie tables check - database not ready');
    return;
  }
  
  try {
    const moviesExists = await client`SELECT to_regclass('movies') as exists`;
    
    if (!moviesExists[0]?.exists) {
      console.log('[DB] Creating movies table...');
      await client`
        CREATE TABLE IF NOT EXISTS movies (
          id INTEGER PRIMARY KEY,
          title TEXT NOT NULL,
          overview TEXT,
          poster_path TEXT,
          backdrop_path TEXT,
          release_date TEXT,
          vote_average REAL,
          vote_count INTEGER,
          popularity REAL,
          genre_ids INTEGER[],
          adult BOOLEAN DEFAULT false,
          original_language TEXT,
          runtime INTEGER,
          status TEXT,
          content_type TEXT NOT NULL DEFAULT 'cinema',
          streaming_providers TEXT[],
          uk_certification TEXT,
          last_updated TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log('[DB] Movies table created');
    } else {
      // Ensure all columns exist (migration for existing tables)
      try {
        await client`ALTER TABLE movies ADD COLUMN IF NOT EXISTS vote_count INTEGER`;
        await client`ALTER TABLE movies ADD COLUMN IF NOT EXISTS popularity REAL`;
        await client`ALTER TABLE movies ADD COLUMN IF NOT EXISTS adult BOOLEAN DEFAULT false`;
        await client`ALTER TABLE movies ADD COLUMN IF NOT EXISTS original_language TEXT`;
        await client`ALTER TABLE movies ADD COLUMN IF NOT EXISTS runtime INTEGER`;
        await client`ALTER TABLE movies ADD COLUMN IF NOT EXISTS status TEXT`;
        await client`ALTER TABLE movies ADD COLUMN IF NOT EXISTS streaming_providers TEXT[]`;
        await client`ALTER TABLE movies ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW()`;
      } catch (e) {
        // Ignore migration errors
      }
    }
    
    const upsellMappingsExists = await client`SELECT to_regclass('upsell_mappings') as exists`;
    
    if (!upsellMappingsExists[0]?.exists) {
      console.log('[DB] Creating upsell_mappings table...');
      await client`
        CREATE TABLE IF NOT EXISTS upsell_mappings (
          id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid(),
          content_type TEXT NOT NULL,
          intent_category TEXT NOT NULL,
          product_keywords TEXT[] NOT NULL,
          product_categories TEXT[],
          priority INTEGER DEFAULT 1,
          is_active BOOLEAN DEFAULT true
        )
      `;
      console.log('[DB] Upsell mappings table created');
    } else {
      try {
        await client`ALTER TABLE upsell_mappings ADD COLUMN IF NOT EXISTS product_categories TEXT[]`;
      } catch (e) {
        // Ignore if column already exists
      }
    }
    
    const upsellClicksExists = await client`SELECT to_regclass('upsell_clicks') as exists`;
    
    if (!upsellClicksExists[0]?.exists) {
      console.log('[DB] Creating upsell_clicks table...');
      await client`
        CREATE TABLE IF NOT EXISTS upsell_clicks (
          id SERIAL PRIMARY KEY,
          content_id TEXT NOT NULL,
          content_type TEXT NOT NULL,
          product_id TEXT NOT NULL,
          intent_category TEXT,
          clicked_at TIMESTAMP DEFAULT NOW(),
          session_id TEXT
        )
      `;
      console.log('[DB] Upsell clicks table created');
    }
    
    console.log('[DB] Movie tables ready');
  } catch (error) {
    const err = error as Error;
    console.error(`[DB] Could not ensure movie tables: ${err.message}`);
  }
}

export { connectionError };
