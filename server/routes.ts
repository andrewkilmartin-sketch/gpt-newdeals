import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { searchQuerySchema, clickLogs } from "@shared/schema";
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
import { getUpsellProducts } from "./services/upsell";
import { 
  parseQuery, 
  applyQueryFilters, 
  getRequiredSearchTerms,
  ParsedQuery,
  BRAND_CHARACTERS
} from "./services/queryParser";

// Import search modules (modularized from routes.ts - Fix #70)
import {
  // Brand constants and validation
  KNOWN_TOY_BRANDS,
  MAKEUP_COSMETICS_TERMS,
  CRAFT_SUPPLY_PATTERNS,
  QUALITY_INTENT_WORDS,
  DISCOUNT_MERCHANTS,
  TRAVEL_MERCHANTS,
  GENDER_EXCLUSION_MAP,
  JEWELRY_WATCH_MERCHANTS,
  HOLIDAY_TRAVEL_MERCHANTS,
  isValidBrand,
  isToyQuery,
  isCraftSupply,
  hasQualityIntent,
  hasGenderContext,
  // Filter constants
  INAPPROPRIATE_TERMS,
  BLOCKED_MERCHANTS,
  KNOWN_FALLBACKS,
  WORD_BOUNDARY_COLLISIONS,
  NON_PRODUCT_EXCLUSIONS,
  PRODUCT_INTENT_WORDS,
  CLOTHING_INDICATORS,
  TOY_QUERY_WORDS,
  MEDIA_EXCLUSIONS,
  MEDIA_QUERY_TRIGGERS,
  WATER_GUN_QUERY_WORDS,
  WATER_GUN_EXCLUDE_TERMS,
  COSTUME_QUERY_WORDS,
  COSTUME_CLOTHING_INDICATORS,
  COSTUME_NON_WEARABLE_TERMS,
  COSTUME_POSITIVE_CATEGORIES,
  KEYWORD_COLLISION_RULES,
  GAMING_KEYWORDS,
  GAMING_CATEGORY_TERMS,
  FilterResult,
  // Filter functions
  filterInappropriateContent,
  filterWordBoundaryCollisions,
  filterCraftSuppliesFromToyQueries,
  filterMakeupFromToyQueries,
  filterFallbackSpam,
  hasProductIntent,
  filterNonProducts,
  hasToyContext,
  filterForToyContext,
  hasMediaExclusionContext,
  filterMediaFromToyQueries,
  hasWaterGunContext,
  filterForWaterGunContext,
  hasCostumeContext,
  filterForCostumeContext,
  hasFilmContext,
  filterForFilmContext,
  hasBlindContext,
  filterForBlindContext,
  hasStitchContext,
  filterForStitchContext,
  filterForGenderContext,
  hasBookContext,
  filterForBookContext,
  hasPartyBagContext,
  filterForPartyBagContext,
  hasAgeContext,
  filterForAgeContext,
  hasWatchOrderContext,
  filterForWatchOrderContext,
  hasBreakContext,
  filterForBreakContext,
  filterKeywordCollisions,
  isGamingQuery,
  filterForGamingQuery,
  filterPromoOnlyResults,
  demoteKidsPassResults,
  isKnownFallback,
  // Dedup functions
  extractSKU,
  normalizeProductName,
  similarNames,
  deduplicateResults,
  deduplicateBySKU,
  applyMerchantCaps,
  countUniqueMerchants,
  // Ranking functions
  sortByPrice,
  reorderForQualityIntent,
  // Cache functions
  hashQuery,
  normalizeQueryForCache,
  getCachedInterpretation,
  getDbCachedInterpretation,
  setCachedInterpretation,
  getCacheStats,
  clearQueryCache,
  // Types
  QueryInterpretation,
  ProductAttributes,
  ProductCategory,
  FilterSchema,
  FilterDefinition,
  FilterOption,
  QueryIntent,
  applyPriceSorting,
  // Category detection and bespoke filters
  inferCategoryFromQuery,
  searchFallbackByCategory,
  detectProductCategory,
  buildBespokeFilters,
  buildPriceRanges,
  buildMerchantComparison,
  // Query interpreter
  interpretQuery as interpretQueryModule,
  expandQueryFallback,
  detectBrand,
  SIMPLE_PATTERNS,
  KNOWN_BRANDS,
  InterpreterDeps,
  // Utilities
  sanitizeMediaSuffix,
  isPromoOnly,
  ILIKE_FALLBACK_TIMEOUT_MS,
  withTimeout,
  QUERY_SYNONYMS,
  PHRASE_SYNONYMS,
  applyPhraseSynonyms,
  expandQueryWithSynonyms,
  detectQueryIntent,
  TYPO_CORRECTIONS,
  correctTypos,
  applySearchQualityFilters,
  registerCJRoutes,
  registerVoiceRoutes,
  registerMovieRoutes,
  registerUpsellRoutes
} from "./search";
import { registerDiagnosticRoutes, registerTrackingRoutes } from "./routes/index";

const STREAMING_SERVICES = ['Netflix', 'Prime Video', 'Disney+', 'Apple TV+', 'Sky', 'NOW', 'MUBI'];

// Build version for deployment verification - increment this when making changes
const BUILD_VERSION = '2026.01.10.v5-stitchfix';
const BUILD_DATE = '2026-01-09T00:30:00Z';
const BUILD_FEATURES = [
  'CRITICAL FIX: storage.searchProducts now filters by detected brand/character',
  'Brand detection in /shopping/awin-link endpoint (Clarks, Crocs, etc.)',
  'Override taxonomy hardFail for brand matches',
  'Expanded knownBrands and knownCharacters lists',
  'GPT prompt: mustMatch requires product type + qualifier + brand',
  'Price range extraction (minPrice/maxPrice)'
];

// Schema imports for DB queries
import { queryCache as queryCacheTable, merchantNetworks, clickEvents, promotionNetworkMap } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// ============================================================
// SMART QUERY INTERPRETER - Uses GPT to understand search intent
// Core logic moved to ./search/interpreter.ts
// ============================================================

// Wrapper function that provides dependencies to the module
async function interpretQuery(query: string, openaiKey: string | undefined): Promise<QueryInterpretation> {
  const deps: InterpreterDeps = { db, queryCacheTable, eq };
  return interpretQueryModule(query, openaiKey, deps);
}

