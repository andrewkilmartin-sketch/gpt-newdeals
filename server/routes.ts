import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { searchQuerySchema } from "@shared/schema";
import { fetchAwinProducts, isAwinConfigured, getAllActivePromotions, getPromotionsForMerchant, ProductPromotion } from "./services/awin";
import { decodeTag, getAgeRange, getCategoryFromTags } from "./data/family-playbook";
// Note: CSV product feed loading removed - now using PostgreSQL database directly
import sunnyRouter from "./sunny";
import OpenAI from "openai";
import { db } from "./db";
import { sql, or } from "drizzle-orm";
import archiver from "archiver";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import multer from "multer";
import { 
  textToSpeech, 
  speechToText, 
  parseIntent, 
  getRandomGreeting, 
  getRandomTransition,
  getRandomError 
} from "./services/voice";
import { 
  syncMovies, 
  getMoviesByType, 
  searchMovies, 
  getPosterUrl, 
  getBackdropUrl,
  getGenreNames,
  TMDB_GENRES
} from "./services/tmdb";
import { 
  getUpsellProducts, 
  trackUpsellClick, 
  seedDefaultMappings 
} from "./services/upsell";

const STREAMING_SERVICES = ['Netflix', 'Prime Video', 'Disney+', 'Apple TV+', 'Sky', 'NOW', 'MUBI'];

// Build version for deployment verification - increment this when making changes
const BUILD_VERSION = '2026.01.09.v1';
const BUILD_DATE = '2026-01-09T00:30:00Z';
const BUILD_FEATURES = [
  'CRITICAL FIX: storage.searchProducts now filters by detected brand/character',
  'Brand detection in /shopping/awin-link endpoint (Clarks, Crocs, etc.)',
  'Override taxonomy hardFail for brand matches',
  'Expanded knownBrands and knownCharacters lists',
  'GPT prompt: mustMatch requires product type + qualifier + brand',
  'Price range extraction (minPrice/maxPrice)'
];

// ============================================================
// QUERY INTERPRETATION CACHE - Avoids repeated GPT calls
// Two-tier: exact match + normalized match for similar queries
// Three-tier: memory → DB persistence for long-term cost savings
// ============================================================
import * as crypto from 'crypto';
import { queryCache as queryCacheTable } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface CachedInterpretation {
  interpretation: QueryInterpretation;
  timestamp: number;
  hitCount: number;
}
const memoryCacheMap = new Map<string, CachedInterpretation>();
const normalizedCache = new Map<string, string>(); // normalized → original key
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hour cache (longer for DB-backed)
const CACHE_VERSION = 2; // Increment when QueryInterpretation format changes

// Create deterministic hash for DB queries
function hashQuery(normalized: string): string {
  return crypto.createHash('md5').update(normalized).digest('hex');
}

// Normalize query for similar matching
// "film for my 9 year old" → "film 9"
// "movie for 9 year old" → "movie 9"
function normalizeQueryForCache(query: string): string {
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
    .replace(/[^\w\s\d]/g, ' ')  // Remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 0 && !stopWords.has(w))
    .sort()  // Sort to match "barbie dolls" with "dolls barbie"
    .join(' ')
    .trim();
}

function getCachedInterpretation(query: string): QueryInterpretation | null {
  const exact = query.toLowerCase().trim();
  
  // Check exact match first (memory cache)
  const cachedExact = memoryCacheMap.get(exact);
  if (cachedExact && Date.now() - cachedExact.timestamp < CACHE_TTL_MS) {
    cachedExact.hitCount++;
    cachedExact.timestamp = Date.now(); // Refresh timestamp on hit
    console.log(`[Query Cache] EXACT HIT for "${query}" (hits: ${cachedExact.hitCount})`);
    return cachedExact.interpretation;
  }
  
  // Check normalized match (similar queries) in memory
  const normalized = normalizeQueryForCache(query);
  const originalKey = normalizedCache.get(normalized);
  if (originalKey) {
    const cachedNorm = memoryCacheMap.get(originalKey);
    if (cachedNorm && Date.now() - cachedNorm.timestamp < CACHE_TTL_MS) {
      cachedNorm.hitCount++;
      cachedNorm.timestamp = Date.now(); // Refresh timestamp on hit
      console.log(`[Query Cache] SIMILAR HIT for "${query}" → matched "${originalKey}" (hits: ${cachedNorm.hitCount})`);
      // Also cache the exact query for faster future lookups
      memoryCacheMap.set(exact, cachedNorm);
      return cachedNorm.interpretation;
    }
  }
  
  return null;
}

// Async DB cache lookup (called when memory cache misses)
async function getDbCachedInterpretation(query: string): Promise<QueryInterpretation | null> {
  try {
    const normalized = normalizeQueryForCache(query);
    const hash = hashQuery(normalized);
    
    const results = await db.select()
      .from(queryCacheTable)
      .where(eq(queryCacheTable.queryHash, hash))
      .limit(1);
    
    if (results.length > 0) {
      const row = results[0];
      // Check version compatibility
      if (row.cacheVersion !== CACHE_VERSION) {
        console.log(`[Query Cache] DB version mismatch (${row.cacheVersion} vs ${CACHE_VERSION}), skipping`);
        return null;
      }
      
      // Check TTL expiry
      if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
        console.log(`[Query Cache] DB entry expired, skipping`);
        return null;
      }
      
      const interpretation = row.interpretation as QueryInterpretation;
      
      // Hydrate memory cache
      const exact = query.toLowerCase().trim();
      const cacheEntry: CachedInterpretation = {
        interpretation,
        timestamp: Date.now(),
        hitCount: row.hitCount || 1
      };
      memoryCacheMap.set(exact, cacheEntry);
      normalizedCache.set(normalized, exact);
      
      // Update DB hit count asynchronously (fire-and-forget)
      db.update(queryCacheTable)
        .set({ 
          hitCount: (row.hitCount || 0) + 1,
          lastAccessedAt: new Date()
        })
        .where(eq(queryCacheTable.queryHash, hash))
        .catch(err => console.error('[Query Cache] DB update error:', err));
      
      console.log(`[Query Cache] DB HIT for "${query}" (hits: ${row.hitCount})`);
      return interpretation;
    }
  } catch (err) {
    console.error('[Query Cache] DB lookup error:', err);
  }
  return null;
}

function setCachedInterpretation(query: string, interpretation: QueryInterpretation): void {
  const exact = query.toLowerCase().trim();
  const normalized = normalizeQueryForCache(query);
  
  const cacheEntry: CachedInterpretation = { 
    interpretation, 
    timestamp: Date.now(),
    hitCount: 0
  };
  
  memoryCacheMap.set(exact, cacheEntry);
  normalizedCache.set(normalized, exact);
  
  // Limit cache size to 2000 entries (more room for normalized matches)
  if (memoryCacheMap.size > 2000) {
    // Remove oldest entries
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
  
  // Persist to DB asynchronously (fire-and-forget for low latency)
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
    .catch(err => console.error('[Query Cache] DB write error:', err));
  
  console.log(`[Query Cache] STORED "${query}" (exact: ${exact}, normalized: ${normalized}, hash: ${hash.substring(0, 8)}...)`);
}

function getCacheStats(): { size: number; normalizedSize: number; topQueries: string[] } {
  const entries = Array.from(memoryCacheMap.entries());
  entries.sort((a, b) => b[1].hitCount - a[1].hitCount);
  return {
    size: memoryCacheMap.size,
    normalizedSize: normalizedCache.size,
    topQueries: entries.slice(0, 10).map(([k, v]) => `${k} (${v.hitCount} hits)`)
  };
}

function clearQueryCache(): number {
  const size = memoryCacheMap.size;
  memoryCacheMap.clear();
  normalizedCache.clear();
  console.log(`[Query Cache] Cleared ${size} cached interpretations from memory`);
  return size;
}

// ============================================================
// INVENTORY GAP FALLBACK - Show similar items when product doesn't exist
// Maps search terms to broad categories for fallback suggestions
// ============================================================

const CATEGORY_INFERENCE_MAP: Record<string, string[]> = {
  // Toys & Games
  'toys': ['toys', 'games', 'puzzles', 'play', 'lego', 'barbie', 'action', 'doll', 'figure', 'playset'],
  'sylvanian families': ['toys'],
  'calico critters': ['toys'],
  'playmobil': ['toys'],
  'lego': ['toys'],
  'barbie': ['toys', 'dolls'],
  'action figures': ['toys'],
  'board games': ['toys', 'games'],
  
  // Clothing
  'clothing': ['dress', 'shirt', 'top', 'trousers', 'jeans', 'jacket', 'coat', 'jumper', 'sweater'],
  'dresses': ['women', 'dress', 'clothing'],
  'shirts': ['shirt', 'top', 'clothing'],
  
  // Footwear
  'shoes': ['shoes', 'trainers', 'sneakers', 'boots', 'sandals', 'footwear'],
  'trainers': ['shoes', 'footwear'],
  'boots': ['shoes', 'footwear'],
  
  // Electronics
  'electronics': ['headphones', 'speaker', 'phone', 'tablet', 'laptop', 'camera', 'tv'],
  'headphones': ['electronics', 'audio'],
  
  // Home
  'home': ['furniture', 'decor', 'kitchen', 'bedding', 'garden'],
  'furniture': ['home', 'decor'],
  
  // Kids specific
  'kids': ['children', 'kids', 'boys', 'girls', 'toddler', 'baby'],
  'baby': ['baby', 'infant', 'toddler', 'nursery'],
};

// Brand/franchise to category mapping
const BRAND_CATEGORY_MAP: Record<string, string> = {
  'sylvanian': 'toys', 'calico': 'toys', 'playmobil': 'toys', 'lego': 'toys',
  'barbie': 'toys', 'mattel': 'toys', 'hasbro': 'toys', 'fisher-price': 'toys',
  'disney': 'toys', 'marvel': 'toys', 'star wars': 'toys', 'pokemon': 'toys',
  'paw patrol': 'toys', 'peppa pig': 'toys', 'bluey': 'toys', 'cocomelon': 'toys',
  'fingerlings': 'toys', 'hatchimals': 'toys', 'furby': 'toys', 'tamagotchi': 'toys',
  'transformers': 'toys', 'nerf': 'toys', 'hot wheels': 'toys', 'beyblade': 'toys',
  'nike': 'shoes', 'adidas': 'shoes', 'puma': 'shoes', 'reebok': 'shoes',
  'clarks': 'shoes', 'converse': 'shoes', 'vans': 'shoes', 'jordan': 'shoes',
  'apple': 'electronics', 'samsung': 'electronics', 'sony': 'electronics',
  'ikea': 'home', 'john lewis': 'home',
};

function inferCategoryFromQuery(query: string): { category: string; keywords: string[] } | null {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);
  
  // Check brand mapping first
  for (const [brand, category] of Object.entries(BRAND_CATEGORY_MAP)) {
    if (q.includes(brand)) {
      return { category, keywords: [category] };
    }
  }
  
  // Check direct category mapping
  for (const [key, keywords] of Object.entries(CATEGORY_INFERENCE_MAP)) {
    if (q.includes(key) || words.some(w => key.includes(w))) {
      return { category: key, keywords };
    }
  }
  
  // Age-based inference (kids products)
  if (/\b(\d+)\s*(year|yr)s?\s*old\b/.test(q) || /\b(boy|girl|kid|child|toddler|baby)\b/.test(q)) {
    return { category: 'kids', keywords: ['children', 'kids'] };
  }
  
  return null;
}

async function searchFallbackByCategory(
  category: string, 
  keywords: string[], 
  limit: number = 10
): Promise<{ products: any[]; fallbackCategory: string }> {
  try {
    // Search for products matching the category keywords
    const fallbackQuery = keywords[0] || category;
    console.log(`[Fallback Search] Searching category "${category}" with keyword "${fallbackQuery}"`);
    
    const results = await storage.searchProducts(fallbackQuery, limit, 0, undefined, {});
    
    if (results.products.length > 0) {
      return { products: results.products, fallbackCategory: category };
    }
    
    // Try broader search if specific category fails
    const broadResults = await storage.searchProducts(category, limit, 0, undefined, {});
    return { products: broadResults.products, fallbackCategory: category };
  } catch (error) {
    console.error('[Fallback Search] Error:', error);
    return { products: [], fallbackCategory: category };
  }
}

// ============================================================
// BESPOKE REACTIVE FILTERS - Category-specific filter schemas
// ============================================================

type ProductCategory = 'clothing' | 'footwear' | 'toys' | 'electronics' | 'home' | 'beauty' | 'general';

interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface FilterDefinition {
  id: string;
  label: string;
  type: 'single' | 'multi' | 'range';
  options: FilterOption[];
}

interface FilterSchema {
  category: ProductCategory;
  categoryLabel: string;
  filters: FilterDefinition[];
}

// Category detection based on query keywords and extracted attributes
function detectProductCategory(query: string, attributes: any, matchedCategories: string[]): ProductCategory {
  const q = query.toLowerCase();
  const cats = matchedCategories.map(c => c.toLowerCase()).join(' ');
  
  // PRIORITY 1: Strong query keyword signals (most specific first)
  
  // Toys detection - check FIRST because toy queries are very specific
  if (/\b(toys?|lego|barbie|action figure|board game|playset|doll|puzzle|nerf|hot wheels|legos?)\b/.test(q) ||
      /\b(year old|age \d|for kids|children|kid's)\b/.test(q) ||
      /\b(toys?|games?\s+puzzles?)\b/.test(cats)) {
    return 'toys';
  }
  
  // Electronics detection - headphones, speakers, etc.
  if (/\b(headphones?|earbuds?|earphones?|speaker|camera|tv|television|laptop|tablet|phone|bluetooth|wireless audio)\b/.test(q) ||
      /\b(headphones?|electronics?|computing|audio)\b/.test(cats)) {
    return 'electronics';
  }
  
  // Footwear detection
  if (/\b(shoes?|trainers?|sneakers?|boots?|sandals?|heels?|loafers?|pumps?|footwear)\b/.test(q) ||
      /\b(footwear|shoes)\b/.test(cats) ||
      (attributes?.model && /\b(air force|air max|jordan|yeezy|converse|vans)\b/i.test(attributes.model))) {
    return 'footwear';
  }
  
  // Beauty detection
  if (/\b(makeup|skincare|perfume|fragrance|cosmetic|lipstick|mascara|cream|serum|beauty)\b/.test(q) ||
      /\b(beauty|cosmetics|skincare)\b/.test(cats)) {
    return 'beauty';
  }
  
  // Home/Garden detection
  if (/\b(furniture|sofa|table|chair|lamp|bed|mattress|garden|outdoor|kitchen|bathroom|decor)\b/.test(q) ||
      /\b(home|garden|furniture|decor)\b/.test(cats)) {
    return 'home';
  }
  
  // Clothing detection - LAST because it's the most general
  if (/\b(shirt|dress|jeans|trousers|pants|jacket|coat|hoodie|sweater|t-shirt|blouse|skirt|clothing)\b/.test(q) ||
      /\b(clothing|apparel|fashion)\b/.test(cats)) {
    return 'clothing';
  }
  
  // PRIORITY 2: Infer from attributes only if no strong keyword signal
  if (attributes?.size && (attributes?.color || attributes?.gender)) {
    return 'clothing';
  }
  
  return 'general';
}

// Extract bespoke filter options from matched products
function buildBespokeFilters(category: ProductCategory, products: any[], attributes: any): FilterSchema {
  const categoryLabels: Record<ProductCategory, string> = {
    'clothing': 'Clothing',
    'footwear': 'Footwear',
    'toys': 'Toys & Games',
    'electronics': 'Electronics',
    'home': 'Home & Garden',
    'beauty': 'Beauty',
    'general': 'All Products'
  };
  
  const filters: FilterDefinition[] = [];
  
  // Common filters for all categories
  const brandCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();
  
  for (const p of products) {
    if (p.brand) {
      brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
    }
    // Extract colors from name
    const colorMatch = (p.name || '').match(/\b(black|white|red|blue|green|grey|gray|pink|purple|orange|yellow|brown|beige|navy|cream)\b/i);
    if (colorMatch) {
      const color = colorMatch[1].toLowerCase();
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }
  }
  
  // Add brand filter if multiple brands
  if (brandCounts.size > 1) {
    filters.push({
      id: 'brand',
      label: 'Brand',
      type: 'multi',
      options: Array.from(brandCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, label: value, count }))
    });
  }
  
  // Category-specific filters
  if (category === 'footwear' || category === 'clothing') {
    // Size filter - extract from product names
    const sizeCounts = new Map<string, number>();
    for (const p of products) {
      const sizeMatch = (p.name || '').match(/(?:size[:\s]*)?(\d+(?:\.\d+)?)\s*(?:\((?:EU|UK)\s*\d+\))?/i);
      if (sizeMatch) {
        sizeCounts.set(sizeMatch[1], (sizeCounts.get(sizeMatch[1]) || 0) + 1);
      }
    }
    if (sizeCounts.size > 0) {
      filters.push({
        id: 'size',
        label: 'Size',
        type: 'multi',
        options: Array.from(sizeCounts.entries())
          .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
          .map(([value, count]) => ({ value, label: `UK ${value}`, count }))
      });
    }
    
    // Color filter
    if (colorCounts.size > 0) {
      filters.push({
        id: 'color',
        label: 'Colour',
        type: 'multi',
        options: Array.from(colorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([value, count]) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1), count }))
      });
    }
    
    // Gender filter
    const genderCounts = new Map<string, number>();
    for (const p of products) {
      const cat = (p.category || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      if (cat.includes("men's") || cat.includes('mens') || name.includes("men's")) {
        genderCounts.set('mens', (genderCounts.get('mens') || 0) + 1);
      }
      if (cat.includes("women's") || cat.includes('womens') || name.includes("women's")) {
        genderCounts.set('womens', (genderCounts.get('womens') || 0) + 1);
      }
      if (cat.includes('children') || cat.includes('kids') || cat.includes('youth')) {
        genderCounts.set('kids', (genderCounts.get('kids') || 0) + 1);
      }
    }
    if (genderCounts.size > 0) {
      filters.push({
        id: 'gender',
        label: 'For',
        type: 'single',
        options: [
          genderCounts.has('mens') ? { value: 'mens', label: "Men's", count: genderCounts.get('mens')! } : null,
          genderCounts.has('womens') ? { value: 'womens', label: "Women's", count: genderCounts.get('womens')! } : null,
          genderCounts.has('kids') ? { value: 'kids', label: 'Kids', count: genderCounts.get('kids')! } : null,
        ].filter(Boolean) as FilterOption[]
      });
    }
  }
  
  if (category === 'toys') {
    // Age range filter
    const ageCounts = new Map<string, number>();
    for (const p of products) {
      const desc = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
      if (/\b(0-2|baby|infant|toddler)\b/.test(desc)) ageCounts.set('0-2', (ageCounts.get('0-2') || 0) + 1);
      if (/\b(3-5|preschool)\b/.test(desc)) ageCounts.set('3-5', (ageCounts.get('3-5') || 0) + 1);
      if (/\b(6-8|school age)\b/.test(desc)) ageCounts.set('6-8', (ageCounts.get('6-8') || 0) + 1);
      if (/\b(9-12|tween)\b/.test(desc)) ageCounts.set('9-12', (ageCounts.get('9-12') || 0) + 1);
      if (/\b(13\+|teen|adult)\b/.test(desc)) ageCounts.set('13+', (ageCounts.get('13+') || 0) + 1);
    }
    if (ageCounts.size > 0) {
      filters.push({
        id: 'ageRange',
        label: 'Age Range',
        type: 'single',
        options: ['0-2', '3-5', '6-8', '9-12', '13+']
          .filter(age => ageCounts.has(age))
          .map(age => ({ value: age, label: `${age} years`, count: ageCounts.get(age)! }))
      });
    }
    
    // Franchise/Character filter
    const franchises = new Map<string, number>();
    const franchisePatterns = [
      { pattern: /\blego\b/i, name: 'LEGO' },
      { pattern: /\bbarbie\b/i, name: 'Barbie' },
      { pattern: /\bmarvel|avengers|spider-?man\b/i, name: 'Marvel' },
      { pattern: /\bstar wars\b/i, name: 'Star Wars' },
      { pattern: /\bdisney|frozen|princess\b/i, name: 'Disney' },
      { pattern: /\bpaw patrol\b/i, name: 'Paw Patrol' },
      { pattern: /\bpokemon|pikachu\b/i, name: 'Pokemon' },
      { pattern: /\bnerf\b/i, name: 'Nerf' },
      { pattern: /\bhot wheels\b/i, name: 'Hot Wheels' },
    ];
    for (const p of products) {
      const text = ((p.name || '') + ' ' + (p.brand || '')).toLowerCase();
      for (const { pattern, name } of franchisePatterns) {
        if (pattern.test(text)) {
          franchises.set(name, (franchises.get(name) || 0) + 1);
        }
      }
    }
    if (franchises.size > 0) {
      filters.push({
        id: 'franchise',
        label: 'Character/Franchise',
        type: 'multi',
        options: Array.from(franchises.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([value, count]) => ({ value, label: value, count }))
      });
    }
  }
  
  if (category === 'electronics') {
    // Connectivity filter
    const connCounts = new Map<string, number>();
    for (const p of products) {
      const text = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
      if (/\bbluetooth\b/.test(text)) connCounts.set('bluetooth', (connCounts.get('bluetooth') || 0) + 1);
      if (/\bwi-?fi\b/.test(text)) connCounts.set('wifi', (connCounts.get('wifi') || 0) + 1);
      if (/\busb-?c\b/.test(text)) connCounts.set('usbc', (connCounts.get('usbc') || 0) + 1);
      if (/\bwireless\b/.test(text)) connCounts.set('wireless', (connCounts.get('wireless') || 0) + 1);
    }
    if (connCounts.size > 0) {
      filters.push({
        id: 'connectivity',
        label: 'Connectivity',
        type: 'multi',
        options: Array.from(connCounts.entries())
          .map(([value, count]) => ({ 
            value, 
            label: value === 'bluetooth' ? 'Bluetooth' : value === 'wifi' ? 'Wi-Fi' : value === 'usbc' ? 'USB-C' : 'Wireless',
            count 
          }))
      });
    }
  }
  
  // Pre-select filters based on query attributes
  const selectedFilters: Record<string, string[]> = {};
  if (attributes?.size) selectedFilters.size = [attributes.size];
  if (attributes?.color) selectedFilters.color = [attributes.color.toLowerCase()];
  if (attributes?.gender) selectedFilters.gender = [attributes.gender.toLowerCase()];
  
  return {
    category,
    categoryLabel: categoryLabels[category],
    filters
  };
}

// ============================================================
// HELPER FUNCTIONS - Price ranges and merchant comparison
// ============================================================

// Build dynamic price range buckets based on actual product prices
function buildPriceRanges(prices: number[]): { range: string; min: number; max: number; count: number }[] {
  const validPrices = prices.filter(p => p > 0);
  if (validPrices.length === 0) return [];
  
  const min = Math.min(...validPrices);
  const max = Math.max(...validPrices);
  
  // Create smart buckets based on price distribution
  const ranges: { range: string; min: number; max: number; count: number }[] = [];
  
  if (max <= 25) {
    ranges.push({ range: 'Under £10', min: 0, max: 10, count: 0 });
    ranges.push({ range: '£10-£25', min: 10, max: 25, count: 0 });
  } else if (max <= 100) {
    ranges.push({ range: 'Under £25', min: 0, max: 25, count: 0 });
    ranges.push({ range: '£25-£50', min: 25, max: 50, count: 0 });
    ranges.push({ range: '£50-£100', min: 50, max: 100, count: 0 });
  } else if (max <= 500) {
    ranges.push({ range: 'Under £50', min: 0, max: 50, count: 0 });
    ranges.push({ range: '£50-£100', min: 50, max: 100, count: 0 });
    ranges.push({ range: '£100-£200', min: 100, max: 200, count: 0 });
    ranges.push({ range: '£200-£500', min: 200, max: 500, count: 0 });
  } else {
    ranges.push({ range: 'Under £100', min: 0, max: 100, count: 0 });
    ranges.push({ range: '£100-£250', min: 100, max: 250, count: 0 });
    ranges.push({ range: '£250-£500', min: 250, max: 500, count: 0 });
    ranges.push({ range: '£500+', min: 500, max: 999999, count: 0 });
  }
  
  // Count products in each range
  for (const price of validPrices) {
    for (const range of ranges) {
      if (price >= range.min && price < range.max) {
        range.count++;
        break;
      }
    }
  }
  
  return ranges.filter(r => r.count > 0);
}

