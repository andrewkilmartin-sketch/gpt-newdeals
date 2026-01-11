import * as crypto from 'crypto';
import type { QueryInterpretation } from './types';

interface CachedInterpretation {
  interpretation: QueryInterpretation;
  timestamp: number;
  hitCount: number;
}

const memoryCacheMap = new Map<string, CachedInterpretation>();
const normalizedCache = new Map<string, string>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_VERSION = 2;

export function hashQuery(normalized: string): string {
  return crypto.createHash('md5').update(normalized).digest('hex');
}

export function normalizeQueryForCache(query: string): string {
  const stopWords = new Set([
    'a', 'an', 'the', 'for', 'my', 'our', 'your', 'their',
    'year', 'years', 'old', 'olds', 'aged', 'age',
    'recommend', 'recommendations', 'suggest', 'suggestions',
    'find', 'show', 'get', 'want', 'need', 'looking',
    'please', 'can', 'could', 'would', 'like', 'some', 'any',
    'good', 'best', 'great', 'nice', 'cool', 'fun'
  ]);
  
  return query
    .toLowerCase()
    .replace(/[^\w\s\d]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w))
    .sort()
    .join(' ')
    .trim();
}

export function getCachedInterpretation(query: string): QueryInterpretation | null {
  const exact = query.toLowerCase().trim();
  
  const cachedExact = memoryCacheMap.get(exact);
  if (cachedExact && Date.now() - cachedExact.timestamp < CACHE_TTL_MS) {
    cachedExact.hitCount++;
    cachedExact.timestamp = Date.now();
    console.log(`[Query Cache] EXACT HIT for "${query}" (hits: ${cachedExact.hitCount})`);
    return cachedExact.interpretation;
  }
  
  const normalized = normalizeQueryForCache(query);
  const originalKey = normalizedCache.get(normalized);
  if (originalKey) {
    const cachedNorm = memoryCacheMap.get(originalKey);
    if (cachedNorm && Date.now() - cachedNorm.timestamp < CACHE_TTL_MS) {
      cachedNorm.hitCount++;
      cachedNorm.timestamp = Date.now();
      console.log(`[Query Cache] SIMILAR HIT for "${query}" → matched "${originalKey}" (hits: ${cachedNorm.hitCount})`);
      memoryCacheMap.set(exact, cachedNorm);
      return cachedNorm.interpretation;
    }
  }
  
  return null;
}

export async function getDbCachedInterpretation(
  query: string,
  db: any,
  queryCacheTable: any,
  eq: any
): Promise<QueryInterpretation | null> {
  try {
    const normalized = normalizeQueryForCache(query);
    const hash = hashQuery(normalized);
    
    const results = await db.select()
      .from(queryCacheTable)
      .where(eq(queryCacheTable.queryHash, hash))
      .limit(1);
    
    if (results.length > 0) {
      const row = results[0];
      if (row.cacheVersion !== CACHE_VERSION) {
        console.log(`[Query Cache] DB version mismatch (${row.cacheVersion} vs ${CACHE_VERSION}), skipping`);
        return null;
      }
      
      if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
        console.log(`[Query Cache] DB entry expired, skipping`);
        return null;
      }
      
      const interpretation = row.interpretation as QueryInterpretation;
      
      const exact = query.toLowerCase().trim();
      const cacheEntry: CachedInterpretation = {
        interpretation,
        timestamp: Date.now(),
        hitCount: row.hitCount || 1
      };
      memoryCacheMap.set(exact, cacheEntry);
      normalizedCache.set(normalized, exact);
      
      db.update(queryCacheTable)
        .set({ 
          hitCount: (row.hitCount || 0) + 1,
          lastAccessedAt: new Date()
        })
        .where(eq(queryCacheTable.queryHash, hash))
        .catch((err: any) => console.error('[Query Cache] DB update error:', err));
      
      console.log(`[Query Cache] DB HIT for "${query}" (hits: ${row.hitCount})`);
      return interpretation;
    }
  } catch (err) {
    console.error('[Query Cache] DB lookup error:', err);
  }
  return null;
}

export function setCachedInterpretation(
  query: string, 
  interpretation: QueryInterpretation,
  db?: any,
  queryCacheTable?: any
): void {
  const exact = query.toLowerCase().trim();
  const normalized = normalizeQueryForCache(query);
  
  const cacheEntry: CachedInterpretation = { 
    interpretation, 
    timestamp: Date.now(),
    hitCount: 0
  };
  
  memoryCacheMap.set(exact, cacheEntry);
  normalizedCache.set(normalized, exact);
  
  if (memoryCacheMap.size > 2000) {
    const entries = Array.from(memoryCacheMap.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 200; i++) {
      memoryCacheMap.delete(entries[i][0]);
    }
  }
  if (normalizedCache.size > 2000) {
    const keys = Array.from(normalizedCache.keys()).slice(0, 200);
    keys.forEach(k => normalizedCache.delete(k));
  }
  
  if (db && queryCacheTable) {
    const hash = hashQuery(normalized);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    
    db.insert(queryCacheTable)
      .values({
        queryHash: hash,
        originalQuery: query,
        normalizedQuery: normalized,
        interpretation: interpretation as any,
        cacheVersion: CACHE_VERSION,
        expiresAt
      })
      .onConflictDoUpdate({
        target: queryCacheTable.queryHash,
        set: {
          interpretation: interpretation as any,
          cacheVersion: CACHE_VERSION,
          lastAccessedAt: new Date(),
          expiresAt
        }
      })
      .catch((err: any) => console.error('[Query Cache] DB write error:', err));
  }
  
  console.log(`[Query Cache] STORED "${query}" (exact: ${exact}, normalized: ${normalized})`);
}

export function getCacheStats(): { size: number; normalizedSize: number; topQueries: string[] } {
  const entries = Array.from(memoryCacheMap.entries());
  entries.sort((a, b) => b[1].hitCount - a[1].hitCount);
  return {
    size: memoryCacheMap.size,
    normalizedSize: normalizedCache.size,
    topQueries: entries.slice(0, 10).map(([k, v]) => `${k} (${v.hitCount} hits)`)
  };
}

export function clearQueryCache(): number {
  const size = memoryCacheMap.size;
  memoryCacheMap.clear();
  normalizedCache.clear();
  console.log(`[Query Cache] Cleared ${size} cached interpretations from memory`);
  return size;
}