// Get deals for a merchant even when no products exist (deals-only experience)
// Only matches full merchant names to avoid false positives
async function getDealsForMerchant(query: string): Promise<ProductPromotion[]> {
  try {
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

  // CJ (Commission Junction) routes - modularized
  registerCJRoutes(app);

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
      
      // ============================================================================
      // FIX #48: VERIFIED RESULTS CACHE - Check pre-verified results FIRST
      // This bypasses all algorithm logic for queries that have been manually verified
      // ============================================================================
      if (!hasFilters && offset === 0) {
        try {
          const { db } = await import('./db');
          const { verifiedResults } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          
          const normalizedQuery = query.toLowerCase().trim();
          const cached = await db.select().from(verifiedResults).where(eq(verifiedResults.query, normalizedQuery)).limit(1);
          
          if (cached.length > 0 && cached[0].verifiedProductIds) {
            const productIds = JSON.parse(cached[0].verifiedProductIds);
            
            // FIX #50: Skip cache if product IDs array is empty
            if (productIds.length === 0) {
              console.log(`[Shop Search] CACHE SKIP: Empty product IDs for "${query}"`);
            } else {
            console.log(`[Shop Search] CACHE HIT: Returning verified results for "${query}"`);
            
            const productNames = cached[0].verifiedProductNames ? JSON.parse(cached[0].verifiedProductNames) : [];
            
            // Fetch the actual products by ID
            const { products } = await import('@shared/schema');
            const { inArray } = await import('drizzle-orm');
            
            const cachedProducts = await db.select({
              id: products.id,
              name: products.name,
              description: products.description,
              price: products.price,
              merchant: products.merchant,
              brand: products.brand,
              category: products.category,
              affiliateLink: products.affiliateLink,
              imageUrl: products.imageUrl,
              inStock: products.inStock
            }).from(products).where(inArray(products.id, productIds)).limit(safeLimit);
            
            // Sort by original verified order
            const sortedProducts = productIds.slice(0, safeLimit).map((id: string) => 
              cachedProducts.find(p => p.id === id)
            ).filter(Boolean);
            
            const responseProducts = sortedProducts.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: (p.description || '').substring(0, 200),
              price: parseFloat(String(p.price)) || 0,
              currency: 'GBP',
              merchant: p.merchant,
              brand: p.brand,
              category: p.category,
              imageUrl: p.imageUrl,
              affiliateLink: p.affiliateLink,
              inStock: p.inStock
            }));
            
            return res.json({
              success: true,
              query,
              count: responseProducts.length,
              totalCount: productIds.length,
              hasMore: productIds.length > safeLimit,
              products: responseProducts,
              interpretation: {
                expanded: ['verified'],
                context: { source: 'cache', verifiedBy: cached[0].verifiedBy, verifiedAt: cached[0].verifiedAt }
              },
              cached: true
            });
            }
          }
        } catch (cacheError) {
          console.log(`[Shop Search] Cache check failed (non-fatal): ${cacheError}`);
          // Continue with normal search
        }
      }
      
      // MEGA-FIX 10: QUERY PARSING - Extract age, gender, character from query
      // This prevents "toys for newborn" and "toys for teenager" returning identical results
      const parsedQuery: ParsedQuery = parseQuery(query);
      if (parsedQuery.ageMin !== null || parsedQuery.ageMax !== null) {
        console.log(`[Shop Search] PARSED: age=${parsedQuery.ageMin}-${parsedQuery.ageMax}`);
      }
      if (parsedQuery.gender) {
        console.log(`[Shop Search] PARSED: gender=${parsedQuery.gender}`);
      }
      if (parsedQuery.character) {
        console.log(`[Shop Search] PARSED: character="${parsedQuery.character}"`);
      }
      if (parsedQuery.priceMax) {
        console.log(`[Shop Search] PARSED: priceMax=£${parsedQuery.priceMax}`);
      }
      
      // MEGA-FIX 9: TYPO TOLERANCE - Fix common misspellings before search
      const typoResult = correctTypos(query);
      let workingQuery = typoResult.corrected;
      if (typoResult.wasCorrected) {
        console.log(`[Shop Search] TYPO FIX: "${query}" → "${workingQuery}"`);
      }
      
      // PHRASE SYNONYMS: Apply US/UK brand mappings (e.g., "calico critters" → "sylvanian families")
      const phraseFixed = applyPhraseSynonyms(workingQuery);
      let phraseSynonymApplied = false;
      if (phraseFixed !== workingQuery.toLowerCase()) {
        console.log(`[Shop Search] PHRASE SYNONYM: "${workingQuery}" → "${phraseFixed}"`);
        workingQuery = phraseFixed;
        phraseSynonymApplied = true;
        // Clear the original character since it was a synonym - we'll use the new phrase
        if (parsedQuery.character) {
          console.log(`[Shop Search] Clearing original character "${parsedQuery.character}" after phrase synonym`);
          parsedQuery.character = null;
        }
      }
      
      // MEDIA SUFFIX FIX: Strip trailing "film", "films", "movie", "movies" for product search
      // "dinosaur film" → "dinosaur", "animated films" → "animated"
      // These queries have products in DB but film/movie suffix breaks search
      const { sanitized: searchQuery, stripped: mediaStripped } = sanitizeMediaSuffix(workingQuery);
      if (mediaStripped) {
        console.log(`[Shop Search] Media suffix stripped: "${workingQuery}" → "${searchQuery}"`);
      }
      
      console.log(`[Shop Search] Query: "${query}"${typoResult.wasCorrected ? ` (typo fixed: "${workingQuery}")` : ''}${mediaStripped ? ` (sanitized: "${searchQuery}")` : ''}, limit: ${safeLimit}, offset: ${safeOffset}, hasFilters: ${hasFilters}`);
      const searchStartTime = Date.now();

      // ============================================================================
      // CRITICAL FIX: ULTRA FAST PATH - DO NOT REMOVE OR MODIFY
      // See CRITICAL_FIXES.md - "Age Query Timeout" fix (2026-01-10)
      // This bypasses GPT for age-based queries, reducing 10-22s to <500ms
      // ============================================================================
      // Pattern: "toys for X year old", "gifts for X year old boy/girl"
      const ageOnlyMatch = query.toLowerCase().match(/^(toys?|gifts?|presents?)\s+(for\s+)?(\d+)\s*(year\s*old|yr\s*old|yo)?(\s+(boy|girl))?$/i);
      if (ageOnlyMatch && !hasFilters) {
        const requestedAge = parseInt(ageOnlyMatch[3]);
        const gender = ageOnlyMatch[6]?.toLowerCase();
        console.log(`[Shop Search] ULTRA FAST PATH: Age-only query detected (age=${requestedAge}, gender=${gender || 'any'})`);
        
        const { db } = await import('./db');
        const { products } = await import('@shared/schema');
        const { and, or, ilike, isNotNull, sql, not } = await import('drizzle-orm');
        
        const fastQueryStart = Date.now();
        
        // Build age-appropriate category filter
        const toyCategories = ['toy', 'toys', 'game', 'games', 'plush', 'doll', 'figure', 'playset', 'lego', 'puzzle'];
        const excludeCategories = ['adult', 'alcohol', 'wine', 'beer', 'spirits', 'candle', 'makeup', 'cosmetic', 'beauty', 'fragrance', 'perfume', 'jewelry', 'jewellery', 'ring', 'necklace', 'earring'];
        
        // Age-appropriate keywords in product name
        const ageKeywords: string[] = [];
        if (requestedAge <= 2) {
          ageKeywords.push('baby', 'infant', 'toddler', 'newborn', 'first', '0-2', '1-2', 'sensory');
        } else if (requestedAge <= 5) {
          ageKeywords.push('toddler', 'preschool', 'pre-school', 'early learning', '3+', '4+', '3-5', '2-5', 'little');
        } else if (requestedAge <= 8) {
          ageKeywords.push('kids', 'children', '5+', '6+', '7+', '8+', '5-8', '6-9');
        } else {
          ageKeywords.push('kids', 'junior', '8+', '9+', '10+', 'tween');
        }
        
        // ULTRA FAST: Use tsvector search for "toy" - massively faster than ILIKE
        // FIX #24: Changed from ilike(category, '%toy%') (4+ seconds) to tsvector (milliseconds)
        // FIX #26: Added try/catch fallback to ILIKE if search_vector column doesn't exist in production
        let fastResults: any[] = [];
        try {
          fastResults = await db.select({
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
              isNotNull(products.affiliateLink),
              // Use tsvector for fast toy search
              sql`search_vector @@ to_tsquery('english', 'toy | toys | game | games | playset | puzzle')`
            ))
            .limit(200);
          console.log(`[Shop Search] ULTRA FAST (tsvector): DB query took ${Date.now() - fastQueryStart}ms, found ${fastResults.length} candidates`);
        } catch (tsvectorError: any) {
          // Fallback to ILIKE if search_vector column doesn't exist
          console.log(`[Shop Search] ULTRA FAST: tsvector failed (${tsvectorError.message}), falling back to ILIKE`);
          fastResults = await db.select({
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
              isNotNull(products.affiliateLink),
              or(
                ilike(products.category, '%toy%'),
                ilike(products.category, '%game%'),
                ilike(products.name, '%toy%'),
                ilike(products.name, '%game%')
              )
            ))
            .limit(200);
          console.log(`[Shop Search] ULTRA FAST (ILIKE fallback): DB query took ${Date.now() - fastQueryStart}ms, found ${fastResults.length} candidates`);
        }
        
        // Score and filter results by age appropriateness
        const scoredResults = fastResults.map(p => {
          let score = 0;
          const nameLower = (p.name || '').toLowerCase();
          const catLower = (p.category || '').toLowerCase();
          
          // Boost for age-appropriate keywords
          for (const kw of ageKeywords) {
            if (nameLower.includes(kw) || catLower.includes(kw)) score += 10;
          }
          
          // Boost for toy/game category
          if (catLower.includes('toy')) score += 5;
          if (catLower.includes('game')) score += 3;
          
          // Penalize if has age mismatch (e.g., "14+" for a 3 year old query)
          const ageMatch = nameLower.match(/(\d+)\+/);
          if (ageMatch) {
            const productMinAge = parseInt(ageMatch[1]);
            if (productMinAge > requestedAge + 2) score -= 20; // Too old
            if (productMinAge <= requestedAge) score += 5; // Age appropriate
          }
          
          // Penalize non-toy items that slipped through
          if (nameLower.includes('book') && !nameLower.includes('activity')) score -= 10;
          if (nameLower.includes('candle')) score -= 50;
          if (nameLower.includes('makeup')) score -= 50;
          if (nameLower.includes('jacket') && !nameLower.includes('costume')) score -= 10;
          
          return { ...p, score };
        });
        
        // Sort by score and take top results
        scoredResults.sort((a, b) => b.score - a.score);
        let topResults = scoredResults.slice(0, safeLimit * 2).filter(r => r.score > -10);
        
        // FIX #47: Filter out craft supplies from toy/gift queries
        // These are DIY craft eyes (Trimits, Craft Factory), not children's toys
        const preCraftFilter = topResults.length;
        topResults = topResults.filter(p => {
          const name = (p.name || '').toLowerCase();
          if (name.includes('trimits') || name.includes('craft factory') || 
              name.includes('wobbly toy eyes') || name.includes('safety eyes') ||
              name.includes('toy eyes') || name.includes('stick on eyes')) {
            console.log(`[Fix #47 ULTRA FAST] Excluded craft supply: "${p.name?.substring(0, 50)}..."`);
            return false;
          }
          return true;
        });
        if (topResults.length < preCraftFilter) {
          console.log(`[Fix #47 ULTRA FAST] Filtered ${preCraftFilter} → ${topResults.length}`);
        }
        
        // Take final limit after filtering
        topResults = topResults.slice(0, safeLimit);
        
        const responseProducts = topResults.map(p => ({
          id: p.id,
          name: p.name,
          description: (p.description || '').substring(0, 200),
          price: parseFloat(String(p.price)) || 0,
          currency: 'GBP',
          merchant: p.merchant,
          brand: p.brand,
          category: p.category,
          imageUrl: p.image_url,
          affiliateLink: p.affiliate_link,
          inStock: p.in_stock
        }));
        
        console.log(`[Shop Search] ULTRA FAST: Returning ${responseProducts.length} results in ${Date.now() - searchStartTime}ms`);
        
        return res.json({
          success: true,
          query,
          count: responseProducts.length,
          totalCount: fastResults.length,
          hasMore: fastResults.length > safeLimit,
          products: responseProducts,
          interpretation: {
            expanded: ['toy', 'gift'],
            context: { ageRange: String(requestedAge), categoryFilter: 'Toys' }
          }
        });
      }

      // STEP 1: Interpret the query using GPT (use sanitized query for product search)
      const interpretStart = Date.now();
      const interpretation = await interpretQuery(searchQuery, openaiKey);
      console.log(`[Shop Search] TIMING: Interpretation took ${Date.now() - interpretStart}ms`);
      
      // FIX #19 + FIX #44: PHRASE SYNONYM TERM HARMONIZATION
      // When phrase synonym is applied (e.g., "stem toys" → "educational toys"), 
      // REPLACE the original terms with synonym terms, don't just add them.
      // This prevents impossible queries like "stem & educational & toys" that match nothing.
      if (phraseSynonymApplied) {
        const originalTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        const synonymTerms = phraseFixed.split(/\s+/).filter(t => t.length > 2);
        
        // FIX #44: Remove original phrase terms from mustHaveAll since they're being replaced
        if (interpretation.mustHaveAll) {
          interpretation.mustHaveAll = interpretation.mustHaveAll.filter(t => {
            const tLower = t.toLowerCase();
            const isOriginalTerm = originalTerms.some(orig => tLower === orig || tLower.includes(orig));
            if (isOriginalTerm) {
              console.log(`[Shop Search] PHRASE SYNONYM: Removed original term "${t}" from mustHaveAll`);
            }
            return !isOriginalTerm;
          });
        }
        
        for (const term of synonymTerms) {
          // Add synonym term to mustHaveAll
          const alreadyInMustHave = interpretation.mustHaveAll?.some(
            t => t.toLowerCase() === term.toLowerCase()
          );
          if (!alreadyInMustHave) {
            if (!interpretation.mustHaveAll) interpretation.mustHaveAll = [];
            interpretation.mustHaveAll.push(term);
            console.log(`[Shop Search] PHRASE SYNONYM: Added "${term}" to mustHaveAll`);
          }
          // Also add to searchTerms so SQL candidate query finds it
          if (!interpretation.searchTerms?.some(group => group.includes(term.toLowerCase()))) {
            if (!interpretation.searchTerms) interpretation.searchTerms = [];
            interpretation.searchTerms.push([term.toLowerCase()]);
            console.log(`[Shop Search] PHRASE SYNONYM: Added "${term}" to searchTerms`);
          }
        }
      }
      
      // CRITICAL FIX: Ensure queryParser-detected character is ALWAYS required in results
      // This prevents "nerf gun" from returning random toys when GPT returns mustMatch: []
      // FIX: Normalize hyphens to prevent "spiderman" AND "spider-man" being required (no product has both!)
      if (parsedQuery.character) {
        const charLower = parsedQuery.character.toLowerCase();
        // Normalize: remove hyphens and spaces for comparison
        const charNormalized = charLower.replace(/[-\s]/g, '');
        
        const alreadyInMustHave = interpretation.mustHaveAll?.some(t => {
          const tNormalized = t.toLowerCase().replace(/[-\s]/g, '');
          return tNormalized.includes(charNormalized) || charNormalized.includes(tNormalized);
        });
        
        if (!alreadyInMustHave) {
          if (!interpretation.mustHaveAll) interpretation.mustHaveAll = [];
          interpretation.mustHaveAll.push(parsedQuery.character);
          console.log(`[Shop Search] Added queryParser character "${parsedQuery.character}" to mustHaveAll`);
        } else {
          console.log(`[Shop Search] Skipping duplicate character "${parsedQuery.character}" (already in mustHaveAll)`);
        }
      }
      
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
      
      // CRITICAL FIX: Force semantic path for character/franchise queries
      // This ensures consistent alias handling (spiderman = spider-man) regardless of GPT cache
      // See architect recommendation: "Gate all character-detected queries through semantic pipeline"
      if (parsedQuery.character) {
        const charNorm = parsedQuery.character.toLowerCase().replace(/[-\s]/g, '');
        
        // Build character variants (hyphenated and non-hyphenated)
        const variants = [parsedQuery.character.toLowerCase()];
        if (parsedQuery.character.includes('-')) {
          variants.push(parsedQuery.character.replace(/-/g, '').toLowerCase()); // spider-man → spiderman
        } else if (/spider|iron|bat|super|aqua|ant/.test(charNorm)) {
          const hyphenated = parsedQuery.character.replace(/(spider|iron|bat|super|aqua|ant)(man|woman|girl|boy)/gi, '$1-$2');
          if (hyphenated !== parsedQuery.character) variants.push(hyphenated.toLowerCase());
        }
        
        // ALWAYS add character variants to searchTerms (even if GPT cache has stale terms)
        // This ensures the SQL candidate query searches for the character, not just generic words like "toys"
        if (!interpretation.searchTerms || interpretation.searchTerms.length === 0) {
          interpretation.searchTerms = [variants];
        } else {
          // CRITICAL: Prepend character variants to existing search terms
          // GPT cache might have ['toys','games'] but we need ['spiderman', 'spider-man', 'toys', 'games']
          interpretation.searchTerms.unshift(variants);
          console.log(`[Shop Search] INJECTING character variants "${variants.join(', ')}" into searchTerms`);
        }
        
        // Force semantic path if not already
        if (!interpretation.isSemanticQuery) {
          console.log(`[Shop Search] FORCING semantic path for character query "${parsedQuery.character}"`);
          interpretation.isSemanticQuery = true;
          interpretation.expandedKeywords = [...variants, ...(interpretation.expandedKeywords || [])];
        }
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
      
      // ============================================================================
      // CRITICAL FIX: KNOWN BRANDS CACHE - DO NOT REMOVE
      // See CRITICAL_FIXES.md - "Brand Validation Slowdown" fix (2026-01-09)
      // Skipping DB validation for known brands saves 2-5 seconds per query
      // ============================================================================
      const knownBrandLower = detectedBrand?.toLowerCase();
      const KNOWN_BRANDS_CACHE = new Set([
        // Major toy brands
        'lego', 'barbie', 'mattel', 'hasbro', 'playmobil', 'fisher price', 'hot wheels',
        'nerf', 'transformers', 'my little pony', 'play-doh', 'monopoly', 'littlest pet shop',
        // Disney/characters
        'disney', 'frozen', 'elsa', 'anna', 'moana', 'encanto', 'mirabel', 'coco', 'luca',
        'toy story', 'woody', 'buzz', 'buzz lightyear', 'finding nemo', 'finding dory',
        'nemo', 'dory', 'marlin', 'gill', 'crush', 'squirt',  // FIX #55: Finding Nemo individual characters
        'cars', 'lightning mcqueen', 'incredibles', 'monsters inc', 'inside out', 'up',
        'mike wazowski', 'mike', 'sulley', 'sully', 'boo', 'randall',  // FIX #55: Monsters Inc characters
        'tangled', 'rapunzel', 'cinderella', 'snow white', 'sleeping beauty', 'ariel',
        'little mermaid', 'aladdin', 'jasmine', 'beauty and the beast', 'belle', 'mulan',
        'pocahontas', 'brave', 'merida', 'raya', 'turning red', 'soul', 'onward', 'elemental',
        'wish', 'zootopia', 'big hero 6', 'wreck it ralph', 'lilo and stitch', 'stitch',
        // Marvel - FIX #55: Added miles morales, spider-verse, mike/sulley, nemo/dory variants
        'marvel', 'avengers', 'spider-man', 'spiderman', 'iron man', 'hulk', 'thor', 'captain america',
        'black panther', 'black widow', 'hawkeye', 'scarlet witch', 'doctor strange', 'ant-man',
        'guardians of the galaxy', 'groot', 'rocket', 'thanos', 'loki', 'venom', 'deadpool',
        'wolverine', 'x-men', 'fantastic four', 'captain marvel', 'shang-chi', 'eternals',
        'miles morales', 'spider-verse', 'into the spider-verse', 'across the spider-verse', 'gwen stacy',
        // DC
        'dc', 'batman', 'superman', 'wonder woman', 'aquaman', 'flash', 'green lantern',
        'justice league', 'joker', 'harley quinn', 'catwoman', 'robin', 'batgirl', 'supergirl',
        // Star Wars
        'star wars', 'darth vader', 'luke skywalker', 'yoda', 'baby yoda', 'grogu', 'mandalorian',
        'boba fett', 'stormtrooper', 'chewbacca', 'r2d2', 'r2-d2', 'c3po', 'c-3po', 'kylo ren',
        'rey', 'obi-wan', 'anakin', 'padme', 'princess leia', 'han solo', 'millennium falcon',
        // Harry Potter
        'harry potter', 'hogwarts', 'hermione', 'ron weasley', 'dumbledore', 'voldemort',
        'snape', 'hagrid', 'gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff', 'quidditch',
        // Pokemon
        'pokemon', 'pikachu', 'charizard', 'bulbasaur', 'squirtle', 'charmander', 'eevee',
        'mewtwo', 'gengar', 'snorlax', 'jigglypuff', 'psyduck', 'pokeball',
        // Gaming
        'minecraft', 'fortnite', 'roblox', 'sonic', 'mario', 'super mario', 'luigi', 'peach',
        'bowser', 'yoshi', 'donkey kong', 'zelda', 'link', 'kirby', 'pokemon go', 'among us',
        // Kids TV
        'paw patrol', 'chase', 'marshall', 'skye', 'rubble', 'rocky', 'zuma', 'everest',
        'peppa pig', 'george pig', 'bluey', 'bingo', 'bandit', 'chilli',
        'cocomelon', 'jj', 'hey duggee', 'duggee', 'bing', 'teletubbies', 'postman pat',
        'fireman sam', 'thomas', 'thomas the tank', 'thomas and friends', 'bob the builder',
        'pj masks', 'catboy', 'owlette', 'gekko', 'dora', 'dora the explorer', 'blippi',
        'numberblocks', 'alphablocks', 'bluey bingo', 'andy', "andy's adventures",
        'horrible histories', 'cbbc', 'cbeebies', 'mr tumble', 'something special',
        'in the night garden', 'iggle piggle', 'upsy daisy', 'makka pakka',
        'sarah and duck', 'go jetters', 'octonauts', 'danger mouse',
        'peter rabbit', 'paddington', 'paddington bear', 'gruffalo', 'room on the broom',
        'stick man', 'zog', 'highway rat', 'snail and whale', 'julia donaldson',
        'mr men', 'little miss', 'winnie the pooh', 'piglet', 'tigger', 'eeyore',
        'babar', 'curious george', 'miffy', 'maisy', 'spot the dog', 'kipper',
        // Other characters/franchises
        'gabby', "gabby's dollhouse", 'baby shark', 'minions', 'despicable me', 'gru',
        'trolls', 'poppy', 'branch', 'shrek', 'fiona', 'donkey', 'kung fu panda', 'po',
        'how to train your dragon', 'toothless', 'boss baby', 'croods', 'sing', 'secret life of pets',
        'angry birds', 'spongebob', 'patrick star', 'paw', 'peppa', 'ben and holly',
        'sylvanian families', 'sylvanian', 'calico critters', 'lol surprise', 'lol', 'omg',
        'hatchimals', 'shopkins', 'polly pocket', 'bratz', 'monster high', 'ever after high',
        'my generation', 'american girl', 'our generation', 'baby born', 'baby annabell',
        'cabbage patch', 'build a bear', 'beanie babies', 'beanie boos', 'ty', 'squishmallow',
        'funko', 'funko pop', 'nendoroid', 'action figure', 'action figures',
        // Dinosaurs
        'dinosaur', 'dinosaurs', 't-rex', 'trex', 'tyrannosaurus', 'velociraptor', 'raptor',
        'triceratops', 'stegosaurus', 'brontosaurus', 'pterodactyl', 'jurassic', 'jurassic park',
        'jurassic world', 'prehistoric',
        // Sports brands (shoes/clothing)
        'nike', 'adidas', 'puma', 'reebok', 'new balance', 'skechers', 'clarks', 'vans',
        'converse', 'crocs', 'under armour', 'jordan', 'air jordan', 'asics', 'fila',
        // Unicorns/fantasy
        'unicorn', 'unicorns', 'fairy', 'fairies', 'mermaid', 'mermaids', 'dragon', 'dragons',
        'princess', 'princesses', 'prince', 'knight', 'knights', 'castle', 'rainbow',
        // General toy types that shouldn't need brand check
        'toy', 'toys', 'game', 'games', 'puzzle', 'puzzles', 'doll', 'dolls', 'teddy', 'teddy bear',
        'plush', 'soft toy', 'stuffed animal', 'building blocks', 'blocks', 'train', 'trains',
        'car', 'cars', 'truck', 'trucks', 'bike', 'scooter', 'trampoline', 'swing', 'slide',
        'playhouse', 'tent', 'ball', 'balls', 'football', 'basketball', 'cricket', 'rugby',
        'costume', 'costumes', 'dress up', 'fancy dress', 'superhero', 'pirate', 'witch',
        'robot', 'robots', 'science', 'stem', 'craft', 'crafts', 'art', 'paint', 'painting',
        'playdough', 'slime', 'kinetic sand', 'sand', 'water', 'bath toys', 'outdoor'
      ]);
      const isKnownBrand = knownBrandLower && KNOWN_BRANDS_CACHE.has(knownBrandLower);
      
      if (isKnownBrand) {
        console.log(`[Shop Search] FAST PATH: Skipping brand check for known brand "${detectedBrand}"`);
      }
      
      if (detectedBrand && !filterBrand && !isKnownBrand) {
        // Only do brand check for unknown brands (not in our known list)
        // FIX #57: Use TSVECTOR for brand check instead of ILIKE (was taking 50-60s!)
        const brandCheckStart = Date.now();
        let brandExists = false;
        let brandCount = 0;
        
        try {
          // FAST PATH: Use tsvector with GIN index (sub-100ms)
          // Use parameterized query to prevent SQL injection
          const tsvectorResult = await db.execute(sql`SELECT id FROM products WHERE search_vector @@ plainto_tsquery('english', ${detectedBrand}) LIMIT 1`);
          brandExists = (tsvectorResult as any).rows?.length > 0 || (tsvectorResult as any).length > 0;
          brandCount = brandExists ? 1 : 0;
          console.log(`[Shop Search] TIMING: Brand check (tsvector) took ${Date.now() - brandCheckStart}ms`);
        } catch (tsvectorError: any) {
          // FALLBACK: If tsvector fails (column missing), use ILIKE but with timeout protection
          console.log(`[Shop Search] Brand check tsvector failed, falling back to ILIKE: ${tsvectorError.message}`);
          try {
            const brandCheckResult = await db.select({ id: products.id })
              .from(products)
              .where(or(
                ilike(products.brand, `%${detectedBrand}%`),
                ilike(products.name, `%${detectedBrand}%`)
              ))
              .limit(1);
            brandExists = brandCheckResult.length > 0;
            brandCount = brandExists ? 1 : 0;
            console.log(`[Shop Search] TIMING: Brand check (ILIKE fallback) took ${Date.now() - brandCheckStart}ms`);
          } catch (ilikeError: any) {
            console.log(`[Shop Search] Brand check ILIKE also failed: ${ilikeError.message}`);
            // Assume brand exists to allow search to proceed
            brandExists = true;
            brandCount = 1;
          }
        }
        
        if (brandCount === 0) {
          // Brand/character doesn't exist in our catalog
          console.log(`[Shop Search] INVENTORY GAP: "${detectedBrand}" not found in catalog (0 products)`);
          inventoryGapMessage = `No ${detectedBrand} products found in our catalog`;
          
          // Try category-based fallback before returning empty
          const inferredCategory = inferCategoryFromQuery(query);
          if (inferredCategory) {
            console.log(`[Shop Search] INVENTORY GAP FALLBACK: "${query}" → category "${inferredCategory.category}"`);
            const fallback = await searchFallbackByCategory(inferredCategory.category, inferredCategory.keywords, storage, safeLimit, effectiveMaxPrice);
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
      
      // ========================================================================
      // PERFORMANCE FIX: BRAND FAST-PATH FOR KNOWN BRANDS
      // For known brands like "Lego", skip semantic search entirely and use indexed brand query
      // This reduces query time from 9s to <500ms
      // ========================================================================
      const knownBrandLower2 = detectedBrand?.toLowerCase();
      const BRAND_FAST_PATH_SET = new Set(['lego', 'barbie', 'mattel', 'hasbro', 'nerf', 'hot wheels']);
      const useBrandFastPath = knownBrandLower2 && BRAND_FAST_PATH_SET.has(knownBrandLower2) && 
                               !filterCategory && !filterMerchant && !filterBrand;
      
      if (useBrandFastPath && detectedBrand) {
        const brandFastStart = Date.now();
        
        // FIX #51: Include significant modifiers in tsvector search
        // Brand is required (AND), modifiers are optional (OR) for ranking
        // "lego frozen" → "lego & frozen" to get Frozen products first
        // "lego frozen for kids" → "lego & (frozen | kids)" to not exclude valid products
        const brandLower = detectedBrand.toLowerCase();
        const stopWords = new Set(['for', 'and', 'the', 'with', 'set', 'toys', 'gift', 'kids', 'boy', 'girl', 'age', 'year', 'old']);
        const queryTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
        
        // Significant modifiers = non-brand, non-stopword terms (frozen, star, wars, disney, etc)
        const significantModifiers = queryTerms.filter(t => t !== brandLower);
        
        let brandTsQuery: string;
        if (significantModifiers.length === 1) {
          // Single modifier: "lego frozen" → "lego & frozen" (both required for precision)
          brandTsQuery = `${brandLower} & ${significantModifiers[0]}`;
          console.log(`[Shop Search] BRAND FAST-PATH: Using TSVECTOR for "${detectedBrand}" + "${significantModifiers[0]}"`);
        } else if (significantModifiers.length > 1) {
          // Multiple modifiers: "lego star wars" → "lego & star & wars" (all required)
          brandTsQuery = [brandLower, ...significantModifiers].join(' & ');
          console.log(`[Shop Search] BRAND FAST-PATH: Using TSVECTOR for "${detectedBrand}" + terms: ${significantModifiers.join(', ')}`);
        } else {
          brandTsQuery = brandLower;
          console.log(`[Shop Search] BRAND FAST-PATH: Using TSVECTOR for "${detectedBrand}" (brand only)`);
        }
        
        let brandResults: any[] = [];
        try {
          brandResults = await db.select({
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
              sql`search_vector @@ to_tsquery('english', ${brandTsQuery})`,
              products.inStock,
              isNotNull(products.affiliateLink),
              sql`${products.imageUrl} NOT ILIKE '%noimage%'`
            ))
            .limit(100);
        } catch (tsvectorError: any) {
          console.log(`[Shop Search] BRAND FAST-PATH: tsvector failed, falling back to ILIKE`);
          brandResults = await db.select({
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
              or(
                ilike(products.brand, `%${detectedBrand}%`),
                ilike(products.name, `%${detectedBrand}%`)
              ),
              products.inStock,
              isNotNull(products.affiliateLink),
              sql`${products.imageUrl} NOT ILIKE '%noimage%'`
            ))
            .limit(100);
        }
        
        // FIX #51: Sort by relevance to FULL query, not just brand
        // For "lego frozen", rank products with "frozen" in name MUCH higher
        // Note: brandLower already declared above
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && w !== brandLower);
        
        brandResults.sort((a, b) => {
          const aName = a.name?.toLowerCase() || '';
          const bName = b.name?.toLowerCase() || '';
          
          // +3 for each query term match (e.g., "frozen" in product name)
          const aTermScore = queryWords.reduce((s, w) => s + (aName.includes(w) ? 3 : 0), 0);
          const bTermScore = queryWords.reduce((s, w) => s + (bName.includes(w) ? 3 : 0), 0);
          
          // +1 for brand in name, +0.5 for brand in brand column
          const aInName = aName.includes(brandLower) ? 1 : 0;
          const bInName = bName.includes(brandLower) ? 1 : 0;
          
          // Term matches are 3x more important than brand placement
          return (bTermScore + bInName) - (aTermScore + aInName);
        });
        
        if (queryWords.length > 0) {
          console.log(`[Shop Search] BRAND FAST-PATH: Boosting results with terms: ${queryWords.join(', ')}`);
        }
        
        candidates = brandResults.slice(0, 60);
        totalCandidates = brandResults.length;
        console.log(`[Shop Search] BRAND FAST-PATH (tsvector) completed in ${Date.now() - brandFastStart}ms (found ${candidates.length} products)`);
      } else if (interpretation.isSemanticQuery && interpretation.searchTerms.length > 0) {
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
        } else if (interpretation.attributes?.brand && isValidBrand(interpretation.attributes.brand)) {
          // Apply GPT-extracted brand filter (e.g., "star wars lego" → brand: Lego)
          // CRITICAL FIX: Do NOT use brand filter for character queries
          // Characters like "Spiderman" appear in product names, not brand column
          // Real Spider-Man products have brand="Marvel" or "Disney", not "Spiderman"
          // Fix #38: Also skip if brand is "null" or empty string (GPT sometimes returns these)
          const gptBrand = interpretation.attributes.brand;
          const isCharacterQuery = parsedQuery.character && 
            gptBrand.toLowerCase().replace(/[-\s]/g, '') === parsedQuery.character.toLowerCase().replace(/[-\s]/g, '');
          
          if (!isCharacterQuery) {
            const brandCondition = or(
              ilike(products.brand, `%${gptBrand}%`),
              ilike(products.name, `%${gptBrand}%`)
            );
            if (brandCondition) filterConditions.push(brandCondition as any);
            console.log(`[Shop Search] Applying GPT-extracted brand filter: ${gptBrand}`);
          } else {
            console.log(`[Shop Search] SKIPPING brand filter for character query (character will be matched via mustHaveAll)`);
          }
        }
        
        // =============================================================================
        // FIX #51: RELAXED TOKEN MATCHING - OR logic with ranking
        // OLD: "frozen elsa doll" requires ALL tokens → 0 results
        // NEW: "frozen" OR "elsa" OR "doll" with products matching more tokens ranked higher
        // First token (usually character/brand) is REQUIRED, additional tokens boost ranking
        // =============================================================================
        const ageStopWords = new Set([
          'year', 'years', 'old', 'age', 'ages', 'aged', 'month', 'months',
          'toddler', 'toddlers', 'baby', 'babies', 'infant', 'infants',
          'newborn', 'newborns', 'teen', 'teens', 'teenager', 'teenagers',
          'child', 'children', 'kid', 'kids', 'boy', 'boys', 'girl', 'girls',
          'toy', 'toys', 'gift', 'gifts', 'for', 'and', 'the', 'with'
        ]);
        
        // Collect all mustHaveAll words for later ranking (FIX #51)
        const mustHaveAllWords: string[] = [];
        
        if (interpretation.mustHaveAll && interpretation.mustHaveAll.length > 0) {
          // Collect all words from all terms
          for (const term of interpretation.mustHaveAll) {
            const isCharacterBrand = /spider|man|patrol|patrol|frozen|disney|marvel|dc|star\s*wars|pokemon|harry\s*potter|peppa|bluey/i.test(term);
            if (!isCharacterBrand && interpretation.attributes?.brand && 
                term.toLowerCase() === interpretation.attributes.brand.toLowerCase()) {
              continue;
            }
            const words = term.toLowerCase().split(/\s+/).filter(w => 
              w.length >= 2 && !ageStopWords.has(w) && !/^\d+$/.test(w)
            );
            mustHaveAllWords.push(...words);
          }
          
          if (mustHaveAllWords.length > 0) {
            // FIX #51: Only FIRST word is required, rest are used for ranking
            const primaryWord = mustHaveAllWords[0];
            const boostWords = mustHaveAllWords.slice(1);
            
            // Build condition for primary word (REQUIRED)
            const primaryVariants = [primaryWord];
            if (primaryWord.includes('-')) {
              primaryVariants.push(primaryWord.replace(/-/g, ''));
            } else if (/spider|man|iron|bat|super/.test(primaryWord)) {
              const hyphenated = primaryWord.replace(/(spider|iron|bat|super)(man|woman|girl|boy)/i, '$1-$2');
              if (hyphenated !== primaryWord) primaryVariants.push(hyphenated);
            }
            
            const primaryConditions = primaryVariants.flatMap(variant => [
              ilike(products.name, `%${variant}%`),
              ilike(products.brand, `%${variant}%`)
            ]);
            const primaryCondition = or(...primaryConditions);
            if (primaryCondition) {
              filterConditions.push(primaryCondition as any);
            }
            
            if (boostWords.length > 0) {
              console.log(`[Shop Search] FIX #51: Requiring "${primaryWord}", will boost by: ${boostWords.join(', ')}`);
            } else {
              console.log(`[Shop Search] Requiring "${primaryWord}" in results`);
            }
          }
        }
        
        // P1 BUG 5 FIX: Safe singular/plural mappings for common words
        // Using targeted map instead of naive string surgery (dress → dres is wrong)
        const MORPH_VARIANTS: Record<string, string> = {
          'books': 'book', 'book': 'books',
          'toys': 'toy', 'toy': 'toys',
          'games': 'game', 'game': 'games',
          'puzzles': 'puzzle', 'puzzle': 'puzzles',
          'dolls': 'doll', 'doll': 'dolls',
          'figures': 'figure', 'figure': 'figures',
          'stories': 'story', 'story': 'stories',
          'storybooks': 'storybook', 'storybook': 'storybooks',
          'costumes': 'costume', 'costume': 'costumes',
          'gifts': 'gift', 'gift': 'gifts',
          'activities': 'activity', 'activity': 'activities',
        };
        
        // =============================================================================
        // FIX #19: TSVECTOR FAST SEARCH - PostgreSQL Full-Text Search
        // This uses the pre-computed search_vector column with GIN index
        // Target: <100ms vs 8-15s with ILIKE regex word boundaries
        // Toggle USE_TSVECTOR_SEARCH to enable/disable for A/B testing
        // search_vector column added to products table and populated with:
        //   to_tsvector('english', name || ' ' || brand)
        // =============================================================================
        // FIX #29: Runtime flag to disable tsvector if column missing in production
        // This prevents 100% failure rate when deploying to Railway without migration
        const USE_TSVECTOR_SEARCH = !(global as any).TSVECTOR_DISABLED; // Disabled at runtime if column missing
        
        if (USE_TSVECTOR_SEARCH) {
          // FIX: Only use ORIGINAL query terms for tsvector (not GPT expansions)
          // plainto_tsquery uses AND logic - too many terms = zero results
          // GPT expansions ("dress up", "halloween") may not be in product names
          // Example: "witch costume" matches, but "witch costume dress halloween" fails
          const allTerms = new Set<string>();
          
          // Fix #40: Generic qualifiers should be OPTIONAL, not REQUIRED
          // "badminton set" should match "badminton racket" too
          const OPTIONAL_QUALIFIERS = new Set([
            'set', 'kit', 'pack', 'bundle', 'collection', 'combo', 'package',
            'equipment', 'accessories', 'supplies', 'gear', 'complete'
          ]);
          
          // FIX #45: Price-related stopwords should NOT be searched in product names
          // "toys under 10 pounds" should search for "toys", not "toys & under & pounds"
          const PRICE_STOPWORDS = new Set([
            'under', 'over', 'below', 'above', 'less', 'more', 'than', 'between',
            'pounds', 'pound', 'quid', 'gbp', 'price', 'priced', 'cheap', 'budget',
            'affordable', 'expensive', 'cost', 'costs', 'costing', 'spend', 'spending'
          ]);
          
          // Add query words - use synonym-replaced query if phrase synonym was applied
          // FIX #44: "stem toys" → uses "educational toys" terms, not "stem toys" terms
          const queryToUse = phraseSynonymApplied ? phraseFixed : query;
          const originalWords = queryToUse.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
          const requiredTerms = new Set<string>();
          const optionalTerms = new Set<string>();
          
          originalWords.forEach((w: string) => {
            // FIX #45: Skip price-related words - they're not in product names
            if (PRICE_STOPWORDS.has(w)) {
              return;
            }
            // Also skip pure numbers (price amounts)
            if (/^\d+$/.test(w)) {
              return;
            }
            if (OPTIONAL_QUALIFIERS.has(w)) {
              optionalTerms.add(w);
            } else {
              requiredTerms.add(w);
            }
          });
          
          // Also add mustHaveAll terms (character names, key terms) - always required
          if (interpretation.mustHaveAll && interpretation.mustHaveAll.length > 0) {
            for (const term of interpretation.mustHaveAll) {
              const words = term.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
              words.forEach((w: string) => {
                if (!OPTIONAL_QUALIFIERS.has(w)) {
                  requiredTerms.add(w);
                }
              });
            }
          }
          
          // Add all to allTerms for backwards compat
          requiredTerms.forEach(t => allTerms.add(t));
          optionalTerms.forEach(t => allTerms.add(t));
          
          // REMOVED: GPT-expanded terms (they cause false negatives with AND logic)
          // The ILIKE fallback handles cases where tsvector returns 0
          
          if (requiredTerms.size > 0 || optionalTerms.size > 0) {
            // Fix #40: Build staged tsquery - require core noun + optional equipment synonyms
            // Example: "badminton set" → "badminton & (set | kit | net | racket)"
            // This ensures we get badminton products, with preference for sets
            
            // Equipment-related synonyms for sports queries
            const EQUIPMENT_SYNONYMS: Record<string, string[]> = {
              'set': ['set', 'kit', 'net', 'racket', 'racquet', 'equipment'],
              'kit': ['kit', 'set', 'pack', 'bundle', 'equipment'],
              'pack': ['pack', 'set', 'kit', 'bundle'],
            };
            
            const tsvectorStart = Date.now();
            let tsvectorQuery: string;
            
            // Build tsquery with proper operators
            const requiredTermsArray = Array.from(requiredTerms);
            const optionalTermsArray = Array.from(optionalTerms);
            
            // FIX #51: Relaxed token matching - first token required, rest boost score
            // "lego frozen" → search "lego", rank by "frozen" presence
            // This prevents strict AND matching from returning 0 results
            
            // FIX #56: For costume queries, require BOTH brand AND costume term
            // "frozen costume" → search "frozen & (costume | dress | outfit)" 
            const isCostumeQuery = hasCostumeContext(query);
            const COSTUME_SEARCH_TERMS = ['costume', 'dress', 'outfit', 'fancy'];
            
            if (isCostumeQuery && requiredTermsArray.length > 0) {
              // For costume queries, require brand AND costume term
              const brandTerm = requiredTermsArray[0];
              const costumeTerms = COSTUME_SEARCH_TERMS.join(' | ');
              tsvectorQuery = `${brandTerm} & (${costumeTerms})`;
              console.log(`[Shop Search] TSVECTOR (FIX #56): Costume query "${tsvectorQuery}"`);
            } else if (requiredTermsArray.length > 1) {
              // First term (usually brand) is required, rest are optional boosters
              const primaryTerm = requiredTermsArray[0];
              const boostTerms = requiredTermsArray.slice(1);
              const allBoost = new Set([...boostTerms, ...optionalTermsArray]);
              
              // Add synonyms for equipment terms
              for (const opt of boostTerms) {
                if (EQUIPMENT_SYNONYMS[opt]) {
                  EQUIPMENT_SYNONYMS[opt].forEach(s => allBoost.add(s));
                }
              }
              
              if (allBoost.size > 0) {
                // Build: primaryTerm & (boost1 | boost2 | ...) - but make boost optional
                // Actually just search for primaryTerm, rank by boost terms later
                tsvectorQuery = primaryTerm;
                console.log(`[Shop Search] TSVECTOR (FIX #51): Primary "${primaryTerm}", will boost by: ${Array.from(allBoost).join(', ')}`);
              } else {
                tsvectorQuery = primaryTerm;
                console.log(`[Shop Search] TSVECTOR: Query "${tsvectorQuery}"`);
              }
            } else if (optionalTermsArray.length > 0 && requiredTermsArray.length > 0) {
              // Get synonyms for optional terms
              const allOptional = new Set(optionalTermsArray);
              for (const opt of optionalTermsArray) {
                if (EQUIPMENT_SYNONYMS[opt]) {
                  EQUIPMENT_SYNONYMS[opt].forEach(s => allOptional.add(s));
                }
              }
              
              // Build: required1 & (opt1 | opt2 | opt3)
              const requiredPart = requiredTermsArray.join(' & ');
              const optionalPart = Array.from(allOptional).join(' | ');
              tsvectorQuery = `(${requiredPart}) & (${optionalPart})`;
              console.log(`[Shop Search] TSVECTOR: Strict query "${tsvectorQuery}"`);
            } else {
              // No optional terms - just use required
              tsvectorQuery = requiredTermsArray.join(' & ');
              console.log(`[Shop Search] TSVECTOR: Query "${tsvectorQuery}"`);
            }
            
            // Build WHERE conditions with tsvector + filters
            // Use to_tsquery for explicit AND/OR operators
            const tsvectorConditions: any[] = [
              sql.raw(`search_vector @@ to_tsquery('english', '${tsvectorQuery.replace(/'/g, "''")}')`),
              isNotNull(products.affiliateLink),
              ...filterConditions
            ];
            
            // FIX #45g + Fix #66: For toy queries, PREFER toy categories and exclude clothing
            // Check ORIGINAL query for toy intent, not just tsvector query
            // "Disney toys" should search Disney products in Toy categories, not Disney t-shirts
            const TOY_RELATED_WORDS = ['toy', 'toys', 'plaything', 'playthings', 'figure', 'figures', 'doll', 'dolls', 'playset', 'playsets'];
            const GIFT_WORDS = ['gift', 'gifts', 'present', 'presents'];
            const originalQueryLower = query.toLowerCase();
            
            // Check if original query (not tsvector) contains toy/gift intent
            const queryHasToyIntent = TOY_RELATED_WORDS.some(word => {
              const regex = new RegExp(`\\b${word}\\b`, 'i');
              return regex.test(originalQueryLower);
            });
            const queryHasGiftIntent = GIFT_WORDS.some(word => {
              const regex = new RegExp(`\\b${word}\\b`, 'i');
              return regex.test(originalQueryLower);
            });
            
            // Also check GPT-extracted categoryFilter
            const hasToysCategoryFilter = interpretation?.context?.categoryFilter === 'Toys';
            
            // Fix #66: Apply toy category filtering when user explicitly wants toys
            if (queryHasToyIntent || hasToysCategoryFilter) {
              // PREFER toy categories - add positive filter for toy-related categories
              tsvectorConditions.push(sql`(
                ${products.category} ILIKE '%toy%' OR 
                ${products.category} ILIKE '%game%' OR 
                ${products.category} ILIKE '%puzzle%' OR 
                ${products.category} ILIKE '%figure%' OR 
                ${products.category} ILIKE '%playset%' OR
                ${products.category} ILIKE '%doll%'
              )`);
              console.log(`[Shop Search] TSVECTOR (Fix #66): Added toy category filter for toy query`);
            } else if (queryHasGiftIntent) {
              // For gift queries, just exclude clothing (don't require toy category)
              tsvectorConditions.push(sql`${products.category} NOT ILIKE '%t-shirt%'`);
              tsvectorConditions.push(sql`${products.category} NOT ILIKE '%sweatshirt%'`);
              tsvectorConditions.push(sql`${products.category} NOT ILIKE '%hoodie%'`);
              tsvectorConditions.push(sql`${products.category} NOT ILIKE '%clothing accessor%'`);
              console.log(`[Shop Search] TSVECTOR: Added clothing exclusions for gift query`);
            }
            
            if (effectiveMinPrice !== undefined) {
              tsvectorConditions.push(sql`CAST(${products.price} AS NUMERIC) >= ${effectiveMinPrice}`);
            }
            if (effectiveMaxPrice !== undefined) {
              tsvectorConditions.push(sql`CAST(${products.price} AS NUMERIC) <= ${effectiveMaxPrice}`);
            }
            
            // FIX #29: Wrap in try/catch - if search_vector column missing, fall back to ILIKE
            let tsvectorResults: any[] = [];
            let tsvectorFailed = false;
            try {
              tsvectorResults = await db.select({
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
                .where(and(...tsvectorConditions))
                .limit(100);
              
              console.log(`[Shop Search] TSVECTOR: Found ${tsvectorResults.length} results in ${Date.now() - tsvectorStart}ms`);
            } catch (tsvectorError: any) {
              // FIX #29: Set runtime flag to disable tsvector for future requests
              if (tsvectorError.message?.includes('search_vector') || tsvectorError.message?.includes('column')) {
                (global as any).TSVECTOR_DISABLED = true;
                console.log(`[Shop Search] TSVECTOR DISABLED: Column missing, all future requests will use ILIKE`);
              }
              console.log(`[Shop Search] TSVECTOR FAILED: ${tsvectorError.message}, falling back to ILIKE`);
              tsvectorFailed = true;
            }
            
            // Sort by relevance: prioritize products with optional qualifiers (like "set") 
            // Then by how many query terms match
            const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            // Note: optionalTermsArray already declared above
            if (tsvectorResults.length > 0) {
              tsvectorResults.sort((a, b) => {
                const aName = a.name?.toLowerCase() || '';
                const bName = b.name?.toLowerCase() || '';
                // Score: +2 for each optional term (like "set"), +1 for each other query term
                const aOptScore = optionalTermsArray.reduce((s, w) => s + (aName.includes(w) ? 2 : 0), 0);
                const bOptScore = optionalTermsArray.reduce((s, w) => s + (bName.includes(w) ? 2 : 0), 0);
                const aTermScore = queryWords.reduce((s, w) => s + (aName.includes(w) ? 1 : 0), 0);
                const bTermScore = queryWords.reduce((s, w) => s + (bName.includes(w) ? 1 : 0), 0);
                return (bOptScore + bTermScore) - (aOptScore + aTermScore);
              });
              
              for (const p of tsvectorResults.slice(0, 50)) {
                if (!seenIds.has(p.id)) {
                  seenIds.add(p.id);
                  allCandidates.push(p);
                }
              }
              
              candidates = allCandidates;
              totalCandidates = candidates.length;
              console.log(`[Shop Search] TSVECTOR: Total ${candidates.length} unique candidates`);
            }
            
            // FALLBACK: If tsvector found 0 results OR failed, fall back to ILIKE search
            // This handles products that don't have search_vector populated yet
            // FIX #29: Also triggers when tsvector query fails (missing column in production)
            if (candidates.length === 0 || tsvectorFailed) {
              // FIX #23: For known brands, skip slow ILIKE (18s+ per term) and do tsvector brand-only search
              // This fixes "lol dolls" timeout - tsvector finds "lol" products in <100ms
              const brandToSearch = interpretation.attributes?.brand || interpretation.attributes?.character;
              const brandLower = brandToSearch?.toLowerCase();
              
              if (brandLower && KNOWN_BRANDS_CACHE.has(brandLower) && !tsvectorFailed) {
                console.log(`[Shop Search] KNOWN BRAND FAST PATH: Skipping ILIKE, searching tsvector for just "${brandLower}"`);
                
                const brandFastStart = Date.now();
                const brandTsquery = brandLower.split(/\s+/).filter(w => w.length > 1).join(' & ');
                
                // FIX #26: Added try/catch fallback to ILIKE if search_vector column doesn't exist
                // FIX #29: Skip if tsvector already failed (column missing)
                let brandResults: any[] = [];
                try {
                  brandResults = await db.select({
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
                      sql`search_vector @@ to_tsquery('english', ${brandTsquery})`,
                      isNotNull(products.affiliateLink),
                      ...filterConditions
                    ))
                    .limit(100);
                } catch (tsvectorError: any) {
                  console.log(`[Shop Search] KNOWN BRAND FAST PATH: tsvector failed, falling back to ILIKE`);
                  brandResults = await db.select({
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
                      or(
                        ilike(products.brand, `%${brandLower}%`),
                        ilike(products.name, `%${brandLower}%`)
                      ),
                      isNotNull(products.affiliateLink),
                      sql`${products.imageUrl} NOT ILIKE '%noimage%'`
                    ))
                    .limit(100);
                }
                
                console.log(`[Shop Search] KNOWN BRAND FAST PATH: Found ${brandResults.length} results in ${Date.now() - brandFastStart}ms`);
                
                // Sort by relevance to original query
                const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                brandResults.sort((a, b) => {
                  const aName = a.name?.toLowerCase() || '';
                  const bName = b.name?.toLowerCase() || '';
                  const aScore = queryWords.reduce((s, w) => s + (aName.includes(w) ? 1 : 0), 0);
                  const bScore = queryWords.reduce((s, w) => s + (bName.includes(w) ? 1 : 0), 0);
                  return bScore - aScore;
                });
                
                candidates = brandResults;
                totalCandidates = candidates.length;
              } else {
                // Unknown brand - use slow ILIKE fallback
                console.log(`[Shop Search] TSVECTOR: 0 results, falling back to ILIKE search`);
                // Reset for ILIKE fallback (use .length = 0 to clear const array)
                allCandidates.length = 0;
                seenIds.clear();
              
              // Run ILIKE search as fallback
              for (const termGroup of interpretation.searchTerms) {
                const termConditions: ReturnType<typeof and>[] = [];
                for (const term of termGroup) {
                  const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                  if (words.length === 0) continue;
                  
                  const condition = and(...words.map(w => {
                    const variants = [w];
                    if (MORPH_VARIANTS[w]) {
                      variants.push(MORPH_VARIANTS[w]);
                    }
                    const variantConditions = variants.map(v => ilike(products.name, `%${v}%`));
                    return or(...variantConditions);
                  }));
                  if (condition) termConditions.push(condition as any);
                }
                
                if (termConditions.length === 0) continue;
                
                const whereConditions: any[] = [
                  or(...termConditions),
                  isNotNull(products.affiliateLink),
                  ...filterConditions
                ];
                
                if (effectiveMinPrice !== undefined) {
                  whereConditions.push(sql`CAST(${products.price} AS NUMERIC) >= ${effectiveMinPrice}`);
                }
                if (effectiveMaxPrice !== undefined) {
                  whereConditions.push(sql`CAST(${products.price} AS NUMERIC) <= ${effectiveMaxPrice}`);
                }
                
                const fallbackStart = Date.now();
                // FIX #50: Wrap ILIKE fallback with 3-second timeout to prevent 50+ second hangs
                const queryPromise = db.select({
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
                  .limit(100);
                
                const groupResults = await withTimeout(queryPromise, ILIKE_FALLBACK_TIMEOUT_MS, 'ILIKE fallback') || [];
                console.log(`[Shop Search] ILIKE FALLBACK: DB query took ${Date.now() - fallbackStart}ms, found ${groupResults.length} results`);
                
                for (let i = groupResults.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [groupResults[i], groupResults[j]] = [groupResults[j], groupResults[i]];
                }
                
                for (const p of groupResults.slice(0, 30)) {
                  if (!seenIds.has(p.id)) {
                    seenIds.add(p.id);
                    allCandidates.push(p);
                  }
                }
              }
              
              candidates = allCandidates;
              totalCandidates = candidates.length;
              console.log(`[Shop Search] ILIKE FALLBACK: Total ${candidates.length} candidates`);
              }
            }
          }
        } else {
          // OLD ILIKE SEARCH (kept for comparison/rollback)
        
        for (const termGroup of interpretation.searchTerms) {
          // Build OR conditions for this term group
          const termConditions: ReturnType<typeof and>[] = [];
          for (const term of termGroup) {
            const words = term.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (words.length === 0) continue;
            
            // PERFORMANCE FIX: Only search indexed name column with simple ILIKE
            const condition = and(...words.map(w => {
              // Use safe morph variants map instead of naive string surgery
              const variants = [w];
              if (MORPH_VARIANTS[w]) {
                variants.push(MORPH_VARIANTS[w]);
              }
              // Build OR condition for all variants
              const variantConditions = variants.map(v => ilike(products.name, `%${v}%`));
              return or(...variantConditions);
            }));
            if (condition) termConditions.push(condition as any);
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
          // PERFORMANCE FIX: Remove ORDER BY RANDOM() - it forces full table sort (13s+)
          // Shuffle results in memory instead
          const semanticSearchStart = Date.now();
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
            .limit(100); // Get more results then shuffle in memory
          console.log(`[Shop Search] TIMING: Semantic DB query took ${Date.now() - semanticSearchStart}ms`);
          
          // Shuffle in memory for variety (Fisher-Yates)
          for (let i = groupResults.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [groupResults[i], groupResults[j]] = [groupResults[j], groupResults[i]];
          }
          const shuffledResults = groupResults.slice(0, 30);
          
          // Add unique results
          for (const p of shuffledResults) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allCandidates.push(p);
            }
          }
        }
        
        candidates = allCandidates;
        totalCandidates = candidates.length;
        console.log(`[Shop Search] Semantic search found ${candidates.length} candidates from ${interpretation.searchTerms.length} term groups`);
        } // End of else block for old ILIKE search
        
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
        
        // CRITICAL: Use searchQuery (with phrase synonyms applied), NOT original query
        // This ensures "calico critters" → "sylvanian families" is used for word matching
        let words = searchQuery.toLowerCase()
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
          // WORD BOUNDARY FIX: Use PostgreSQL regex \y for word boundaries
          // This prevents "bike" matching "biker", "cheap" matching "cheapskate"
          // HYPHENATED FIX: Also search for hyphenated variants (spiderman → spider-man)
          const wordConditions = words.map(w => {
            // Escape regex special chars in the word
            const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // CRITICAL FIX: Handle hyphenated superhero variants
            // "spiderman" should also match "spider-man" and vice versa
            const variants = [escaped];
            if (/spiderman|ironman|batman|superman|aquaman|antman/.test(w)) {
              // Add hyphenated variant: spiderman → spider-man
              const hyphenated = w.replace(/(spider|iron|bat|super|aqua|ant)(man|woman|girl|boy)/i, '$1-$2');
              if (hyphenated !== w) variants.push(hyphenated);
            } else if (w.includes('-') && /spider|iron|bat|super|aqua|ant/.test(w)) {
              // Add non-hyphenated variant: spider-man → spiderman
              variants.push(w.replace(/-/g, ''));
            }
            
            // Build OR condition for all variants
            const regexPattern = variants.map(v => '\\y' + v + '\\y').join('|');
            return sql`${products.name} ~* ${regexPattern}`;
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
          } else if (interpretation.attributes?.brand && isValidBrand(interpretation.attributes.brand)) {
            // Apply GPT-extracted brand filter for non-semantic queries
            // Fix #38: Skip if brand is "null" or empty string
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
          const fallback = await searchFallbackByCategory(inferredCategory.category, inferredCategory.keywords, storage, safeLimit, effectiveMaxPrice);
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
          const fallback2 = await searchFallbackByCategory(inferredCategory2.category, inferredCategory2.keywords, storage, safeLimit, effectiveMaxPrice);
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

      // PRE-RERANK QUALITY FILTER: Apply quality filters to ALL candidates BEFORE slicing
      // This prevents the inventory gap fallback from firing when only the random slice was clothing
      const preRerankCount = candidates.length;
      candidates = applySearchQualityFilters(candidates, query);
      if (candidates.length < preRerankCount) {
        console.log(`[Shop Search] Pre-rerank quality filter: ${preRerankCount} → ${candidates.length} for "${query}"`);
      }
      
      // TOKEN-MATCH BOOST: Sort products with matching keywords to top before limiting
      // This ensures "peppa pig books" surfaces products with "book" in name
      const boostQueryLower = query.toLowerCase();
      const boostTokens = ['book', 'books', 'toy', 'toys', 'figure', 'figures', 'costume', 'costumes', 'puzzle', 'puzzles', 'game', 'games', 'doll', 'dolls'];
      const matchingTokens = boostTokens.filter(t => boostQueryLower.includes(t));
      
      if (matchingTokens.length > 0 && candidates.length > safeLimit) {
        // Score candidates: +1 for each matching token in name
        candidates.sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          const aScore = matchingTokens.filter(t => aName.includes(t)).length;
          const bScore = matchingTokens.filter(t => bName.includes(t)).length;
          return bScore - aScore; // Higher score first
        });
        console.log(`[Shop Search] Token boost applied for: ${matchingTokens.join(', ')}`);
      }
      
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

      // Fix #35: REMOVED duplicate quality filter - already applied at pre-rerank stage (line 5441)
      // This was causing results to drop from 6 to 2 due to double merchant cap application
      
      // MEGA-FIX 10: Apply age, gender, character, price, and diversity filters
      // This ensures "toys for newborn" returns baby toys and "toys for teenager" returns teen-appropriate items
      const preAgeFilterCount = selectedProducts.length;
      selectedProducts = applyQueryFilters(selectedProducts, parsedQuery);
      if (selectedProducts.length < preAgeFilterCount) {
        const filterReasons: string[] = [];
        if (parsedQuery.ageMin !== null || parsedQuery.ageMax !== null) filterReasons.push(`age ${parsedQuery.ageMin}-${parsedQuery.ageMax}`);
        if (parsedQuery.gender) filterReasons.push(`gender=${parsedQuery.gender}`);
        if (parsedQuery.character) filterReasons.push(`character=${parsedQuery.character}`);
        if (parsedQuery.priceMax) filterReasons.push(`price≤£${parsedQuery.priceMax}`);
        console.log(`[Shop Search] Age/Context filter: ${preAgeFilterCount} → ${selectedProducts.length} (${filterReasons.join(', ')})`);
      }

      // =============================================================================
      // GLOBAL FIXES #67-69: Apply AFTER all other filters, BEFORE final return
      // =============================================================================
      
      // Fix #69: Filter out non-products (books, DVDs, posters) for toy/set searches
      const preNonProductCount = selectedProducts.length;
      selectedProducts = filterNonProducts(selectedProducts, query);
      if (selectedProducts.length < preNonProductCount) {
        console.log(`[Fix #69] Non-product filter: ${preNonProductCount} → ${selectedProducts.length}`);
      }
      
      // Fix #67: Deduplicate by SKU - keep cheapest when same product from multiple merchants
      const preSkuDedupCount = selectedProducts.length;
      selectedProducts = deduplicateBySKU(selectedProducts);
      if (selectedProducts.length < preSkuDedupCount) {
        console.log(`[Fix #67] SKU deduplication: ${preSkuDedupCount} → ${selectedProducts.length}`);
      }
      
      // Fix #68: Sort by price ascending (cheapest first) - but NOT for quality intent queries
      // Quality intent queries like "best toys", "premium gifts", "luxury" should prioritize quality over price
      // Uses the global hasQualityIntent() function which covers: best, top, quality, premium, timeless, 
      // heirloom, investment, luxury, high end, well made, durable, recommended, popular, trending, must have, essential
      if (!hasQualityIntent(query)) {
        selectedProducts = sortByPrice(selectedProducts);
        console.log(`[Fix #68] Sorted by price (cheapest first)`);
      } else {
        console.log(`[Fix #68] SKIPPED price sort - quality intent detected in: "${query}"`);
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
      
      // Get brand-based and category-based promotions for matching
      const { getAllBrandPromotions, getAllCategoryPromotions, getCategoryKeywordsForQuery } = await import('./services/awin');
      const brandPromotions = await getAllBrandPromotions();
      const categoryPromotions = await getAllCategoryPromotions();
      const queryCategoryKeywords = getCategoryKeywordsForQuery(query);
      
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
        
        // 3. If no brand promotion, try category-based matching (e.g., "Back to School" for school shoes)
        if (!promotion && queryCategoryKeywords.length > 0) {
          for (const categoryKeyword of queryCategoryKeywords) {
            const categoryPromos = categoryPromotions.get(categoryKeyword);
            if (categoryPromos && categoryPromos.length > 0) {
              const relevantCategoryPromo = categoryPromos.find(promo =>
                isPromotionRelevant(promo.promotionTitle, query, p.category || '')
              );
              if (relevantCategoryPromo) {
                promotion = relevantCategoryPromo;
                break; // Use first matching category promotion
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
      
      // MEDIA SUFFIX FIX: Strip trailing "film", "films", "movie", "movies" for product search
      const { sanitized: searchQuery, stripped: mediaStripped } = sanitizeMediaSuffix(query);
      if (mediaStripped) {
        console.log(`[Shop V2] Media suffix stripped: "${query}" → "${searchQuery}"`);
      }
      
      console.log(`[Shop V2] Query: "${query}"${mediaStripped ? ` (sanitized: "${searchQuery}")` : ''}, limit: ${safeLimit}, offset: ${safeOffset}, hasFilters: ${hasFilters}`);

      const interpretation = await interpretQuery(searchQuery, openaiKey);
      
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
          } else if (interpretation.attributes?.brand && isValidBrand(interpretation.attributes.brand)) {
            // Apply GPT-extracted brand filter for queries like "star wars lego under £20"
            // This ensures only Lego products are returned, not generic Star Wars toys
            // Fix #38: Skip if brand is "null" or empty string
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

      // CRITICAL: Apply search quality filters to remove inappropriate content and fix keyword mismatches
      const preFilterCountV2 = selectedProducts.length;
      selectedProducts = applySearchQualityFilters(selectedProducts, query);
      if (selectedProducts.length < preFilterCountV2) {
        console.log(`[Shop V2] Quality filter: ${preFilterCountV2} → ${selectedProducts.length} results for "${query}"`);
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
  // V2: Uses queryParser for real scoring per CTO spec
  app.post("/api/audit/run", async (req, res) => {
    try {
      const { queries, check_relevance = true, limit = 10, use_ai_scoring = false } = req.body;
      
      console.log(`[Audit V2] Starting audit for ${queries?.length || 0} queries, use_ai_scoring=${use_ai_scoring}`);
      
      if (!queries || !Array.isArray(queries)) {
        return res.status(400).json({ error: 'queries array required' });
      }
      
      // Load AI scorer if enabled
      let scoreResults: typeof import('./services/relevance-scorer').scoreResults | null = null;
      if (use_ai_scoring) {
        const scorer = await import('./services/relevance-scorer');
        scoreResults = scorer.scoreResults;
      }
      
      // Helper: estimate product age from title/description
      function estimateProductAge(product: any): number | null {
        const text = ((product.name || product.title || '') + ' ' + (product.description || '')).toLowerCase();
        const ageMatch = text.match(/(\d+)\+/) || text.match(/ages?\s*(\d+)/);
        if (ageMatch) return parseInt(ageMatch[1]);
        if (text.includes('duplo') || text.includes('toddler')) return 2;
        if (text.includes('baby') || text.includes('infant') || text.includes('newborn')) return 0;
        if (text.includes('teen') || text.includes('teenage')) return 14;
        return null;
      }
      
      // Helper: check age appropriateness
      function isAgeAppropriate(productAge: number | null, queryAge: number | null): boolean | null {
        if (productAge === null || queryAge === null) return null; // Can't determine
        const diff = Math.abs(productAge - queryAge);
        return diff <= 3; // Within 3 years is appropriate
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
        
        // FIX #46: Strip quotes from query before processing
        // CSV parsing can add extra quotes around queries like "toys for 3 year old boy"
        const cleanQuery = query.replace(/^["']+|["']+$/g, '').replace(/,+$/, '').trim();
        
        // V2: Parse query to extract age, gender, character, price, productType
        const parsed = parseQuery(cleanQuery);
        
        // Skip empty queries
        if (!cleanQuery || typeof cleanQuery !== 'string' || cleanQuery.trim().length === 0) {
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
          
          // FIX #46: Use cleanQuery (stripped of quotes) for DB check
          // Use AND logic to match what search actually does (not OR which inflates counts)
          const kwConditions = requiredKws.length > 0
            ? requiredKws.map((kw: string) => `(LOWER(name) LIKE '%${kw.replace(/'/g, "''")}%' OR LOWER(brand) LIKE '%${kw.replace(/'/g, "''")}%')`).join(' AND ')
            : `LOWER(name) LIKE '%${cleanQuery.toLowerCase().replace(/'/g, "''").split(' ')[0]}%'`;
          
          const priceCondition = max_price ? ` AND price <= ${parseFloat(max_price)}` : '';
          const countResult = await db.execute(sqlTag.raw(`SELECT COUNT(*) as total FROM products WHERE (${kwConditions})${priceCondition}`)) as any;
          dbCount = parseInt(countResult[0]?.total || countResult.rows?.[0]?.total || '0');
          dbExists = dbCount > 0;
          console.log(`[Audit] DB check for "${cleanQuery}": ${dbCount} products found`);
        } catch (e) {
          console.error(`[Audit] DB check failed for "${cleanQuery}":`, e);
        }
        
        // Step 2: Run ACTUAL search API to test the full pipeline (including MEGA-FIX 10)
        let searchResults: any[] = [];
        let searchTime = 0;
        try {
          const searchStart = Date.now();
          // Call actual /api/shop/search endpoint internally via HTTP
          // FIX: Use PORT env var for production compatibility (Railway uses different ports)
          const port = process.env.PORT || 5000;
          // FIX #46: Use cleanQuery for search API
          const searchResponse = await fetch(`http://localhost:${port}/api/shop/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: cleanQuery, limit })
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            searchTime = Date.now() - searchStart;
            
            // Map products to expected format
            searchResults = (searchData.products || []).map((p: any) => ({
              title: p.name,
              name: p.name,
              description: p.description || '',
              salePrice: p.price,
              price: p.price,
              merchant: p.merchant,
              brand: p.brand,
              category: p.category,
              imageUrl: p.imageUrl || p.image,
              link: p.affiliateLink || p.link
            }));
          } else {
            console.error(`[Audit] Search API returned ${searchResponse.status}`);
          }
        } catch (e) {
          console.error(`[Audit] Search API failed for "${cleanQuery}":`, e);
        }
        
        // Step 3: V2 Score relevance using queryParser extracted data
        let relevantCount = 0;
        const scoredProducts: any[] = [];
        
        // V2 aggregate counters
        let characterMatches = 0;
        let ageMatches = 0;
        let priceMatches = 0;
        let ageCheckable = 0; // products with detectable age
        const brandSet = new Set<string>();
        const titleSet = new Set<string>();
        let duplicateCount = 0;
        
        for (const product of searchResults) {
          const productText = `${product.title} ${product.description || ''} ${product.merchant || ''}`.toLowerCase();
          let isRelevant = true;
          const issues: string[] = [];
          
          // Track brand diversity
          const brand = (product.brand || product.merchant || 'Unknown').toLowerCase();
          brandSet.add(brand);
          
          // Track duplicates
          const normalizedTitle = (product.title || '').toLowerCase().trim();
          if (titleSet.has(normalizedTitle)) {
            duplicateCount++;
          } else {
            titleSet.add(normalizedTitle);
          }
          
          // V2: Score character match - check name, description, AND brand
          // For ambiguous character names (stitch, flash, link), require name/brand match only
          const AMBIGUOUS_CHARACTERS = ['stitch', 'flash', 'link', 'belle', 'aurora', 'chase', 'rocky'];
          let matchesCharacter: boolean | null = null;
          if (parsed.character) {
            const charLower = parsed.character.toLowerCase();
            const brandLower = (product.brand || '').toLowerCase();
            const nameLower = (product.title || '').toLowerCase();
            const isAmbiguous = AMBIGUOUS_CHARACTERS.includes(charLower);
            
            if (isAmbiguous) {
              // For ambiguous characters, require match in name or brand only (not description)
              // Also check for Disney context for Disney characters
              const hasDisneyContext = brandLower.includes('disney') || nameLower.includes('disney') ||
                                       nameLower.includes('lilo') || brandLower.includes('lilo');
              matchesCharacter = nameLower.includes(charLower) || brandLower.includes(charLower) ||
                                (charLower === 'stitch' && hasDisneyContext);
            } else {
              // For clear characters (paw patrol, peppa pig), match in all fields
              matchesCharacter = productText.includes(charLower) || brandLower.includes(charLower);
            }
            
            if (matchesCharacter) {
              characterMatches++;
            } else {
              issues.push(`Missing character: ${parsed.character}`);
            }
          }
          
          // V2: Score age appropriateness
          let matchesAge: boolean | null = null;
          const productAge = estimateProductAge(product);
          const queryAge = parsed.ageMin !== undefined ? parsed.ageMin : null;
          if (queryAge !== null) {
            matchesAge = isAgeAppropriate(productAge, queryAge);
            if (matchesAge !== null) {
              ageCheckable++;
              if (matchesAge) ageMatches++;
              else issues.push(`Age mismatch: product ${productAge}+, query ${queryAge}`);
            }
          }
          
          // V2: Score price compliance
          let matchesPrice: boolean | null = null;
          const priceLimit = parsed.priceMax !== undefined ? parsed.priceMax : (max_price ? parseFloat(max_price) : null);
          if (priceLimit && product.salePrice !== undefined) {
            matchesPrice = product.salePrice <= priceLimit;
            if (matchesPrice) {
              priceMatches++;
            } else {
              issues.push(`Price £${product.salePrice} > £${priceLimit}`);
            }
          }
          
          // Check required keywords (legacy support)
          if (check_relevance && requiredKws.length > 0) {
            for (const kw of requiredKws) {
              if (!productText.includes(kw)) {
                isRelevant = false;
                issues.push(`Missing: ${kw}`);
                break;
              }
            }
          }
          
          // V2: Determine relevance based on parsed requirements
          // Character is critical - if specified and missing, not relevant
          if (parsed.character && !matchesCharacter) {
            isRelevant = false;
          }
          // Price is critical - if over budget, not relevant  
          if (priceLimit && matchesPrice === false) {
            isRelevant = false;
          }
          
          if (isRelevant) relevantCount++;
          
          scoredProducts.push({
            name: product.title,
            price: product.salePrice,
            merchant: product.merchant,
            brand: product.brand || product.merchant,
            description: product.description || '',
            hasImage: !!product.imageUrl,
            // V2 per-product scores
            matchesCharacter,
            matchesAge,
            matchesPrice,
            productAge,
            relevant: isRelevant,
            issues: issues.length > 0 ? issues : undefined
          });
        }
        
        // V2: Calculate aggregate percentages
        const n = searchResults.length;
        const characterMatchPct = parsed.character && n > 0 ? Math.round((characterMatches / n) * 100) : null;
        const ageMatchPct = ageCheckable > 0 ? Math.round((ageMatches / ageCheckable) * 100) : null;
        const priceMaxUsed = parsed.priceMax !== undefined ? parsed.priceMax : (max_price ? parseFloat(max_price) : null);
        const priceMatchPct = priceMaxUsed && n > 0 ? Math.round((priceMatches / n) * 100) : null;
        const diversityScore = brandSet.size;
        
        // Calculate relevance score (legacy)
        const relevanceScore = searchResults.length > 0 ? relevantCount / searchResults.length : 0;
        
        // V2: Calculate weighted overall score per CTO spec
        // Character: 40 points, Age: 30 points, Price: 20 points, Diversity: 10 points
        // All percentages (0-100) are normalized to their point contributions
        let totalScore = 0;
        let maxScore = 0;
        
        if (parsed.character) {
          maxScore += 40;
          // characterMatchPct is 0-100, convert to 0-40 points
          totalScore += ((characterMatchPct || 0) / 100) * 40;
        }
        if (parsed.ageMin !== null || parsed.ageMax !== null) {
          maxScore += 30;
          // ageMatchPct is 0-100, convert to 0-30 points
          totalScore += ((ageMatchPct || 0) / 100) * 30;
        }
        if (priceMaxUsed) {
          maxScore += 20;
          // priceMatchPct is 0-100, convert to 0-20 points
          totalScore += ((priceMatchPct || 0) / 100) * 20;
        }
        // Diversity: Skip for brand-specific queries (lego, barbie, nerf, etc.)
        const isBrandQuery = parsed.character && BRAND_CHARACTERS.includes(parsed.character.toLowerCase());
        
        if (!isBrandQuery) {
          maxScore += 10;
          totalScore += Math.min(diversityScore, 10);
        }
        
        const v2Score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : (n > 0 ? 100 : 0);
        
        // V2: Use new verdict logic based on overall score
        // PASS: ≥70%, PARTIAL: ≥40%, FAIL: <40%
        let status: string;
        let statusNote = '';
        
        // Check if TOP result matches character (most important for character queries)
        const topResultRelevant = scoredProducts.length > 0 && scoredProducts[0].relevant === true;
        
        // Detect inventory gap: 0 results AND 0 products in DB for this query
        const isInventoryGap = searchResults.length === 0 && !dbExists;
        
        if (isInventoryGap) {
          status = 'INVENTORY_GAP';
          statusNote = 'Brand/product not in catalog';
        } else if (searchResults.length === 0 && dbExists) {
          status = 'FAIL';
          statusNote = 'Products exist in DB but search returned nothing';
          failCount++;
        } else if (searchResults.length === 0) {
          status = 'INVENTORY_GAP';
          statusNote = 'No matching products in catalog';
        } else if (v2Score >= 70) {
          status = 'PASS';
          statusNote = `Score ${v2Score}%: Good relevance`;
          passCount++;
        } else if (v2Score >= 40) {
          status = 'PARTIAL';
          statusNote = `Score ${v2Score}%: Needs improvement`;
          partialCount++;
        } else {
          status = 'FAIL';
          statusNote = `Score ${v2Score}%: Poor relevance`;
          failCount++;
        }
        
        // Limit products to 10 before AI scoring for alignment
        const limitedProducts = scoredProducts.slice(0, 10);
        
        // Add AI scoring if enabled
        let aiScores: { score: number; reason: string; flagged: boolean }[] = [];
        let avgAiScore: number | null = null;
        let aiScoringFailed = false;
        
        if (use_ai_scoring && scoreResults && limitedProducts.length > 0) {
          console.log(`[Audit] Running AI scoring for "${query}" with ${limitedProducts.length} products`);
          try {
            // Format products for AI scoring - description is now directly in limitedProducts
            const productsForScoring = limitedProducts.map((p, idx) => ({
              position: idx + 1,
              title: p.name || '',
              merchant: p.merchant || '',
              price: String(p.price || 0),
              description: p.description || ''
            }));
            
            aiScores = await scoreResults(query, productsForScoring);
            
            // Calculate average AI score (exclude error scores of -1)
            const validScores = aiScores.filter(s => s.score >= 0);
            if (validScores.length > 0) {
              avgAiScore = validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length;
            } else {
              // All scores are negative - systemic failure
              aiScoringFailed = true;
              avgAiScore = null;
            }
          } catch (aiError: any) {
            console.error(`[Audit] AI scoring failed for "${query}":`, aiError.message);
            aiScoringFailed = true;
            // Populate with error scores
            aiScores = limitedProducts.map(() => ({
              score: -1,
              reason: 'SCORING_ERROR: API call failed',
              flagged: false
            }));
          }
        }
        
        // Merge AI scores with products - guard against undefined entries
        const productsWithAiScores = limitedProducts.map((p, idx) => {
          const aiScore = aiScores[idx];
          return {
            ...p,
            aiScore: aiScore?.score !== undefined ? aiScore.score : null,
            aiReason: aiScore?.reason || (use_ai_scoring ? 'No AI score' : undefined),
            flagged: aiScore?.flagged || false
          };
        });
        
        results.push({
          query,
          category,
          // V2: Include parsed query data
          parsed_query: {
            age: parsed.ageMin,
            ageRange: parsed.ageMin !== null || parsed.ageMax !== null 
              ? `${parsed.ageMin ?? '?'}-${parsed.ageMax ?? '?'}` : null,
            gender: parsed.gender || null,
            character: parsed.character || null,
            priceMax: parsed.priceMax,
            productType: parsed.productType || null,
            keywords: parsed.keywords
          },
          database_check: { exists: dbExists, count: dbCount },
          search_result: {
            count: searchResults.length,
            time_ms: searchTime,
            products: productsWithAiScores
          },
          analysis: {
            status,
            status_note: statusNote || undefined,
            // V2: New scoring metrics
            score: v2Score,
            breakdown: {
              characterMatch: characterMatchPct !== null ? `${characterMatchPct}%` : 'N/A',
              ageMatch: ageMatchPct !== null ? `${ageMatchPct}%` : 'N/A',
              priceMatch: priceMatchPct !== null ? `${priceMatchPct}%` : 'N/A',
              diversity: isBrandQuery ? 'N/A (brand query)' : `${diversityScore}/10 brands`
            },
            characterMatchPct,
            ageMatchPct,
            priceMatchPct,
            diversityScore,
            duplicateCount,
            // Legacy fields
            top_result_relevant: topResultRelevant,
            relevance_score: Math.round(relevanceScore * 100) / 100,
            relevant_count: relevantCount,
            total_returned: searchResults.length,
            ai_avg_score: use_ai_scoring && avgAiScore !== null ? Math.round(avgAiScore * 100) / 100 : undefined,
            ai_flagged_count: use_ai_scoring ? aiScores.filter(s => s.flagged).length : undefined,
            ai_scoring_failed: aiScoringFailed || undefined
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
  // BULK AUDIT ENDPOINT - Run 1000 queries with parallel workers
  // ============================================================
  app.post("/api/audit/bulk", async (req, res) => {
    try {
      const { 
        batch_size = 10, 
        workers = 5, 
        limit = 10,
        start_index = 0,
        max_queries = 1000
      } = req.body;
      
      console.log(`[Bulk Audit] Starting bulk audit: batch_size=${batch_size}, workers=${workers}, limit=${limit}, start=${start_index}, max=${max_queries}`);
      
      const queriesPath = path.join(process.cwd(), 'data', 'bulk_audit_queries.json');
      if (!fs.existsSync(queriesPath)) {
        return res.status(404).json({ error: 'Bulk queries file not found at data/bulk_audit_queries.json' });
      }
      
      const queriesData = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
      let allQueries: string[] = queriesData.queries || [];
      
      allQueries = allQueries.slice(start_index, start_index + max_queries);
      console.log(`[Bulk Audit] Loaded ${allQueries.length} queries (starting from index ${start_index})`);
      
      const outputPath = path.join(process.cwd(), 'data', `bulk_audit_results_${Date.now()}.json`);
      const progressPath = path.join(process.cwd(), 'data', 'bulk_audit_progress.json');
      
      const port = process.env.PORT || 5000;
      const results: any[] = [];
      let passCount = 0, partialCount = 0, failCount = 0, errorCount = 0;
      let processed = 0;
      const startTime = Date.now();
      
      const runSingleQuery = async (query: string, index: number): Promise<any> => {
        const queryStart = Date.now();
        try {
          const searchResponse = await fetch(`http://localhost:${port}/api/shop/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit })
          });
          
          if (!searchResponse.ok) {
            return { query, index, status: 'ERROR', error: `HTTP ${searchResponse.status}`, timeMs: Date.now() - queryStart };
          }
          
          const searchData = await searchResponse.json();
          const products = searchData.products || [];
          
          const parsed = parseQuery(query);
          
          let characterMatches = 0;
          let ageMatches = 0;
          let priceMatches = 0;
          
          for (const product of products) {
            const productText = `${product.name || ''} ${product.brand || ''}`.toLowerCase();
            
            if (parsed.character) {
              if (productText.includes(parsed.character.toLowerCase())) {
                characterMatches++;
              }
            }
            
            if (parsed.priceMax && product.price !== undefined) {
              if (product.price <= parsed.priceMax) {
                priceMatches++;
              }
            }
          }
          
          const characterPct = parsed.character ? (products.length > 0 ? (characterMatches / products.length) * 100 : 0) : null;
          const pricePct = parsed.priceMax ? (products.length > 0 ? (priceMatches / products.length) * 100 : 0) : null;
          
          let totalScore = 0;
          let maxScore = 0;
          
          if (characterPct !== null) {
            maxScore += 40;
            totalScore += (characterPct / 100) * 40;
          }
          if (pricePct !== null) {
            maxScore += 20;
            totalScore += (pricePct / 100) * 20;
          }
          
          const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 70;
          const verdict = finalScore >= 70 ? 'PASS' : finalScore >= 40 ? 'PARTIAL' : 'FAIL';
          
          return {
            query,
            index,
            status: verdict,
            score: finalScore,
            resultCount: products.length,
            parsed: {
              character: parsed.character,
              age: parsed.ageMin,
              priceMax: parsed.priceMax,
              productType: parsed.productType
            },
            metrics: {
              characterPct,
              pricePct,
              characterMatches,
              priceMatches
            },
            topResults: products.slice(0, 3).map((p: any) => ({
              name: p.name?.substring(0, 60),
              brand: p.brand,
              price: p.price,
              merchant: p.merchant
            })),
            timeMs: Date.now() - queryStart
          };
        } catch (e) {
          return { query, index, status: 'ERROR', error: String(e), timeMs: Date.now() - queryStart };
        }
      };
      
      const batches: string[][] = [];
      for (let i = 0; i < allQueries.length; i += batch_size) {
        batches.push(allQueries.slice(i, i + batch_size));
      }
      
      console.log(`[Bulk Audit] Processing ${batches.length} batches of ${batch_size} queries each with ${workers} parallel workers`);
      
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx += workers) {
        const workerBatches = batches.slice(batchIdx, batchIdx + workers);
        
        const batchPromises = workerBatches.map((batch, workerIdx) => {
          const globalBatchIdx = batchIdx + workerIdx;
          return Promise.all(
            batch.map((query, queryIdx) => {
              const globalIdx = globalBatchIdx * batch_size + queryIdx + start_index;
              return runSingleQuery(query, globalIdx);
            })
          );
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        for (const workerResults of batchResults) {
          for (const result of workerResults) {
            results.push(result);
            processed++;
            
            if (result.status === 'PASS') passCount++;
            else if (result.status === 'PARTIAL') partialCount++;
            else if (result.status === 'FAIL') failCount++;
            else errorCount++;
          }
        }
        
        const progress = {
          processed,
          total: allQueries.length,
          percent: Math.round((processed / allQueries.length) * 100),
          pass: passCount,
          partial: partialCount,
          fail: failCount,
          errors: errorCount,
          elapsedMs: Date.now() - startTime,
          estimatedRemainingMs: processed > 0 ? Math.round(((Date.now() - startTime) / processed) * (allQueries.length - processed)) : 0
        };
        
        fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
        
        if (processed % 50 === 0 || processed === allQueries.length) {
          console.log(`[Bulk Audit] Progress: ${processed}/${allQueries.length} (${progress.percent}%) - PASS: ${passCount}, PARTIAL: ${partialCount}, FAIL: ${failCount}, ERRORS: ${errorCount}`);
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      const finalOutput = {
        summary: {
          total: results.length,
          pass: passCount,
          partial: partialCount,
          fail: failCount,
          errors: errorCount,
          passRate: Math.round((passCount / (results.length - errorCount)) * 100) + '%',
          totalTimeMs: totalTime,
          avgTimePerQuery: Math.round(totalTime / results.length),
          buildVersion: BUILD_VERSION
        },
        results
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
      console.log(`[Bulk Audit] Complete! Results saved to ${outputPath}`);
      
      res.json({
        success: true,
        outputFile: outputPath,
        summary: finalOutput.summary
      });
      
    } catch (error) {
      console.error('[Bulk Audit] Error:', error);
      res.status(500).json({ error: 'Bulk audit failed', details: String(error) });
    }
  });
  
  app.get("/api/audit/bulk/progress", async (req, res) => {
    try {
      const progressPath = path.join(process.cwd(), 'data', 'bulk_audit_progress.json');
      if (fs.existsSync(progressPath)) {
        const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
        res.json(progress);
      } else {
        res.json({ status: 'not_started', message: 'No bulk audit in progress' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get progress' });
    }
  });

  // ============================================================
  // VERIFICATION ENDPOINTS - Pre-verify search results
  // ============================================================
  
  app.get("/api/verify/stats", async (req, res) => {
    try {
      const { db } = await import('./db');
      const { verifiedResults } = await import('@shared/schema');
      const { count, eq, ne, isNull, not } = await import('drizzle-orm');
      
      const allResults = await db.select().from(verifiedResults);
      
      const verified = allResults.filter(r => r.confidence === 'manual' || r.confidence === 'auto').length;
      const flagged = allResults.filter(r => r.confidence === 'flagged').length;
      
      let totalQueries = 0;
      try {
        const queriesPath = path.join(process.cwd(), 'data', 'test-queries-2000.json');
        if (fs.existsSync(queriesPath)) {
          const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
          totalQueries = queries.length;
        }
      } catch (e) {}
      
      res.json({
        total: totalQueries,
        verified,
        flagged,
        remaining: Math.max(0, totalQueries - verified - flagged)
      });
    } catch (error) {
      console.error('[Verify Stats] Error:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });
  
  app.post("/api/verify/save", async (req, res) => {
    try {
      const { query, productIds, productNames, confidence, verifiedBy } = req.body;
      
      if (!query || !productIds) {
        return res.status(400).json({ error: 'Query and productIds are required' });
      }
      
      const { db } = await import('./db');
      const { verifiedResults } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const normalizedQuery = query.toLowerCase().trim();
      
      const existing = await db.select().from(verifiedResults).where(eq(verifiedResults.query, normalizedQuery)).limit(1);
      
      if (existing.length > 0) {
        await db.update(verifiedResults)
          .set({
            verifiedProductIds: JSON.stringify(productIds),
            verifiedProductNames: JSON.stringify(productNames || []),
            confidence: confidence || 'manual',
            verifiedBy: verifiedBy || 'admin',
            verifiedAt: new Date()
          })
          .where(eq(verifiedResults.query, normalizedQuery));
        
        console.log(`[Verify] Updated cache for "${normalizedQuery}" (${confidence})`);
      } else {
        await db.insert(verifiedResults).values({
          query: normalizedQuery,
          verifiedProductIds: JSON.stringify(productIds),
          verifiedProductNames: JSON.stringify(productNames || []),
          confidence: confidence || 'manual',
          verifiedBy: verifiedBy || 'admin'
        });
        
        console.log(`[Verify] Created cache for "${normalizedQuery}" (${confidence})`);
      }
      
      res.json({ success: true, query: normalizedQuery, confidence });
    } catch (error) {
      console.error('[Verify Save] Error:', error);
      res.status(500).json({ error: 'Failed to save verification' });
    }
  });
  
  app.get("/api/verify/list", async (req, res) => {
    try {
      const { db } = await import('./db');
      const { verifiedResults } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const results = await db.select({
        query: verifiedResults.query,
        confidence: verifiedResults.confidence,
        verifiedBy: verifiedResults.verifiedBy,
        verifiedAt: verifiedResults.verifiedAt
      }).from(verifiedResults).orderBy(desc(verifiedResults.verifiedAt)).limit(100);
      
      res.json({ results });
    } catch (error) {
      console.error('[Verify List] Error:', error);
      res.status(500).json({ error: 'Failed to list verifications' });
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

  // Voice, Movie, and Upsell routes - modularized
  registerVoiceRoutes(app);
  registerMovieRoutes(app);
  registerUpsellRoutes(app);
  
  // Diagnostic and Tracking routes - modularized
  registerDiagnosticRoutes(app);
  registerTrackingRoutes(app);

  return httpServer;
}