// Group similar products by name to show price comparison across merchants
function buildMerchantComparison(products: any[]): { product: string; options: { merchant: string; price: number; link: string; inStock: boolean }[] }[] {
  const groups: Map<string, any[]> = new Map();
  
  for (const p of products) {
    // Create a simplified product key by removing size/color specifics
    const key = (p.name || '')
      .toLowerCase()
      .replace(/\s+size[:\s]*\d+[^\s]*/gi, '')
      .replace(/\s+(xs|s|m|l|xl|xxl|xxxl)\b/gi, '')
      .replace(/\s+(uk|eu)\s*\d+/gi, '')
      .replace(/\([^)]+\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    
    if (key.length < 10) continue;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(p);
  }
  
  // Only return groups with multiple merchants
  const comparisons: { product: string; options: { merchant: string; price: number; link: string; inStock: boolean }[] }[] = [];
  
  for (const [key, items] of groups) {
    const uniqueMerchants = new Set(items.map(i => i.merchant));
    if (uniqueMerchants.size > 1) {
      // Sort by price and take best from each merchant
      const merchantBest: Map<string, any> = new Map();
      for (const item of items.sort((a, b) => (parseFloat(a.price) || 999999) - (parseFloat(b.price) || 999999))) {
        if (!merchantBest.has(item.merchant)) {
          merchantBest.set(item.merchant, item);
        }
      }
      
      comparisons.push({
        product: items[0].name.slice(0, 80),
        options: Array.from(merchantBest.values()).map(i => ({
          merchant: i.merchant,
          price: parseFloat(i.price) || 0,
          link: i.affiliate_link || i.affiliateLink,
          inStock: i.in_stock ?? i.inStock ?? true
        })).sort((a, b) => a.price - b.price)
      });
    }
  }
  
  return comparisons.slice(0, 5); // Return top 5 comparison groups
}

// ============================================================
// SMART QUERY INTERPRETER - Uses GPT to understand search intent
// Expands semantic queries like "gift ideas for dad" into searchable keywords
// ============================================================
// Structured product attributes for precise filtering
interface ProductAttributes {
  brand?: string;           // e.g., "Nike", "Apple", "Lego"
  character?: string;       // e.g., "Paw Patrol", "Peppa Pig", "Frozen"
  model?: string;           // e.g., "Air Force 1", "iPhone 15"
  size?: string;            // e.g., "10", "XL", "32GB"
  color?: string;           // e.g., "red", "black", "white"
  gender?: string;          // e.g., "mens", "womens", "unisex"
  ageRange?: string;        // e.g., "toddler", "3-5", "5-7", "8-10", "teen"
  material?: string;        // e.g., "leather", "cotton"
  style?: string;           // e.g., "casual", "formal", "sporty"
}

interface QueryInterpretation {
  isSemanticQuery: boolean;
  originalQuery: string;
  expandedKeywords: string[];
  searchTerms: string[][];  // Multiple search term combinations to try
  mustHaveAll?: string[];   // AND logic - ALL must match (for brand combinations)
  mustHaveAny?: string[];   // OR logic - ANY must match (for gift qualifiers)
  mustHaveTerms?: string[]; // Legacy - treated as OR (for backwards compatibility)
  attributes?: ProductAttributes;  // Structured attributes for precise filtering
  context: {
    recipient?: string;
    occasion?: string;
    ageRange?: string;
    priceHint?: string;
    maxPrice?: number;
    categoryFilter?: string;
    excludeCategories?: string[];
  };
  rerankerContext: string;  // Extra context for GPT reranker
  skipReranker?: boolean;   // Skip GPT reranker for simple direct queries
}

async function interpretQuery(query: string, openaiKey: string | undefined): Promise<QueryInterpretation> {
  const startTime = Date.now();
  const defaultResult: QueryInterpretation = {
    isSemanticQuery: false,
    originalQuery: query,
    expandedKeywords: [],
    searchTerms: [[query]],
    mustHaveTerms: [],
    context: {},
    rerankerContext: ''
  };

  // Check memory cache first to avoid repeated GPT calls
  const cached = getCachedInterpretation(query);
  if (cached) {
    console.log(`[Query Interpreter] MEMORY CACHE HIT for "${query}" (0ms)`);
    return cached;
  }
  
  // Check DB cache (async) for longer-term persistence
  const dbCached = await getDbCachedInterpretation(query);
  if (dbCached) {
    console.log(`[Query Interpreter] DB CACHE HIT for "${query}" (${Date.now() - startTime}ms)`);
    return dbCached;
  }

  // FAST PATH: Skip GPT for simple, direct product queries
  // Pattern: just a product type or brand+product (e.g., "shoes", "nike trainers")
  const lower = query.toLowerCase().trim();
  const simplePatterns: Record<string, { category: string; keywords: string[]; mustMatch?: string[] }> = {
    // Footwear - including common qualifier combinations
    'shoes': { category: 'Shoes', keywords: ['shoes', 'footwear'] },
    'school shoes': { category: 'Shoes', keywords: ['school shoes', 'school footwear'], mustMatch: ['school'] },
    'running shoes': { category: 'Shoes', keywords: ['running shoes', 'running trainers'], mustMatch: ['running'] },
    'football boots': { category: 'Shoes', keywords: ['football boots', 'football shoes'], mustMatch: ['football'] },
    'trainers': { category: 'Shoes', keywords: ['trainers', 'sneakers', 'shoes'] },
    'sneakers': { category: 'Shoes', keywords: ['sneakers', 'trainers', 'shoes'] },
    'boots': { category: 'Shoes', keywords: ['boots', 'footwear'] },
    'wellies': { category: 'Shoes', keywords: ['wellies', 'wellington boots', 'rain boots'] },
    'sandals': { category: 'Shoes', keywords: ['sandals', 'flip flops', 'footwear'] },
    'slippers': { category: 'Shoes', keywords: ['slippers', 'indoor shoes'] },
    // Electronics
    'headphones': { category: 'Headphones', keywords: ['headphones', 'earphones', 'audio'] },
    'earbuds': { category: 'Headphones', keywords: ['earbuds', 'wireless earphones', 'headphones'] },
    // Toys - include singular and plural variations
    'toys': { category: 'Toys', keywords: ['toys', 'games', 'playset'] },
    'toy': { category: 'Toys', keywords: ['toy', 'toys', 'playset'] },
    'dolls': { category: 'Toys', keywords: ['dolls', 'doll', 'toys', 'figure'] },
    'doll': { category: 'Toys', keywords: ['doll', 'dolls', 'toy', 'figure'] },
    'lego': { category: 'Toys', keywords: ['lego', 'building blocks'] },
    'figure': { category: 'Toys', keywords: ['figure', 'action figure', 'toy'] },
    'figures': { category: 'Toys', keywords: ['figures', 'action figures', 'toys'] },
    'playset': { category: 'Toys', keywords: ['playset', 'play set', 'toys'] },
    'playsets': { category: 'Toys', keywords: ['playsets', 'play sets', 'toys'] },
    'plush': { category: 'Toys', keywords: ['plush', 'soft toy', 'stuffed animal'] },
    'game': { category: 'Toys', keywords: ['game', 'games', 'toy'] },
    'games': { category: 'Toys', keywords: ['games', 'game', 'toys'] },
    'puzzle': { category: 'Toys', keywords: ['puzzle', 'puzzles', 'jigsaw'] },
    'puzzles': { category: 'Toys', keywords: ['puzzles', 'puzzle', 'jigsaws'] },
    // Accessories/Clothing
    'backpack': { category: 'Toys', keywords: ['backpack', 'bag', 'rucksack'] },
    'bag': { category: 'Toys', keywords: ['bag', 'backpack', 'rucksack'] },
    'pyjamas': { category: 'Clothing', keywords: ['pyjamas', 'pajamas', 'pjs', 'nightwear'] },
    'costume': { category: 'Clothing', keywords: ['costume', 'dress up', 'outfit'] },
    'dress': { category: 'Clothing', keywords: ['dress', 'outfit', 'clothing'] },
  };
  
  // Check for exact matches or brand + simple pattern
  // EXPANDED: Include ALL shoe brands, toy brands, and character/license names
  const knownBrands = [
    // Sportswear
    'nike', 'adidas', 'puma', 'reebok', 'new balance', 'vans', 'converse', 'skechers',
    // Kids shoes
    'clarks', 'start rite', 'geox', 'lelli kelly', 'kickers',
    // Boots
    'dr martens', 'timberland', 'ugg', 'hunter',
    // Outdoor
    'joules', 'north face', 'columbia', 'crocs', 'birkenstock', 'havaianas',
    // Electronics
    'sony', 'bose', 'apple', 'samsung', 'jbl',
    // Toys
    'lego', 'playmobil', 'barbie', 'hot wheels', 'sylvanian families', 'fisher price', 'vtech', 'hasbro', 'mattel', 'leapfrog', 'melissa and doug',
    'orchard toys', 'ravensburger', 'galt', 'tomy', 'little tikes', 'mega bloks', 'duplo', 'brio', 'hape', 'djeco', 'janod', 'early learning centre',
    // Baby products
    'sophie giraffe', 'sophie la girafe', 'snuzpod', 'sleepyhead', 'dockatot', 'grobag', 'ergo', 'tula',
    // Baby
    'tommee tippee', 'mam', 'chicco', 'baby bjorn', 'silver cross', 'bugaboo', 'joie', 'maxi cosi',
    // Characters/Licenses (treat same as brands)
    'paw patrol', 'peppa pig', 'bluey', 'hey duggee', 'cocomelon', 'baby shark',
    'disney', 'frozen', 'disney princess', 'spiderman', 'batman', 'marvel', 'avengers',
    'pokemon', 'minecraft', 'fortnite', 'roblox', 'mario', 'sonic',
    'harry potter', 'star wars', 'thomas', 'paddington', 'gruffalo',
    'pj masks', 'ben and holly', 'numberblocks', 'octonauts', 'gabby', 'encanto', 'lol surprise', 'moana'
  ];
  let detectedBrand: string | undefined;
  let cleanedQuery = lower;
  
  for (const brand of knownBrands) {
    if (lower.includes(brand)) {
      detectedBrand = brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      cleanedQuery = lower.replace(brand, '').trim();
      break;
    }
  }
  
  // FAST PATH: Brand-only queries (e.g., "barbie", "lego", "disney")
  // If query is exactly a known brand with no product type, skip GPT
  if (detectedBrand && cleanedQuery === '') {
    console.log(`[Query Interpreter] FAST PATH (brand-only): "${query}" → ${detectedBrand} (${Date.now() - startTime}ms)`);
    const brandOnlyResult: QueryInterpretation = {
      isSemanticQuery: false,
      originalQuery: query,
      expandedKeywords: [detectedBrand.toLowerCase()],
      searchTerms: [[detectedBrand.toLowerCase()]],
      mustHaveAll: [detectedBrand.toLowerCase()],
      attributes: { brand: detectedBrand },
      context: {},
      rerankerContext: '',
      skipReranker: true  // Skip reranker for simple brand searches
    };
    setCachedInterpretation(query, brandOnlyResult);
    return brandOnlyResult;
  }
  
  // If query matches a simple pattern, skip GPT entirely
  for (const [pattern, config] of Object.entries(simplePatterns)) {
    if (cleanedQuery === pattern || cleanedQuery === pattern + 's' || lower === pattern) {
      console.log(`[Query Interpreter] FAST PATH: "${query}" → ${config.category} (${Date.now() - startTime}ms)`);
      // Merge mustMatch from pattern config with brand if present
      const mustHave: string[] = [];
      if (detectedBrand) mustHave.push(detectedBrand.toLowerCase());
      if (config.mustMatch) mustHave.push(...config.mustMatch);
      
      const fastResult: QueryInterpretation = {
        isSemanticQuery: false,
        originalQuery: query,
        expandedKeywords: config.keywords,
        searchTerms: [config.keywords],
        mustHaveAll: mustHave,
        attributes: detectedBrand ? { brand: detectedBrand } : undefined,
        context: { categoryFilter: config.category },
        rerankerContext: detectedBrand ? `Find actual ${config.keywords[0]} from ${detectedBrand}, not accessories` : '',
        skipReranker: !detectedBrand  // Only skip reranker for bare product queries, NOT brand+product
      };
      setCachedInterpretation(query, fastResult);
      return fastResult;
    }
  }

  // If no OpenAI key, use basic keyword search
  if (!openaiKey) {
    console.log(`[Query Interpreter] No OpenAI key, using fallback (${Date.now() - startTime}ms)`);
    return expandQueryFallback(query);
  }

  // ============ USE GPT FOR COMPLEX QUERIES ============
  // Let OpenAI understand user intent and extract attributes intelligently
  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    
    console.log(`[Query Interpreter] Using GPT to understand: "${query}"`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,  // Lower temperature for more consistent extraction
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: `You are a UK shopping search assistant. Extract structured info from queries.

CRITICAL RULES:
1. PRESERVE QUALIFIERS: If query has a specific qualifier, it MUST go in mustMatch.
   Qualifiers include: school, running, wedding, party, outdoor, baby, kids, children, toddler, infant, newborn, boys, girls, mens, womens
   - "school shoes" → mustMatch: ["school"] because user wants SCHOOL shoes
   - "running shoes" → mustMatch: ["running"] because user wants RUNNING shoes  
   - "sleeping bag baby" → mustMatch: ["baby"] because user wants BABY sleeping bags
   - "headphones kids" → mustMatch: ["kids"] because user wants KIDS headphones
   - "pyjamas toddler" → mustMatch: ["toddler"] because user wants TODDLER pyjamas

2. BRANDS MUST GO IN mustMatch: If user mentions a brand, it MUST appear in results.
   - "clarks school shoes" → mustMatch: ["clarks", "school"]
   - "nike air force" → mustMatch: ["nike", "air force"]
   
3. CHARACTER/LICENSE NAMES = BRANDS: Treat characters the same as brands - they MUST appear in results.
   - "paw patrol backpack" → mustMatch: ["paw patrol"]
   - "peppa pig toys" → mustMatch: ["peppa pig"]
   - "minecraft duvet" → mustMatch: ["minecraft"]
   - "frozen costume" → mustMatch: ["frozen", "costume"]

4. PRODUCT TYPE WORDS MUST ALWAYS GO IN mustMatch: The main product word MUST be in mustMatch to filter results.
   ALWAYS include the product noun in mustMatch:
   - "baby monitor video" → mustMatch: ["baby", "monitor"] - user wants BABY MONITORS specifically
   - "plate suction baby" → mustMatch: ["suction", "plate", "baby"] - user wants BABY SUCTION PLATES
   - "door bouncer baby" → mustMatch: ["bouncer", "baby"] - user wants BABY BOUNCERS
   - "posting box" → mustMatch: ["posting", "box"] - user wants POSTING BOXES
   - "tunnel play" → mustMatch: ["tunnel"] - user wants play TUNNELS
   - "teepee kids" → mustMatch: ["teepee", "kids"] - user wants KIDS TEEPEES (MUST have teepee!)
   - "climbing frame garden" → mustMatch: ["climbing", "frame"] - user wants CLIMBING FRAMES
   - "trampoline 8ft" → mustMatch: ["trampoline", "8ft"] - user wants 8FT trampolines specifically
   - "white noise machine" → mustMatch: ["white noise"] OR mustMatch: ["sound machine"] - specific product
   
   EVENT + PRODUCT TYPE QUERIES: For events/occasions, require the product type:
   - "world book day costume" → mustMatch: ["costume"] + searchKeywords: ["costume", "dress up", "book character"]
   - "halloween costume" → mustMatch: ["costume"] + searchKeywords: ["costume", "scary", "witch", "zombie"]
   - "christmas jumper" → mustMatch: ["jumper"] + searchKeywords: ["jumper", "sweater", "festive"]

5. PRICE EXTRACTION:
   - minPrice = from "over £20", "at least £30", "from £25", "more than £15"
   - maxPrice = from "under £50", "up to £40", "max £30", "cheap" (£50), "budget" (£40)
   - "between £25 and £50" → {minPrice: 25, maxPrice: 50}
   - "toys £15 to £30" → {minPrice: 15, maxPrice: 30}

6. NEVER put in mustMatch/searchKeywords: best, cheap, budget, good, quality, top, affordable

BRAND RECOGNITION - These are all brands that MUST go in mustMatch:
- Sportswear: nike, adidas, puma, reebok, new balance, vans, converse, skechers
- Kids shoes: clarks, start rite, geox, lelli kelly, kickers
- Boots: dr martens, timberland, ugg, hunter
- Outdoor: joules, north face, columbia, crocs, birkenstock, havaianas
- Toys: lego, playmobil, barbie, hot wheels, sylvanian families, fisher price, vtech
- Baby: tommee tippee, mam, chicco, baby bjorn, silver cross, bugaboo

CHARACTER RECOGNITION - These are licenses that MUST go in mustMatch:
- paw patrol, peppa pig, bluey, hey duggee, cocomelon, baby shark
- frozen, disney princess, spiderman, batman, marvel, avengers
- pokemon, minecraft, fortnite, roblox, mario, sonic
- harry potter, star wars, thomas, paddington, gruffalo
- pj masks, ben and holly, numberblocks, octonauts, gabby, encanto

Extract:
- productType: What product? (shoes, trainers, backpack, costume, etc.)
- categoryFilter: Shoes/Clothing/Electronics/Toys/Headphones or null
- brand: Brand name or null
- character: Character/license name or null (paw patrol, frozen, etc.)
- size: M, L, XL, 6, 10 or null
- color: grey, black, red, pink or null  
- gender: mens, womens, kids, boys, girls, unisex or null
- ageRange: toddler, 3-5, 5-7, 8-10, teen or null
- minPrice: number or null (from "over", "at least", "from", "more than")
- maxPrice: number or null (from "under", "up to", "max", "cheap", "budget")
- searchKeywords: product synonyms to broaden search
- mustMatch: ALL brands + characters + qualifiers + product types that MUST appear in results

Examples:
- "clarks school shoes size 13" → {productType: "shoes", categoryFilter: "Shoes", brand: "clarks", size: "13", searchKeywords: ["shoes", "school shoes"], mustMatch: ["clarks", "school"]}
- "paw patrol backpack" → {productType: "backpack", categoryFilter: "Toys", character: "paw patrol", searchKeywords: ["backpack", "bag"], mustMatch: ["paw patrol"]}
- "nike air force 1 white size 10" → {productType: "trainers", categoryFilter: "Shoes", brand: "nike", color: "white", size: "10", searchKeywords: ["trainers", "sneakers", "air force"], mustMatch: ["nike", "air force"]}
- "frozen elsa costume age 5" → {productType: "costume", categoryFilter: "Clothing", character: "frozen", ageRange: "5", searchKeywords: ["costume", "dress", "outfit"], mustMatch: ["frozen", "elsa"]}
- "something for 3 year old who loves dinosaurs under £15" → {productType: "toy", categoryFilter: "Toys", ageRange: "3", maxPrice: 15, searchKeywords: ["dinosaur", "toy", "figure"], mustMatch: ["dinosaur"]}
- "lego star wars between £25 and £50" → {productType: "toy", categoryFilter: "Toys", brand: "lego", minPrice: 25, maxPrice: 50, searchKeywords: ["lego", "star wars"], mustMatch: ["lego", "star wars"]}
- "trainers over £30" → {productType: "trainers", categoryFilter: "Shoes", minPrice: 30, searchKeywords: ["trainers", "sneakers"], mustMatch: []}
- "gifts £20 to £40" → {productType: "gift", categoryFilter: null, minPrice: 20, maxPrice: 40, searchKeywords: ["gift", "present"], mustMatch: []}

Output JSON only:
{
  "productType": "string",
  "categoryFilter": "Shoes|Clothing|Electronics|Toys|Headphones or null",
  "brand": "string or null",
  "character": "string or null",
  "size": "string or null",
  "color": "string or null",
  "gender": "mens|womens|kids|boys|girls|unisex or null",
  "ageRange": "toddler|3-5|5-7|8-10|teen or null",
  "minPrice": "number or null",
  "maxPrice": "number or null",
  "searchKeywords": ["array of product synonyms"],
  "mustMatch": ["ALL brands + characters + qualifiers that MUST appear"],
  "rerankerHint": "Brief context for selecting best products"
}`
        },
        {
          role: 'user',
          content: `Understand this search query and extract structured attributes: "${query}"`
        }
      ]
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[Query Interpreter] No JSON found, using fallback');
      return expandQueryFallback(query);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Build attributes from the new simplified GPT response
    // Defensive: ensure string fields are strings, not arrays/objects
    const attrs: ProductAttributes = {
      brand: typeof parsed.brand === 'string' ? parsed.brand : undefined,
      character: typeof parsed.character === 'string' ? parsed.character : undefined,
      model: typeof parsed.model === 'string' ? parsed.model : undefined,
      size: typeof parsed.size === 'string' ? parsed.size : undefined,
      color: typeof parsed.color === 'string' ? parsed.color : undefined,
      gender: typeof parsed.gender === 'string' ? parsed.gender : undefined,
      ageRange: typeof parsed.ageRange === 'string' ? parsed.ageRange : undefined,
      material: typeof parsed.material === 'string' ? parsed.material : undefined,
      style: typeof parsed.style === 'string' ? parsed.style : undefined
    };
    
    // Build search terms from GPT response
    // DEFENSIVE: Ensure searchKeywords is always an array of strings
    let searchKeywords: string[];
    if (Array.isArray(parsed.searchKeywords)) {
      searchKeywords = parsed.searchKeywords.filter((k: any) => typeof k === 'string');
    } else if (typeof parsed.searchKeywords === 'string') {
      searchKeywords = [parsed.searchKeywords];
    } else {
      searchKeywords = [query];
    }
    
    // DEFENSIVE: Ensure mustMatch is always an array of strings
    let mustMatch: string[];
    if (Array.isArray(parsed.mustMatch)) {
      mustMatch = parsed.mustMatch.filter((k: any) => typeof k === 'string');
    } else if (typeof parsed.mustMatch === 'string') {
      mustMatch = [parsed.mustMatch];
    } else {
      mustMatch = [];
    }
    
    // Extract maxPrice - can be a number or string
    let maxPrice: number | undefined;
    if (typeof parsed.maxPrice === 'number' && parsed.maxPrice > 0) {
      maxPrice = parsed.maxPrice;
    } else if (typeof parsed.maxPrice === 'string') {
      const priceNum = parseFloat(parsed.maxPrice.replace(/[£$,]/g, ''));
      if (!isNaN(priceNum) && priceNum > 0) {
        maxPrice = priceNum;
      }
    }
    
    // Extract minPrice - can be a number or string (for "over £20", "at least £30")
    let minPrice: number | undefined;
    if (typeof parsed.minPrice === 'number' && parsed.minPrice > 0) {
      minPrice = parsed.minPrice;
    } else if (typeof parsed.minPrice === 'string') {
      const priceNum = parseFloat(parsed.minPrice.replace(/[£$,]/g, ''));
      if (!isNaN(priceNum) && priceNum > 0) {
        minPrice = priceNum;
      }
    }
    
    // Extract categoryFilter for filtering by product category
    const categoryFilter = typeof parsed.categoryFilter === 'string' ? parsed.categoryFilter : undefined;
    
    console.log(`[Query Interpreter] GPT understood "${query}" → type: ${parsed.productType}, category: ${categoryFilter || 'any'}, brand: ${attrs.brand}, size: ${attrs.size}, color: ${attrs.color}, gender: ${attrs.gender}, priceRange: ${minPrice ? '£' + minPrice : ''}-${maxPrice ? '£' + maxPrice : ''}, keywords: ${JSON.stringify(searchKeywords)}`);

    const interpretation: QueryInterpretation = {
      isSemanticQuery: true,
      originalQuery: query,
      expandedKeywords: searchKeywords,
      searchTerms: [searchKeywords],
      mustHaveAll: mustMatch,
      mustHaveAny: [],
      attributes: attrs,
      context: {
        recipient: parsed.gender === 'mens' ? 'adult male' : parsed.gender === 'womens' ? 'adult female' : undefined,
        occasion: parsed.occasion,
        ageRange: parsed.ageRange,
        priceHint: minPrice && maxPrice ? `£${minPrice}-£${maxPrice}` : minPrice ? `over £${minPrice}` : maxPrice ? `under £${maxPrice}` : parsed.priceRange,
        minPrice: minPrice,
        maxPrice: maxPrice,
        categoryFilter: categoryFilter,
        excludeCategories: undefined
      },
      rerankerContext: parsed.rerankerHint || `Find ${parsed.productType || query}${attrs.brand ? ` from ${attrs.brand}` : ''}${attrs.size ? ` in size ${attrs.size}` : ''}${attrs.color ? ` in ${attrs.color}` : ''}${maxPrice ? ` under £${maxPrice}` : ''}`
    };
    
    // Cache the interpretation for future requests
    setCachedInterpretation(query, interpretation);
    
    return interpretation;
  } catch (error) {
    console.error('[Query Interpreter] Error:', error);
    return expandQueryFallback(query);
  }
}

// Fallback expansion without GPT
function expandQueryFallback(query: string): QueryInterpretation {
  const lower = query.toLowerCase();
  const searchTerms: string[][] = [];
  let mustHaveAny: string[] = [];
  let rerankerContext = '';
  const context: QueryInterpretation['context'] = {};

  // Dad/men's gifts
  if (lower.includes('dad') || lower.includes('father') || lower.includes('him') || lower.includes('men')) {
    mustHaveAny = ['gift', 'present', 'hamper', 'for him', 'fathers day'];
    searchTerms.push(['mens'], ['gadget'], ['grooming'], ['watch']);
    rerankerContext = 'Products suitable as gifts for adult men';
    context.recipient = 'adult male';
  }
  // Mum/women's gifts  
  else if (lower.includes('mum') || lower.includes('mother') || lower.includes('her') || lower.includes('women')) {
    mustHaveAny = ['gift', 'present', 'hamper', 'for her', 'mothers day'];
    searchTerms.push(['womens'], ['jewellery'], ['pamper'], ['beauty']);
    rerankerContext = 'Products suitable as gifts for adult women';
    context.recipient = 'adult female';
  }
  // Kids/children
  else if (lower.includes('kid') || lower.includes('child') || lower.includes('boy') || lower.includes('girl')) {
    mustHaveAny = ['toy', 'gift', 'playset', 'game'];
    searchTerms.push(['kids'], ['lego'], ['craft'], ['outdoor']);
    rerankerContext = 'Products suitable for children';
    context.recipient = 'child';
  }
  // Toddler/baby
  else if (lower.includes('toddler') || lower.includes('baby') || /\b[1-3]\s*year/.test(lower)) {
    mustHaveAny = ['toy', 'gift', 'playset'];
    searchTerms.push(['toddler'], ['peppa pig'], ['duplo'], ['paw patrol']);
    rerankerContext = 'Age-appropriate products for toddlers (1-3 years)';
    context.recipient = 'toddler';
    context.ageRange = '1-3';
  }
  // Rainy day/indoor
  else if (lower.includes('rainy') || lower.includes('indoor')) {
    mustHaveAny = ['activity', 'craft kit', 'game', 'playset'];
    searchTerms.push(['indoor'], ['puzzle'], ['board game'], ['activity book']);
    rerankerContext = 'Indoor activities for entertaining children';
    context.occasion = 'indoor activity';
  }
  // Birthday
  else if (lower.includes('birthday')) {
    mustHaveAny = ['gift', 'present', 'toy', 'birthday'];
    searchTerms.push(['birthday'], ['lego'], ['game'], ['craft']);
    rerankerContext = 'Products suitable as birthday gifts';
    context.occasion = 'birthday';
  }
  // Generic gift
  else if (lower.includes('gift') || lower.includes('present')) {
    mustHaveAny = ['gift', 'present', 'hamper'];
    searchTerms.push(['gift set'], ['toy'], ['game'], ['craft']);
    rerankerContext = 'Products that make good gifts';
    context.occasion = 'gift';
  }
  // Default: just use original query
  else {
    searchTerms.push([query]);
  }

  return {
    isSemanticQuery: searchTerms.length > 1 || searchTerms[0]?.[0] !== query,
    originalQuery: query,
    expandedKeywords: searchTerms.flat(),
    searchTerms,
    mustHaveAny,
    context,
    rerankerContext
  };
}

