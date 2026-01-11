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
import { registerDiagnosticRoutes, registerTrackingRoutes, registerAuditRoutes, registerAdminRoutes, registerLegacySearchRoutes, registerDocsRoutes, registerDebugRoutes, registerShopRoutes } from "./routes/index";

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


  // Debug routes - modularized (openai-check, db-check, promotions-stats, cj-promotions, bootstrap-status)
  registerDebugRoutes(app);



  // Admin routes - modularized (bootstrap, migration, indexes, refresh tiers, tracking)
  registerAdminRoutes(app);

  // CJ (Commission Junction) routes - modularized
  registerCJRoutes(app);

  // ============================================================
  // SIMPLE SEARCH - CTO's approach: keyword SQL + GPT reranker
  // One simple endpoint. 115k products. OpenAI picks the best.
  // ============================================================

  // Shop search routes - modularized (simple-search, shop/search, shopv2/search, shop/search-grouped)
  registerShopRoutes(app);

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

  // Sunny - AI Family Concierge chat endpoint
  app.use("/sunny", sunnyRouter);

  // Legacy search routes - modularized
  registerLegacySearchRoutes(app);

  // API documentation routes - modularized
  registerDocsRoutes(app);

  // Audit and Verify routes - modularized
  registerAuditRoutes(app);

  // Voice, Movie, and Upsell routes - modularized
  registerVoiceRoutes(app);
  registerMovieRoutes(app);
  registerUpsellRoutes(app);
  
  // Diagnostic and Tracking routes - modularized
  registerDiagnosticRoutes(app);
  registerTrackingRoutes(app);

  return httpServer;
}