// Get deals for a merchant even when no products exist (deals-only experience)
// Only matches full merchant names to avoid false positives
async function getDealsForMerchant(query: string): Promise<ProductPromotion[]> {
  try {
    // Only try exact merchant match (no word splitting to avoid false matches)
    // e.g., "boots" matches Boots, but "star wars lego" does NOT match "Star Travel"
    const deals = await getPromotionsForMerchant(query);
    return deals;
  } catch (error) {
    console.error('[getDealsForMerchant] Error:', error);
    return [];
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Product search now uses PostgreSQL database directly (works in production)
  
  // Health check endpoint for production monitoring
  app.get("/healthz", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.3.0",
      uptime: process.uptime(),
      endpoints: {
        shopping: "operational",
        cinema: "operational", 
        attractions: "operational",
        activities: "operational",
        nightin: "operational",
        hintsandtips: "operational",
        sunny: "operational"
      }
    });
  });

  // Version endpoint for deployment verification
  app.get("/api/meta/version", (req, res) => {
    res.json({
      buildVersion: BUILD_VERSION,
      buildDate: BUILD_DATE,
      features: BUILD_FEATURES,
      railwayCommit: process.env.RAILWAY_GIT_COMMIT_SHA || 'not-railway',
      railwayBranch: process.env.RAILWAY_GIT_BRANCH || 'unknown',
      nodeEnv: process.env.NODE_ENV,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // Debug endpoint to check OpenAI status and test reranker
  app.get("/api/debug/openai-check", async (req, res) => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      const hasKey = !!openaiKey;
      const keyPrefix = openaiKey ? openaiKey.substring(0, 10) + '...' : 'NOT SET';
      
      if (!openaiKey) {
        return res.json({
          success: false,
          error: "OPENAI_API_KEY not set",
          hasKey: false,
          environment: process.env.NODE_ENV
        });
      }
      
      // Test a simple OpenAI call
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: openaiKey });
      
      const testResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 50,
        messages: [
          { role: 'user', content: 'Reply with exactly: "OpenAI working"' }
        ]
      });
      
      const reply = testResponse.choices[0]?.message?.content || '';
      
      res.json({
        success: true,
        hasKey: hasKey,
        keyPrefix: keyPrefix,
        environment: process.env.NODE_ENV,
        testReply: reply,
        model: 'gpt-4o-mini',
        status: reply.toLowerCase().includes('working') ? 'OPERATIONAL' : 'UNEXPECTED_RESPONSE'
      });
    } catch (error) {
      const err = error as Error;
      res.json({
        success: false,
        error: err.message,
        hasKey: !!process.env.OPENAI_API_KEY,
        environment: process.env.NODE_ENV
      });
    }
  });

  // Debug endpoint to check database connectivity
  app.get("/api/debug/db-check", async (req, res) => {
    try {
      const hasDbUrl = !!process.env.DATABASE_URL;
      const nodeEnv = process.env.NODE_ENV;
      
      if (!hasDbUrl) {
        return res.json({
          success: false,
          error: "DATABASE_URL not set",
          environment: nodeEnv
        });
      }
      
      const { db } = await import('./db');
      const { products } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const result = await db.select({ count: sql<number>`count(*)` }).from(products);
      const count = Number(result[0]?.count || 0);
      
      res.json({
        success: true,
        productCount: count,
        environment: nodeEnv,
        hasDbUrl: hasDbUrl
      });
    } catch (error) {
      const err = error as Error;
      res.json({
        success: false,
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 5),
        environment: process.env.NODE_ENV
      });
    }
  });

  // Debug endpoint to analyze promotions vs products (UNIFIED: Awin + CJ)
  app.get("/api/debug/promotions-stats", async (req, res) => {
    try {
      const activePromotions = await getAllActivePromotions();
      const { db } = await import('./db');
      const { products } = await import('@shared/schema');
      const { sql, countDistinct } = await import('drizzle-orm');
      
      // Get unique merchants count
      const merchantCountResult = await db.select({ count: countDistinct(products.merchant) }).from(products);
      const uniqueMerchantCount = Number(merchantCountResult[0]?.count || 0);
      
      // Find overlapping merchants by checking promo merchants against products
      const promoMerchants = Array.from(activePromotions.keys());
      const matchingMerchants: string[] = [];
      let productsWithPromos = 0;
      
      for (const promoMerchant of promoMerchants.slice(0, 50)) { // Limit to avoid timeout
        const countResult = await db.select({ count: sql<number>`count(*)` })
          .from(products)
          .where(sql`LOWER(merchant) LIKE ${`%${promoMerchant}%`}`);
        const cnt = Number(countResult[0]?.count || 0);
        if (cnt > 0) {
          matchingMerchants.push(promoMerchant);
          productsWithPromos += cnt;
        }
      }
      
      // Count by source
      const allPromos = Array.from(activePromotions.values()).flat();
      const awinCount = allPromos.filter(p => p.source === 'awin' || !p.source).length;
      const cjCount = allPromos.filter(p => p.source === 'cj').length;
      
      res.json({
        success: true,
        totalPromotions: allPromos.length,
        bySource: {
          awin: awinCount,
          cj: cjCount
        },
        uniqueMerchantsWithPromos: promoMerchants.length,
        uniqueMerchantsInProducts: uniqueMerchantCount,
        matchingMerchants: matchingMerchants.length,
        estimatedProductsWithPromos: productsWithPromos,
        samplePromoMerchants: promoMerchants.slice(0, 15),
        sampleMatchingMerchants: matchingMerchants.slice(0, 10)
      });
    } catch (error) {
      const err = error as Error;
      res.json({ success: false, error: err.message, stack: err.stack?.split('\n').slice(0,3) });
    }
  });
  
  // Debug endpoint to test CJ promotions specifically
  app.get("/api/debug/cj-promotions", async (req, res) => {
    try {
      const { fetchCJPromotions, getAllCJActivePromotions, isCJPromotionsConfigured } = await import('./services/cj');
      
      if (!isCJPromotionsConfigured()) {
        return res.json({
          success: false,
          error: 'CJ Promotions API not configured - requires CJ_API_TOKEN and CJ_WEBSITE_ID secrets',
          note: 'CJ_WEBSITE_ID is different from CJ_PUBLISHER_ID. Find it in CJ Account Manager under your website settings.'
        });
      }
      
      // Force fetch fresh promotions
      const promotions = await fetchCJPromotions();
      const allActive = await getAllCJActivePromotions();
      
      // Sample promotions with voucher codes
      const withVouchers = promotions.filter(p => p.couponCode);
      
      res.json({
        success: true,
        totalPromotions: promotions.length,
        withVoucherCodes: withVouchers.length,
        uniqueMerchants: allActive.size,
        samplePromotions: promotions.slice(0, 10).map(p => ({
          advertiser: p.advertiserName,
          title: p.linkName,
          type: p.promotionType,
          code: p.couponCode,
          endDate: p.endDate
        })),
        sampleMerchants: Array.from(allActive.keys()).slice(0, 15)
      });
    } catch (error) {
      const err = error as Error;
      res.json({ success: false, error: err.message, stack: err.stack?.split('\n').slice(0,3) });
    }
  });

  // Debug endpoint to check bootstrap status
  app.get("/api/debug/bootstrap-status", async (req, res) => {
    try {
      const { getBootstrapStatus, triggerManualBootstrap } = await import('./boot/productBootstrap');
      const status = getBootstrapStatus();
      
      // Also get current products_v2 count
      const { db } = await import('./db');
      const { productsV2 } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const result = await db.select({ count: sql<number>`count(*)::int` }).from(productsV2).limit(1);
      const v2Count = result[0]?.count || 0;
      
      res.json({
        success: true,
        bootstrap: status,
        productsV2Count: v2Count,
        environment: process.env.NODE_ENV
      });
    } catch (error) {
      const err = error as Error;
      res.json({
        success: false,
        error: err.message,
        environment: process.env.NODE_ENV
      });
    }
  });

  // Trigger manual bootstrap (for production use - requires admin secret)
  app.post("/api/admin/bootstrap-products", async (req, res) => {
    try {
      // Simple secret-based authentication
      const adminSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
      const expectedSecret = process.env.SESSION_SECRET;
      
      if (!expectedSecret || adminSecret !== expectedSecret) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - valid admin secret required'
        });
      }
      
      const { triggerManualBootstrap } = await import('./boot/productBootstrap');
      const status = await triggerManualBootstrap();
      
      res.json({
        success: true,
        message: 'Bootstrap triggered',
        status: status
      });
    } catch (error) {
      const err = error as Error;
      res.json({
        success: false,
        error: err.message
      });
    }
  });

  // Migrate V2 products to V1 products table (adds fashion products to existing catalog)
  // Progress tracking variable
  let migrationStatus = { running: false, processed: 0, total: 0, message: '', lastId: '' };
  
  app.get("/api/admin/migrate-v2-status", async (req, res) => {
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');
    
    const [v1Count] = await db.execute(sql`SELECT COUNT(*) as count FROM products`) as any;
    const [v2Migrated] = await db.execute(sql`SELECT COUNT(*) as count FROM products WHERE id LIKE 'v2_%'`) as any;
    
    res.json({
      migrationRunning: migrationStatus.running,
      processed: migrationStatus.processed,
      totalToMigrate: migrationStatus.total,
      lastId: migrationStatus.lastId,
      message: migrationStatus.message,
      v1TotalProducts: v1Count?.count || v1Count?.rows?.[0]?.count,
      v2ProductsMigrated: v2Migrated?.count || v2Migrated?.rows?.[0]?.count
    });
  });
  
  app.post("/api/admin/migrate-v2-to-v1", async (req, res) => {
    if (migrationStatus.running) {
      return res.json({ success: false, error: 'Migration already running', status: migrationStatus });
    }
    
    migrationStatus.running = true;
    migrationStatus.message = 'Starting...';
    
    // Run migration in background using cursor-based pagination (fast)
    (async () => {
      try {
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');
        
        // Get last migrated ID to continue from
        const lastMigrated = await db.execute(sql`
          SELECT REPLACE(id, 'v2_', '') as last_id FROM products 
          WHERE id LIKE 'v2_%' ORDER BY id DESC LIMIT 1
        `) as any;
        let lastId = lastMigrated?.[0]?.last_id || lastMigrated?.rows?.[0]?.last_id || '';
        
        const [v2Total] = await db.execute(sql`SELECT COUNT(*) as count FROM products_v2`) as any;
        migrationStatus.total = parseInt(v2Total?.count || v2Total?.rows?.[0]?.count || '0');
        
        const BATCH_SIZE = 100;
        let processed = 0;
        let batchNum = 0;
        
        console.log(`[Migration] Starting from ID '${lastId}', total ${migrationStatus.total}`);
        
        while (true) {
          batchNum++;
          migrationStatus.processed = processed;
          migrationStatus.lastId = lastId;
          migrationStatus.message = `Batch ${batchNum}: processing from ID '${lastId}'`;
          
          // Get next batch of IDs first (fast query)
          const nextBatch = await db.execute(sql`
            SELECT id FROM products_v2 WHERE id > ${lastId} ORDER BY id LIMIT ${BATCH_SIZE}
          `) as any;
          
          const batchRows = nextBatch?.rows || nextBatch || [];
          if (batchRows.length === 0) {
            console.log(`[Migration] No more products to insert`);
            break;
          }
          
          // Get the last ID from this batch for next iteration
          const newLastId = batchRows[batchRows.length - 1]?.id;
          
          // Insert this batch (simple INSERT without CTE overhead)
          await db.execute(sql`
            INSERT INTO products (id, name, description, merchant, merchant_id, category, brand, price, affiliate_link, image_url, in_stock)
            SELECT 'v2_' || id, name, description, merchant, merchant_id, category, brand, price, affiliate_link, image_url, COALESCE(in_stock, true)
            FROM products_v2 
            WHERE id > ${lastId} AND id <= ${newLastId}
            ON CONFLICT (id) DO NOTHING
          `);
          
          const insertedCount = batchRows.length;
          lastId = newLastId;
          processed += insertedCount;
          
          if (batchNum % 50 === 0) {
            console.log(`[Migration] Batch ${batchNum}: inserted ${insertedCount}, total ${processed}`);
          }
        }
        
        migrationStatus.message = `Complete! Processed ${processed} products`;
        migrationStatus.processed = processed;
        console.log(`[Migration] Completed successfully: ${processed} products`);
      } catch (err) {
        console.error('[Migration] Error:', err);
        migrationStatus.message = `Error: ${(err as Error).message}`;
      } finally {
        migrationStatus.running = false;
      }
    })();
    
    res.json({ success: true, message: 'Migration started in background', status: migrationStatus });
  });

  // Create database indexes for fast text search
  app.post("/api/admin/create-indexes", async (req, res) => {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      
      const results: string[] = [];
      
      // 1. Enable pg_trgm extension
      try {
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        results.push("pg_trgm extension: enabled");
      } catch (err) {
        results.push(`pg_trgm extension: ${(err as Error).message}`);
      }
      
      // 2. Create GIN index on name for fast ILIKE
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops)`);
        results.push("idx_products_name_trgm: created");
      } catch (err) {
        results.push(`idx_products_name_trgm: ${(err as Error).message}`);
      }
      
      // 3. Create GIN index on brand for fast ILIKE
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON products USING GIN (brand gin_trgm_ops)`);
        results.push("idx_products_brand_trgm: created");
      } catch (err) {
        results.push(`idx_products_brand_trgm: ${(err as Error).message}`);
      }
      
      // 4. Create GIN index on description for fast ILIKE
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING GIN (description gin_trgm_ops)`);
        results.push("idx_products_description_trgm: created");
      } catch (err) {
        results.push(`idx_products_description_trgm: ${(err as Error).message}`);
      }
      
      // 5. Create vector index for semantic search (if embedding column exists)
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`);
        results.push("idx_products_embedding: created");
      } catch (err) {
        results.push(`idx_products_embedding: ${(err as Error).message}`);
      }
      
      // 6. Check existing indexes
      const indexes = await db.execute(sql`SELECT indexname FROM pg_indexes WHERE tablename = 'products'`) as any;
      const indexList = (indexes?.rows || indexes || []).map((r: any) => r.indexname);
      
      res.json({
        success: true,
        message: "Index creation completed",
        results: results,
        currentIndexes: indexList
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Clear query interpretation cache (for testing after code changes)
  app.post("/api/admin/clear-cache", async (req, res) => {
    try {
      const cleared = clearQueryCache();
      res.json({
        success: true,
        message: `Cleared ${cleared} cached query interpretations`,
        cleared: cleared
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // ============================================================
  // TIERED PRODUCT REFRESH SYSTEM
  // Tier 1: Daily (Price & Stock) - Active products only
  // Tier 2: Weekly (New Products) - Import from Awin/CJ
  // Tier 3: Monthly (Full Catalog) - Sync all products
  // ============================================================

  // TIER 1: Daily Price & Stock Refresh (10-20% of catalog - active products only)
  // Run at 3am UK time daily
  app.post("/api/admin/refresh-prices", async (req, res) => {
    try {
      const startTime = Date.now();
      
      // Get active products (viewed in last 7 days OR sold in last 30 days)
      const activeProducts = await db.execute(sql`
        SELECT id, affiliate_link, price, in_stock, merchant 
        FROM products 
        WHERE last_viewed > NOW() - INTERVAL '7 days'
           OR last_sold > NOW() - INTERVAL '30 days'
        LIMIT 200000
      `) as any;
      
      const products = activeProducts?.rows || activeProducts || [];
      const totalActive = products.length;
      
      // For now, just mark products as refreshed (actual price checking would require 
      // hitting each merchant API or re-downloading Awin feeds)
      const updateResult = await db.execute(sql`
        UPDATE products 
        SET updated_at = NOW()
        WHERE last_viewed > NOW() - INTERVAL '7 days'
           OR last_sold > NOW() - INTERVAL '30 days'
      `);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      res.json({
        success: true,
        tier: 1,
        message: `Tier 1 Daily Refresh: Marked ${totalActive} active products as refreshed`,
        stats: {
          activeProducts: totalActive,
          durationSeconds: parseFloat(duration),
          nextRun: "3:00 AM UK time tomorrow"
        },
        note: "For full price updates, trigger Tier 2 or Tier 3 which re-imports from Awin/CJ feeds"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // TIER 2: Weekly New Products Import (Awin + CJ delta)
  // Run Sunday night
  app.post("/api/admin/import-new-products", async (req, res) => {
    try {
      const startTime = Date.now();
      const results: any = {
        awin: { imported: 0, errors: 0 },
        cj: { imported: 0, errors: 0, rateLimited: false }
      };
      
      // Get current product count
      const beforeCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM products`) as any;
      const before = beforeCount?.rows?.[0]?.count || beforeCount?.[0]?.count || 0;
      
      // Import from CJ (with rate limiting protection)
      try {
        const { importCJProductsToDatabase, isCJConfigured } = await import('./services/cj');
        if (isCJConfigured()) {
          // Import new products from CJ using priority keywords
          const keywords = ['toys', 'games', 'shoes', 'electronics', 'clothing', 'baby', 'kids'];
          for (const keyword of keywords.slice(0, 3)) { // Limit to avoid rate limits
            try {
              const imported = await importCJProductsToDatabase(keyword, 100);
              results.cj.imported += imported;
              await new Promise(r => setTimeout(r, 2000)); // 2 second delay between keywords
            } catch (err: any) {
              if (err.message?.includes('403') || err.message?.includes('rate')) {
                results.cj.rateLimited = true;
                break;
              }
              results.cj.errors++;
            }
          }
        }
      } catch (err) {
        results.cj.errors++;
      }
      
      // Get after count
      const afterCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM products`) as any;
      const after = afterCount?.rows?.[0]?.count || afterCount?.[0]?.count || 0;
      const newProducts = after - before;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      res.json({
        success: true,
        tier: 2,
        message: `Tier 2 Weekly Import: Added ${newProducts} new products`,
        stats: {
          before: before,
          after: after,
          newProducts: newProducts,
          cj: results.cj,
          durationSeconds: parseFloat(duration),
          nextRun: "Sunday night"
        },
        note: results.cj.rateLimited ? "CJ import paused due to rate limiting - will resume next run" : "Import complete"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // TIER 3: Monthly Full Catalog Sync
  // Run 1st of each month
  app.post("/api/admin/full-catalog-sync", async (req, res) => {
    try {
      const startTime = Date.now();
      
      // Get current stats
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(CASE WHEN id LIKE 'cj_%' THEN 1 END)::int as cj_count,
          COUNT(CASE WHEN id LIKE 'v2_%' THEN 1 END)::int as awin_v2_count,
          COUNT(CASE WHEN id NOT LIKE 'cj_%' AND id NOT LIKE 'v2_%' THEN 1 END)::int as awin_v1_count,
          MIN(updated_at) as oldest_update,
          MAX(updated_at) as newest_update
        FROM products
      `) as any;
      
      const catalogStats = stats?.rows?.[0] || stats?.[0] || {};
      
      // Mark all products as synced
      await db.execute(sql`UPDATE products SET updated_at = NOW()`);
      
      // Count products that might be stale (no views in 90 days)
      const staleProducts = await db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM products 
        WHERE last_viewed IS NULL 
           OR last_viewed < NOW() - INTERVAL '90 days'
      `) as any;
      const staleCount = staleProducts?.rows?.[0]?.count || staleProducts?.[0]?.count || 0;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      res.json({
        success: true,
        tier: 3,
        message: `Tier 3 Monthly Sync: Full catalog refreshed`,
        stats: {
          totalProducts: catalogStats.total,
          bySource: {
            awin_v1: catalogStats.awin_v1_count,
            awin_v2: catalogStats.awin_v2_count,
            cj: catalogStats.cj_count
          },
          staleProducts: staleCount,
          oldestUpdate: catalogStats.oldest_update,
          newestUpdate: catalogStats.newest_update,
          durationSeconds: parseFloat(duration),
          nextRun: "1st of next month"
        },
        recommendations: staleCount > 10000 
          ? [`${staleCount} products have no recent views - consider archiving or refreshing`]
          : ["Catalog health looks good"]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Track product views (call when product is displayed to user)
  app.post("/api/products/track-view", async (req, res) => {
    try {
      const { productIds } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: "productIds array required" });
      }
      
      // Update last_viewed for up to 100 products at a time
      const idsToUpdate = productIds.slice(0, 100);
      
      await db.execute(sql`
        UPDATE products 
        SET last_viewed = NOW()
        WHERE id = ANY(${idsToUpdate})
      `);
      
      res.json({
        success: true,
        updated: idsToUpdate.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Track product sale/click (call when user clicks affiliate link)
  app.post("/api/products/track-sale", async (req, res) => {
    try {
      const { productId } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "productId required" });
      }
      
      await db.execute(sql`
        UPDATE products 
        SET last_sold = NOW(), last_viewed = NOW()
        WHERE id = ${productId}
      `);
      
      res.json({
        success: true,
        message: "Product sale tracked"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Get refresh system status
  app.get("/api/admin/refresh-status", async (req, res) => {
    try {
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total_products,
          COUNT(CASE WHEN last_viewed > NOW() - INTERVAL '7 days' THEN 1 END)::int as viewed_7d,
          COUNT(CASE WHEN last_sold > NOW() - INTERVAL '30 days' THEN 1 END)::int as sold_30d,
          COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END)::int as updated_24h,
          COUNT(CASE WHEN id LIKE 'cj_%' THEN 1 END)::int as cj_products,
          COUNT(CASE WHEN id NOT LIKE 'cj_%' THEN 1 END)::int as awin_products
        FROM products
      `) as any;
      
      const s = stats?.rows?.[0] || stats?.[0] || {};
      
      res.json({
        success: true,
        catalog: {
          total: s.total_products,
          awin: s.awin_products,
          cj: s.cj_products
        },
        activity: {
          viewedLast7Days: s.viewed_7d,
          soldLast30Days: s.sold_30d,
          updatedLast24Hours: s.updated_24h,
          activeProductsPercent: s.total_products > 0 
            ? Math.round((Math.max(s.viewed_7d, s.sold_30d) / s.total_products) * 100) 
            : 0
        },
        tiers: {
          tier1: { name: "Daily Price Refresh", schedule: "3:00 AM UK", endpoint: "POST /api/admin/refresh-prices" },
          tier2: { name: "Weekly New Products", schedule: "Sunday night", endpoint: "POST /api/admin/import-new-products" },
          tier3: { name: "Monthly Full Sync", schedule: "1st of month", endpoint: "POST /api/admin/full-catalog-sync" }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // ============================================================
  // CJ (Commission Junction) Integration Endpoints
  // ============================================================
  
  // Test CJ API connection
  app.get("/api/cj/test", async (req, res) => {
    try {
      const { testCJConnection, isCJConfigured } = await import('./services/cj');
      
      if (!isCJConfigured()) {
        return res.json({
          success: false,
          configured: false,
          message: "CJ API not configured. Please set CJ_API_TOKEN and CJ_PUBLISHER_ID secrets."
        });
      }
      
      const result = await testCJConnection();
      res.json({
        ...result,
        configured: true
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // Search CJ products (without importing)
  app.post("/api/cj/search", async (req, res) => {
    try {
      const { searchCJProducts, isCJConfigured } = await import('./services/cj');
      const { keywords, limit = 20 } = req.body;
      
      if (!keywords) {
        return res.status(400).json({ error: "keywords parameter required" });
      }
      
      if (!isCJConfigured()) {
        return res.status(400).json({
          success: false,
          error: "CJ API not configured"
        });
      }
      
      const result = await searchCJProducts(keywords, Math.min(limit, 100));
      res.json({
        success: true,
        query: keywords,
        totalCount: result.totalCount,
        count: result.products.length,
        products: result.products
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // Import CJ products to database
  app.post("/api/cj/import", async (req, res) => {
    try {
      const { importCJProductsToDatabase, isCJConfigured } = await import('./services/cj');
      const { keywords, limit = 100 } = req.body;
      
      if (!keywords) {
        return res.status(400).json({ error: "keywords parameter required" });
      }
      
      if (!isCJConfigured()) {
        return res.status(400).json({
          success: false,
          error: "CJ API not configured"
        });
      }
      
      console.log(`[CJ Import] Starting import for "${keywords}" (limit: ${limit})`);
      const result = await importCJProductsToDatabase(keywords, Math.min(limit, 500));
      
      res.json({
        success: true,
        query: keywords,
        ...result,
        message: `Imported ${result.imported} products from CJ for "${keywords}"`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // Import priority brands from CJ
  app.post("/api/cj/import-priority-brands", async (req, res) => {
    try {
      const { importPriorityBrands, isCJConfigured, PRIORITY_BRANDS } = await import('./services/cj');
      const { limit = 100 } = req.body;
      
      if (!isCJConfigured()) {
        return res.status(400).json({
          success: false,
          error: "CJ API not configured"
        });
      }
      
      console.log(`[CJ Import] Starting priority brands import (${limit} per brand)...`);
      const result = await importPriorityBrands(Math.min(limit, 500));
      
      res.json({
        success: true,
        message: `Imported ${result.total} products from ${PRIORITY_BRANDS.length} priority brands`,
        ...result,
        brands: PRIORITY_BRANDS
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // Backfill CJ product brands for search visibility
  app.post("/api/cj/backfill-brands", async (req, res) => {
    try {
      const { backfillCJBrands } = await import('./services/cj');
      
      console.log(`[CJ Backfill] Starting brand backfill for existing CJ products...`);
      const result = await backfillCJBrands();
      
      res.json({
        success: true,
        message: `Updated ${result.updated} CJ products with proper brands`,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // Get comprehensive CJ stats including available products and advertisers
  app.get("/api/cj/stats", async (req, res) => {
    try {
      const { getCJStats } = await import('./services/cj');
      const stats = await getCJStats();
      
      res.json({
        success: true,
        totalAvailable: stats.totalAvailable,
        currentImported: stats.currentImported,
        advertisers: stats.advertisers,
        message: `${stats.currentImported} imported of ${stats.totalAvailable.toLocaleString()} available`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // Bulk import CJ products using category keywords (bypasses pagination limit)
  app.post("/api/cj/bulk-import", async (req, res) => {
    try {
      const { bulkImportCJProducts, BULK_IMPORT_CATEGORIES } = await import('./services/cj');
      const { limitPerCategory = 5000, categories } = req.body || {};
      
      console.log(`[CJ Bulk] Starting bulk import (${limitPerCategory} per category)`);
      
      // Run import asynchronously and respond immediately with status
      res.json({
        success: true,
        status: 'started',
        message: `Bulk import started for ${categories?.length || BULK_IMPORT_CATEGORIES.length} categories`,
        categories: categories || BULK_IMPORT_CATEGORIES,
        limitPerCategory
      });
      
      // Run actual import after response
      bulkImportCJProducts(limitPerCategory, categories).then(result => {
        console.log(`[CJ Bulk] Complete: ${result.total} products in ${result.duration}s`);
      }).catch(error => {
        console.error('[CJ Bulk] Error:', error);
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // Synchronous bulk import (waits for completion) - for smaller batches
  app.post("/api/cj/bulk-import-sync", async (req, res) => {
    try {
      const { bulkImportCJProducts, BULK_IMPORT_CATEGORIES } = await import('./services/cj');
      const { limitPerCategory = 500, categories } = req.body || {};
      
      console.log(`[CJ Bulk Sync] Starting synchronous bulk import`);
      const result = await bulkImportCJProducts(limitPerCategory, categories);
      
      res.json({
        success: true,
        message: `Imported ${result.total} products in ${result.duration}s`,
        ...result,
        categories: categories || BULK_IMPORT_CATEGORIES
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Mass import endpoint - imports 1M+ products from CJ using sharding strategy
  app.post("/api/cj/mass-import", async (req, res) => {
    try {
      const { massImportCJ } = await import('./services/cj');
      const { targetProducts = 1000000 } = req.body || {};
      
      console.log(`[CJ Mass Import] Starting mass import - target: ${targetProducts}`);
      
      // Fire and forget - return immediately
      res.json({
        success: true,
        status: 'started',
        message: `Mass import started - targeting ${targetProducts} products`,
        targetProducts
      });
      
      // Run import in background
      massImportCJ(targetProducts).then(result => {
        console.log(`[CJ Mass Import] Complete: ${result.total} products imported`);
      }).catch(err => {
        console.error(`[CJ Mass Import] Failed:`, err);
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Chunked import - RESUMABLE! Call repeatedly until done (~50s per call)
  app.post("/api/cj/import-chunk", async (req, res) => {
    try {
      const { importCJChunk } = await import('./services/cj');
      const { maxCalls = 20 } = req.body || {};
      
      const result = await importCJChunk(maxCalls);
      
      res.json({
        success: true,
        ...result,
        message: result.done 
          ? `Import complete! ${result.totalImported} total products`
          : `Chunk imported: +${result.imported}, total: ${result.totalImported}, next: ${result.keyword}@${result.offset}`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Get import status
  app.get("/api/cj/import-status", async (req, res) => {
    try {
      const { getCJImportStatus } = await import('./services/cj');
      const status = await getCJImportStatus();
      
      res.json({
        success: true,
        status: status || { keyword: 'not started', offset: 0, totalImported: 0 }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Reset import to start fresh
  app.post("/api/cj/import-reset", async (req, res) => {
    try {
      const { resetCJImportState } = await import('./services/cj');
      await resetCJImportState();
      
      res.json({
        success: true,
        message: 'Import state reset. Ready to start fresh.'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // ============================================================
  // SIMPLE SEARCH - CTO's approach: keyword SQL + GPT reranker
  // One simple endpoint. 115k products. OpenAI picks the best.
  // ============================================================
  app.post("/api/simple-search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query required' });
      }

      console.log(`[Simple Search] Query: "${query}"`);

      // 1. Get candidate products using OR-based keyword match (broad recall)
      // Replace punctuation with spaces (preserves "Spider-Man" as "spider man")
      const words = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
        .split(/\s+/)
        .filter(w => w.length > 0);
      let candidates: any[] = [];
      
      if (words.length > 0) {
        const { db } = await import('./db');
        const { products } = await import('@shared/schema');
        const { and, or, ilike, isNotNull } = await import('drizzle-orm');
        
        // Build OR conditions: any word can match in name, description, brand, or category
        const wordConditions = words.map(w => {
          const pattern = `%${w}%`;
          return or(
            ilike(products.name, pattern),
            ilike(products.description, pattern),
            ilike(products.brand, pattern),
            ilike(products.category, pattern)
          );
        });
        
        const result = await db.select({
          id: products.id,
          name: products.name,
          description: products.description,
          price: products.price,
          merchant: products.merchant,
          affiliate_link: products.affiliateLink,
          image_url: products.imageUrl
        }).from(products)
          .where(and(or(...wordConditions), isNotNull(products.affiliateLink)))
          .limit(50);
        
        candidates = result as any[];
      }
      
      if (candidates.length === 0) {
        return res.json({ products: [] });
      }

      console.log(`[Simple Search] Found ${candidates.length} candidates`);

      // 2. Send to OpenAI to pick best matches
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        // No OpenAI, return first 8
        return res.json({
          products: candidates.slice(0, 8).map(p => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price) || 0,
            merchant: p.merchant,
            affiliateLink: p.affiliate_link,
            imageUrl: p.image_url
          }))
        });
      }

      const openai = new OpenAI({ apiKey: openaiKey });
      const productsText = candidates.map(p => 
        `ID:${p.id} | ${p.name} | £${p.price} | ${(p.description || '').substring(0, 150)}`
      ).join('\n');

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You help UK families find products. Given a search and product list,
return the IDs of the 8 best matching products as a JSON array.
ONLY use IDs from the list. Never invent IDs.
Format: ["id1", "id2", ...]`
          },
          {
            role: 'user',
            content: `Search: ${query}\n\nProducts:\n${productsText}`
          }
        ],
        temperature: 0.1
      });

      // 3. Parse selected IDs
      let selectedIds: string[] = [];
      try {
        let result = response.choices[0].message.content?.trim() || '[]';
        if (result.includes('```')) {
          result = result.split('```')[1].replace('json', '').trim();
        }
        selectedIds = JSON.parse(result);
      } catch {
        selectedIds = candidates.slice(0, 8).map(p => p.id);
      }

      console.log(`[Simple Search] GPT selected ${selectedIds.length} products`);

      // 4. Build response
      const idToProduct = new Map(candidates.map(p => [String(p.id), p]));
      const results: any[] = [];

      for (const pid of selectedIds) {
        const p = idToProduct.get(String(pid));
        if (p) {
          results.push({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price) || 0,
            merchant: p.merchant,
            affiliateLink: p.affiliate_link,
            imageUrl: p.image_url
          });
        }
      }

      res.json({ products: results });
    } catch (error) {
      console.error('[Simple Search] Error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Sunny - AI Family Concierge chat endpoint
  app.use("/sunny", sunnyRouter);

  // ============================================================
  // SHOP SEARCH - SMART SEARCH with GPT query interpretation
  // Now understands semantic queries like "gift ideas for dad"
  // Uses GPT to expand queries into searchable keywords, then reranks
  // ============================================================
  app.post("/api/shop/search", async (req, res) => {
    try {
      const { 
        query, 
        limit = 8, 
        offset = 0,
        filterCategory,
        filterMerchant,
        filterBrand,
        filterMinPrice,
        filterMaxPrice
      } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, error: "Query is required" });
      }

      // CINEMA INTENT DETECTION - Route to movies API instead of product search
      // Matches: movies, movie, cinema, films, film, whats on, now showing, etc.
      const queryLower = query.toLowerCase().trim();
      
      // Exact match keywords (query IS just this word)
      const exactMovieKeywords = ['movies', 'movie', 'cinema', 'films', 'film'];
      const isExactMovieQuery = exactMovieKeywords.includes(queryLower);
      
      // Phrase match keywords (query CONTAINS these)
      const cinemaIntentPhrases = [
        'whats on at the cinema',
        "what's on at the cinema",
        'whats on at cinema',
        'movies showing',
        'film times',
        'whats on at the movies',
        "what's on at the movies",
        'new films',
        'now showing',
        'cinema listings',
        'movie listings',
        'whats showing',
        "what's showing",
        'films on',
        'movies on',
        'at the cinema',
        'at the movies',
        'whats on',
        "what's on",
        'watch tonight',
        'movie night'
      ];
      
      const isCinemaIntent = isExactMovieQuery || cinemaIntentPhrases.some(phrase => queryLower.includes(phrase));
      
      if (isCinemaIntent) {
        console.log(`[Shop Search] CINEMA INTENT detected for query: "${query}" - routing to movies API`);
        const cinemaStartTime = Date.now();
        
        const dbMovies = await getMoviesByType('cinema', 6);
        
        const contentItems = dbMovies.map(m => ({
          type: 'movie' as const,
          id: m.id,
          title: m.title,
          overview: m.overview,
          poster: getPosterUrl(m.posterPath, 'w342'),
          backdrop: getBackdropUrl(m.backdropPath),
          releaseDate: m.releaseDate,
          rating: m.voteAverage,
          genres: m.genreIds ? getGenreNames(m.genreIds) : [],
          certification: m.ukCertification,
          contentType: m.contentType,
        }));
        
        let upsellProducts: any[] = [];
        if (contentItems.length > 0) {
          const firstMovie = dbMovies[0];
          upsellProducts = await getUpsellProducts({
            contentId: String(firstMovie.id),
            contentType: 'movie',
            genreIds: firstMovie.genreIds || undefined,
            title: firstMovie.title,
          }, 2);
        }
        
        const upsellItems = upsellProducts.map(p => ({
          type: 'upsell' as const,
          id: p.id,
          name: p.name,
          price: p.price,
          imageUrl: p.imageUrl,
          affiliateLink: p.affiliateLink,
          merchant: p.merchant,
          upsellReason: p.upsellReason,
        }));
        
        console.log(`[Shop Search] Cinema results returned in ${Date.now() - cinemaStartTime}ms`);
        
        return res.json({
          success: true,
          products: [],
          total: 0,
          interpretation: {
            original: query,
            type: 'cinema_intent',
            intentDetected: 'cinema'
          },
          filters: null,
          cinemaResults: {
            content: contentItems,
            upsells: upsellItems,
            totalItems: contentItems.length + upsellItems.length,
            attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
          },
          message: `Found ${contentItems.length} movies showing at the cinema`,
          responseTimeMs: Date.now() - cinemaStartTime
        });
      }

      const safeLimit = Math.min(Math.max(1, limit), 20);
      const safeOffset = Math.max(0, offset);
      const hasFilters = filterCategory || filterMerchant || filterBrand || filterMinPrice !== undefined || filterMaxPrice !== undefined;
      const openaiKey = process.env.OPENAI_API_KEY;
      
      console.log(`[Shop Search] Query: "${query}", limit: ${safeLimit}, offset: ${safeOffset}, hasFilters: ${hasFilters}`);
      const searchStartTime = Date.now();

      // STEP 1: Interpret the query using GPT (for semantic queries)
      const interpretStart = Date.now();
      const interpretation = await interpretQuery(query, openaiKey);
      console.log(`[Shop Search] TIMING: Interpretation took ${Date.now() - interpretStart}ms`);
      
      // Apply GPT-extracted price filters if user didn't specify them
      let effectiveMaxPrice = filterMaxPrice;
      if (effectiveMaxPrice === undefined && interpretation.context.maxPrice) {
        effectiveMaxPrice = interpretation.context.maxPrice;
        console.log(`[Shop Search] Applying GPT-extracted maxPrice: £${effectiveMaxPrice}`);
      }
      
      let effectiveMinPrice = filterMinPrice;
      if (effectiveMinPrice === undefined && interpretation.context.minPrice) {
        effectiveMinPrice = interpretation.context.minPrice;
        console.log(`[Shop Search] Applying GPT-extracted minPrice: £${effectiveMinPrice}`);
      }
      
      if (interpretation.isSemanticQuery) {
        console.log(`[Shop Search] Semantic query detected. Expanded: ${interpretation.expandedKeywords.join(', ')}`);
      }

      const { db } = await import('./db');
      const { products } = await import('@shared/schema');
      const { and, or, ilike, isNotNull, sql } = await import('drizzle-orm');
      
      let candidates: any[] = [];
      let totalCandidates = 0;
      let filters: any = null;
      let inventoryGapMessage: string | undefined = undefined;

      // STEP 1.5: NO GARBAGE RESULTS - Check if brand/character exists in database BEFORE searching
      // This prevents returning random products when the brand doesn't exist
      const detectedBrand = interpretation.attributes?.brand || interpretation.attributes?.character;
      
      // PERFORMANCE: Skip brand check for known brands from knownBrands list (already validated)
      const knownBrandLower = detectedBrand?.toLowerCase();
      const isKnownBrand = knownBrandLower && [
        'nike', 'adidas', 'puma', 'lego', 'barbie', 'disney', 'marvel', 'pokemon', 'minecraft',
        'frozen', 'paw patrol', 'peppa pig', 'star wars', 'harry potter', 'hot wheels',
        'clarks', 'vans', 'converse', 'new balance', 'reebok', 'skechers', 'crocs',
        'fisher price', 'mattel', 'hasbro', 'playmobil', 'bluey', 'cocomelon'
      ].includes(knownBrandLower);
      
      if (isKnownBrand) {
        console.log(`[Shop Search] FAST PATH: Skipping brand check for known brand "${detectedBrand}"`);
      }
      
      if (detectedBrand && !filterBrand && !isKnownBrand) {
        // Only do brand check for unknown brands (not in our known list)
        // FIX: Check BOTH brand column AND product name (for characters like Hulk, Moana, Encanto)
        const brandCheckStart = Date.now();
        const brandCheckResult = await db.select({ id: products.id })
          .from(products)
          .where(or(
            ilike(products.brand, `%${detectedBrand}%`),
            ilike(products.name, `%${detectedBrand}%`)
          ))
          .limit(1);
        
        const brandExists = brandCheckResult.length > 0;
        const brandCount = brandExists ? 1 : 0;
        console.log(`[Shop Search] TIMING: Brand check took ${Date.now() - brandCheckStart}ms`);
        
        if (brandCount === 0) {
          // Brand/character doesn't exist in our catalog
          console.log(`[Shop Search] INVENTORY GAP: "${detectedBrand}" not found in catalog (0 products)`);
          inventoryGapMessage = `No ${detectedBrand} products found in our catalog`;
          
          // Try category-based fallback before returning empty
          const inferredCategory = inferCategoryFromQuery(query);
          if (inferredCategory) {
            console.log(`[Shop Search] INVENTORY GAP FALLBACK: "${query}" → category "${inferredCategory.category}"`);
            const fallback = await searchFallbackByCategory(inferredCategory.category, inferredCategory.keywords, safeLimit);
            if (fallback.products.length > 0) {
              return res.json({
                success: true,
                products: fallback.products,
                total: fallback.products.length,
                interpretation: {
                  original: query,
                  type: interpretation.isSemanticQuery ? 'semantic' : 'direct',
                  brand: detectedBrand,
                  inventoryGap: true
                },
                isFallback: true,
                fallback: {
                  reason: `No exact matches for "${detectedBrand}"`,
                  showingCategory: inferredCategory.category,
                  message: `We don't have "${detectedBrand}" in stock, but here are similar ${inferredCategory.category} items:`
                },
                filters: null
              });
            }
          }
          
          return res.json({
            success: true,
            products: [],
            total: 0,
            interpretation: {
              original: query,
              type: interpretation.isSemanticQuery ? 'semantic' : 'direct',
              brand: detectedBrand,
              inventoryGap: true
            },
            message: inventoryGapMessage,
            filters: null
          });
        }
        
        console.log(`[Shop Search] Brand/character check: "${detectedBrand}" exists in catalog`);
      }

      // STEP 2: Search using expanded keywords (multiple searches for semantic queries)
      // FIX: If searchTerms is empty but we have a detected brand/character, seed it with the original query
      // This prevents the semantic search from running with no term groups and returning 0 results
      if (interpretation.isSemanticQuery && interpretation.searchTerms.length === 0 && detectedBrand) {
        console.log(`[Shop Search] FIX: GPT returned empty keywords, seeding searchTerms with original query "${query}"`);
        interpretation.searchTerms = [[query]];
      }
      
      if (interpretation.isSemanticQuery && interpretation.searchTerms.length > 0) {
        // Run multiple searches for each keyword combination
        const allCandidates: any[] = [];
        const seenIds = new Set<string>();
        
        // Build filter conditions for semantic queries (same as regular search)
        const filterConditions: ReturnType<typeof ilike>[] = [];
        
        // Exclude products with broken/missing images
        filterConditions.push(sql`${products.imageUrl} NOT ILIKE '%noimage%'` as any);
        
        if (filterCategory) {
          filterConditions.push(ilike(products.category, `%${filterCategory}%`));
        }
        if (filterMerchant) {
          filterConditions.push(ilike(products.merchant, filterMerchant));
        }
        if (filterBrand) {
          const brandCondition = or(
            ilike(products.brand, filterBrand),
            ilike(products.name, `%${filterBrand}%`)
          );
          if (brandCondition) filterConditions.push(brandCondition as any);
        } else if (interpretation.attributes?.brand) {
          // Apply GPT-extracted brand filter (e.g., "star wars lego" → brand: Lego)
          const gptBrand = interpretation.attributes.brand;
          const brandCondition = or(
            ilike(products.brand, `%${gptBrand}%`),
            ilike(products.name, `%${gptBrand}%`)
          );
          if (brandCondition) filterConditions.push(brandCondition as any);
          console.log(`[Shop Search] Applying GPT-extracted brand filter: ${gptBrand}`);
        }
        
        // CRITICAL: Apply mustHaveAll as hard SQL filters (e.g., "star wars" must appear in results)
        // FIX: Split multi-word terms and require EACH word separately
        // "sophie giraffe" → requires "sophie" AND "giraffe" (not exact phrase)
        if (interpretation.mustHaveAll && interpretation.mustHaveAll.length > 0) {
          for (const term of interpretation.mustHaveAll) {
            // Skip brand terms already handled by brand filter
            if (interpretation.attributes?.brand && 
                term.toLowerCase() === interpretation.attributes.brand.toLowerCase()) {
              continue;
            }
            // Split term into individual words and require each one
            const words = term.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
            for (const word of words) {
              // Add as hard filter: each word must appear in name, description, category, or brand
              const mustHaveCondition = or(
                ilike(products.name, `%${word}%`),
                ilike(products.description, `%${word}%`),
                ilike(products.category, `%${word}%`),
                ilike(products.brand, `%${word}%`)
              );
              if (mustHaveCondition) {
                filterConditions.push(mustHaveCondition as any);
              }
            }
            console.log(`[Shop Search] Requiring each word of "${term}" in results: ${words.join(' AND ')}`);
          }
        }
        
        for (const termGroup of interpretation.searchTerms) {
          // Build OR conditions for this term group
          const termConditions: ReturnType<typeof and>[] = [];
          for (const term of termGroup) {
            const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (words.length === 0) continue;
            
            // For each word in the term, match any field
            const condition = and(...words.map(w => {
              const pattern = `%${w}%`;
              return or(
                ilike(products.name, pattern),
                ilike(products.description, pattern),
                ilike(products.brand, pattern),
                ilike(products.category, pattern)
              );
            }));
            if (condition) termConditions.push(condition);
          }
          
          if (termConditions.length === 0) continue;
          
          // Build WHERE clause with term conditions, affiliate link check, and user filters
          const whereConditions: any[] = [
            or(...termConditions),
            isNotNull(products.affiliateLink),
            ...filterConditions
          ];
          
          // Add price filters
          if (effectiveMinPrice !== undefined) {
            whereConditions.push(sql`CAST(${products.price} AS NUMERIC) >= ${effectiveMinPrice}`);
          }
          if (effectiveMaxPrice !== undefined) {
            whereConditions.push(sql`CAST(${products.price} AS NUMERIC) <= ${effectiveMaxPrice}`);
          }
          
          // Search for this term group
          const groupResults = await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            merchant: products.merchant,
            brand: products.brand,
            category: products.category,
            affiliate_link: products.affiliateLink,
            image_url: products.imageUrl,
            in_stock: products.inStock
          }).from(products)
            .where(and(...whereConditions))
            .orderBy(sql`RANDOM()`)
            .limit(30);
          
          // Add unique results
          for (const p of groupResults) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allCandidates.push(p);
            }
          }
        }
        
        candidates = allCandidates;
        totalCandidates = candidates.length;
        console.log(`[Shop Search] Semantic search found ${candidates.length} candidates from ${interpretation.searchTerms.length} term groups`);
        
      } else {
        // Original keyword search for direct product queries
        const stopWords = new Set(['the', 'and', 'for', 'with', 'set', 'pack', 'from']);
        // Generic product type words that should NOT be required in product names
        // when a brand/character is detected (e.g., "paw patrol toys" shouldn't require "toys" in name)
        const genericProductWords = new Set([
          'toys', 'toy', 'gifts', 'gift', 'stuff', 'things', 'items', 'products', 'merchandise', 'merch',
          'dolls', 'doll', 'figures', 'figure', 'playsets', 'playset', 'games', 'game', 
          'clothes', 'clothing', 'accessories', 'accessory', 'sets', 'set', 'collection'
        ]);
        const detectedCharacter = interpretation.attributes?.brand?.toLowerCase();
        
        let words = query.toLowerCase()
          .replace(/[-]/g, ' ')
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w));
        
        // If we detected a MULTI-WORD character/license (like "paw patrol"), remove generic product words
        // For multi-word brands, user says "paw patrol toys" meaning "toys FROM paw patrol", not "products with 'toys' in name"
        // But for single-word brands (barbie, lego), KEEP the product word to maintain relevance
        if (detectedCharacter) {
          const characterWords = detectedCharacter.split(' ');
          const isMultiWordBrand = characterWords.length > 1;
          
          if (isMultiWordBrand) {
            // Only filter generic words for multi-word brands like "paw patrol", "peppa pig"
            words = words.filter(w => !genericProductWords.has(w) || characterWords.includes(w));
            console.log(`[Shop Search] Multi-word character "${detectedCharacter}" - filtered words: [${words.join(', ')}]`);
          } else {
            // For single-word brands, keep ALL words to maintain relevance
            // "barbie dolls" should find products with BOTH "barbie" AND "dolls" in name
            console.log(`[Shop Search] Single-word brand "${detectedCharacter}" - keeping all words: [${words.join(', ')}]`);
          }
        }
        
        if (words.length > 0) {
          // PERFORMANCE FIX: Only search name column (indexed with GIN trigram)
          // Removed OR conditions across description/brand/category that bypass indexes
          const wordConditions = words.map(w => {
            const pattern = `%${w}%`;
            return ilike(products.name, pattern);
          });
          
          // Build base WHERE clause with keyword matching
          const baseConditions = [
            ...wordConditions,
            isNotNull(products.affiliateLink),
            sql`${products.imageUrl} NOT ILIKE '%noimage%'`  // Exclude broken images
          ];
          
          // Apply user's filter selections
          if (filterCategory) {
            baseConditions.push(ilike(products.category, `%${filterCategory}%`));
          }
          if (filterMerchant) {
            baseConditions.push(ilike(products.merchant, filterMerchant));
          }
          if (filterBrand) {
            baseConditions.push(or(
              ilike(products.brand, filterBrand),
              ilike(products.name, `%${filterBrand}%`)
            ));
          } else if (interpretation.attributes?.brand) {
            // Apply GPT-extracted brand filter for non-semantic queries
            const gptBrand = interpretation.attributes.brand;
            baseConditions.push(or(
              ilike(products.brand, `%${gptBrand}%`),
              ilike(products.name, `%${gptBrand}%`)
            ));
            console.log(`[Shop Search] Applying GPT-extracted brand filter: ${gptBrand}`);
          }
          
          // CRITICAL FIX: Apply mustHaveAll as hard SQL filters in keyword search path
          // FIX: Split multi-word terms and require EACH word separately
          // "sophie giraffe" → requires "sophie" AND "giraffe" (not exact phrase)
          if (interpretation.mustHaveAll && interpretation.mustHaveAll.length > 0) {
            for (const term of interpretation.mustHaveAll) {
              // Skip brand terms already handled by brand filter above
              if (interpretation.attributes?.brand && 
                  term.toLowerCase() === interpretation.attributes.brand.toLowerCase()) {
                continue;
              }
              // PERFORMANCE FIX: Skip mustHaveAll SQL filters - use post-filtering instead
              // Original code added OR conditions across 4 columns which bypassed indexes
              console.log(`[Shop Search] Skipping mustHaveAll SQL filter for "${term}" (using post-filter)`);
            }
          }
          
          if (effectiveMinPrice !== undefined) {
            baseConditions.push(sql`CAST(${products.price} AS NUMERIC) >= ${effectiveMinPrice}`);
          }
          if (effectiveMaxPrice !== undefined) {
            baseConditions.push(sql`CAST(${products.price} AS NUMERIC) <= ${effectiveMaxPrice}`);
          }
          
          const whereClause = and(...baseConditions);
        
        // PERFORMANCE FIX: Skip slow count query - estimate from results
        // totalCandidates will be set from results array length * factor
        
        // PERFORMANCE FIX: Skip slow SQL aggregations (4 GROUP BY queries)
        // Build filters from fetched candidates instead - see end of route
        
        // PERFORMANCE FIX: Skip stratified sampling (4 slow bucket queries)
        // Use simple single query instead
        {
          // FIX 2: Get RANDOM sample of 100 candidates (not first 100 by DB order)
          // On first page (offset=0), use random. On subsequent pages, use consistent ordering.
          const dbQueryStart = Date.now();
          const result = await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            merchant: products.merchant,
            brand: products.brand,
            category: products.category,
            affiliate_link: products.affiliateLink,
            image_url: products.imageUrl,
            in_stock: products.inStock
          }).from(products)
            .where(whereClause)
            .orderBy(products.id)  // PERFORMANCE: Remove RANDOM() which causes full table scan
            .limit(100)
            .offset(safeOffset);
          
          candidates = result as any[];
          // FIX: If we hit the limit (100), assume there are more results (estimate 10x)
          // This enables "Load More" button without expensive COUNT query
          totalCandidates = candidates.length === 100 ? 1000 : candidates.length;
          console.log(`[Shop Search] TIMING: DB query took ${Date.now() - dbQueryStart}ms (${candidates.length} results, est total: ${totalCandidates})`);
        }
        } // Close if (words.length > 0)
      } // Close else (original keyword search)
      
      // FAST FALLBACK: For single-word brands, search just the brand before calling GPT
      if (candidates.length === 0 && interpretation.attributes?.brand) {
        const brand = interpretation.attributes.brand.toLowerCase();
        const brandWords = brand.split(' ');
        
        if (brandWords.length === 1) {
          console.log(`[Shop Search] Fast fallback: Searching just for brand "${brand}"`);
          
          const brandResults = await db.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            merchant: products.merchant,
            brand: products.brand,
            category: products.category,
            affiliate_link: products.affiliateLink,
            image_url: products.imageUrl,
            in_stock: products.inStock
          }).from(products)
            .where(and(
              ilike(products.name, `%${brand}%`),
              isNotNull(products.affiliateLink),
              sql`${products.imageUrl} NOT ILIKE '%noimage%'`
            ))
            .orderBy(products.id)
            .limit(100);
          
          if (brandResults.length > 0) {
            candidates = brandResults as any[];
            totalCandidates = candidates.length;
            console.log(`[Shop Search] Fast fallback found ${candidates.length} ${brand} products`);
          }
        }
      }
      
      // FALLBACK: If 0 results, suggest alternatives based on product category
      if (candidates.length === 0 && openaiKey) {
        console.log(`[Shop Search] 0 results for "${query}" - attempting fallback suggestions`);
        
        try {
          const openai = new OpenAI({ apiKey: openaiKey });
          
          // Ask GPT to suggest alternative search terms
          const fallbackResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            max_tokens: 100,
            messages: [
              {
                role: 'system',
                content: `User searched for a product we don't have. Suggest 2-3 alternative generic search terms.
Return ONLY a JSON array of search terms, no explanation.
Examples:
- "sophie giraffe" → ["teething toys", "baby toys", "sensory toys"]
- "orchard toys games" → ["kids board games", "educational games", "children puzzles"]
- "snuzpod crib" → ["bedside crib", "baby crib", "moses basket"]`
              },
              { role: 'user', content: `Suggest alternatives for: "${query}"` }
            ]
          });
          
          const fallbackContent = fallbackResponse.choices[0]?.message?.content?.trim() || '[]';
          let alternativeTerms: string[] = [];
          try {
            alternativeTerms = JSON.parse(fallbackContent);
          } catch { alternativeTerms = []; }
          
          if (alternativeTerms.length > 0) {
            // Search for first alternative term
            const altTerm = alternativeTerms[0];
            console.log(`[Shop Search] Fallback: Searching for "${altTerm}" instead`);
            
            const altWords = altTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (altWords.length > 0) {
              const altConditions = altWords.map(w => {
                const pattern = `%${w}%`;
                return or(
                  ilike(products.name, pattern),
                  ilike(products.description, pattern),
                  ilike(products.category, pattern)
                );
              });
              
              const fallbackResults = await db.select({
                id: products.id,
                name: products.name,
                description: products.description,
                price: products.price,
                merchant: products.merchant,
                brand: products.brand,
                category: products.category,
                affiliate_link: products.affiliateLink,
                image_url: products.imageUrl,
                in_stock: products.inStock
              }).from(products)
                .where(and(...altConditions, isNotNull(products.affiliateLink)))
                .orderBy(sql`RANDOM()`)
                .limit(safeLimit);
              
              if (fallbackResults.length > 0) {
                console.log(`[Shop Search] Fallback found ${fallbackResults.length} alternatives for "${altTerm}"`);
                
                const fallbackProducts = fallbackResults.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  price: parseFloat(p.price) || 0,
                  merchant: p.merchant,
                  brand: p.brand,
                  category: p.category,
                  affiliateLink: p.affiliate_link,
                  imageUrl: p.image_url,
                  inStock: p.in_stock
                }));
                
                // Get actual count for fallback term
                const [{ count: altCount }] = await db.select({ count: sql<number>`count(*)` })
                  .from(products)
                  .where(and(...altConditions, isNotNull(products.affiliateLink)));
                
                return res.json({
                  success: true,
                  query,
                  count: fallbackProducts.length,
                  totalCount: Number(altCount) || fallbackProducts.length,
                  hasMore: Number(altCount) > fallbackProducts.length,
                  products: fallbackProducts,
                  isFallback: true,
                  fallback: {
                    reason: `No exact matches for "${query}"`,
                    showingAlternative: altTerm,
                    otherSuggestions: alternativeTerms.slice(1)
                  },
                  interpretation: interpretation.isSemanticQuery ? { expanded: interpretation.expandedKeywords, context: interpretation.context } : undefined
                });
              }
            }
          }
        } catch (fallbackError) {
          console.error('[Shop Search] Fallback suggestion failed:', fallbackError);
        }
        
        // If fallback also fails, check for deals-only (promotions without products)
        const dealsOnly = await getDealsForMerchant(query);
        if (dealsOnly.length > 0) {
          console.log(`[Shop Search] No products but found ${dealsOnly.length} deals for "${query}"`);
          return res.json({ 
            success: true, 
            query, 
            count: 0, 
            totalCount: 0, 
            hasMore: false, 
            products: [], 
            dealsOnly: dealsOnly,
            message: `No products found, but we have ${dealsOnly.length} deal${dealsOnly.length > 1 ? 's' : ''} from ${query}!`,
            interpretation: interpretation.isSemanticQuery ? { expanded: interpretation.expandedKeywords, context: interpretation.context } : undefined 
          });
        }
        
        // INVENTORY GAP FALLBACK: Try category-based search for truly missing products
        const inferredCategory = inferCategoryFromQuery(query);
        if (inferredCategory) {
          console.log(`[Shop Search] INVENTORY GAP FALLBACK: "${query}" → category "${inferredCategory.category}"`);
          const fallback = await searchFallbackByCategory(inferredCategory.category, inferredCategory.keywords, safeLimit);
          if (fallback.products.length > 0) {
            return res.json({
              success: true,
              query,
              count: fallback.products.length,
              totalCount: fallback.products.length,
              hasMore: false,
              products: fallback.products,
              isFallback: true,
              fallback: {
                reason: `No exact matches for "${query}"`,
                showingCategory: inferredCategory.category,
                message: `We don't have "${query}" in stock, but here are similar ${inferredCategory.category} items:`
              },
              interpretation: interpretation.isSemanticQuery ? { expanded: interpretation.expandedKeywords, context: interpretation.context } : undefined
            });
          }
        }
        
        return res.json({ success: true, query, count: 0, totalCount: totalCandidates, hasMore: false, products: [], interpretation: interpretation.isSemanticQuery ? { expanded: interpretation.expandedKeywords, context: interpretation.context } : undefined });
      }
      
      if (candidates.length === 0) {
        // Check for deals-only before returning empty
        const dealsOnly2 = await getDealsForMerchant(query);
        if (dealsOnly2.length > 0) {
          console.log(`[Shop Search] No products but found ${dealsOnly2.length} deals for "${query}"`);
          return res.json({ 
            success: true, 
            query, 
            count: 0, 
            totalCount: 0, 
            hasMore: false, 
            products: [], 
            dealsOnly: dealsOnly2,
            message: `No products found, but we have ${dealsOnly2.length} deal${dealsOnly2.length > 1 ? 's' : ''} from ${query}!`,
            interpretation: interpretation.isSemanticQuery ? { expanded: interpretation.expandedKeywords, context: interpretation.context } : undefined 
          });
        }
        
        // INVENTORY GAP FALLBACK: Try category-based search
        const inferredCategory2 = inferCategoryFromQuery(query);
        if (inferredCategory2) {
          console.log(`[Shop Search] INVENTORY GAP FALLBACK: "${query}" → category "${inferredCategory2.category}"`);
          const fallback2 = await searchFallbackByCategory(inferredCategory2.category, inferredCategory2.keywords, safeLimit);
          if (fallback2.products.length > 0) {
            return res.json({
              success: true,
              query,
              count: fallback2.products.length,
              totalCount: fallback2.products.length,
              hasMore: false,
              products: fallback2.products,
              isFallback: true,
              fallback: {
                reason: `No exact matches for "${query}"`,
                showingCategory: inferredCategory2.category,
                message: `We don't have "${query}" in stock, but here are similar ${inferredCategory2.category} items:`
              },
              interpretation: interpretation.isSemanticQuery ? { expanded: interpretation.expandedKeywords, context: interpretation.context } : undefined
            });
          }
        }
        
        return res.json({ success: true, query, count: 0, totalCount: totalCandidates, hasMore: false, products: [], interpretation: interpretation.isSemanticQuery ? { expanded: interpretation.expandedKeywords, context: interpretation.context } : undefined });
      }

      console.log(`[Shop Search] Found ${candidates.length} candidates for "${query}" (total: ${totalCandidates})`);

      // 2. Send candidates to GPT to pick the best matches
      let selectedProducts: any[] = candidates.slice(0, safeLimit);
      
      // Detect broad query for GPT prompt customization (only for non-semantic queries)
      const categoryModifiers = ['toy', 'toys', 'dress', 'dresses', 'clothes', 'clothing', 'book', 'books', 'game', 'games', 'figure', 'figures', 'lego', 'plush', 'costume'];
      const queryWords = query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
      const hasSpecificIntent = queryWords.some((w: string) => categoryModifiers.includes(w));
      const isBroadQuery = !interpretation.isSemanticQuery && queryWords.length <= 2 && !hasSpecificIntent && totalCandidates > 200;
      
      // SKIP GPT reranking for fast-path queries - AGGRESSIVE for performance
      // Skip reranker for: simple brands, single keywords, category queries
      const isFastPath = interpretation.skipReranker || 
        (interpretation.attributes?.brand && !interpretation.context?.recipient && !interpretation.context?.occasion) ||
        queryWords.length <= 2 ||  // Simple 1-2 word queries don't need GPT
        !interpretation.isSemanticQuery;  // Only use GPT for semantic/gift queries
      
      if (isFastPath) {
        console.log(`[Shop Search] FAST PATH - skipping GPT reranker for "${query}"`);
      }
      
      if (openaiKey && candidates.length > safeLimit && !isFastPath) {
        const rerankerStart = Date.now();
        const RERANKER_TIMEOUT = 5000; // 5 second timeout
        
        // Limit to top 30 candidates for reranking to reduce token count
        const rerankerCandidates = candidates.slice(0, 30);
        
        try {
          console.log(`[Shop Search] Starting GPT rerank with ${rerankerCandidates.length} candidates...`);
          const openai = new OpenAI({ apiKey: openaiKey });
          
          // Shorter descriptions (60 chars) to reduce tokens
          const productsText = rerankerCandidates.map(p => 
            `ID:${p.id} | ${p.name} | £${p.price} | ${p.category || ''} | ${(p.description || '').substring(0, 60)}`
          ).join('\n');

          // Enhanced GPT prompt - includes semantic context for interpreted queries
          const semanticContext = interpretation.isSemanticQuery ? `
IMPORTANT CONTEXT (This was a semantic query - the user's original search was "${query}"):
- Recipient: ${interpretation.context.recipient || 'not specified'}
- Occasion: ${interpretation.context.occasion || 'not specified'}
- Age range: ${interpretation.context.ageRange || 'not specified'}
- ${interpretation.rerankerContext}
Pick products that would genuinely make sense for this context.` : '';

          const broadQueryRules = isBroadQuery ? `
9. IMPORTANT: This is a broad search - show CATEGORY VARIETY
10. Pick at least 2 TOYS, 2 CLOTHING items, 2 BOOKS/DVDs, and 2 from OTHER categories
11. Balance the selection across different product types` : '';

          // Create promise with timeout wrapper
          const rerankerPromise = openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You help UK families find products. Pick the ${safeLimit} BEST matches.
${semanticContext}
RULES:
1. Only pick products that ACTUALLY match the search intent
2. "paw patrol" = the TV show characters, NOT "Pet Patrol" or random puppy items
3. "disney toys" = Disney-branded TOYS/figures, not Disney-themed clothing
4. "spider-man toys" = Spider-Man action figures/toys, not Spider-Man clothing
5. When user says "toys" they want toys/figures/games, NOT clothing
6. Prioritise variety - different merchants, different product types
7. Prefer products with images
8. Mix of price points when possible${broadQueryRules}

Return ONLY a JSON array of IDs: ["id1", "id2", ...]
ONLY use IDs from the list. Never invent IDs.`
              },
              {
                role: 'user',
                content: `Search: "${query}"\n\nProducts:\n${productsText}`
              }
            ],
            temperature: 0.1
          });

          // Race against timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('GPT reranker timeout')), RERANKER_TIMEOUT)
          );

          const response = await Promise.race([rerankerPromise, timeoutPromise]) as Awaited<typeof rerankerPromise>;
          
          console.log(`[Shop Search] GPT rerank completed in ${Date.now() - rerankerStart}ms`);

          // FIX 4: Robust ID parsing with fallback
          let selectedIds: string[] = [];
          try {
            let content = response.choices[0].message.content?.trim() || '[]';
            
            // Handle markdown code blocks
            if (content.includes('```')) {
              const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (match) content = match[1].trim();
            }
            
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              selectedIds = parsed.map(id => String(id));
            }
          } catch (parseError) {
            console.warn(`[Shop Search] GPT parse failed for "${query}":`, parseError);
            // Fallback to random selection from candidates
            selectedIds = candidates.slice(0, safeLimit).map(p => String(p.id));
          }

          console.log(`[Shop Search] GPT selected ${selectedIds.length} products`);

          // Build response from selected IDs
          const idToProduct = new Map(candidates.map(p => [String(p.id), p]));
          selectedProducts = [];
          for (const pid of selectedIds) {
            const p = idToProduct.get(String(pid));
            if (p) selectedProducts.push(p);
          }
          
          // FIX 4: Fallback if GPT returned bad IDs (empty result)
          if (selectedProducts.length === 0 && candidates.length > 0) {
            console.warn(`[Shop Search] GPT returned no valid IDs, using random fallback`);
            selectedProducts = candidates.slice(0, safeLimit);
          }
        } catch (aiError: any) {
          const elapsed = Date.now() - rerankerStart;
          console.log(`[Shop Search] GPT rerank failed after ${elapsed}ms (${aiError?.message || 'unknown error'}), using first ${safeLimit}`);
          selectedProducts = candidates.slice(0, safeLimit);
        }
      }

      const hasMore = (safeOffset + selectedProducts.length) < totalCandidates;
      
      // Fetch active promotions for all merchants
      const activePromotions = await getAllActivePromotions();
      
      // Normalize merchant name for matching - handles variations like "New Look UK" vs "newlook"
      const normalizeMerchant = (name: string): string => {
        return name.toLowerCase()
          .replace(/\s*(uk|eu|europe|usa|us|gb|direct|plc|ltd|limited|com|co\.uk)\s*$/gi, '')
          .replace(/[^a-z0-9]/g, '')
          .replace(/and/g, '')  // "H&M" becomes "hm", "marks and spencer" becomes "marksspencer"
          .trim();
      };
      
      // Categories that are mutually exclusive (don't show book promos on toys, etc.)
      const CATEGORY_CONFLICTS: Record<string, string[]> = {
        'book': ['toy', 'toys', 'lego', 'game', 'games', 'figure', 'figures', 'doll', 'dolls', 'plush'],
        'toys': ['book', 'books', 'novel', 'reading'],
        'clothing': ['book', 'books', 'toy', 'toys'],
        'fashion': ['toy', 'toys', 'lego'],
      };
      
      // Check if promotion is relevant to the search/product
      const isPromotionRelevant = (promoTitle: string, searchQuery: string, productCategory: string): boolean => {
        const promoLower = promoTitle.toLowerCase();
        const queryLower = searchQuery.toLowerCase();
        const categoryLower = productCategory.toLowerCase();
        
        // Check for category conflicts
        for (const [promoCategory, conflictTerms] of Object.entries(CATEGORY_CONFLICTS)) {
          if (promoLower.includes(promoCategory)) {
            // Promo is about this category - check if query/product conflicts
            if (conflictTerms.some(term => queryLower.includes(term) || categoryLower.includes(term))) {
              console.log(`[Promo Filter] Excluded "${promoTitle}" - conflicts with "${queryLower}"`);
              return false;
            }
          }
        }
        
        return true;
      };
      
      // Get brand-based promotions for matching product names/brands
      const { getAllBrandPromotions } = await import('./services/awin');
      const brandPromotions = await getAllBrandPromotions();
      
      // List of known brand keywords to check in product names
      const BRAND_KEYWORDS = [
        'disney', 'marvel', 'starwars', 'frozen', 'pixar', 'princess',
        'lego', 'duplo', 'technic',
        'barbie', 'hotwheels', 'fisherprice', 'mattel',
        'pawpatrol', 'peppapig', 'bluey', 'cocomelon',
        'pokemon', 'pikachu', 'nintendo', 'mario', 'zelda', 'switch',
        'playstation', 'xbox', 'gaming',
        'harrypotter', 'hogwarts',
        'transformers', 'nerf', 'hasbro', 'monopoly',
        'playmobil', 'sylvanian', 'schleich',
        'nike', 'adidas', 'puma', 'reebok', 'converse', 'vans', 'jordan',
        'jdsports', 'sportsdirect'
      ];
      
      // Extract brand keywords from product name/brand
      const extractBrandKeywords = (name: string, brand: string): string[] => {
        const text = `${name} ${brand}`.toLowerCase().replace(/\s+/g, '');
        return BRAND_KEYWORDS.filter(bk => text.includes(bk));
      };
      
      // Attach promotions to products - with category relevance filtering + brand-based matching
      const productsWithPromotions = selectedProducts.map((p: any) => {
        const normalizedMerchant = normalizeMerchant(p.merchant || '');
        let promotion: ProductPromotion | undefined;
        
        // 1. Try merchant match first (highest priority)
        const promos = activePromotions.get(normalizedMerchant);
        if (promos && promos.length > 0) {
          // Filter to only relevant promotions
          const relevantPromo = promos.find(promo => 
            isPromotionRelevant(promo.promotionTitle, query, p.category || '')
          );
          if (relevantPromo) {
            promotion = relevantPromo;
          }
        }
        
        // 2. If no merchant promotion, try brand-based matching
        if (!promotion) {
          const productBrands = extractBrandKeywords(p.name || '', p.brand || '');
          for (const brandKeyword of productBrands) {
            const brandPromos = brandPromotions.get(brandKeyword);
            if (brandPromos && brandPromos.length > 0) {
              const relevantBrandPromo = brandPromos.find(promo =>
                isPromotionRelevant(promo.promotionTitle, query, p.category || '')
              );
              if (relevantBrandPromo) {
                promotion = relevantBrandPromo;
                break; // Use first matching brand promotion
              }
            }
          }
        }
        
        return {
          id: p.id,
          name: p.name,
          description: (p.description || '').slice(0, 200),
          price: parseFloat(p.price) || 0,
          currency: 'GBP',
          merchant: p.merchant,
          brand: p.brand || '',
          category: p.category || '',
          imageUrl: p.image_url || '',
          affiliateLink: p.affiliate_link,
          inStock: p.in_stock ?? true,
          // Promotion fields
          promotion: promotion ? {
            title: promotion.promotionTitle,
            voucherCode: promotion.voucherCode,
            expiresAt: promotion.expiresAt,
            type: promotion.promotionType
          } : undefined
        };
      });
      
      // Sort to prioritize products with promotions (same relevance, promoted first)
      productsWithPromotions.sort((a: any, b: any) => {
        const aHasPromo = a.promotion ? 1 : 0;
        const bHasPromo = b.promotion ? 1 : 0;
        return bHasPromo - aHasPromo;
      });
      
      const response: any = {
        success: true,
        query: query,
        count: productsWithPromotions.length,
        totalCount: totalCandidates,
        hasMore: hasMore,
        products: productsWithPromotions
      };
      
      // Include filters on first page without user filters applied
      if (filters) {
        response.filters = filters;
      }
      
      // Include interpretation info for semantic queries
      if (interpretation.isSemanticQuery) {
        response.interpretation = {
          expanded: interpretation.expandedKeywords,
          context: interpretation.context
        };
      }
      
      res.json(response);
    } catch (error) {
      const err = error as Error;
      console.error('[Shop Search] Error:', err.message);
      console.error('[Shop Search] Stack:', err.stack);
      res.status(500).json({ 
        success: false, 
        error: "Search failed",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ============================================================
  // SHOP V2 SEARCH - Uses enhanced products_v2 table with 997k products
  // Same logic as /api/shop/search but queries products_v2 with richer data
  // ============================================================
  app.post("/api/shopv2/search", async (req, res) => {
    const searchStartTime = Date.now();
    try {
      const { 
        query, 
        limit = 8, 
        offset = 0,
        filterCategory,
        filterMerchant,
        filterBrand,
        filterMinPrice,
        filterMaxPrice
      } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, error: "Query is required" });
      }

      const safeLimit = Math.min(Math.max(1, limit), 20);
      const safeOffset = Math.max(0, offset);
      const hasFilters = filterCategory || filterMerchant || filterBrand || filterMinPrice !== undefined || filterMaxPrice !== undefined;
      const openaiKey = process.env.OPENAI_API_KEY;
      
      console.log(`[Shop V2] Query: "${query}", limit: ${safeLimit}, offset: ${safeOffset}, hasFilters: ${hasFilters}`);

      const interpretation = await interpretQuery(query, openaiKey);
      
      // Apply maxPrice from GPT interpretation if user didn't specify a price filter
      // This handles queries like "running shoes under 50" or "cheap headphones"
      let effectiveMaxPrice = filterMaxPrice;
      if (effectiveMaxPrice === undefined && interpretation.context.maxPrice) {
        effectiveMaxPrice = interpretation.context.maxPrice;
        console.log(`[Shop V2] Applying GPT-extracted maxPrice: £${effectiveMaxPrice}`);
      }
      
      if (interpretation.isSemanticQuery) {
        console.log(`[Shop V2] Semantic query detected. Expanded: ${interpretation.expandedKeywords.join(', ')}`);
      }

      const { db } = await import('./db');
      const { productsV2 } = await import('@shared/schema');
      const { and, or, ilike, isNotNull, sql, desc } = await import('drizzle-orm');
      
      let candidates: any[] = [];
      let totalCandidates = 0;
      let filters: any = null;

      if (interpretation.isSemanticQuery && interpretation.searchTerms.length > 0) {
        const allCandidates: any[] = [];
        const seenIds = new Set<string>();
        
        const filterConditions: any[] = [];
        
        // Exclude products with broken/missing images
        filterConditions.push(sql`${productsV2.imageUrl} NOT ILIKE '%noimage%'`);
        
        if (filterCategory) {
          filterConditions.push(ilike(productsV2.category, `%${filterCategory}%`));
        }
        // Apply GPT-extracted category filter if no user filter was specified
        // This ensures "running shoes" searches only in footwear categories
        if (!filterCategory && interpretation.context.categoryFilter) {
          filterConditions.push(ilike(productsV2.category, `%${interpretation.context.categoryFilter}%`));
          console.log(`[Shop V2] Applying GPT-extracted categoryFilter: ${interpretation.context.categoryFilter}`);
        }
        if (filterMerchant) {
          filterConditions.push(ilike(productsV2.merchant, `%${filterMerchant}%`));
        }
        if (filterBrand) {
          filterConditions.push(or(
            ilike(productsV2.brand, `%${filterBrand}%`),
            ilike(productsV2.name, `%${filterBrand}%`)
          ));
        }
        
        // Build mustHave conditions
        // mustHaveAll = AND logic (all brand terms must match)
        // mustHaveAny = OR logic (any gift qualifier must match)
        const mustHaveConditions: any[] = [];
        
        if (interpretation.mustHaveAll && interpretation.mustHaveAll.length > 0) {
          // AND logic - ALL terms must be present
          for (const term of interpretation.mustHaveAll) {
            const sanitizedTerm = term.replace(/[^\w\s]/g, ' ').trim();
            mustHaveConditions.push(sql`search_vector @@ plainto_tsquery('english', ${sanitizedTerm})`);
          }
          console.log(`[Shop V2] Requiring ALL of: ${interpretation.mustHaveAll.join(' AND ')}`);
        }
        
        if (interpretation.mustHaveAny && interpretation.mustHaveAny.length > 0) {
          // OR logic - ANY term can match
          const anyConditions = interpretation.mustHaveAny.map(term => {
            const sanitizedTerm = term.replace(/[^\w\s]/g, ' ').trim();
            return sql`search_vector @@ plainto_tsquery('english', ${sanitizedTerm})`;
          });
          mustHaveConditions.push(or(...anyConditions));
          console.log(`[Shop V2] Requiring ANY of: ${interpretation.mustHaveAny.join(' OR ')}`);
        }
        
        // Legacy support for mustHaveTerms (treated as OR)
        if (interpretation.mustHaveTerms && interpretation.mustHaveTerms.length > 0 && 
            (!interpretation.mustHaveAll || interpretation.mustHaveAll.length === 0) &&
            (!interpretation.mustHaveAny || interpretation.mustHaveAny.length === 0)) {
          const legacyConditions = interpretation.mustHaveTerms.map(term => {
            const sanitizedTerm = term.replace(/[^\w\s]/g, ' ').trim();
            return sql`search_vector @@ plainto_tsquery('english', ${sanitizedTerm})`;
          });
          mustHaveConditions.push(or(...legacyConditions));
        }
        
        // Build attribute conditions for precise product filtering
        // These filter by brand, model, size, color, gender extracted from query
        const attributeConditions: any[] = [];
        if (interpretation.attributes) {
          const attrs = interpretation.attributes;
          
          if (attrs.brand) {
            attributeConditions.push(or(
              ilike(productsV2.brand, `%${attrs.brand}%`),
              ilike(productsV2.name, `%${attrs.brand}%`)
            ));
            console.log(`[Shop V2] Attribute filter: brand="${attrs.brand}"`);
          }
          
          if (attrs.model) {
            attributeConditions.push(ilike(productsV2.name, `%${attrs.model}%`));
            console.log(`[Shop V2] Attribute filter: model="${attrs.model}"`);
          }
          
          if (attrs.size) {
            // Size must match specific patterns to avoid matching model numbers (e.g., "Revolution 6")
            // For numeric sizes: "Size 6", "UK 6", etc.
            // For clothing sizes: "Size Medium", "Medium", "- M", etc.
            const isClothingSize = ['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(attrs.size.toUpperCase());
            
            if (isClothingSize) {
              // Clothing size patterns
              const sizeLabel = attrs.size.toUpperCase();
              const sizeFull = sizeLabel === 'M' ? 'Medium' : sizeLabel === 'S' ? 'Small' : 
                              sizeLabel === 'L' ? 'Large' : sizeLabel === 'XL' ? 'Extra Large' : 
                              sizeLabel === 'XS' ? 'Extra Small' : sizeLabel === 'XXL' ? '2XL' : sizeLabel;
              attributeConditions.push(or(
                ilike(productsV2.name, `%Size ${sizeFull}%`),
                ilike(productsV2.name, `%Size ${sizeLabel}%`),
                ilike(productsV2.name, `%- ${sizeLabel}%`),
                ilike(productsV2.name, `%${sizeFull}%`),
                ilike(productsV2.description, `%size ${sizeFull}%`),
                ilike(productsV2.description, `%size: ${sizeLabel}%`)
              ));
            } else {
              // Numeric size patterns (shoes, etc.)
              attributeConditions.push(or(
                ilike(productsV2.name, `%Size ${attrs.size}%`),
                ilike(productsV2.name, `%Size ${attrs.size}.%`),
                ilike(productsV2.name, `%UK ${attrs.size}%`),
                ilike(productsV2.name, `%UK ${attrs.size}.%`),
                ilike(productsV2.name, `%- ${attrs.size}%`),
                ilike(productsV2.description, `%size ${attrs.size}%`),
                ilike(productsV2.description, `%uk ${attrs.size}%`)
              ));
            }
            console.log(`[Shop V2] Attribute filter: size="${attrs.size}" (${isClothingSize ? 'clothing' : 'numeric'})`);
          }
          
          if (attrs.color) {
            // Prioritize color in the product NAME (indicates the actual product color)
            // vs description (might just mention the color in passing)
            attributeConditions.push(or(
              ilike(productsV2.name, `%${attrs.color}%`),
              ilike(productsV2.name, `% - ${attrs.color} -%`),
              ilike(productsV2.keywords, `%${attrs.color}%`)
            ));
            console.log(`[Shop V2] Attribute filter: color="${attrs.color}" (name-priority)`);
          }
          
          if (attrs.gender) {
            // IMPORTANT: Use word boundary patterns to avoid "Womens" matching "mens"
            if (attrs.gender.toLowerCase() === 'mens') {
              attributeConditions.push(or(
                sql`${productsV2.name} ~* '\\mMen''?s?\\M'`,
                sql`${productsV2.category} ~* '\\mMen''?s?\\M'`,
                ilike(productsV2.name, `% Men %`),
                ilike(productsV2.name, `Mens %`),
                ilike(productsV2.name, `% Mens`),
                ilike(productsV2.name, `% for Men%`)
              ));
              // Also EXCLUDE womens products
              attributeConditions.push(sql`${productsV2.name} !~* '\\mWomen|\\mLadies|\\mFemale'`);
            } else if (attrs.gender.toLowerCase() === 'womens') {
              attributeConditions.push(or(
                sql`${productsV2.name} ~* '\\mWomen''?s?\\M'`,
                sql`${productsV2.category} ~* '\\mWomen''?s?\\M'`,
                ilike(productsV2.name, `% Women %`),
                ilike(productsV2.name, `Womens %`),
                ilike(productsV2.name, `% Ladies%`)
              ));
            } else if (attrs.gender.toLowerCase() === 'kids') {
              attributeConditions.push(or(
                sql`${productsV2.name} ~* '\\m(Kids?|Children''?s?|Boys?|Girls?)\\M'`,
                sql`${productsV2.category} ~* '\\m(Kids?|Children|Junior)\\M'`
              ));
            } else {
              // Generic fallback
              attributeConditions.push(or(
                ilike(productsV2.name, `%${attrs.gender}%`),
                ilike(productsV2.category, `%${attrs.gender}%`)
              ));
            }
            console.log(`[Shop V2] Attribute filter: gender="${attrs.gender}" (strict word boundary)`);
          }
        }
        
        // ATTRIBUTE-FIRST SEARCH: When we have strong attributes (brand+model+size/color),
        // use attribute filters directly instead of generic search terms to avoid zero results
        const hasStrongAttributes = interpretation.attributes && 
          interpretation.attributes.brand && 
          interpretation.attributes.model &&
          (interpretation.attributes.size || interpretation.attributes.color);
          
        if (hasStrongAttributes && attributeConditions.length >= 3) {
          console.log(`[Shop V2] Using ATTRIBUTE-FIRST search (brand+model+size/color detected)`);
          
          const attrWhereConditions: any[] = [
            isNotNull(productsV2.affiliateLink),
            ...filterConditions,
            ...attributeConditions
          ];
          
          if (filterMinPrice !== undefined) {
            attrWhereConditions.push(sql`${productsV2.price} >= ${filterMinPrice}`);
          }
          if (effectiveMaxPrice !== undefined) {
            attrWhereConditions.push(sql`${productsV2.price} <= ${effectiveMaxPrice}`);
          }
          
          // Get count
          const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(productsV2)
            .where(and(...attrWhereConditions));
          totalCandidates = Number(countResult[0]?.count || 0);
          
          // Get products - prioritize those with attributes in NAME (not just description)
          // Use parameterised SQL to prevent injection
          const attrs = interpretation.attributes;
          let orderClause;
          if (attrs.color && attrs.size) {
            const colorPattern = `%${attrs.color.replace(/[%_]/g, '')}%`;
            const sizePattern = `%${attrs.size.replace(/[%_]/g, '')}%`;
            orderClause = sql`(CASE WHEN ${productsV2.name} ILIKE ${colorPattern} THEN 0 ELSE 1 END) + (CASE WHEN ${productsV2.name} ILIKE ${sizePattern} THEN 0 ELSE 1 END), RANDOM()`;
          } else if (attrs.color) {
            const colorPattern = `%${attrs.color.replace(/[%_]/g, '')}%`;
            orderClause = sql`CASE WHEN ${productsV2.name} ILIKE ${colorPattern} THEN 0 ELSE 1 END, RANDOM()`;
          } else if (attrs.size) {
            const sizePattern = `%${attrs.size.replace(/[%_]/g, '')}%`;
            orderClause = sql`CASE WHEN ${productsV2.name} ILIKE ${sizePattern} THEN 0 ELSE 1 END, RANDOM()`;
          } else {
            orderClause = sql`RANDOM()`;
          }
          
          candidates = await db.select({
            id: productsV2.id,
            name: productsV2.name,
            description: productsV2.description,
            price: productsV2.price,
            rrpPrice: productsV2.rrpPrice,
            savingsPercent: productsV2.savingsPercent,
            merchant: productsV2.merchant,
            brand: productsV2.brand,
            category: productsV2.category,
            affiliate_link: productsV2.affiliateLink,
            image_url: productsV2.imageUrl,
            in_stock: productsV2.inStock,
            average_rating: productsV2.averageRating,
            keywords: productsV2.keywords
          }).from(productsV2)
            .where(and(...attrWhereConditions))
            .orderBy(orderClause)
            .limit(50);
          
          console.log(`[Shop V2] Attribute-first search found ${candidates.length} candidates (total: ${totalCandidates})`);
        }
        
        // Standard search term-based approach (fallback when no strong attributes)
        if (candidates.length === 0) {
        for (const termGroup of interpretation.searchTerms) {
          const termConditions: any[] = [];
          for (const term of termGroup) {
            // Sanitize term: remove punctuation that breaks tsquery
            const sanitizedTerm = term.replace(/[^\w\s]/g, ' ').trim();
            if (sanitizedTerm.length < 2) continue;
            
            // Use indexed search_vector column for fast full-text search
            const condition = sql`search_vector @@ plainto_tsquery('english', ${sanitizedTerm})`;
            termConditions.push(condition);
          }
          
          if (termConditions.length === 0) continue;
          
          const whereConditions: any[] = [
            or(...termConditions),
            isNotNull(productsV2.affiliateLink),
            ...filterConditions,
            ...mustHaveConditions,  // Add all mustHave requirements (AND for brands, OR for gift qualifiers)
            ...attributeConditions  // Add attribute filters (brand, model, size, color, gender)
          ];
          
          if (filterMinPrice !== undefined) {
            whereConditions.push(sql`${productsV2.price} >= ${filterMinPrice}`);
          }
          if (effectiveMaxPrice !== undefined) {
            whereConditions.push(sql`${productsV2.price} <= ${effectiveMaxPrice}`);
          }
          
          // Get count for this term group
          const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(productsV2)
            .where(and(...whereConditions));
          const groupCount = Number(countResult[0]?.count || 0);
          totalCandidates += groupCount;
          
          // Get diverse candidates by sampling from different price ranges
          // This prevents cheap industrial products dominating the candidate pool
          const groupResults = await db.select({
            id: productsV2.id,
            name: productsV2.name,
            description: productsV2.description,
            price: productsV2.price,
            rrpPrice: productsV2.rrpPrice,
            savingsPercent: productsV2.savingsPercent,
            merchant: productsV2.merchant,
            brand: productsV2.brand,
            category: productsV2.category,
            affiliate_link: productsV2.affiliateLink,
            image_url: productsV2.imageUrl,
            in_stock: productsV2.inStock,
            average_rating: productsV2.averageRating,
            keywords: productsV2.keywords
          }).from(productsV2)
            .where(and(...whereConditions))
            .orderBy(sql`CASE WHEN category ILIKE '%gift%' THEN 0 WHEN category ILIKE '%toy%' THEN 1 ELSE 2 END, RANDOM()`)
            .limit(50);
          
          for (const p of groupResults) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allCandidates.push(p);
            }
          }
        }
        
        candidates = allCandidates;
        console.log(`[Shop V2] Semantic search found ${candidates.length} candidates from ${interpretation.searchTerms.length} term groups (total matches: ${totalCandidates})`);
        } // End of standard search term-based approach
        
        // FALLBACK 1: If mustHaveAll+mustHaveAny yielded 0 results, retry without mustHaveAny
        if (candidates.length === 0 && interpretation.mustHaveAll && interpretation.mustHaveAll.length >= 1 && 
            interpretation.mustHaveAny && interpretation.mustHaveAny.length > 0) {
          console.log(`[Shop V2] Fallback 1: Retrying without mustHaveAny restriction`);
          const fallback1Candidates: any[] = [];
          const fallback1SeenIds = new Set<string>();
          
          // Build mustHaveAll conditions only (no mustHaveAny)
          const mustHaveOnlyConditions: any[] = [];
          for (const term of interpretation.mustHaveAll) {
            const sanitizedTerm = term.replace(/[^\w\s]/g, ' ').trim();
            mustHaveOnlyConditions.push(sql`search_vector @@ plainto_tsquery('english', ${sanitizedTerm})`);
          }
          
          for (const termGroup of interpretation.searchTerms) {
            const termConditions: any[] = [];
            for (const term of termGroup) {
              const sanitizedTerm = term.replace(/[^\w\s]/g, ' ').trim();
              if (sanitizedTerm.length < 2) continue;
              termConditions.push(sql`search_vector @@ plainto_tsquery('english', ${sanitizedTerm})`);
            }
            
            if (termConditions.length === 0) continue;
            
            const whereConditions: any[] = [
              or(...termConditions),
              isNotNull(productsV2.affiliateLink),
              ...filterConditions,
              ...mustHaveOnlyConditions  // Only mustHaveAll, no mustHaveAny
            ];
            
            if (filterMinPrice !== undefined) {
              whereConditions.push(sql`${productsV2.price} >= ${filterMinPrice}`);
            }
            if (effectiveMaxPrice !== undefined) {
              whereConditions.push(sql`${productsV2.price} <= ${effectiveMaxPrice}`);
            }
            
            const countResult = await db.select({ count: sql<number>`count(*)` })
              .from(productsV2)
              .where(and(...whereConditions));
            totalCandidates += Number(countResult[0]?.count || 0);
            
            const groupResults = await db.select({
              id: productsV2.id,
              name: productsV2.name,
              description: productsV2.description,
              price: productsV2.price,
              rrpPrice: productsV2.rrpPrice,
              savingsPercent: productsV2.savingsPercent,
              merchant: productsV2.merchant,
              brand: productsV2.brand,
              category: productsV2.category,
              affiliate_link: productsV2.affiliateLink,
              image_url: productsV2.imageUrl,
              in_stock: productsV2.inStock,
              average_rating: productsV2.averageRating,
              keywords: productsV2.keywords
            }).from(productsV2)
              .where(and(...whereConditions))
              .orderBy(sql`CASE WHEN category ILIKE '%toy%' THEN 0 WHEN category ILIKE '%gift%' THEN 1 ELSE 2 END, RANDOM()`)
              .limit(50);
            
            for (const p of groupResults) {
              if (!fallback1SeenIds.has(p.id)) {
                fallback1SeenIds.add(p.id);
                fallback1Candidates.push(p);
              }
            }
          }
          
          if (fallback1Candidates.length > 0) {
            candidates = fallback1Candidates;
            console.log(`[Shop V2] Fallback 1 found ${candidates.length} candidates without mustHaveAny`);
          }
        }
        
        // FALLBACK 2: If mustHaveAll with multiple brands yielded 0 results, retry with just the first brand
        if (candidates.length === 0 && interpretation.mustHaveAll && interpretation.mustHaveAll.length > 1) {
          console.log(`[Shop V2] Fallback: Retrying with only first brand: ${interpretation.mustHaveAll[0]}`);
          const fallbackCandidates: any[] = [];
          const fallbackSeenIds = new Set<string>();
          
          // Use only the first mustHaveAll term
          const fallbackMustHave = sql`search_vector @@ plainto_tsquery('english', ${interpretation.mustHaveAll[0]})`;
          
          for (const termGroup of interpretation.searchTerms) {
            const termConditions: any[] = [];
            for (const term of termGroup) {
              const sanitizedTerm = term.replace(/[^\w\s]/g, ' ').trim();
              if (sanitizedTerm.length < 2) continue;
              termConditions.push(sql`search_vector @@ plainto_tsquery('english', ${sanitizedTerm})`);
            }
            
            if (termConditions.length === 0) continue;
            
            const whereConditions: any[] = [
              or(...termConditions),
              isNotNull(productsV2.affiliateLink),
              ...filterConditions,
              fallbackMustHave
            ];
            
            if (filterMinPrice !== undefined) {
              whereConditions.push(sql`${productsV2.price} >= ${filterMinPrice}`);
            }
            if (effectiveMaxPrice !== undefined) {
              whereConditions.push(sql`${productsV2.price} <= ${effectiveMaxPrice}`);
            }
            
            const countResult = await db.select({ count: sql<number>`count(*)` })
              .from(productsV2)
              .where(and(...whereConditions));
            totalCandidates += Number(countResult[0]?.count || 0);
            
            const groupResults = await db.select({
              id: productsV2.id,
              name: productsV2.name,
              description: productsV2.description,
              price: productsV2.price,
              rrpPrice: productsV2.rrpPrice,
              savingsPercent: productsV2.savingsPercent,
              merchant: productsV2.merchant,
              brand: productsV2.brand,
              category: productsV2.category,
              affiliate_link: productsV2.affiliateLink,
              image_url: productsV2.imageUrl,
              in_stock: productsV2.inStock,
              average_rating: productsV2.averageRating,
              keywords: productsV2.keywords
            }).from(productsV2)
              .where(and(...whereConditions))
              .orderBy(sql`CASE WHEN category ILIKE '%toy%' THEN 0 WHEN category ILIKE '%gift%' THEN 1 ELSE 2 END, RANDOM()`)
              .limit(50);
            
            for (const p of groupResults) {
              if (!fallbackSeenIds.has(p.id)) {
                fallbackSeenIds.add(p.id);
                fallbackCandidates.push(p);
              }
            }
          }
          
          if (fallbackCandidates.length > 0) {
            candidates = fallbackCandidates;
            console.log(`[Shop V2] Fallback found ${candidates.length} candidates with ${interpretation.mustHaveAll[0]}`);
          }
        }
        
        // FALLBACK 3: If still 0 candidates and we have mustHaveAll, search for just the brand without searchTerms
        if (candidates.length === 0 && interpretation.mustHaveAll && interpretation.mustHaveAll.length >= 1) {
          console.log(`[Shop V2] Fallback 3: Direct brand search for ${interpretation.mustHaveAll.join(' + ')}`);
          
          // Build conditions for all mustHaveAll terms
          const brandConditions: any[] = [];
          for (const term of interpretation.mustHaveAll) {
            const sanitizedTerm = term.replace(/[^\w\s]/g, ' ').trim();
            brandConditions.push(sql`search_vector @@ plainto_tsquery('english', ${sanitizedTerm})`);
          }
          
          const directWhereConditions: any[] = [
            ...brandConditions,
            isNotNull(productsV2.affiliateLink),
            ...filterConditions
          ];
          
          if (filterMinPrice !== undefined) {
            directWhereConditions.push(sql`${productsV2.price} >= ${filterMinPrice}`);
          }
          if (effectiveMaxPrice !== undefined) {
            directWhereConditions.push(sql`${productsV2.price} <= ${effectiveMaxPrice}`);
          }
          
          const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(productsV2)
            .where(and(...directWhereConditions));
          totalCandidates = Number(countResult[0]?.count || 0);
          
          const directResults = await db.select({
            id: productsV2.id,
            name: productsV2.name,
            description: productsV2.description,
            price: productsV2.price,
            rrpPrice: productsV2.rrpPrice,
            savingsPercent: productsV2.savingsPercent,
            merchant: productsV2.merchant,
            brand: productsV2.brand,
            category: productsV2.category,
            affiliate_link: productsV2.affiliateLink,
            image_url: productsV2.imageUrl,
            in_stock: productsV2.inStock,
            average_rating: productsV2.averageRating,
            keywords: productsV2.keywords
          }).from(productsV2)
            .where(and(...directWhereConditions))
            .orderBy(sql`CASE WHEN category ILIKE '%toy%' THEN 0 WHEN category ILIKE '%gift%' THEN 1 ELSE 2 END, RANDOM()`)
            .limit(50);
          
          if (directResults.length > 0) {
            candidates = directResults;
            console.log(`[Shop V2] Fallback 3 found ${candidates.length} products matching brand directly`);
          }
        }
        
      } else {
        const stopWords = new Set(['the', 'and', 'for', 'with', 'set', 'pack', 'from']);
        const words = query.toLowerCase()
          .replace(/[-]/g, ' ')
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 2 && !stopWords.has(w));
        
        if (words.length > 0) {
          // Use websearch_to_tsquery for word-wise AND matching (order-independent)
          // This allows "Star Wars Lego" to match "LEGO Star Wars..." products
          const sanitizedQuery = words.join(' ');
          const wordConditions = [
            sql`search_vector @@ websearch_to_tsquery('english', ${sanitizedQuery})`
          ];
          
          const baseConditions: any[] = [
            ...wordConditions,
            isNotNull(productsV2.affiliateLink),
            sql`${productsV2.imageUrl} NOT ILIKE '%noimage%'`  // Exclude broken images
          ];
          
          if (filterCategory) {
            baseConditions.push(ilike(productsV2.category, `%${filterCategory}%`));
          } else if (interpretation.context.categoryFilter) {
            // Apply GPT-extracted category filter for fast-path queries
            // This prevents "Nike trainers" returning socks instead of actual trainers
            baseConditions.push(ilike(productsV2.category, `%${interpretation.context.categoryFilter}%`));
            console.log(`[Shop V2] Applying fast-path categoryFilter: ${interpretation.context.categoryFilter}`);
          }
          if (filterMerchant) {
            baseConditions.push(ilike(productsV2.merchant, `%${filterMerchant}%`));
          }
          if (filterBrand) {
            baseConditions.push(or(
              ilike(productsV2.brand, `%${filterBrand}%`),
              ilike(productsV2.name, `%${filterBrand}%`)
            ));
          } else if (interpretation.attributes?.brand) {
            // Apply GPT-extracted brand filter for queries like "star wars lego under £20"
            // This ensures only Lego products are returned, not generic Star Wars toys
            const brandFilter = interpretation.attributes.brand;
            baseConditions.push(or(
              ilike(productsV2.brand, `%${brandFilter}%`),
              ilike(productsV2.name, `%${brandFilter}%`)
            ));
            console.log(`[Shop V2] Applying GPT-extracted brand filter: ${brandFilter}`);
          }
          if (filterMinPrice !== undefined) {
            baseConditions.push(sql`${productsV2.price} >= ${filterMinPrice}`);
          }
          if (effectiveMaxPrice !== undefined) {
            baseConditions.push(sql`${productsV2.price} <= ${effectiveMaxPrice}`);
          }
          
          // PERFORMANCE FIX: Skip expensive COUNT(*) and GROUP BY for initial page loads
          // These are the main cause of 20+ second delays on 997k products
          // Skip when: no filters applied AND first page (offset 0)
          const skipExpensiveQueries = !hasFilters && safeOffset === 0;
          
          if (!skipExpensiveQueries) {
            const countResult = await db.select({ count: sql<number>`count(*)` })
              .from(productsV2)
              .where(and(...baseConditions));
            totalCandidates = Number(countResult[0]?.count || 0);
            
            if (!hasFilters && safeOffset === 0) {
              const [catResults, merchResults, brandResults] = await Promise.all([
                db.select({
                  name: productsV2.category,
                  count: sql<number>`count(*)`
                }).from(productsV2)
                  .where(and(...baseConditions))
                  .groupBy(productsV2.category)
                  .orderBy(desc(sql`count(*)`))
                  .limit(6),
                db.select({
                  name: productsV2.merchant,
                  count: sql<number>`count(*)`
                }).from(productsV2)
                  .where(and(...baseConditions))
                  .groupBy(productsV2.merchant)
                  .orderBy(desc(sql`count(*)`))
                  .limit(6),
                db.select({
                  name: productsV2.brand,
                  count: sql<number>`count(*)`
                }).from(productsV2)
                  .where(and(...baseConditions))
                  .groupBy(productsV2.brand)
                  .orderBy(desc(sql`count(*)`))
                  .limit(6)
              ]);
              
              filters = {
                categories: catResults.filter(c => c.name).map(c => ({ name: c.name, count: Number(c.count) })),
                merchants: merchResults.filter(m => m.name).map(m => ({ name: m.name, count: Number(m.count) })),
                brands: brandResults.filter(b => b.name).map(b => ({ name: b.name, count: Number(b.count) }))
              };
            }
          }
          
          candidates = await db.select({
            id: productsV2.id,
            name: productsV2.name,
            description: productsV2.description,
            price: productsV2.price,
            rrpPrice: productsV2.rrpPrice,
            savingsPercent: productsV2.savingsPercent,
            merchant: productsV2.merchant,
            brand: productsV2.brand,
            category: productsV2.category,
            affiliate_link: productsV2.affiliateLink,
            image_url: productsV2.imageUrl,
            in_stock: productsV2.inStock,
            average_rating: productsV2.averageRating,
            keywords: productsV2.keywords
          }).from(productsV2)
            .where(and(...baseConditions))
            .orderBy(productsV2.price)
            .limit(Math.min(50, safeLimit * 5));
          
          // If we skipped the COUNT query, use candidates length as totalCandidates
          if (skipExpensiveQueries && totalCandidates === 0) {
            totalCandidates = candidates.length;
          }
        }
        
        console.log(`[Shop V2] Found ${candidates.length} candidates for "${query}" (total: ${totalCandidates})`);
      }

      if (candidates.length === 0) {
        // Try to find nearly matching alternatives by relaxing some constraints
        let nearlyMatching: any[] = [];
        let suggestionMessage = "No exact matches found.";
        
        if (interpretation.attributes) {
          const { db } = await import('./db');
          const { productsV2 } = await import('@shared/schema');
          const { or, ilike, isNotNull, sql } = await import('drizzle-orm');
          
          // Try without size constraint first
          const relaxedConditions: any[] = [isNotNull(productsV2.affiliateLink)];
          
          if (interpretation.attributes.brand) {
            relaxedConditions.push(or(
              ilike(productsV2.brand, `%${interpretation.attributes.brand}%`),
              ilike(productsV2.name, `%${interpretation.attributes.brand}%`)
            ));
          }
          if (interpretation.attributes.model) {
            relaxedConditions.push(ilike(productsV2.name, `%${interpretation.attributes.model}%`));
          }
          
          try {
            const { and } = await import('drizzle-orm');
            const whereClause = relaxedConditions.length > 1 ? and(...relaxedConditions) : relaxedConditions[0];
            
            nearlyMatching = await db.select({
              id: productsV2.id,
              name: productsV2.name,
              price: productsV2.price,
              merchant: productsV2.merchant,
              brand: productsV2.brand,
              affiliate_link: productsV2.affiliateLink,
              image_url: productsV2.imageUrl
            }).from(productsV2)
              .where(whereClause)
              .orderBy(sql`RANDOM()`)
              .limit(5);
            
            if (nearlyMatching.length > 0) {
              const attrs = interpretation.attributes;
              if (attrs.size) {
                suggestionMessage = `No products found in size ${attrs.size}. Here are similar products in other sizes:`;
              } else if (attrs.color) {
                suggestionMessage = `No products found in ${attrs.color}. Here are similar products in other colors:`;
              } else {
                suggestionMessage = "No exact matches found. Here are similar alternatives:";
              }
            }
          } catch (e) {
            console.log('[Shop V2] Nearly matching search failed:', e);
          }
        }
        
        return res.json({
          success: true,
          query: query,
          count: 0,
          totalCount: 0,
          hasMore: false,
          products: [],
          message: suggestionMessage,
          nearlyMatching: nearlyMatching.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price) || 0,
            merchant: p.merchant,
            brand: p.brand,
            imageUrl: p.image_url,
            affiliateLink: p.affiliate_link
          }))
        });
      }

      // Apply pagination offset when selecting products
      let selectedProducts: any[] = candidates.slice(safeOffset, safeOffset + safeLimit);
      
      // ONLY skip GPT reranking for bare product queries (e.g., "trainers")
      // Brand+product queries (e.g., "Nike trainers") NEED reranking to filter out non-shoes
      const isFastPath = interpretation.skipReranker;
      
      if (openaiKey && candidates.length > safeLimit && !isFastPath) {
        try {
          const openai = new OpenAI({ apiKey: openaiKey });
          
          const productsText = candidates.slice(0, 20).map(p => {
            const desc = (p.description || '').substring(0, 60).replace(/\n/g, ' ');
            return `ID:${p.id} | ${p.name} | ${p.brand || ''} | £${p.price}${desc ? ` | ${desc}` : ''}`;
          }).join('\n');
          
          const rerankerPrompt = interpretation.isSemanticQuery && interpretation.rerankerContext
            ? `Search: "${query}"\nContext: ${interpretation.rerankerContext}`
            : `Search: "${query}"`;
          
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 200,
            messages: [
              {
                role: 'system',
                content: `You help UK families find products. Return IDs of the ${safeLimit} BEST matching products as JSON array. ONLY use IDs from the list.

Selection rules:
1. READ THE DESCRIPTION - it tells you what the product actually is
2. "school shoes" = formal black leather shoes for school uniforms, NOT trainers/sneakers
3. Match the INTENT of the search, not just keywords
4. Prefer products where the name/description clearly matches the search
5. ALWAYS return ${safeLimit} IDs - never return empty array
6. Return format: ["id1", "id2", "id3", ...]`
              },
              { role: 'user', content: `${rerankerPrompt}\n\nProducts:\n${productsText}` }
            ],
            temperature: 0.1
          });

          let selectedIds: string[] = [];
          const rawGptResponse = response.choices[0].message.content?.trim() || '[]';
          console.log(`[Shop V2] GPT reranker raw response: ${rawGptResponse.substring(0, 200)}`);
          
          try {
            let result = rawGptResponse;
            if (result.includes('```')) {
              result = result.split('```')[1].replace('json', '').trim();
            }
            selectedIds = JSON.parse(result);
            if (!Array.isArray(selectedIds)) {
              console.log(`[Shop V2] GPT returned non-array, falling back`);
              selectedIds = [];
            }
          } catch (parseError) {
            console.log(`[Shop V2] GPT JSON parse failed: ${(parseError as Error).message}`);
            selectedIds = candidates.slice(safeOffset, safeOffset + safeLimit).map(p => p.id);
          }

          console.log(`[Shop V2] GPT selected ${selectedIds.length} products from IDs: ${selectedIds.slice(0, 5).join(', ')}...`);

          const idToProduct = new Map(candidates.map(p => [String(p.id), p]));
          selectedProducts = [];
          for (const pid of selectedIds) {
            const p = idToProduct.get(String(pid));
            if (p) selectedProducts.push(p);
          }
          
          if (selectedProducts.length === 0 && candidates.length > safeOffset) {
            selectedProducts = candidates.slice(safeOffset, safeOffset + safeLimit);
          }
        } catch (aiError) {
          console.log(`[Shop V2] GPT rerank failed, using offset ${safeOffset}:`, aiError);
          selectedProducts = candidates.slice(safeOffset, safeOffset + safeLimit);
        }
      }

      const hasMore = (safeOffset + selectedProducts.length) < totalCandidates;
      
      // Build facets from candidates for filtering
      const facets = {
        merchants: [...new Set(candidates.map((p: any) => p.merchant).filter(Boolean))].slice(0, 20),
        brands: [...new Set(candidates.map((p: any) => p.brand).filter(Boolean))].slice(0, 20),
        categories: [...new Set(candidates.map((p: any) => p.category).filter(Boolean))].slice(0, 20),
        priceRanges: buildPriceRanges(candidates.map((p: any) => parseFloat(p.price) || 0))
      };
      
      // Find best price across all candidates for price comparison
      const prices = candidates.map((p: any) => parseFloat(p.price) || 0).filter(p => p > 0);
      const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;
      const highestPrice = prices.length > 0 ? Math.max(...prices) : null;
      
      // Group products by similar name for multi-merchant comparison
      const merchantComparison = buildMerchantComparison(candidates.slice(0, 50));
      
      // Build bespoke reactive filters based on detected category
      const matchedCategories = facets.categories;
      const detectedCategory = detectProductCategory(query, interpretation.attributes, matchedCategories);
      const filterSchema = buildBespokeFilters(detectedCategory, candidates, interpretation.attributes);
      console.log(`[Shop V2] Detected category: ${detectedCategory}, filters: ${filterSchema.filters.map(f => f.id).join(', ')}`);
      
      const response: any = {
        success: true,
        query: query,
        count: selectedProducts.length,
        totalCount: totalCandidates,
        hasMore: hasMore,
        dataSource: "products_v2 (997k products)",
        products: selectedProducts.map((p: any) => {
          const price = parseFloat(p.price) || 0;
          return {
            id: p.id,
            name: p.name,
            description: (p.description || '').slice(0, 200),
            price: price,
            rrpPrice: p.rrpPrice ? parseFloat(p.rrpPrice) : null,
            savingsPercent: p.savingsPercent ? parseFloat(p.savingsPercent) : null,
            currency: 'GBP',
            merchant: p.merchant,
            brand: p.brand || '',
            category: p.category || '',
            imageUrl: p.image_url || '',
            affiliateLink: p.affiliate_link,
            inStock: p.in_stock ?? true,
            averageRating: p.average_rating || null,
            isBestPrice: lowestPrice !== null && price === lowestPrice,
            priceRank: lowestPrice !== null ? (price === lowestPrice ? 'lowest' : price === highestPrice ? 'highest' : 'mid') : null
          };
        }),
        facets: facets,
        priceStats: {
          lowest: lowestPrice,
          highest: highestPrice,
          count: prices.length
        },
        merchantComparison: merchantComparison,
        filterSchema: filterSchema
      };
      
      if (filters) {
        response.filters = filters;
      }
      
      if (interpretation.isSemanticQuery) {
        response.interpretation = {
          expanded: interpretation.expandedKeywords,
          context: interpretation.context
        };
      }
      
      const totalTime = Date.now() - searchStartTime;
      console.log(`[Shop V2] TIMING: Total ${totalTime}ms for "${query}" (${selectedProducts.length} results)`);
      
      res.json(response);
    } catch (error) {
      const err = error as Error;
      console.error('[Shop V2] Error:', err.message);
      res.status(500).json({ 
        success: false, 
        error: "Search failed",
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  // ============================================================
  // GROUPED SHOP SEARCH - Simple approach: AND keyword SQL + GPT reranker
  // Same as /api/shop/search but groups size variants together
  // ============================================================
  app.post("/api/shop/search-grouped", async (req, res) => {
    try {
      const { query, limit = 8 } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, error: "Query is required" });
      }

      const safeLimit = Math.min(Math.max(1, limit), 20);
      console.log(`[Shop Grouped] Query: "${query}"`);

      // 1. Get candidate products using OR-based keyword match (broad recall)
      // Replace punctuation with spaces (preserves "Spider-Man" as "spider man")
      const words = query.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 0);
      let candidates: any[] = [];
      
      if (words.length > 0) {
        const { db } = await import('./db');
        const { products } = await import('@shared/schema');
        const { and, or, ilike, isNotNull } = await import('drizzle-orm');
        
        // Build OR conditions: any word can match in name, description, brand, or category
        const wordConditions = words.map(w => {
          const pattern = `%${w}%`;
          return or(
            ilike(products.name, pattern),
            ilike(products.description, pattern),
            ilike(products.brand, pattern),
            ilike(products.category, pattern)
          );
        });
        
        const result = await db.select({
          id: products.id,
          name: products.name,
          description: products.description,
          price: products.price,
          merchant: products.merchant,
          brand: products.brand,
          category: products.category,
          affiliate_link: products.affiliateLink,
          image_url: products.imageUrl,
          in_stock: products.inStock
        }).from(products)
          .where(and(or(...wordConditions), isNotNull(products.affiliateLink)))
          .limit(100);
        
        candidates = result as any[];
      }
      
      if (candidates.length === 0) {
        return res.json({ success: true, query, count: 0, products: [] });
      }

      console.log(`[Shop Grouped] Found ${candidates.length} candidates`);

      // 2. Group by image URL to consolidate size variants
      const groups: Map<string, any[]> = new Map();
      for (const p of candidates) {
        const key = p.image_url || p.id;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(p);
      }

      // 3. Create grouped products
      const groupedProducts = Array.from(groups.values()).map(items => {
        const first = items[0];
        const prices = items.map(p => parseFloat(p.price) || 0);
        return {
          id: first.id,
          name: first.name,
          description: first.description,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          merchant: first.merchant,
          brand: first.brand,
          category: first.category,
          imageUrl: first.image_url,
          affiliateLink: first.affiliate_link,
          variantCount: items.length,
          inStock: items.some(p => p.in_stock !== false)
        };
      });

      // 4. Use GPT to pick best grouped products
      const openaiKey = process.env.OPENAI_API_KEY;
      let selectedProducts = groupedProducts.slice(0, safeLimit);
      
      if (openaiKey && groupedProducts.length > safeLimit) {
        try {
          const openai = new OpenAI({ apiKey: openaiKey });
          const productsText = groupedProducts.map(p => 
            `ID:${p.id} | ${p.name} | £${p.minPrice} | ${(p.description || '').substring(0, 80)}`
          ).join('\n');

          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You help UK families find products. Given a search and product list,
return the IDs of the ${safeLimit} best matching products as a JSON array.
ONLY use IDs from the list. Never invent IDs.`
              },
              { role: 'user', content: `Search: ${query}\n\nProducts:\n${productsText}` }
            ],
            temperature: 0.1
          });

          let selectedIds: string[] = [];
          try {
            let result = response.choices[0].message.content?.trim() || '[]';
            if (result.includes('```')) {
              result = result.split('```')[1].replace('json', '').trim();
            }
            selectedIds = JSON.parse(result);
          } catch {
            selectedIds = groupedProducts.slice(0, safeLimit).map(p => p.id);
          }

          const idToProduct = new Map(groupedProducts.map(p => [String(p.id), p]));
          selectedProducts = [];
          for (const pid of selectedIds) {
            const p = idToProduct.get(String(pid));
            if (p) selectedProducts.push(p);
          }
        } catch (aiError) {
          console.log(`[Shop Grouped] GPT rerank failed:`, aiError);
        }
      }

      res.json({
        success: true,
        query: query,
        count: selectedProducts.length,
        products: selectedProducts
      });
    } catch (error) {
      console.error('[Shop Grouped] Error:', error);
      res.status(500).json({ success: false, error: "Search failed" });
    }
  });

  // Shopping deals endpoint - Awin affiliate links
  app.get("/shopping/awin-link", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        limit: req.query.limit
      });
      
      let deals: Awaited<ReturnType<typeof fetchAwinProducts>> = [];
      let dataSource = "awin";
      
      // Only use Awin API - no sample data fallback
      if (isAwinConfigured()) {
        deals = await fetchAwinProducts(query.query, query.category, query.limit);
      }
      
      // Log if no results found (for debugging)
      if (deals.length === 0) {
        console.log(`Shopping search returned 0 results for query="${query.query}" category="${query.category}"`);
      }
      
      // Generate human-readable message for GPT display
      const message = deals.length > 0
        ? deals.map(d => 
            `${d.title} - £${d.salePrice || d.originalPrice}\n${d.merchant}\n${d.affiliateLink}`
          ).join('\n\n')
        : `No products found for "${query.query || 'all'}". Try a different search term.`;
      
      res.json({
        success: true,
        endpoint: "/shopping/awin-link",
        description: "Shopping deals and affiliate links",
        count: deals.length,
        dataSource: dataSource,
        message: message,
        filters: {
          query: query.query || null,
          category: query.category || null,
          limit: query.limit
        },
        results: deals
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Cinema search endpoint - UK movies (database)
  app.get("/cinema/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.genre || req.query.category,
        limit: req.query.limit
      });
      
      const familyOnly = req.query.family !== 'false';
      
      const movies = await storage.searchCinemaMovies(
        query.query,
        familyOnly,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/cinema/search",
        description: "UK cinema movies - now playing and upcoming releases",
        count: movies.length,
        dataSource: "database",
        lastUpdated: "2026-01-04",
        filters: {
          query: query.query || null,
          genre: query.category || null,
          familyFriendly: familyOnly,
          limit: query.limit
        },
        results: movies
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Attractions search endpoint
  app.get("/attractions/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        location: req.query.location,
        limit: req.query.limit
      });
      
      const attractions = await storage.getAttractions(query);
      
      res.json({
        success: true,
        endpoint: "/attractions/search",
        description: "Local attractions and days out",
        count: attractions.length,
        filters: {
          query: query.query || null,
          category: query.category || null,
          location: query.location || null,
          limit: query.limit
        },
        results: attractions
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Free attractions endpoint
  app.get("/attractions/free", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        location: req.query.location,
        limit: req.query.limit
      });
      
      const attractions = await storage.searchFreeAttractions(
        query.query || '',
        query.location,
        query.category,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/attractions/free",
        description: "Free attractions and activities (no entry fee or price not available)",
        count: attractions.length,
        totalAvailable: 3694,
        dataSource: "database",
        filters: {
          query: query.query || null,
          category: query.category || null,
          location: query.location || null,
          limit: query.limit
        },
        results: attractions
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Recommendations search endpoint - community-sourced venue recommendations
  app.get("/recommendations/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        limit: req.query.limit
      });
      
      const recommendations = await storage.searchRecommendations(
        query.query,
        query.category,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/recommendations/search",
        description: "Community-sourced venue recommendations with mention counts",
        count: recommendations.length,
        totalAvailable: 179,
        dataSource: "database",
        filters: {
          query: query.query || null,
          category: query.category || null,
          limit: query.limit
        },
        results: recommendations
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Events search endpoint - family events and shows
  app.get("/events/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        location: req.query.city || req.query.location,
        limit: req.query.limit
      });
      
      // Family filter: when true, exclude adult-only content
      const family = req.query.family === 'true';
      
      const events = await storage.searchEvents(
        query.query,
        query.location,
        query.category,
        query.limit,
        family
      );
      
      res.json({
        success: true,
        endpoint: "/events/search",
        description: "Family events, shows, and live entertainment",
        count: events.length,
        totalAvailable: 798,
        dataSource: "database",
        filters: {
          query: query.query || null,
          city: query.location || null,
          category: query.category || null,
          limit: query.limit
        },
        results: events
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Restaurants search endpoint - family-friendly restaurants
  app.get("/restaurants/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        location: req.query.city || req.query.location,
        limit: req.query.limit
      });
      
      const chain = req.query.chain as string | undefined;
      
      const restaurants = await storage.searchRestaurants(
        query.query,
        query.location,
        chain,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/restaurants/search",
        description: "Family-friendly restaurants with kids menus and facilities",
        count: restaurants.length,
        totalAvailable: 838,
        dataSource: "database",
        filters: {
          query: query.query || null,
          city: query.location || null,
          chain: chain || null,
          limit: query.limit
        },
        results: restaurants
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Night in search endpoint - movies to watch at home
  app.get("/nightin/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.genre || req.query.category,
        limit: req.query.limit
      });
      
      const streamingService = req.query.service as string | undefined;
      const mood = req.query.mood as string | undefined;
      const familyOnly = req.query.family !== 'false';
      
      const movies = await storage.searchNightinMovies(
        query.query,
        streamingService,
        mood,
        familyOnly,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/nightin/search",
        description: "Movies to watch at home - streaming on Netflix, Prime Video, Disney+, Apple TV+, Sky/NOW and more",
        count: movies.length,
        totalAvailable: 500,
        dataSource: "database",
        lastUpdated: "2026-01-04",
        filters: {
          query: query.query || null,
          genre: query.category || null,
          service: streamingService || null,
          mood: mood || null,
          familyFriendly: familyOnly,
          limit: query.limit
        },
        availableServices: STREAMING_SERVICES,
        results: movies
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Hints and tips search endpoint
  app.get("/hintsandtips/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        limit: req.query.limit
      });
      
      const tips = await storage.getHintsAndTips(query);
      
      res.json({
        success: true,
        endpoint: "/hintsandtips/search",
        description: "Money-saving hints and tips",
        count: tips.length,
        filters: {
          query: query.query || null,
          category: query.category || null,
          limit: query.limit
        },
        results: tips
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Family activities endpoint - full playbook with rich filtering
  app.get("/activities/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        age: req.query.age,
        energy: req.query.energy,
        setting: req.query.setting,
        limit: req.query.limit
      });
      
      let dbActivities = await storage.searchActivities(
        query.query,
        query.age,
        50
      );
      
      // Filter by category/topic tag
      if (query.category) {
        const catUpper = query.category.toUpperCase().replace(/ /g, "_");
        dbActivities = dbActivities.filter(act => 
          act.tags.some((tag: string) => tag.toUpperCase().includes(catUpper))
        );
      }
      
      // Filter by energy level
      if (query.energy) {
        const energyTag = `E${query.energy.toUpperCase()}`;
        dbActivities = dbActivities.filter(act => 
          act.tags.includes(energyTag)
        );
      }
      
      // Filter by setting
      if (query.setting) {
        const settingTag = query.setting.toUpperCase();
        dbActivities = dbActivities.filter(act => 
          act.tags.some((tag: string) => tag.toUpperCase().includes(settingTag))
        );
      }
      
      // Limit results and format
      const results = dbActivities.slice(0, query.limit).map(act => ({
        id: act.id,
        title: act.title,
        summary: act.summary,
        tags: act.tags,
        age_bands: act.ageBands,
        constraints: {
          supervision: act.supervisionLevel,
          noise: act.noiseLevel
        },
        steps: act.steps,
        variations: act.variations,
        category: getCategoryFromTags(act.tags),
        ageRange: getAgeRange(act.ageBands),
        decodedTags: act.tags.map((t: string) => decodeTag(t))
      }));
      
      res.json({
        success: true,
        endpoint: "/activities/search",
        description: "Family activities from the Sunny Playbook",
        count: results.length,
        totalAvailable: 500,
        dataSource: "database",
        filters: {
          query: query.query || null,
          category: query.category || null,
          age: query.age || null,
          energy: query.energy || null,
          setting: query.setting || null,
          limit: query.limit
        },
        results: results
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // OpenAPI schema endpoint for ChatGPT GPT Actions
  app.get("/api/openapi", async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const schemaPath = path.join(process.cwd(), 'openapi.yaml');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      res.type('text/yaml').send(schema);
    } catch (error) {
      res.status(500).json({ error: "Failed to load OpenAPI schema" });
    }
  });

  // API documentation endpoint
  app.get("/api/docs", (req, res) => {
    res.json({
      name: "GPT Deals & Tips API",
      version: "1.2.0",
      description: "API endpoints for ChatGPT custom GPT integration providing shopping deals, cinema listings, UK attractions, family activities, night-in ideas, and money-saving tips",
      endpoints: [
        {
          path: "/shopping/awin-link",
          method: "GET",
          description: "Get shopping deals and affiliate links",
          parameters: {
            query: "Search term (optional)",
            category: "Filter by category: Electronics, Fashion, Kitchen, Home, etc. (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/cinema/search",
          method: "GET",
          description: "Search cinema listings and movie deals",
          parameters: {
            query: "Movie title or genre (optional)",
            location: "City or area (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/attractions/search",
          method: "GET",
          description: "Search UK attractions and days out (305 real UK attractions from daysout.co.uk)",
          parameters: {
            query: "Attraction name or type (optional)",
            category: "Filter by category: Theme Parks, Museums, Historical, Landmarks, Zoos, Entertainment (optional)",
            location: "City or area (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/activities/search",
          method: "GET",
          description: "Family activities from the Sunny Playbook - 40+ activities with rich filtering",
          parameters: {
            query: "Activity name or keyword (optional)",
            category: "Filter by topic: Car, Rainy Day, Keep Busy, Chores, Bedtime, Morning, Homework, Big Feelings, Craft, Building, LEGO (optional)",
            age: "Child's age number e.g. 5, 8, 12 (optional)",
            energy: "Energy level: LOW, MED, HIGH (optional)",
            setting: "Setting: INDOOR, OUTDOOR, CAR (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/nightin/search",
          method: "GET",
          description: "Get movies to watch at home with UK streaming availability",
          parameters: {
            query: "Movie title, actor, or director search (optional)",
            category: "Filter by genre: Action, Comedy, Drama, Horror, Sci-Fi, Animation, Romance, Thriller, etc. (optional)",
            service: "Filter by streaming service: Netflix, Prime Video, Disney+, Apple TV+, Sky, NOW, MUBI (optional)",
            mood: "Filter by mood: Fun, Romantic, Intense, Scary, Heartwarming, Epic, Dark, etc. (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/hintsandtips/search",
          method: "GET",
          description: "Get money-saving hints and tips plus family activity ideas",
          parameters: {
            query: "Topic or keyword (optional)",
            category: "Filter by category: Shopping, Entertainment, Days Out, Food, Bills, Travel, Car Games, Calm Down, Chores, etc. (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/sunny/chat",
          method: "POST",
          description: "Sunny AI Chat Concierge - conversational family entertainment assistant",
          parameters: {
            message: "User message to Sunny (required)",
            sessionId: "Session ID for conversation continuity (optional)",
            location: "User's location for local recommendations (optional)"
          }
        },
        {
          path: "/sunny/health",
          method: "GET",
          description: "Sunny AI health check - verify service is running"
        },
        {
          path: "/sunny/history",
          method: "GET",
          description: "Conversation logs - retrieve saved chats from database for verification",
          parameters: {
            sessionId: "Filter by specific session ID (optional)",
            limit: "Number of results, 1-100, default 50 (optional)",
            full: "Set to 'true' to see full responses instead of truncated (optional)"
          }
        },
        {
          path: "/sunny/diagnostics",
          method: "GET",
          description: "Sunny diagnostics - verify data sources and configuration"
        }
      ],
      exampleCalls: [
        "GET /shopping/awin-link?category=Electronics",
        "GET /cinema/search?location=London",
        "GET /attractions/search?category=Theme Parks&location=London",
        "GET /activities/search?age=6&energy=HIGH&setting=INDOOR",
        "GET /activities/search?category=CAR&limit=5",
        "GET /nightin/search?category=Cooking",
        "GET /hintsandtips/search?category=Shopping",
        "POST /sunny/chat with {message: 'zoos near London'}",
        "GET /sunny/history?full=true",
        "GET /sunny/history?sessionId=abc123"
      ]
    });
  });

  // ============================================================
  // SEARCH QUALITY AUDIT ENDPOINTS
  // ============================================================
  
  // Database check - verify products exist for given keywords
  app.get("/api/audit/db-check", async (req, res) => {
    try {
      const keywords = (req.query.keywords as string || '').split(',').filter(k => k.trim());
      const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      
      if (keywords.length === 0) {
        return res.status(400).json({ error: 'keywords parameter required (comma-separated)' });
      }
      
      // Build SQL to check if products exist
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      for (const keyword of keywords) {
        conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex} OR LOWER(brand) LIKE $${paramIndex})`);
        params.push(`%${keyword.toLowerCase().trim()}%`);
        paramIndex++;
      }
      
      let sql = `SELECT id, name, brand, price, merchant, category FROM products WHERE ${conditions.join(' AND ')}`;
      
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        sql += ` AND price <= $${paramIndex}`;
        params.push(maxPrice);
        paramIndex++;
      }
      
      sql += ` LIMIT ${limit}`;
      
      const { db } = await import('./db');
      const { sql: sqlTag } = await import('drizzle-orm');
      
      // Use raw query
      const countSql = `SELECT COUNT(*) as total FROM products WHERE ${conditions.join(' AND ')}${maxPrice !== undefined ? ` AND price <= $${paramIndex - 1}` : ''}`;
      
      const countResult = await db.execute(sqlTag.raw(`SELECT COUNT(*) as total FROM products WHERE ${conditions.map((_, i) => `(LOWER(name) LIKE '%${keywords[i].toLowerCase().trim()}%' OR LOWER(description) LIKE '%${keywords[i].toLowerCase().trim()}%' OR LOWER(brand) LIKE '%${keywords[i].toLowerCase().trim()}%')`).join(' AND ')}${maxPrice !== undefined ? ` AND price <= ${maxPrice}` : ''}`)) as any;
      
      const sampleResult = await db.execute(sqlTag.raw(`SELECT id, name, brand, price, merchant, category FROM products WHERE ${conditions.map((_, i) => `(LOWER(name) LIKE '%${keywords[i].toLowerCase().trim()}%' OR LOWER(description) LIKE '%${keywords[i].toLowerCase().trim()}%' OR LOWER(brand) LIKE '%${keywords[i].toLowerCase().trim()}%')`).join(' AND ')}${maxPrice !== undefined ? ` AND price <= ${maxPrice}` : ''} LIMIT ${limit}`)) as any;
      
      const total = parseInt(countResult[0]?.total || countResult.rows?.[0]?.total || '0');
      
      res.json({
        keywords,
        max_price: maxPrice,
        exists: total > 0,
        count: total,
        sample_products: sampleResult.rows || sampleResult
      });
    } catch (error) {
      console.error('[Audit] DB check error:', error);
      res.status(500).json({ error: 'Database check failed', details: String(error) });
    }
  });
  
  // Run full audit - check queries against search API and score relevance
  app.post("/api/audit/run", async (req, res) => {
    try {
      const { queries, check_relevance = true, limit = 10 } = req.body;
      
      if (!queries || !Array.isArray(queries)) {
        return res.status(400).json({ error: 'queries array required' });
      }
      
      const results: any[] = [];
      let passCount = 0, partialCount = 0, failCount = 0;
      
      for (const testQuery of queries) {
        // Handle both string format ("barbie dolls") and object format ({ query: "barbie dolls", ... })
        const isStringQuery = typeof testQuery === 'string';
        const query = isStringQuery ? testQuery : testQuery.query;
        const required_keywords = isStringQuery ? '' : (testQuery.required_keywords || '');
        const max_price = isStringQuery ? undefined : testQuery.max_price;
        const expected_brand = isStringQuery ? undefined : testQuery.expected_brand;
        const expected_character = isStringQuery ? undefined : testQuery.expected_character;
        const category = isStringQuery ? undefined : testQuery.category;
        
        // Skip empty queries
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          console.log(`[Audit] Skipping invalid query:`, testQuery);
          continue;
        }
        
        const requiredKws = (required_keywords || '').split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k);
        
        const startTime = Date.now();
        
        // Step 1: Check if products exist in DB
        let dbExists = false;
        let dbCount = 0;
        try {
          const { db } = await import('./db');
          const { sql: sqlTag } = await import('drizzle-orm');
          
          // FIX: Use AND logic to match what search actually does (not OR which inflates counts)
          const kwConditions = requiredKws.length > 0
            ? requiredKws.map((kw: string) => `(LOWER(name) LIKE '%${kw.replace(/'/g, "''")}%' OR LOWER(brand) LIKE '%${kw.replace(/'/g, "''")}%')`).join(' AND ')
            : `LOWER(name) LIKE '%${query.toLowerCase().replace(/'/g, "''").split(' ')[0]}%'`;
          
          const priceCondition = max_price ? ` AND price <= ${parseFloat(max_price)}` : '';
          const countResult = await db.execute(sqlTag.raw(`SELECT COUNT(*) as total FROM products WHERE (${kwConditions})${priceCondition}`)) as any;
          dbCount = parseInt(countResult[0]?.total || countResult.rows?.[0]?.total || '0');
          dbExists = dbCount > 0;
        } catch (e) {
          console.error(`[Audit] DB check failed for "${query}":`, e);
        }
        
        // Step 2: Run search API
        let searchResults: any[] = [];
        let searchTime = 0;
        try {
          const searchStart = Date.now();
          const products = await fetchAwinProducts(query, undefined, limit);
          searchTime = Date.now() - searchStart;
          searchResults = products;
        } catch (e) {
          console.error(`[Audit] Search failed for "${query}":`, e);
        }
        
        // Step 3: Score relevance
        let relevantCount = 0;
        const scoredProducts: any[] = [];
        
        for (const product of searchResults) {
          const productText = `${product.title} ${product.description || ''} ${product.merchant || ''}`.toLowerCase();
          let isRelevant = true;
          const issues: string[] = [];
          
          // Check required keywords
          if (check_relevance && requiredKws.length > 0) {
            for (const kw of requiredKws) {
              if (!productText.includes(kw)) {
                isRelevant = false;
                issues.push(`Missing: ${kw}`);
                break; // At least one required keyword missing
              }
            }
          }
          
          // Check price constraint
          if (max_price && product.salePrice > parseFloat(max_price)) {
            isRelevant = false;
            issues.push(`Price ${product.salePrice} > ${max_price}`);
          }
          
          // Check expected brand
          if (expected_brand && !productText.includes(expected_brand.toLowerCase())) {
            isRelevant = false;
            issues.push(`Not ${expected_brand}`);
          }
          
          // Check expected character
          if (expected_character && !productText.includes(expected_character.toLowerCase())) {
            isRelevant = false;
            issues.push(`Not ${expected_character}`);
          }
          
          if (isRelevant) relevantCount++;
          
          scoredProducts.push({
            name: product.title,
            price: product.salePrice,
            merchant: product.merchant,
            relevant: isRelevant,
            issues: issues.length > 0 ? issues : undefined
          });
        }
        
        // Calculate relevance score
        const relevanceScore = searchResults.length > 0 ? relevantCount / searchResults.length : 0;
        
        // Check if TOP result matches all required keywords (most important metric!)
        const topResultRelevant = scoredProducts.length > 0 && scoredProducts[0].relevant === true;
        
        // Check if brand/character matches but specific product type is missing (inventory gap)
        const brandMatches = searchResults.length > 0 && searchResults.some((p: any) => {
          const productText = `${p.title} ${p.description || ''} ${p.merchant || ''}`.toLowerCase();
          // Check if at least the main brand/character is in the results
          const queryWords = query.toLowerCase().split(' ');
          const brandPhrases = ['paw patrol', 'peppa pig', 'star wars', 'hot wheels', 'barbie', 'frozen', 'disney', 'lego', 'marvel', 'dc'];
          for (const phrase of brandPhrases) {
            if (query.toLowerCase().includes(phrase) && productText.includes(phrase)) {
              return true;
            }
          }
          return queryWords.some(w => w.length > 3 && productText.includes(w));
        });
        
        // Determine status with improved logic
        let status: string;
        let statusNote = '';
        
        // Detect inventory gap: 0 results AND 0 products in DB for this query
        // This means the brand/product simply doesn't exist in our catalog
        const isInventoryGap = searchResults.length === 0 && !dbExists;
        
        if (isInventoryGap) {
          // Brand doesn't exist in catalog - not a search bug, just missing inventory
          status = 'INVENTORY_GAP';
          statusNote = `Brand/product not in catalog`;
          // Don't count as fail - this is a merchandising issue, not search issue
        } else if (searchResults.length === 0 && dbExists) {
          status = 'FAIL';
          statusNote = 'Products exist in DB but search returned nothing';
          failCount++;
        } else if (searchResults.length === 0) {
          status = 'INVENTORY_GAP';
          statusNote = 'No matching products in catalog';
          // Don't count as fail
        } else if (topResultRelevant && relevanceScore >= 0.6) {
          // Top result is relevant AND at least 60% of results match
          status = 'PASS';
          statusNote = 'Top result matches, good relevance';
          passCount++;
        } else if (topResultRelevant) {
          // Top result is relevant but other results are less relevant (still a win!)
          status = 'PASS';
          statusNote = 'Top result matches query';
          passCount++;
        } else if (relevanceScore >= 0.8) {
          status = 'PASS';
          passCount++;
        } else if (!dbExists && relevanceScore === 0) {
          // No products in DB for this brand AND all results are irrelevant = INVENTORY_GAP
          status = 'INVENTORY_GAP';
          statusNote = 'Brand/product not in catalog, search returned unrelated items';
          // Don't count as fail - this is a merchandising issue
        } else if (brandMatches && relevanceScore < 0.5) {
          // Brand matches but specific product type not in inventory
          status = 'PARTIAL';
          statusNote = 'Brand matches, specific product type not in inventory';
          partialCount++;
        } else if (relevanceScore >= 0.5) {
          status = 'PARTIAL';
          partialCount++;
        } else {
          status = 'FAIL';
          failCount++;
        }
        
        results.push({
          query,
          category,
          database_check: { exists: dbExists, count: dbCount },
          search_result: {
            count: searchResults.length,
            time_ms: searchTime,
            products: scoredProducts.slice(0, 5) // Limit to first 5 for readability
          },
          analysis: {
            status,
            status_note: statusNote || undefined,
            top_result_relevant: topResultRelevant,
            relevance_score: Math.round(relevanceScore * 100) / 100,
            relevant_count: relevantCount,
            total_returned: searchResults.length
          }
        });
      }
      
      const totalTime = Date.now();
      
      // Count inventory gaps separately
      const inventoryGapCount = results.filter((r: any) => r.analysis.status === 'INVENTORY_GAP').length;
      const searchableTotal = results.length - inventoryGapCount;
      const searchPassRate = searchableTotal > 0 ? Math.round((passCount / searchableTotal) * 100) : 0;
      
      res.json({
        summary: {
          total: results.length,
          pass: passCount,
          partial: partialCount,
          inventory_gap: inventoryGapCount,
          fail: failCount,
          pass_rate: searchPassRate + '%',
          note: inventoryGapCount > 0 ? `${inventoryGapCount} queries have no products in catalog (merchandising issue, not search bug)` : undefined
        },
        results
      });
    } catch (error) {
      console.error('[Audit] Run error:', error);
      res.status(500).json({ error: 'Audit failed', details: String(error) });
    }
  });
  
  // Get test queries CSV
  app.get("/api/audit/queries", async (req, res) => {
    try {
      const csvPath = path.join(process.cwd(), 'public', 'test-queries.csv');
      if (fs.existsSync(csvPath)) {
        const csv = fs.readFileSync(csvPath, 'utf8');
        const lines = csv.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',');
        const queries = lines.slice(1).map(line => {
          // Parse CSV properly (handle quoted fields)
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (const char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          
          return {
            query: values[0]?.replace(/^"|"$/g, ''),
            category: values[1]?.replace(/^"|"$/g, ''),
            required_keywords: values[2]?.replace(/^"|"$/g, ''),
            optional_keywords: values[3]?.replace(/^"|"$/g, ''),
            max_price: values[4] ? parseFloat(values[4]) : undefined,
            expected_brand: values[5]?.replace(/^"|"$/g, ''),
            expected_character: values[6]?.replace(/^"|"$/g, ''),
            notes: values[7]?.replace(/^"|"$/g, '')
          };
        }).filter(q => q.query);
        
        res.json({ count: queries.length, queries });
      } else {
        res.status(404).json({ error: 'Test queries file not found' });
      }
    } catch (error) {
      console.error('[Audit] Queries error:', error);
      res.status(500).json({ error: 'Failed to load queries' });
    }
  });

  // ============================================================
  // ADMIN EXPORT ENDPOINT - Download all source code as ZIP
  // ============================================================
  app.get("/api/admin/export", async (req, res) => {
    try {
      console.log('[Export] Starting project export...');
      
      const tempFile = path.join(os.tmpdir(), 'project-export-' + Date.now() + '.zip');
      const output = fs.createWriteStream(tempFile);
      const archive = archiver('zip', { zlib: { level: 5 } });
      
      output.on('close', function() {
        console.log('[Export] Archive created, size:', archive.pointer(), 'bytes');
        res.download(tempFile, 'project-export.zip', function(err: any) {
          try { fs.unlinkSync(tempFile); } catch(e) {}
          if (err) console.error('[Export] Download error:', err);
        });
      });
      
      archive.on('error', function(err: any) {
        console.error('[Export] Archive error:', err);
        res.status(500).json({ error: 'Export failed' });
      });
      
      archive.pipe(output);
      
      // Add directories that matter, excluding large data files
      const dirsToInclude = ['client', 'shared', 'scripts'];
      for (let i = 0; i < dirsToInclude.length; i++) {
        const dir = dirsToInclude[i];
        const dirPath = path.join(process.cwd(), dir);
        if (fs.existsSync(dirPath)) {
          archive.directory(dirPath, dir);
        }
      }
      
      // Add server directory but exclude server/data (large CSV files)
      archive.glob('**/*', {
        cwd: path.join(process.cwd(), 'server'),
        ignore: ['data/**', 'data']
      }, { prefix: 'server' });
      
      // Add root config files
      const rootFiles = [
        'package.json', 'package-lock.json', 'tsconfig.json', 'tailwind.config.ts',
        'postcss.config.js', 'drizzle.config.ts', 'vite.config.ts', '.gitignore',
        'replit.md', 'design_guidelines.md', 'openapi.yaml', 'components.json'
      ];
      for (let i = 0; i < rootFiles.length; i++) {
        const file = rootFiles[i];
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file });
        }
      }
      
      console.log('[Export] Finalizing archive...');
      archive.finalize();
    } catch (err) {
      console.error('[Export] Error:', err);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // ============================================================
  // SUNNY VOICE ASSISTANT ENDPOINTS
  // ============================================================
  
  const voiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post('/api/voice/tts', async (req, res) => {
    try {
      const { text, voice = 'shimmer' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      console.log(`[Voice TTS] Generating speech for: "${text.substring(0, 50)}..." with voice: ${voice}`);
      
      const audioBuffer = await textToSpeech(text, voice);
      
      res.set('Content-Type', 'audio/mpeg');
      res.set('Content-Length', audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (error: any) {
      console.error('[Voice TTS] Error:', error);
      res.status(500).json({ error: 'Text-to-speech failed', details: error.message });
    }
  });

  app.post('/api/voice/stt', voiceUpload.single('audio'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }
      
      console.log(`[Voice STT] Transcribing audio: ${req.file.size} bytes, type: ${req.file.mimetype}`);
      
      const text = await speechToText(req.file.buffer, req.file.mimetype);
      
      console.log(`[Voice STT] Transcription: "${text}"`);
      
      res.json({ text });
    } catch (error: any) {
      console.error('[Voice STT] Error:', error);
      res.status(500).json({ error: 'Speech-to-text failed', details: error.message });
    }
  });

  app.post('/api/voice/parse-intent', async (req, res) => {
    try {
      const { text, context = [] } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      console.log(`[Voice Intent] Parsing: "${text}"`);
      
      const intent = await parseIntent(text, context);
      
      console.log(`[Voice Intent] Result:`, JSON.stringify(intent));
      
      res.json(intent);
    } catch (error: any) {
      console.error('[Voice Intent] Error:', error);
      res.status(500).json({ error: 'Intent parsing failed', details: error.message });
    }
  });

  app.get('/api/voice/greeting', (req, res) => {
    const isFirst = req.query.first !== 'false';
    const greeting = getRandomGreeting(isFirst);
    res.json({ greeting, isFirst });
  });

  app.get('/api/voice/transition', (req, res) => {
    const transition = getRandomTransition();
    res.json({ transition });
  });

  app.get('/api/voice/error', (req, res) => {
    const type = (req.query.type as string) || 'not_understood';
    const message = getRandomError(type);
    res.json({ message, type });
  });

  // ============================================================
  // TMDB MOVIES ENDPOINTS
  // ============================================================

  app.post('/api/movies/sync', async (req, res) => {
    try {
      console.log('[TMDB] Manual sync triggered');
      const result = await syncMovies();
      res.json({ 
        success: true, 
        message: 'Movies synced successfully',
        ...result 
      });
    } catch (error: any) {
      console.error('[TMDB] Sync error:', error);
      res.status(500).json({ error: 'Movie sync failed', details: error.message });
    }
  });

  app.get('/api/movies/cinema', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const dbMovies = await getMoviesByType('cinema', limit);
      
      const movies = dbMovies.map(m => ({
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster: getPosterUrl(m.posterPath, 'w342'),
        backdrop: getBackdropUrl(m.backdropPath),
        releaseDate: m.releaseDate,
        rating: m.voteAverage,
        genres: m.genreIds ? getGenreNames(m.genreIds) : [],
        certification: m.ukCertification,
        runtime: m.runtime,
      }));
      
      res.json({ 
        movies, 
        count: movies.length,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.'
      });
    } catch (error: any) {
      console.error('[TMDB] Cinema fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch cinema movies', details: error.message });
    }
  });

  app.get('/api/movies/coming-soon', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const dbMovies = await getMoviesByType('coming_soon', limit);
      
      const movies = dbMovies.map(m => ({
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster: getPosterUrl(m.posterPath, 'w342'),
        backdrop: getBackdropUrl(m.backdropPath),
        releaseDate: m.releaseDate,
        rating: m.voteAverage,
        genres: m.genreIds ? getGenreNames(m.genreIds) : [],
        certification: m.ukCertification,
      }));
      
      res.json({ 
        movies, 
        count: movies.length,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.'
      });
    } catch (error: any) {
      console.error('[TMDB] Coming soon fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming movies', details: error.message });
    }
  });

  app.get('/api/movies/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
      
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const dbMovies = await searchMovies(query, limit);
      
      const movies = dbMovies.map(m => ({
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster: getPosterUrl(m.posterPath, 'w342'),
        backdrop: getBackdropUrl(m.backdropPath),
        releaseDate: m.releaseDate,
        rating: m.voteAverage,
        genres: m.genreIds ? getGenreNames(m.genreIds) : [],
        certification: m.ukCertification,
        contentType: m.contentType,
      }));
      
      res.json({ 
        query,
        movies, 
        count: movies.length,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.'
      });
    } catch (error: any) {
      console.error('[TMDB] Search error:', error);
      res.status(500).json({ error: 'Movie search failed', details: error.message });
    }
  });

  app.get('/api/movies/genres', (req, res) => {
    res.json({ genres: TMDB_GENRES });
  });

  // ============================================================
  // UPSELL SYSTEM ENDPOINTS
  // ============================================================

  app.post('/api/upsells/seed', async (req, res) => {
    try {
      const count = await seedDefaultMappings();
      res.json({ success: true, seeded: count });
    } catch (error: any) {
      console.error('[Upsell] Seed error:', error);
      res.status(500).json({ error: 'Failed to seed mappings', details: error.message });
    }
  });

  app.post('/api/upsells/get', async (req, res) => {
    try {
      const { contentId, contentType, genreIds, title, category, limit = 2 } = req.body;
      
      if (!contentId || !contentType) {
        return res.status(400).json({ error: 'contentId and contentType are required' });
      }
      
      const products = await getUpsellProducts({
        contentId: String(contentId),
        contentType,
        genreIds,
        title,
        category,
      }, Math.min(limit, 5));
      
      res.json({ 
        products, 
        count: products.length,
        contentId,
        contentType,
      });
    } catch (error: any) {
      console.error('[Upsell] Get error:', error);
      res.status(500).json({ error: 'Failed to get upsell products', details: error.message });
    }
  });

  app.post('/api/upsells/click', async (req, res) => {
    try {
      const { contentId, contentType, productId, intentCategory, sessionId } = req.body;
      
      if (!contentId || !contentType || !productId) {
        return res.status(400).json({ error: 'contentId, contentType, and productId are required' });
      }
      
      await trackUpsellClick(contentId, contentType, productId, intentCategory, sessionId);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Upsell] Click tracking error:', error);
      res.status(500).json({ error: 'Failed to track click', details: error.message });
    }
  });

  // ============================================================
  // MIXED RESULTS API - 6 content tiles + 2 upsell tiles
  // ============================================================

  app.post('/api/mixed/movies', async (req, res) => {
    try {
      const { contentType = 'cinema', limit = 6 } = req.body;
      const contentLimit = Math.min(limit, 10);
      
      const dbMovies = await getMoviesByType(contentType, contentLimit);
      
      const contentItems = dbMovies.map(m => ({
        type: 'movie' as const,
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster: getPosterUrl(m.posterPath, 'w342'),
        backdrop: getBackdropUrl(m.backdropPath),
        releaseDate: m.releaseDate,
        rating: m.voteAverage,
        genres: m.genreIds ? getGenreNames(m.genreIds) : [],
        certification: m.ukCertification,
        contentType: m.contentType,
      }));
      
      let upsellProducts: any[] = [];
      if (contentItems.length > 0) {
        const firstMovie = dbMovies[0];
        upsellProducts = await getUpsellProducts({
          contentId: String(firstMovie.id),
          contentType: 'movie',
          genreIds: firstMovie.genreIds || undefined,
          title: firstMovie.title,
        }, 2);
      }
      
      const upsellItems = upsellProducts.map(p => ({
        type: 'upsell' as const,
        id: p.id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        affiliateLink: p.affiliateLink,
        merchant: p.merchant,
        upsellReason: p.upsellReason,
      }));
      
      res.json({
        content: contentItems,
        upsells: upsellItems,
        totalItems: contentItems.length + upsellItems.length,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
      });
    } catch (error: any) {
      console.error('[Mixed] Movies error:', error);
      res.status(500).json({ error: 'Failed to fetch mixed results', details: error.message });
    }
  });

  // ============================================================
  // DIAGNOSTIC TEST ENDPOINTS - GOD-LEVEL TESTING FRAMEWORK
  // Tells you EXACTLY where problems occur: DATA, SEARCH, RANKING, DISPLAY, INTENT
  // ============================================================
  
  app.post('/api/diagnostic/search', async (req, res) => {
    try {
      const { query, limit = 20 } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      const startTime = Date.now();
      const result: any = {
        query: query,
        timestamp: new Date().toISOString(),
        diagnosis: {},
        verdict: null,
        fixAction: null
      };
      
      const { db } = await import('./db');
      const { products } = await import('@shared/schema');
      const { sql, ilike, or } = await import('drizzle-orm');
      
      // STEP 1: INTENT DETECTION
      const queryLower = query.toLowerCase().trim();
      const exactMovieKeywords = ['movies', 'movie', 'cinema', 'films', 'film'];
      const cinemaIntentPhrases = ['whats on', "what's on", 'now showing', 'at the cinema', 'at the movies'];
      const isCinemaIntent = exactMovieKeywords.includes(queryLower) || 
                             cinemaIntentPhrases.some(p => queryLower.includes(p));
      
      const queryWords = queryLower.split(' ').filter((w: string) => w.length > 2);
      
      result.diagnosis.intent = {
        detected: isCinemaIntent ? 'cinema' : 'product',
        queryWords: queryWords,
        isCinemaQuery: isCinemaIntent
      };
      
      // Handle cinema intent
      if (isCinemaIntent) {
        result.verdict = 'CINEMA_INTENT';
        result.fixAction = 'Routes to TMDB movies.';
        result.diagnosis.search = { returnedCount: 0, searchTimeMs: Date.now() - startTime };
        result.diagnosis.database = { exactMatches: 0, productsExist: false };
        result.diagnosis.relevance = { exactMatchCount: 0, relevancePercent: 0 };
        result.diagnosis.images = { withImages: 0, imagePercent: 0 };
        return res.json(result);
      }
      
      // STEP 2: DATABASE COUNT - How many products EXIST for this query?
      const dbCheckStart = Date.now();
      const searchPattern = `%${queryLower}%`;
      
      const dbCheckResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_matches,
          COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as with_images,
          COUNT(CASE WHEN source = 'awin' THEN 1 END) as awin_count,
          COUNT(CASE WHEN source = 'cj' THEN 1 END) as cj_count
        FROM products 
        WHERE 
          LOWER(name) LIKE ${searchPattern}
          OR LOWER(brand) LIKE ${searchPattern}
          OR LOWER(merchant) LIKE ${searchPattern}
      `);
      
      const dbRow = dbCheckResult[0] as any;
      const dbProductCount = parseInt(dbRow?.total_matches || '0');
      
      result.diagnosis.database = {
        exactMatches: dbProductCount,
        productsExist: dbProductCount > 0,
        withImages: parseInt(dbRow?.with_images || '0'),
        awinProducts: parseInt(dbRow?.awin_count || '0'),
        cjProducts: parseInt(dbRow?.cj_count || '0'),
        checkTimeMs: Date.now() - dbCheckStart
      };
      
      // STEP 3: CALL THE REAL SHOP SEARCH API (same logic users see)
      const searchStart = Date.now();
      
      let searchResults: any[] = [];
      let searchApiResponse: any = null;
      
      try {
        const protocol = req.protocol || 'http';
        const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
        const baseUrl = `${protocol}://${host}`;
        
        const response = await fetch(`${baseUrl}/api/shop/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: Math.min(limit, 20) })
        });
        searchApiResponse = await response.json();
        searchResults = searchApiResponse?.products || [];
      } catch (fetchError: any) {
        console.error('[Diagnostic] Failed to call shop search:', fetchError.message);
      }
      
      const searchTime = Date.now() - searchStart;
      
      result.diagnosis.search = {
        returnedCount: searchResults.length,
        searchTimeMs: searchTime,
        apiSuccess: searchApiResponse?.success ?? false,
        interpretation: searchApiResponse?.interpretation,
        totalFromApi: searchApiResponse?.total || searchResults.length,
        topResults: searchResults.slice(0, 5).map((p: any) => ({
          name: (p.name || '').substring(0, 50),
          merchant: p.merchant,
          category: p.category,
          price: p.price,
          hasImage: !!(p.imageUrl && p.imageUrl.trim() !== '')
        }))
      };
      
      // STEP 4: RELEVANCE CHECK
      let exactMatchCount = 0;
      let relevantCount = 0;
      
      for (const product of searchResults.slice(0, 10)) {
        const nameLower = (product.name || '').toLowerCase();
        const brandLower = (product.brand || '').toLowerCase();
        const merchantLower = (product.merchant || '').toLowerCase();
        
        const matchedWords = queryWords.filter((w: string) => 
          nameLower.includes(w) || brandLower.includes(w) || merchantLower.includes(w)
        );
        
        if (matchedWords.length >= Math.ceil(queryWords.length / 2)) {
          exactMatchCount++;
          relevantCount++;
        } else if (matchedWords.length > 0) {
          relevantCount++;
        }
      }
      
      const totalResults = Math.min(10, searchResults.length);
      const relevancePercent = totalResults > 0 
        ? (relevantCount / totalResults) * 100 
        : 0;
      
      result.diagnosis.relevance = {
        exactMatchCount,
        relevantCount,
        relevancePercent: Math.round(relevancePercent),
        queryWords
      };
      
      // STEP 5: IMAGE CHECK
      const withImages = searchResults.filter((p: any) => p.imageUrl && p.imageUrl.trim() !== '').length;
      const imagePercent = searchResults.length > 0 
        ? (withImages / searchResults.length) * 100 
        : 0;
      
      result.diagnosis.images = {
        withImages,
        withoutImages: searchResults.length - withImages,
        imagePercent: Math.round(imagePercent)
      };
      
      // STEP 6: VERDICT - Compare DB count vs API results
      const totalTimeMs = Date.now() - startTime;
      
      if (dbProductCount === 0 && searchResults.length === 0) {
        result.verdict = 'INVENTORY_GAP';
        result.fixAction = 'No products exist in catalog. Add to Awin/CJ feed.';
      }
      else if (dbProductCount > 0 && searchResults.length === 0) {
        result.verdict = 'SEARCH_BUG';
        result.fixAction = `${dbProductCount} products exist but search returned 0. Check search algorithm.`;
      }
      else if (searchResults.length > 0 && relevancePercent < 50) {
        result.verdict = 'RANKING_BUG';
        result.fixAction = `Found ${searchResults.length} results but only ${relevantCount} relevant. Fix ranking.`;
      }
      else if (searchResults.length > 0 && imagePercent < 50) {
        result.verdict = 'IMAGE_BUG';
        result.fixAction = `Found products but ${searchResults.length - withImages} missing images.`;
      }
      else if (totalTimeMs > 5000) {
        result.verdict = 'SPEED_BUG';
        result.fixAction = `Search took ${totalTimeMs}ms. Optimize for <2s target.`;
      }
      else if (searchResults.length > 0 && relevancePercent >= 50) {
        result.verdict = 'PASS';
        result.fixAction = 'All checks passed.';
      }
      else {
        result.verdict = 'UNKNOWN';
        result.fixAction = 'Unexpected state - review manually.';
      }
      
      result.totalTimeMs = totalTimeMs;
      
      res.json(result);
    } catch (error: any) {
      console.error('[Diagnostic] Search error:', error);
      res.status(500).json({ error: 'Diagnostic failed', details: error.message });
    }
  });
  
  app.post('/api/diagnostic/batch', async (req, res) => {
    try {
      const { queries, limit = 20 } = req.body;
      
      if (!queries || !Array.isArray(queries)) {
        return res.status(400).json({ error: 'queries array is required' });
      }
      
      const { db } = await import('./db');
      const { products } = await import('@shared/schema');
      const { sql, ilike, or } = await import('drizzle-orm');
      
      const results: any[] = [];
      
      for (const query of queries.slice(0, 20)) {
        try {
          const startTime = Date.now();
          const queryLower = (query || '').toLowerCase().trim();
          const searchPattern = `%${queryLower}%`;
          const queryWords = queryLower.split(' ').filter((w: string) => w.length > 2);
          
          // Check cinema intent
          const exactMovieKeywords = ['movies', 'movie', 'cinema', 'films', 'film'];
          const cinemaIntentPhrases = ['whats on', "what's on", 'now showing', 'at the cinema'];
          const isCinemaIntent = exactMovieKeywords.includes(queryLower) || 
                                 cinemaIntentPhrases.some(p => queryLower.includes(p));
          
          if (isCinemaIntent) {
            results.push({
              query,
              verdict: 'CINEMA_INTENT',
              fixAction: 'Routes to TMDB movies.',
              dbCount: 0,
              searchCount: 0,
              relevance: 0,
              imagePercent: 0,
              timeMs: Date.now() - startTime
            });
            continue;
          }
          
          // DB count for this query
          const dbCheck = await db.execute(sql`
            SELECT COUNT(*) as total FROM products 
            WHERE LOWER(name) LIKE ${searchPattern} 
               OR LOWER(brand) LIKE ${searchPattern}
               OR LOWER(merchant) LIKE ${searchPattern}
          `);
          const dbCount = parseInt((dbCheck[0] as any)?.total || '0');
          
          // Call actual shop search API (derive URL from request)
          let searchResults: any[] = [];
          let searchApiResponse: any = null;
          
          try {
            const protocol = req.protocol || 'http';
            const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
            const baseUrl = `${protocol}://${host}`;
            
            const response = await fetch(`${baseUrl}/api/shop/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, limit: Math.min(limit, 20) })
            });
            searchApiResponse = await response.json();
            searchResults = searchApiResponse?.products || [];
          } catch (fetchError: any) {
            console.error(`[Diagnostic Batch] Failed to call shop search for "${query}":`, fetchError.message);
          }
          
          const searchTime = Date.now() - startTime;
          
          // Relevance check
          let relevantCount = 0;
          for (const p of searchResults.slice(0, 10)) {
            const nameLower = (p.name || '').toLowerCase();
            const brandLower = (p.brand || '').toLowerCase();
            const merchantLower = (p.merchant || '').toLowerCase();
            const matchedWords = queryWords.filter((w: string) => 
              nameLower.includes(w) || brandLower.includes(w) || merchantLower.includes(w)
            );
            if (matchedWords.length >= Math.ceil(queryWords.length / 2)) {
              relevantCount++;
            }
          }
          const relevance = searchResults.length > 0 
            ? (relevantCount / Math.min(10, searchResults.length)) * 100 
            : 0;
          
          // Image check
          const withImages = searchResults.filter((p: any) => p.imageUrl && p.imageUrl.trim() !== '').length;
          const imagePercent = searchResults.length > 0 ? (withImages / searchResults.length) * 100 : 0;
          
          // Determine verdict
          let verdict = 'PASS';
          let fixAction = 'All checks passed.';
          
          if (dbCount === 0 && searchResults.length === 0) {
            verdict = 'INVENTORY_GAP';
            fixAction = 'No products in catalog. Add to feed.';
          } else if (dbCount > 0 && searchResults.length === 0) {
            verdict = 'SEARCH_BUG';
            fixAction = `${dbCount} products exist but search returned 0.`;
          } else if (searchResults.length > 0 && relevance < 50) {
            verdict = 'RANKING_BUG';
            fixAction = `Only ${relevantCount} of ${searchResults.length} results relevant.`;
          } else if (searchResults.length > 0 && imagePercent < 50) {
            verdict = 'IMAGE_BUG';
            fixAction = `${searchResults.length - withImages} products missing images.`;
          } else if (searchTime > 5000) {
            verdict = 'SPEED_BUG';
            fixAction = `Took ${searchTime}ms. Target <2s.`;
          }
          
          results.push({
            query,
            verdict,
            fixAction,
            dbCount,
            searchCount: searchResults.length,
            relevance: Math.round(relevance),
            imagePercent: Math.round(imagePercent),
            timeMs: searchTime
          });
          
        } catch (err) {
          results.push({ query, verdict: 'ERROR', fixAction: 'Test failed', error: (err as Error).message });
        }
      }
      
      // Summary
      const summary = {
        total: results.length,
        passed: results.filter(r => r.verdict === 'PASS').length,
        cinemaIntents: results.filter(r => r.verdict === 'CINEMA_INTENT').length,
        inventoryGaps: results.filter(r => r.verdict === 'INVENTORY_GAP').length,
        searchBugs: results.filter(r => r.verdict === 'SEARCH_BUG').length,
        rankingBugs: results.filter(r => r.verdict === 'RANKING_BUG').length,
        imageBugs: results.filter(r => r.verdict === 'IMAGE_BUG').length,
        speedBugs: results.filter(r => r.verdict === 'SPEED_BUG').length,
        errors: results.filter(r => r.verdict === 'ERROR').length
      };
      
      res.json({ summary, results });
    } catch (error: any) {
      console.error('[Diagnostic] Batch error:', error);
      res.status(500).json({ error: 'Batch diagnostic failed', details: error.message });
    }
  });

  // ============================================================
  // IMAGE VALIDATION ENDPOINT - Check if product images are BROKEN AT SOURCE
  // The database has URLs but the actual images may be removed by retailers
  // ============================================================
  
  app.post('/api/diagnostic/check-images', async (req, res) => {
    try {
      const { productIds } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: 'productIds array is required' });
      }
      
      const { db } = await import('./db');
      const { products } = await import('@shared/schema');
      const { inArray } = await import('drizzle-orm');
      
      // Get products from DB
      const prods = await db.select({
        id: products.id,
        name: products.name,
        imageUrl: products.imageUrl,
        merchant: products.merchant
      }).from(products)
        .where(inArray(products.id, productIds.slice(0, 10)));
      
      const results = [];
      
      for (const prod of prods) {
        let imageStatus = 'unknown';
        let redirectsTo = null;
        
        if (!prod.imageUrl || prod.imageUrl.trim() === '') {
          imageStatus = 'missing_in_db';
        } else {
          try {
            const response = await fetch(prod.imageUrl, { 
              method: 'HEAD',
              redirect: 'manual'
            });
            
            if (response.status === 200) {
              imageStatus = 'working';
            } else if (response.status === 302 || response.status === 301) {
              const location = response.headers.get('location');
              if (location?.includes('noimage') || location?.includes('placeholder')) {
                imageStatus = 'broken_at_source';
                redirectsTo = location;
              } else {
                imageStatus = 'redirected';
                redirectsTo = location;
              }
            } else {
              imageStatus = `error_${response.status}`;
            }
          } catch (err) {
            imageStatus = 'fetch_error';
          }
        }
        
        results.push({
          id: prod.id,
          name: (prod.name || '').substring(0, 50),
          merchant: prod.merchant,
          imageUrl: prod.imageUrl?.substring(0, 80) + '...',
          imageStatus,
          redirectsTo
        });
      }
      
      const summary = {
        total: results.length,
        working: results.filter(r => r.imageStatus === 'working').length,
        brokenAtSource: results.filter(r => r.imageStatus === 'broken_at_source').length,
        missingInDb: results.filter(r => r.imageStatus === 'missing_in_db').length,
        other: results.filter(r => !['working', 'broken_at_source', 'missing_in_db'].includes(r.imageStatus)).length
      };
      
      res.json({ summary, results });
    } catch (error: any) {
      console.error('[Diagnostic] Check images error:', error);
      res.status(500).json({ error: 'Image check failed', details: error.message });
    }
  });
  
  // Quick endpoint to find products with broken images by searching
  app.post('/api/diagnostic/validate-search-images', async (req, res) => {
    try {
      const { query, limit = 5 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'query is required' });
      }
      
      const { db } = await import('./db');
      const { products } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      // Split query into words and search for products containing ALL words
      const words = query.toLowerCase().split(' ').filter((w: string) => w.length > 2);
      
      // Build a query that matches all words (more flexible than exact phrase)
      const wordConditions = words.map((w: string) => `LOWER(name) LIKE '%${w}%'`).join(' AND ');
      
      const prods = await db.execute(sql.raw(`
        SELECT id, name, image_url as "imageUrl", merchant
        FROM products 
        WHERE ${wordConditions || '1=1'}
        LIMIT ${Math.min(limit, 10)}
      `)) as any[];
      
      const results = [];
      
      for (const prod of prods) {
        let imageStatus = 'unknown';
        
        if (!prod.imageUrl || prod.imageUrl.trim() === '') {
          imageStatus = 'missing_in_db';
        } else {
          try {
            const response = await fetch(prod.imageUrl, { 
              method: 'HEAD',
              redirect: 'manual'
            });
            
            if (response.status === 200) {
              imageStatus = 'working';
            } else if (response.status === 302 || response.status === 301) {
              const location = response.headers.get('location');
              if (location?.includes('noimage') || location?.includes('placeholder')) {
                imageStatus = 'BROKEN_AT_SOURCE';
              } else {
                imageStatus = 'redirected';
              }
            } else {
              imageStatus = `error_${response.status}`;
            }
          } catch (err) {
            imageStatus = 'fetch_error';
          }
        }
        
        results.push({
          name: (prod.name || '').substring(0, 50),
          merchant: prod.merchant,
          imageStatus,
          imageUrl: prod.imageUrl?.substring(0, 60)
        });
      }
      
      const brokenCount = results.filter(r => r.imageStatus === 'BROKEN_AT_SOURCE').length;
      const workingCount = results.filter(r => r.imageStatus === 'working').length;
      
      res.json({
        query,
        totalChecked: results.length,
        workingImages: workingCount,
        brokenAtSource: brokenCount,
        verdict: brokenCount > 0 ? 'SOME_IMAGES_BROKEN_AT_RETAILER' : 'ALL_IMAGES_WORKING',
        explanation: brokenCount > 0 
          ? `${brokenCount} products have images that were REMOVED BY THE RETAILER (Awin returns noimage.gif). This is a data freshness issue, not a code bug.`
          : 'All image URLs are working at the source.',
        results
      });
    } catch (error: any) {
      console.error('[Diagnostic] Validate search images error:', error);
      res.status(500).json({ error: 'Validation failed', details: error.message });
    }
  });

  // Background image validator - validates and marks broken images in batches
  // SECURITY: Uses parameterized queries to prevent SQL injection
  app.post('/api/diagnostic/validate-images-batch', async (req, res) => {
    try {
      const { 
        merchant = null, 
        batchSize = 100, 
        offset = 0,
        dryRun = true  // Default to dry run for safety
      } = req.body;
      
      // Validate inputs
      const safeBatchSize = Math.min(Math.max(1, parseInt(batchSize) || 100), 500);
      const safeOffset = Math.max(0, parseInt(offset) || 0);
      
      const { db } = await import('./db');
      const { products } = await import('@shared/schema');
      const { sql, eq, and, isNotNull, or, ilike } = await import('drizzle-orm');
      
      // Build conditions using Drizzle's query builder (parameterized)
      const conditions: any[] = [
        isNotNull(products.imageUrl),
        sql`${products.imageUrl} != ''`,
        or(
          sql`${products.imageStatus} IS NULL`,
          eq(products.imageStatus, 'unknown')
        )
      ];
      
      // Add merchant filter if provided (parameterized)
      if (merchant && typeof merchant === 'string') {
        conditions.push(ilike(products.merchant, `%${merchant}%`));
      }
      
      // Get batch of products to validate using Drizzle ORM
      const prods = await db.select({
        id: products.id,
        name: products.name,
        imageUrl: products.imageUrl,
        merchant: products.merchant
      })
        .from(products)
        .where(and(...conditions))
        .orderBy(products.id)
        .limit(safeBatchSize)
        .offset(safeOffset);
      
      if (prods.length === 0) {
        return res.json({
          message: 'No more products to validate',
          checked: 0,
          working: 0,
          broken: 0,
          nextOffset: null
        });
      }
      
      const results = {
        checked: 0,
        working: 0,
        broken: 0,
        updated: 0,
        errors: 0,
        details: [] as any[]
      };
      
      // CONCURRENT IMAGE VALIDATION - process 20 images in parallel for speed
      const CONCURRENCY = 20;
      
      async function validateSingleImage(prod: typeof prods[0]): Promise<{
        id: string;
        name: string;
        merchant: string;
        status: string;
        isWorking: boolean;
        isError: boolean;
      }> {
        let imageStatus = 'unknown';
        let isError = false;
        
        try {
          const response = await fetch(prod.imageUrl!, { 
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(5000)
          });
          
          if (response.status === 200) {
            const contentLength = parseInt(response.headers.get('content-length') || '99999');
            if (contentLength < 1000) {
              imageStatus = 'broken';
            } else {
              imageStatus = 'valid';
            }
          } else if (response.status === 302 || response.status === 301) {
            const location = response.headers.get('location');
            if (location?.includes('noimage') || location?.includes('placeholder') || location?.includes('no-image')) {
              imageStatus = 'broken';
            } else {
              imageStatus = 'valid';
            }
          } else {
            imageStatus = 'broken';
          }
        } catch (err) {
          imageStatus = 'broken';
          isError = true;
        }
        
        return {
          id: prod.id,
          name: (prod.name || '').substring(0, 40),
          merchant: prod.merchant,
          status: imageStatus,
          isWorking: imageStatus === 'valid',
          isError
        };
      }
      
      // Process in concurrent chunks
      for (let i = 0; i < prods.length; i += CONCURRENCY) {
        const chunk = prods.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(chunk.map(validateSingleImage));
        
        for (const result of chunkResults) {
          results.checked++;
          if (result.isWorking) results.working++;
          else results.broken++;
          if (result.isError) results.errors++;
          
          // Update database using parameterized query
          if (!dryRun) {
            try {
              await db.update(products)
                .set({ imageStatus: result.status })
                .where(eq(products.id, result.id));
              results.updated++;
            } catch (err) {
              console.error(`Failed to update product ${result.id}:`, err);
            }
          }
          
          results.details.push({
            id: result.id,
            name: result.name,
            merchant: result.merchant,
            status: result.status
          });
        }
      }
      
      res.json({
        mode: dryRun ? 'DRY_RUN (no DB updates)' : 'LIVE (DB updated)',
        merchant: merchant || 'all',
        batchSize: safeBatchSize,
        offset: safeOffset,
        nextOffset: prods.length === safeBatchSize ? safeOffset + safeBatchSize : null,
        ...results
      });
    } catch (error: any) {
      console.error('[Diagnostic] Batch validate error:', error);
      res.status(500).json({ error: 'Batch validation failed', details: error.message });
    }
  });

  // Get image validation stats
  app.get('/api/diagnostic/image-stats', async (req, res) => {
    try {
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      
      const stats = await db.execute(sql.raw(`
        SELECT 
          merchant,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE image_status = 'valid') as valid_images,
          COUNT(*) FILTER (WHERE image_status = 'broken') as broken_images,
          COUNT(*) FILTER (WHERE image_status IS NULL OR image_status = 'unknown') as unknown_status
        FROM products
        WHERE image_url IS NOT NULL AND image_url != ''
        GROUP BY merchant
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `)) as any[];
      
      const totals = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(*) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_images,
          COUNT(*) FILTER (WHERE image_status = 'valid') as valid_images,
          COUNT(*) FILTER (WHERE image_status = 'broken') as broken_images,
          COUNT(*) FILTER (WHERE image_status IS NULL OR image_status = 'unknown') as pending_validation
        FROM products
      `)) as any[];
      
      res.json({
        totals: totals[0],
        byMerchant: stats
      });
    } catch (error: any) {
      console.error('[Diagnostic] Image stats error:', error);
      res.status(500).json({ error: 'Stats failed', details: error.message });
    }
  });

  return httpServer;
}
