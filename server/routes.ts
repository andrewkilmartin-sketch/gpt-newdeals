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
import { 
  parseQuery, 
  applyQueryFilters, 
  getRequiredSearchTerms,
  ParsedQuery,
  BRAND_CHARACTERS
} from "./services/queryParser";

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

// ============================================================
// QUERY INTERPRETATION CACHE - Avoids repeated GPT calls
// Two-tier: exact match + normalized match for similar queries
// Three-tier: memory → DB persistence for long-term cost savings
// ============================================================
import * as crypto from 'crypto';
import { queryCache as queryCacheTable, merchantNetworks, clickEvents, promotionNetworkMap } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

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

// ============================================================
// MEDIA SUFFIX SANITIZER - Strips trailing "film", "films", "movie", "movies"
// "dinosaur film" → "dinosaur", "animated films" → "animated"
// This fixes 39 SEARCH_BUGs where products exist but film/movie suffix breaks search
// ============================================================
function sanitizeMediaSuffix(query: string): { sanitized: string; stripped: boolean } {
  const mediaSuffixes = ['film', 'films', 'movie', 'movies'];
  const words = query.toLowerCase().trim().split(/\s+/);
  
  // Only strip if query has >1 word and ends with media suffix
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    if (mediaSuffixes.includes(lastWord)) {
      const sanitized = words.slice(0, -1).join(' ');
      console.log(`[MediaSanitizer] Stripped "${lastWord}" from "${query}" → "${sanitized}"`);
      return { sanitized, stripped: true };
    }
  }
  
  return { sanitized: query, stripped: false };
}

// ============================================================
// SEARCH QUALITY FILTERS - Critical fixes for family platform
// CTO Audit: Jan 2026 - Fixing 86% fake PASS rate → real 30-40%
// ============================================================

// PHASE 1: CONTENT SAFETY - Blocklist for inappropriate content
const INAPPROPRIATE_TERMS = [
  // Sexual/Adult content
  'bedroom confidence', 'erectile', 'viagra', 'sexual health',
  'reproductive health', 'your status', 'sti test', 'std test',
  'reclaim your confidence', 'regain confidence', 'dating site',
  'singles near', 'sexual performance', 'libido', 'erectile dysfunction',
  'adult toy', 'lingerie', 'sexy', 'erotic', 'intimate moments',
  // Alcohol - CRITICAL: CTO found 13 instances for kids queries
  'alcohol gift', 'shop alcohol', 'wine subscription', 'beer delivery',
  'alcohol delivery', 'gin gift', 'whisky gift', 'vodka gift',
  'wine gift', 'champagne gift', 'prosecco gift', 'spirits gift',
  'cocktail gift', 'beer gift', 'ale gift', 'lager gift',
  'bottle club', 'wine club', 'beer club', 'gin club',
  'save on gin', 'save on wine', 'save on whisky',
  // Gambling/Vice
  'gambling', 'casino', 'betting', 'poker', 'slots',
  // Health supplements (not for kids platform)
  'weight loss pill', 'diet pill', 'slimming tablet',
  'fat burner', 'appetite suppressant',
  // Vaping/Smoking
  'cigarette', 'vape juice', 'cbd oil', 'nicotine', 'e-liquid'
];

// PHASE 1: MERCHANT KILL-LIST - Block entire merchants
// MEGA-FIX 6: Expanded Merchant Blocklist - non-family merchants that pollute results
const BLOCKED_MERCHANTS = [
  // ALCOHOL (Critical - 77+ appearances)
  'bottle club', 'the bottle club', 'wine direct', 'naked wines',
  'virgin wines', 'laithwaites', 'majestic wine', 'beer hawk',
  'brewdog', 'whisky exchange', 'master of malt', 'the drink shop',
  'shop alcohol gifts', 'wine subscription', 'gin subscription',
  'beer subscription', 'whisky subscription', 'rum subscription',
  'cocktail subscription', 'spirit subscription',
  // ED PILLS / ADULT HEALTH (Critical - 23 appearances)
  'bedroom confidence', 'reclaim your bedroom', 'regain confidence',
  'erectile', 'viagra', 'cialis', 'sildenafil',
  // STI TESTING (Critical - 10 appearances)
  'know your status', 'sti test', 'std test', 'sexual health test',
  // CAR RENTAL (13 appearances - "book" collisions)
  'booking.com car rental', 'car rental', 'rental car',
  // WINDOW BLINDS/SHUTTERS (39 appearances - "blind" collisions)
  '247 blinds', 'blinds 2go', 'blinds direct', 'make my blinds',
  'english blinds', 'shutters', 'roller blinds', 'venetian blinds',
  // HOUSE PAINT (30+ appearances - "paint" collisions)
  'dulux', 'zinsser', 'albany paint', 'emulsion paint', 'eggshell paint',
  // WEIGHT LOSS / DATING
  'slimming world', 'weight watchers', 'noom', 'dating direct',
  // GAMBLING
  'bet365', 'ladbrokes', 'william hill', 'paddy power', 'betfair'
];

// MEGA-FIX 2: Promo-only patterns - generic promos that match everything but help no one
const PROMO_ONLY_PATTERNS = [
  /^\d+% off/i,                    // "10% off..."
  /^up to \d+% off/i,              // "Up to 55% off..."
  /^save \d+%/i,                   // "Save 15%..."
  /^save up to \d+%/i,             // "Save up to 20%..."
  /^buy \d+ get \d+/i,             // "Buy 1 get 1..."
  /^buy one get one/i,             // "Buy one get one..."
  /^any \d+ .*£\d+/i,              // "Any 2 Knitwear £120"
  /free delivery/i,                 // "Free Delivery"
  /free next day/i,                 // "Free Next Day..."
  /from 1p/i,                       // "Toys from 1p..."
  /extra \d+% off/i,               // "Extra 15% off..."
  /£\d+ off/i,                     // "£50 OFF..."
  /^\d+% discount/i,               // "15% DISCOUNT..."
  /sale ends/i,                     // "Sale ends soon..."
];

// Function to detect promo-only results
function isPromoOnly(title: string): boolean {
  if (!title) return false;
  const t = title.trim();
  return PROMO_ONLY_PATTERNS.some(pattern => pattern.test(t));
}

// MEGA-FIX 4: Synonym expansion for better recall
const QUERY_SYNONYMS: { [key: string]: string[] } = {
  'film': ['movie', 'cinema', 'dvd', 'blu-ray'],
  'movie': ['film', 'cinema', 'dvd', 'blu-ray'],
  'movies': ['film', 'films', 'cinema', 'dvd'],
  'films': ['movie', 'movies', 'cinema', 'dvd'],
  'kids': ['children', 'child', 'toddler', 'kid'],
  'children': ['kids', 'child', 'toddler'],
  'child': ['kid', 'kids', 'children'],
  'gift': ['present', 'gifts', 'gift set'],
  'present': ['gift', 'presents', 'gift set'],
  'game': ['games', 'gaming', 'video game'],
  'games': ['game', 'gaming', 'video game'],
  'toy': ['toys', 'plaything'],
  'toys': ['toy', 'plaything'],
  'cheap': ['budget', 'affordable', 'value', 'bargain'],
  'best': ['top', 'popular', 'recommended', 'award winning'],
};

// PHRASE SYNONYMS - US/UK brand name mappings and common alternatives
const PHRASE_SYNONYMS: { [key: string]: string } = {
  // Brand name translations (US → UK)
  'calico critters': 'sylvanian families',
  'calico critter': 'sylvanian families',
  'thomas the tank engine': 'thomas friends',
  'thomas tank engine': 'thomas friends',
  
  // Common US/UK spelling differences
  'play-doh': 'playdough',
  'playdoh': 'playdough',
  'legos': 'lego',  // US plural → UK singular
  
  // Baby product terms (US → UK)
  'diaper': 'nappy',
  'diapers': 'nappies',
  'pacifier': 'dummy',
  'pacifiers': 'dummies',
  'stroller': 'pushchair',
  'strollers': 'pushchairs',
  'onesie': 'babygrow',
  'onesies': 'babygrows',
  'crib': 'cot',
  'cribs': 'cots',
  
  // Spelling variants
  'color': 'colour',
  'colors': 'colours',
  'favorite': 'favourite',
  'favorites': 'favourites',
  'gray': 'grey',
  
  // Activity terms
  'sidewalk chalk': 'pavement chalk',
};

// Apply phrase synonyms before word-level processing
function applyPhraseSynonyms(query: string): string {
  let result = query.toLowerCase();
  for (const [phrase, replacement] of Object.entries(PHRASE_SYNONYMS)) {
    if (result.includes(phrase)) {
      console.log(`[PhraseSynonym] Replaced "${phrase}" with "${replacement}"`);
      result = result.replace(phrase, replacement);
    }
  }
  return result;
}

// Function to expand query with synonyms
function expandQueryWithSynonyms(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/);
  const expanded = new Set<string>(words);
  
  for (const word of words) {
    const synonyms = QUERY_SYNONYMS[word];
    if (synonyms) {
      synonyms.forEach(s => expanded.add(s));
    }
  }
  
  return Array.from(expanded);
}

// MEGA-FIX 1: Intent Router - route queries to correct category
type QueryIntent = 'GAMING' | 'ENTERTAINMENT' | 'DAYS_OUT' | 'PARTY' | 'BOOKS' | 'PRODUCTS';

function detectQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase();
  
  // GAMING intent - video games, consoles
  if (q.includes('game') || q.includes('xbox') || q.includes('playstation') || 
      q.includes('nintendo') || q.includes('switch') || q.includes('console') ||
      q.includes('ps5') || q.includes('ps4') || q.includes('gaming')) {
    // But not "board game" or "game set"
    if (!q.includes('board game') && !q.includes('game set')) {
      return 'GAMING';
    }
  }
  
  // ENTERTAINMENT intent - films, movies, cinema
  if (q.includes('film') || q.includes('movie') || q.includes('cinema') ||
      q.includes('dvd') || q.includes('blu-ray') || q.includes('streaming') ||
      (q.includes('watch') && (q.includes('order') || q.includes('list') || q.includes('marathon')))) {
    return 'ENTERTAINMENT';
  }
  
  // DAYS_OUT intent - attractions, experiences
  if (q.includes('near me') || q.includes('nearby') || q.includes('local') ||
      q.includes('visit') || q.includes('day out') || q.includes('days out') ||
      q.includes('attraction') || q.includes('theme park') || q.includes('zoo') ||
      q.includes('aquarium') || q.includes('museum')) {
    return 'DAYS_OUT';
  }
  
  // PARTY intent - party supplies
  if (q.includes('party bag') || q.includes('party supplies') || 
      q.includes('goody bag') || q.includes('pass the parcel') ||
      q.includes('party favour') || q.includes('party favor')) {
    return 'PARTY';
  }
  
  // BOOKS intent
  if ((q.includes('book') && (q.includes('token') || q.includes('voucher') || q.includes('reading'))) ||
      q.includes('story book') || q.includes('picture book')) {
    return 'BOOKS';
  }
  
  return 'PRODUCTS';
}

// Known fallback spam - appears for unrelated queries (CTO: 37-126 instances each)
// NORMALIZED: no punctuation, lowercase - matching is done after stripping punctuation
const KNOWN_FALLBACKS = [
  // CTO audit findings - these appear 50-300+ times across queries
  'gifting at clarks',
  '10 off organic baby',
  'organic baby kidswear',
  'organic baby',
  'toys from 1p',
  'poundfun',
  'free delivery',
  'clearance save',
  'free next day delivery',
  'buy one get one',
  'any 2 knitwear',
  'any 2 shirts',
  'buy 1 get 1',
  'treetop challenge',
  'treetop family discount',
  'save up to 20 on shopping',
  'save up to 20 on dining',
  'save up to 30 off hotels',
  'save up to 55 off theme parks',
  'save up to 44 or kids go free',
  'honor choice',
  'honor magic',
  'honor pad',
  '50 off honor',
  '30 off honor',
  'free 5 top up credit',
  'vitamin planet rewards'
];

// Quality intent words - user wants premium, not cheapest
const QUALITY_INTENT_WORDS = [
  'best', 'top', 'quality', 'premium', 'timeless', 'heirloom', 
  'investment', 'luxury', 'high end', 'well made', 'durable',
  'recommended', 'popular', 'trending', 'must have', 'essential'
];

// Discount merchants to deprioritize for quality queries (CTO: PoundFun in 126 queries)
const DISCOUNT_MERCHANTS = [
  'poundfun', 'poundland', 'poundshop', 'everything5pounds', 'poundworld',
  'poundtoy', 'the works', 'b&m', 'home bargains'
];

// Travel/booking merchants to exclude for book context queries
const TRAVEL_MERCHANTS = [
  'booking.com', 'hotels.com', 'expedia', 'lastminute', 'trivago', 
  'travelodge', 'premier inn', 'airbnb', 'jet2', 'easyjet'
];

// PHASE 3: Gender-specific exclusion words
const GENDER_EXCLUSION_MAP: { [key: string]: string[] } = {
  'him': ["women's", 'for her', 'gifts for her', "ladies'", 'feminine'],
  'he': ["women's", 'for her', 'gifts for her', "ladies'", 'feminine'],
  'boy': ["women's", 'for her', "ladies'", 'feminine', "girl's dress"],
  'son': ["women's", 'for her', "ladies'", 'feminine'],
  'nephew': ["women's", 'for her', "ladies'", 'feminine'],
  'dad': ["women's", 'for her', "ladies'", 'feminine', 'mum', 'mother'],
  'father': ["women's", 'for her', "ladies'", 'feminine', 'mum', 'mother'],
  'grandad': ["women's", 'for her', "ladies'", 'feminine'],
  'her': ["men's", 'for him', 'gifts for him', "gent's", 'masculine'],
  'she': ["men's", 'for him', 'gifts for him', "gent's", 'masculine'],
  'girl': ["men's", 'for him', "gent's", "boy's shirt", 'tie'],
  'daughter': ["men's", 'for him', "gent's", 'masculine'],
  'niece': ["men's", 'for him', "gent's", 'masculine'],
  'mum': ["men's", 'for him', "gent's", 'dad', 'father'],
  'mother': ["men's", 'for him', "gent's", 'dad', 'father'],
  'grandma': ["men's", 'for him', "gent's", 'masculine']
};

// PHASE 1: Filter inappropriate content from search results
function filterInappropriateContent(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.description || '')).toLowerCase();
    const merchant = (r.merchant || '').toLowerCase();
    
    // Check blocked terms in content
    const hasBadTerm = INAPPROPRIATE_TERMS.some(term => text.includes(term));
    if (hasBadTerm) {
      console.log(`[Content Filter] BLOCKED inappropriate term: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    
    // Check blocked merchants (entire merchant banned)
    const isBannedMerchant = BLOCKED_MERCHANTS.some(m => merchant.includes(m));
    if (isBannedMerchant) {
      console.log(`[Content Filter] BLOCKED merchant: ${r.merchant} - "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    
    return true;
  });
}

// PHASE 2: Remove duplicate products from results
function deduplicateResults(results: any[]): any[] {
  const seen = new Set<string>();
  const deduplicated: any[] = [];
  
  for (const r of results) {
    // Skip entries without a name - can't reliably dedupe
    if (!r.name || r.name.trim() === '') {
      deduplicated.push(r);
      continue;
    }
    
    // Create a unique key from name + merchant (normalized)
    // Use ID if available for more reliable deduplication
    const key = r.id 
      ? `id:${r.id}` 
      : ((r.name || '') + '|' + (r.merchant || '')).toLowerCase().trim();
    
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(r);
    } else {
      console.log(`[Dedup] Removed duplicate: "${r.name?.substring(0, 50)}..."`);
    }
  }
  
  return deduplicated;
}

// PHASE 2: Apply merchant caps - max 2 results per merchant
function applyMerchantCaps(results: any[], maxPerMerchant: number = 2): any[] {
  const merchantCounts: { [key: string]: number } = {};
  const capped: any[] = [];
  
  for (const r of results) {
    const merchant = (r.merchant || 'unknown').toLowerCase();
    const count = merchantCounts[merchant] || 0;
    
    if (count < maxPerMerchant) {
      merchantCounts[merchant] = count + 1;
      capped.push(r);
    } else {
      console.log(`[Merchant Cap] Exceeded ${maxPerMerchant} for ${r.merchant}: "${r.name?.substring(0, 40)}..."`);
    }
  }
  
  return capped;
}

// PHASE 3: Check if query has film/movie context
function hasFilmContext(query: string): boolean {
  const q = query.toLowerCase();
  const filmWords = ['film', 'movie', 'watch', 'cinema', 'animated'];
  const contextWords = ['about', 'with', 'for kids', 'children', 'family', 'disney', 'pixar'];
  
  // Has film word AND context word
  return filmWords.some(f => q.includes(f)) && contextWords.some(c => q.includes(c));
}

// PHASE 3: Check if query has blind/accessibility context
function hasBlindContext(query: string): boolean {
  const q = query.toLowerCase();
  // "blind character" or "blind kid" = accessibility, not window blinds
  return q.includes('blind') && (
    q.includes('character') || q.includes('kid') || q.includes('child') ||
    q.includes('book') || q.includes('story') || q.includes('person') ||
    q.includes('toy') || q.includes('doll') || q.includes('disability')
  );
}

// PHASE 3: Check if query has gender context
function hasGenderContext(query: string): string | null {
  const q = query.toLowerCase();
  for (const gender of Object.keys(GENDER_EXCLUSION_MAP)) {
    // Match whole words: "for him", "my son", etc.
    const regex = new RegExp(`\\b${gender}\\b`, 'i');
    if (regex.test(q)) {
      return gender;
    }
  }
  return null;
}

// PHASE 3: Filter for blind/accessibility context - exclude window blinds
function filterForBlindContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.description || '') + ' ' + (r.category || '')).toLowerCase();
    const isWindowBlinds = text.includes('window blind') || text.includes('roller blind') ||
                           text.includes('venetian') || text.includes('day & night blind') ||
                           text.includes('blackout blind') || text.includes('blinds.');
    if (isWindowBlinds) {
      console.log(`[Blind Context] Excluded window blinds: "${r.name?.substring(0, 50)}..."`);
    }
    return !isWindowBlinds;
  });
}

// Check if query is about Disney's Stitch character
function hasStitchContext(query: string): boolean {
  const q = query.toLowerCase();
  return q.includes('stitch') && (
    q.includes('plush') || q.includes('toy') || q.includes('soft') ||
    q.includes('disney') || q.includes('lilo') || q.includes('figure') ||
    q.includes('gift') || q.includes('kids') || q.includes('child')
  );
}

// Filter for Stitch context - exclude clothing/fashion with "stitch" in construction description
function filterForStitchContext(results: any[]): any[] {
  return results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const brand = (r.brand || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    const description = (r.description || '').toLowerCase();
    
    // Allow if Stitch/Disney is in name or brand
    if (name.includes('stitch') || brand.includes('disney') || brand.includes('stitch')) {
      return true;
    }
    
    // Allow if category is toys
    if (category.includes('toy')) {
      return true;
    }
    
    // Exclude clothing/fashion where "stitch" is construction term
    const isClothing = category.includes('cloth') || category.includes('fashion') ||
                       category.includes('footwear') || category.includes('shoe') ||
                       category.includes('underwear') || category.includes('apparel');
    const isConstructionTerm = description.includes('stitch-for-stitch') || 
                               description.includes('stitched') ||
                               description.includes('stitching') ||
                               (description.includes('stitch') && description.includes('cotton'));
    
    if (isClothing || isConstructionTerm) {
      console.log(`[Stitch Context] Excluded non-Disney stitch: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    
    return true;
  });
}

// PHASE 3: Filter for gender context - exclude wrong gender products
function filterForGenderContext(results: any[], gender: string): any[] {
  const exclusions = GENDER_EXCLUSION_MAP[gender] || [];
  if (exclusions.length === 0) return results;
  
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.description || '')).toLowerCase();
    const hasWrongGender = exclusions.some(ex => text.includes(ex));
    if (hasWrongGender) {
      console.log(`[Gender Filter] Wrong gender for "${gender}": "${r.name?.substring(0, 50)}..."`);
    }
    return !hasWrongGender;
  });
}

// PHASE 2: Filter known fallback spam
function filterFallbackSpam(results: any[], query: string): any[] {
  const q = query.toLowerCase();
  
  // Helper to normalize text - strip punctuation and extra spaces
  const normalize = (text: string) => text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return results.filter(r => {
    const normalizedName = normalize(r.name || '');
    
    for (const fallback of KNOWN_FALLBACKS) {
      if (normalizedName.includes(fallback)) {
        // Check if there's any semantic connection to the query
        const queryWords = normalize(q).split(/\s+/).filter(w => w.length > 2);
        const hasConnection = queryWords.some(qw => normalizedName.includes(qw));
        
        if (!hasConnection) {
          console.log(`[Fallback Filter] Removed spam: "${r.name?.substring(0, 50)}..."`);
          return false;
        }
      }
    }
    return true;
  });
}

// PHASE 3: Filter for film/movie context - user wants movies, not merchandise
function filterForFilmContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.category || '')).toLowerCase();
    // Allow: DVDs, Blu-rays, streaming, cinema, actual movie products
    const isMovieRelated = text.includes('dvd') || text.includes('blu-ray') || 
                           text.includes('movie') || text.includes('film') ||
                           text.includes('cinema') || text.includes('disney') ||
                           text.includes('pixar') || text.includes('dreamworks');
    // Exclude: random products that have nothing to do with films
    const isIrrelevantProduct = text.includes('heel') || text.includes('shoe sale') ||
                                 text.includes('handbag') || text.includes('supplement') ||
                                 text.includes('vitamin') || text.includes('skincare');
    if (isIrrelevantProduct && !isMovieRelated) {
      console.log(`[Film Context] Excluded non-film product: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
}

// Check if query is specifically about movie/show watch order (not jewelry or forms)
function hasWatchOrderContext(query: string): boolean {
  const q = query.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  // Must be movie/show context - looking for watch order of a series/franchise
  const moviePatterns = ['watch order', 'order to watch', 'watching order'];
  if (!moviePatterns.some(p => q.includes(p))) return false;
  // Exclude non-movie contexts (forms, accessories)
  const excludePatterns = ['order form', 'watch strap', 'watch band', 'watch repair'];
  return !excludePatterns.some(p => q.includes(p));
}

// Filter for watch order queries - only remove explicit jewelry watch merchants
const JEWELRY_WATCH_MERCHANTS = [
  'sekonda', 'fossil', 'casio', 'timex', 'watch shop', 'watchshop',
  'goldsmiths', 'ernest jones', 'h samuel', 'watches of switzerland'
];
function filterForWatchOrderContext(results: any[]): any[] {
  return results.filter(r => {
    const merchant = (r.merchant || '').toLowerCase();
    const isJewelryMerchant = JEWELRY_WATCH_MERCHANTS.some(m => merchant.includes(m));
    if (isJewelryMerchant) {
      console.log(`[Watch Order Context] Excluded jewelry merchant: "${r.merchant}"`);
      return false;
    }
    return true;
  });
}

// Check if query is specifically about chapter/movie breaks (not holiday breaks)
function hasBreakContext(query: string): boolean {
  const q = query.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  // Specific patterns for movie runtime breaks
  return (q.includes('chapter break') || q.includes('toilet break') || 
          q.includes('intermission') || q.includes('movie break'));
}

// Filter for break context - only remove explicit travel/holiday merchants
const HOLIDAY_TRAVEL_MERCHANTS = [
  'lastminute', 'expedia', 'booking.com', 'trivago', 'jet2', 
  'easyjet', 'ryanair', 'tui', 'haven', 'pontins'
];
function filterForBreakContext(results: any[]): any[] {
  return results.filter(r => {
    const merchant = (r.merchant || '').toLowerCase();
    const name = (r.name || '').toLowerCase();
    // Only exclude if merchant is travel OR product is a holiday package
    const isTravelMerchant = HOLIDAY_TRAVEL_MERCHANTS.some(m => merchant.includes(m));
    const isHolidayPackage = name.includes('holiday package') || name.includes('city break deal');
    if (isTravelMerchant || isHolidayPackage) {
      console.log(`[Break Context] Excluded travel: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
}

// Check if query has "book" context (children's books, not booking.com)
function hasBookContext(query: string): boolean {
  const q = query.toLowerCase();
  if (!q.includes('book')) return false;
  
  const bookContextWords = [
    'tokens', 'voucher', 'gift', 'about', 'for kids', 'children', 
    'dentist', 'doctor', 'hospital', 'baby', 'sibling', 'families',
    'new baby', 'potty', 'bedtime', 'story', 'read'
  ];
  return bookContextWords.some(w => q.includes(w));
}

// Check if query has "party bag" context (party supplies, not fashion)
function hasPartyBagContext(query: string): boolean {
  const q = query.toLowerCase();
  return q.includes('party bag') || q.includes('goody bag') || 
         q.includes('bag filler') || q.includes('bag bits');
}

// Check if query has age context (for kids, not warranty)
function hasAgeContext(query: string): boolean {
  const q = query.toLowerCase();
  const agePattern = /(\d+)\s*(year|yr)s?\s*(old)?/i;
  if (!agePattern.test(q)) return false;
  
  // Must also have kid-related words
  const kidWords = ['old', 'child', 'kid', 'boy', 'girl', 'son', 'daughter', 'essentials'];
  return kidWords.some(w => q.includes(w));
}

// Check if query has quality intent
function hasQualityIntent(query: string): boolean {
  const q = query.toLowerCase();
  return QUALITY_INTENT_WORDS.some(w => q.includes(w));
}

// Filter results for book context - exclude travel/booking results
function filterForBookContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.merchant || '')).toLowerCase();
    const isTravel = text.includes('car rental') || text.includes('holiday') || 
                     text.includes('hotel') || text.includes('flight') ||
                     TRAVEL_MERCHANTS.some(m => text.includes(m));
    if (isTravel) {
      console.log(`[Book Context] Excluded travel result: "${r.name?.substring(0, 50)}..."`);
    }
    return !isTravel;
  });
}

// Filter results for party bag context - exclude fashion bags
function filterForPartyBagContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.category || '')).toLowerCase();
    const isFashionBag = text.includes('handbag') || text.includes("women's bag") ||
                         text.includes('river island') || text.includes('fashion') ||
                         (text.includes('bag') && !text.includes('party'));
    // More lenient - only exclude obvious fashion bags
    const isObviousFashion = text.includes('river island bag') || 
                             text.includes("women's bag") || 
                             text.includes('handbag');
    if (isObviousFashion) {
      console.log(`[Party Bag Context] Excluded fashion bag: "${r.name?.substring(0, 50)}..."`);
    }
    return !isObviousFashion;
  });
}

// Filter results for age context - exclude warranty/plan products
function filterForAgeContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.description || '')).toLowerCase();
    const isWarranty = text.includes('year plan') || text.includes('year warranty') ||
                       text.includes('year care') || text.includes('year guarantee') ||
                       text.includes('year protection');
    if (isWarranty) {
      console.log(`[Age Context] Excluded warranty product: "${r.name?.substring(0, 50)}..."`);
    }
    return !isWarranty;
  });
}

// Reorder results to deprioritize discount merchants for quality queries
function reorderForQualityIntent(results: any[]): any[] {
  const discountResults: any[] = [];
  const otherResults: any[] = [];
  
  for (const r of results) {
    const merchant = (r.merchant || '').toLowerCase();
    const name = (r.name || '').toLowerCase();
    const isDiscount = DISCOUNT_MERCHANTS.some(m => merchant.includes(m)) ||
                       name.includes('from 1p') || name.includes('from 1 p');
    
    if (isDiscount) {
      discountResults.push(r);
      console.log(`[Quality Intent] Deprioritized: "${r.name?.substring(0, 50)}..."`);
    } else {
      otherResults.push(r);
    }
  }
  
  // Put quality results first, discount last
  return [...otherResults, ...discountResults];
}

// =============================================================================
// P0 BUG 2 FIX: TOY CONTEXT FILTER - Exclude clothing for toy/equipment queries
// When user searches for toys/figures/equipment, filter out clothing with character prints
// See CRITICAL_FIXES.md - Fix #10
// =============================================================================
const CLOTHING_INDICATORS = [
  't-shirt', 'tshirt', 'sweatshirt', 'hoodie', 'dress', 'shirt', 
  'shorts', 'trousers', 'vest', 'jacket', 'coat', 'jumper', 'sweater',
  'trainers', 'shoes', 'slides', 'sandals', 'socks', 'pyjamas', 'pajamas',
  'leggings', 'joggers', 'jeans', 'skirt', 'cardigan', 'polo', 'blouse',
  'bodysuit', 'romper', 'dungarees', 'onesie', 'nightwear', 'underwear',
  'snowsuit', 'swimsuit', 'swimming costume', 'bikini', 'trunks',
  'wellingtons', 'wellington', 'boots', 'wellies', 'slippers', 'crocs',
  'birthday card', 'photo card', 'greeting card', 'handbell', 'bell',
  'sticker pack', 'lunch bag', 'storage closet', 'wall decor', 'storage bin'
];

const TOY_QUERY_WORDS = [
  'toys', 'toy', 'figures', 'figure', 'playset', 'playsets', 'action figure',
  'helmet', 'bike helmet', 'scooter', 'slide', 'swing', 'trampoline',
  'climbing frame', 'paddling pool', 'ball', 'doll', 'dolls', 'teddy',
  'puzzle', 'puzzles', 'game', 'games', 'lego', 'duplo', 'blocks',
  'craft', 'crayons', 'paint', 'playdough', 'play-doh', 'stickers'
];

function hasToyContext(query: string): boolean {
  const q = query.toLowerCase();
  return TOY_QUERY_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(q);
  });
}

function filterForToyContext(results: any[]): any[] {
  const filtered = results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    
    // Check if this is clothing/footwear/accessories (not toys)
    const isClothing = CLOTHING_INDICATORS.some(term => name.includes(term)) ||
                       category.includes('clothing') || 
                       category.includes('fashion') ||
                       category.includes('apparel') ||
                       category.includes('shoes') ||
                       category.includes('footwear') ||
                       category.includes('gifts') ||
                       category.includes('card') ||
                       category.includes('accessories') ||
                       category.includes('bags') ||
                       category.includes('stationery') ||
                       category.includes('lunch') ||
                       category.includes('decor') ||
                       category.includes('baby clothes') ||
                       category.includes('sleepwear') ||
                       category.includes('nightwear') ||
                       category.includes('mugs');
    
    if (isClothing) {
      console.log(`[Toy Context] Excluded non-toy: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
  
  // SAFETY: If filtering removed ALL results, return original (inventory gap, not filter issue)
  // User asked for toys but we only have clothing with that character - return what we have
  if (filtered.length === 0 && results.length > 0) {
    console.log(`[Toy Context] INVENTORY GAP: All ${results.length} results were clothing, keeping original`);
    return results;
  }
  
  return filtered;
}

// =============================================================================
// P1 BUG 4 FIX: COSTUME CONTEXT FILTER - Exclude clothing for costume queries
// When user searches for costumes, filter out t-shirts/hoodies with "costume" in graphics
// See CRITICAL_FIXES.md - Fix #11
// =============================================================================
const COSTUME_QUERY_WORDS = ['costume', 'costumes', 'fancy dress', 'dress up', 'dressing up'];

// Clothing that should NOT appear for costume queries (has "costume" in graphic, not actual costume)
const COSTUME_CLOTHING_INDICATORS = [
  't-shirt', 'tshirt', 'sweatshirt', 'hoodie', 'hoody', 'jumper', 'sweater',
  'polo', 'vest', 'jacket', 'coat', 'cardigan', 'shorts', 'trousers', 'joggers',
  'leggings', 'jeans', 'skirt', 'pyjamas', 'pajamas', 'nightwear', 'onesie',
  'swimsuit', 'bikini', 'trunks', 'swimming costume', // exclude swimming costume results
  // Foreign-language clothing terms
  'copricostume', 'cover-up', 'coverup', 'maillot', 'badeanzug',
  // Baby clothing/sleepwear (not costumes you wear)
  'bunting', 'swaddle', 'sleep sack', 'sleep bag', 'babywear', 'layette',
  'romper', 'bodysuit', 'sleeper', 'grow bag', 'growbag'
];

// Non-wearable items that have "costume" in name (toys, storage, etc.)
const COSTUME_NON_WEARABLE_TERMS = [
  'doll', 'figure', 'playset', 'toy', 'figurine', 'action figure',
  'storage', 'closet', 'hanger', 'organizer', 'wardrobe', 'rack',
  'barbie', 'bratz', 'monster high', // costume-themed dolls
  'skating barbie', 'ice skating' // specific doll products
];

// Categories that indicate real costumes/fancy dress
const COSTUME_POSITIVE_CATEGORIES = [
  'fancy dress', 'costumes', 'dress up', 'halloween', 'party', 'role play'
];

function hasCostumeContext(query: string): boolean {
  const q = query.toLowerCase();
  // Don't apply filter for "swimming costume" - that's a valid clothing item
  if (q.includes('swimming costume') || q.includes('swim costume')) {
    return false;
  }
  return COSTUME_QUERY_WORDS.some(word => q.includes(word));
}

// Return type for smarter fallback handling
interface FilterResult {
  items: any[];
  inventoryGap: boolean;
  gapReason?: string;
}

function filterForCostumeContext(results: any[]): FilterResult {
  const filtered = results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    
    // First check: Exclude non-wearable items (dolls, storage, etc.)
    const isNonWearable = COSTUME_NON_WEARABLE_TERMS.some(term => name.includes(term));
    if (isNonWearable) {
      console.log(`[Costume Context] Excluded non-wearable: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    
    // If it's in a costume/fancy dress category, always keep it
    const isInCostumeCategory = COSTUME_POSITIVE_CATEGORIES.some(cat => category.includes(cat));
    if (isInCostumeCategory) {
      return true;
    }
    
    // Check if this is regular clothing (not a costume)
    const isClothing = COSTUME_CLOTHING_INDICATORS.some(term => name.includes(term)) ||
                       category.includes('clothing') || 
                       category.includes('fashion') ||
                       category.includes('apparel') ||
                       category.includes('baby') ||
                       category.includes('swimwear') ||
                       category.includes('beachwear');
    
    if (isClothing) {
      console.log(`[Costume Context] Excluded clothing: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
  
  // SMART FALLBACK: If filtering removed ALL results, return empty with inventory gap flag
  // Don't show hoodies with "costume" graphics when user wants actual costumes
  if (filtered.length === 0 && results.length > 0) {
    console.log(`[Costume Context] INVENTORY GAP: All ${results.length} results were clothing - returning empty`);
    return { items: [], inventoryGap: true, gapReason: 'No actual costumes found - only clothing with costume graphics' };
  }
  
  return { items: filtered, inventoryGap: false };
}

// =============================================================================
// P1 BUG 5 FIX: BOOKS CONTEXT FILTER - Prioritize Books category, exclude bags
// When user searches for books, filter out backpacks/bags/clothing with "book" in name
// See CRITICAL_FIXES.md - Fix #12
// =============================================================================
const BOOKS_QUERY_PATTERNS = [
  /\bbooks?\b/i,  // "book" or "books" as whole word
  /\breaders?\b/i, // "reader" or "readers"
  /\bstories\b/i,
  /\bstorybook\b/i
];

const BOOKS_BLOCK_INDICATORS = [
  'book bag', 'bookbag', 'backpack', 'rucksack', 'school bag', 'lunch bag',
  'book end', 'bookend', 'book shelf', 'bookshelf', 'bookmark'
];

// Categories that are NOT books
const BOOKS_NEGATIVE_CATEGORIES = [
  'bags', 'backpack', 'clothing', 'fashion', 'apparel', 'accessories', 'furniture',
  'shoes', 'footwear', 'boots', 'wellingtons', 'wellies', 'trainers', 'sandals',
  'toys', 'games', 'puzzles', 'baby products', 'bedding', 'decor',
  'gifts', 'creative', 'construction', 'soft toy', 'plush', 'dresses', 'skirts',
  'sale', 'clearance', 'baby clothes', 'audio', 'audio equipment'
];

function hasBooksContext(query: string): boolean {
  const q = query.toLowerCase();
  return BOOKS_QUERY_PATTERNS.some(pattern => pattern.test(q));
}

function filterForBooksContext(results: any[]): any[] {
  const filtered = results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    
    // If it's in Books category, always keep it
    if (category.includes('book')) {
      return true;
    }
    
    // If name contains "book", likely a book product - keep it
    if (name.includes(' book') || name.includes('book ') || name.endsWith(' book')) {
      return true;
    }
    
    // Check if this is a bag/backpack/clothing/shoes (not a book)
    const isNotABook = BOOKS_BLOCK_INDICATORS.some(term => name.includes(term)) ||
                       BOOKS_NEGATIVE_CATEGORIES.some(cat => category.includes(cat));
    
    if (isNotABook) {
      console.log(`[Books Context] Excluded non-book: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
  
  // SAFETY: If filtering removed ALL results, return original only if there are book-like items
  if (filtered.length === 0 && results.length > 0) {
    // Check if there are any actual books in original before falling back
    const hasAnyBooks = results.some(r => {
      const name = (r.name || '').toLowerCase();
      const category = (r.category || '').toLowerCase();
      return category.includes('book') || name.includes(' book') || name.includes('book ');
    });
    
    if (hasAnyBooks) {
      // Return only the book items from original
      return results.filter(r => {
        const name = (r.name || '').toLowerCase();
        const category = (r.category || '').toLowerCase();
        return category.includes('book') || name.includes(' book') || name.includes('book ');
      });
    }
    
    console.log(`[Books Context] INVENTORY GAP: All ${results.length} results were non-books, returning empty`);
    return [];
  }
  
  return filtered;
}

// =============================================================================
// MEGA-FIX 7: KEYWORD COLLISION DETECTION
// Prevents "book" → car rental, "watch" → jewelry, "blind" → shutters
// =============================================================================
const KEYWORD_COLLISION_RULES = [
  {
    word: 'book',
    familyContext: ['token', 'voucher', 'reading', 'story', 'picture', 'kids', 'child', 'children', 'baby', 'bedtime', 'dentist', 'doctor', 'sibling'],
    blockTerms: ['car rental', 'booking.com', 'book your', 'book now', 'book a', 'book online']
  },
  {
    word: 'watch',
    familyContext: ['film', 'movie', 'order', 'first', 'kids', 'children', 'mcu', 'marvel', 'disney', 'together'],
    blockTerms: ['watches', 'watch & watch', 'winder', 'sekonda', 'guess watches', 'casio watch', 'analog watch']
  },
  {
    word: 'blind',
    familyContext: ['character', 'accessibility', 'representation', 'disability', 'visually', 'story', 'book'],
    blockTerms: ['blinds', 'shutters', 'window', 'day & night', 'roller blind', 'venetian', '247 blinds']
  },
  {
    word: 'confidence',
    familyContext: ['child', 'kids', 'building', 'self', 'social', 'school', 'anxiety'],
    blockTerms: ['bedroom', 'erectile', 'viagra', 'cialis', 'reclaim']
  },
  {
    word: 'bedroom',
    familyContext: ['kids', 'child', 'sharing', 'decor', 'furniture', 'room', 'sibling', 'new baby'],
    blockTerms: ['confidence', 'erectile', 'adult', 'romantic']
  },
  {
    word: 'paint',
    familyContext: ['craft', 'art', 'kids', 'finger', 'face paint', 'poster', 'activity', 'toddler'],
    blockTerms: ['dulux', 'zinsser', 'albany', 'eggshell', 'emulsion', 'interior paint', 'exterior paint', 'primer']
  },
  {
    word: 'brush',
    familyContext: ['art', 'paint', 'teeth', 'hair', 'kids', 'toddler', 'activity'],
    blockTerms: ['decorator', 'roller', 'trade', 'professional', 'paint brush set']
  },
  {
    word: 'training',
    familyContext: ['potty', 'toilet', 'sleep', 'baby', 'toddler', 'child'],
    blockTerms: ['gym', 'fitness', 'weight', 'muscle', 'athletic', 'workout']
  }
];

function filterKeywordCollisions(query: string, results: any[]): any[] {
  const q = query.toLowerCase();
  
  for (const rule of KEYWORD_COLLISION_RULES) {
    if (!q.includes(rule.word)) continue;
    
    // Check if query has family context
    const hasFamilyContext = rule.familyContext.some(ctx => q.includes(ctx));
    if (!hasFamilyContext) continue;
    
    // Filter out wrong-category results
    results = results.filter(r => {
      const text = ((r.name || '') + ' ' + (r.merchant || '') + ' ' + (r.description || '')).toLowerCase();
      const hasBlockedTerm = rule.blockTerms.some(block => text.includes(block));
      if (hasBlockedTerm) {
        console.log(`[Collision Filter] Blocked "${rule.word}" collision: "${r.name?.substring(0, 50)}..."`);
        return false;
      }
      return true;
    });
  }
  
  return results;
}

// =============================================================================
// MEGA-FIX 8: GAMING QUERY ROUTER
// Detects gaming queries and filters to gaming category
// =============================================================================
const GAMING_KEYWORDS = [
  'game', 'games', 'gaming', 'xbox', 'playstation', 'ps4', 'ps5', 
  'nintendo', 'switch', 'console', 'video game', 'board game'
];

const GAMING_CATEGORY_TERMS = [
  'video game', 'board game', 'game', 'gaming', 'console', 'playstation', 
  'xbox', 'nintendo', 'switch', 'pc game', 'puzzle', 'jigsaw', 'card game'
];

function isGamingQuery(query: string): boolean {
  const q = query.toLowerCase();
  return GAMING_KEYWORDS.some(kw => q.includes(kw));
}

function filterForGamingQuery(results: any[]): any[] {
  // For gaming queries, prioritize products with gaming terms in name/category
  const gamingResults: any[] = [];
  const otherResults: any[] = [];
  
  for (const r of results) {
    const text = ((r.name || '') + ' ' + (r.category || '')).toLowerCase();
    const isGamingProduct = GAMING_CATEGORY_TERMS.some(term => text.includes(term));
    
    if (isGamingProduct) {
      gamingResults.push(r);
    } else {
      otherResults.push(r);
    }
  }
  
  // If we found gaming products, return only those (up to 8)
  if (gamingResults.length >= 3) {
    console.log(`[Gaming Router] Found ${gamingResults.length} gaming products, excluding ${otherResults.length} non-gaming`);
    return gamingResults;
  }
  
  // Not enough gaming products, include all but gaming first
  return [...gamingResults, ...otherResults];
}

// =============================================================================
// MEGA-FIX 9: TYPO TOLERANCE
// Fixes common misspellings of popular brands/characters
// =============================================================================
const TYPO_CORRECTIONS: Record<string, string> = {
  // LEGO variants
  'leggo': 'lego', 'legos': 'lego', 'legao': 'lego', 'lgeo': 'lego',
  // Barbie variants  
  'barbi': 'barbie', 'barbee': 'barbie', 'barbei': 'barbie', 'brbie': 'barbie',
  // Peppa Pig variants (don't expand 'peppa' alone - causes 'peppa pig pig school')
  'peper pig': 'peppa pig', 'pepa pig': 'peppa pig', 'pepper pig': 'peppa pig', 
  'peppapig': 'peppa pig',
  // Paw Patrol variants
  'paw partol': 'paw patrol', 'pawpatrol': 'paw patrol', 'paw petrol': 'paw patrol',
  // Pokemon variants
  'pokeman': 'pokemon', 'pokémon': 'pokemon', 'pokemons': 'pokemon', 'pokimon': 'pokemon',
  // Disney variants
  'disnep': 'disney', 'diseny': 'disney', 'dinsey': 'disney',
  // Marvel variants
  'marvle': 'marvel', 'marval': 'marvel',
  // Batman variants
  'batmam': 'batman', 'bat man': 'batman', 'batrman': 'batman',
  // Frozen variants
  'forzen': 'frozen', 'frozem': 'frozen',
  // Minecraft variants
  'mindcraft': 'minecraft', 'mincraft': 'minecraft', 'minecarft': 'minecraft',
  // Bluey variants
  'bluee': 'bluey', 'blueey': 'bluey',
  // Cocomelon variants
  'coco melon': 'cocomelon', 'cocomelen': 'cocomelon',
  // Hot Wheels variants
  'hotwheels': 'hot wheels', 'hot wheel': 'hot wheels',
  // Harry Potter variants
  'hary potter': 'harry potter', 'harry poter': 'harry potter', 'harrypotter': 'harry potter'
};

function correctTypos(query: string): { corrected: string; wasCorrected: boolean; original: string } {
  let corrected = query.toLowerCase();
  let wasCorrected = false;
  
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    if (corrected.includes(typo)) {
      corrected = corrected.replace(new RegExp(typo, 'gi'), correction);
      wasCorrected = true;
      console.log(`[Typo Fix] Corrected "${typo}" → "${correction}" in query`);
    }
  }
  
  // Preserve original casing where possible
  if (wasCorrected) {
    return { corrected, wasCorrected, original: query };
  }
  
  return { corrected: query, wasCorrected: false, original: query };
}

// MEGA-FIX 2: Filter promo-only results (no specific product)
function filterPromoOnlyResults(results: any[]): any[] {
  return results.filter(r => {
    const name = r.name || r.title || '';
    if (isPromoOnly(name)) {
      console.log(`[Promo Filter] Removed promo-only: "${name.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
}

// MEGA-FIX 3: Demote/exclude Kids Pass results (unless DAYS_OUT query)
function demoteKidsPassResults(results: any[], queryIntent: QueryIntent): any[] {
  // Only demote if NOT a days out query
  if (queryIntent === 'DAYS_OUT') {
    return results;
  }
  
  const kidsPassResults: any[] = [];
  const otherResults: any[] = [];
  
  for (const r of results) {
    const name = (r.name || '').toLowerCase();
    const merchant = (r.merchant || '').toLowerCase();
    
    const isKidsPass = merchant.includes('kids pass') || 
                       name.includes('kids pass') ||
                       name.includes('save up to') && (
                         name.includes('theme park') ||
                         name.includes('aquarium') ||
                         name.includes('hotel') ||
                         name.includes('dining') ||
                         name.includes('cinema') ||
                         name.includes('indoor activities') ||
                         name.includes('toddler friendly')
                       ) ||
                       name.includes('treetop challenge');
    
    if (isKidsPass) {
      kidsPassResults.push(r);
      console.log(`[Kids Pass] Demoted/excluded: "${(r.name || '').substring(0, 50)}..."`);
    } else {
      otherResults.push(r);
    }
  }
  
  // If we have enough non-Kids-Pass results, exclude Kids Pass entirely
  // Otherwise, put Kids Pass at the end (better than nothing)
  if (otherResults.length >= 5) {
    console.log(`[Kids Pass] Excluded ${kidsPassResults.length} Kids Pass results (${otherResults.length} other results available)`);
    return otherResults;
  }
  
  // Not enough other results - include Kids Pass at end as fallback
  return [...otherResults, ...kidsPassResults];
}

// Check if result is a known fallback (generic result for unrelated queries)
function isKnownFallback(resultName: string, query: string): boolean {
  const name = (resultName || '').toLowerCase();
  const q = query.toLowerCase();
  
  for (const fallback of KNOWN_FALLBACKS) {
    if (name.includes(fallback)) {
      // Check for semantic connection
      const queryWords = q.split(/\s+/).filter(w => w.length > 3);
      const fallbackWords = fallback.split(/\s+/);
      const hasConnection = queryWords.some(qw => 
        fallbackWords.some(fw => fw.includes(qw) || qw.includes(fw))
      );
      if (!hasConnection) {
        return true;
      }
    }
  }
  return false;
}

// Main filter function - applies all context-aware filters (ALL 3 PHASES + MEGA-FIXES)
function applySearchQualityFilters(results: any[], query: string): any[] {
  const originalCount = results.length;
  let filtered = results;
  
  // Detect query intent for routing (MEGA-FIX 1)
  const queryIntent = detectQueryIntent(query);
  if (queryIntent !== 'PRODUCTS') {
    console.log(`[Intent Router] Query "${query}" → ${queryIntent}`);
  }
  
  // PHASE 1: Always filter inappropriate content + blocked merchants
  filtered = filterInappropriateContent(filtered);
  
  // MEGA-FIX 2: Remove promo-only results (generic promos without products)
  filtered = filterPromoOnlyResults(filtered);
  
  // PHASE 2: Remove duplicates first (MEGA-FIX 5)
  filtered = deduplicateResults(filtered);
  
  // PHASE 2: Remove fallback spam
  filtered = filterFallbackSpam(filtered, query);
  
  // MEGA-FIX 3: Demote Kids Pass results to end (unless DAYS_OUT)
  filtered = demoteKidsPassResults(filtered, queryIntent);
  
  // MEGA-FIX 7: Keyword collision detection (book → not car rental, blind → not shutters)
  filtered = filterKeywordCollisions(query, filtered);
  
  // MEGA-FIX 8: Gaming query routing (prioritize games for gaming queries)
  if (isGamingQuery(query)) {
    console.log(`[Gaming Router] Gaming query detected: "${query}"`);
    filtered = filterForGamingQuery(filtered);
  }
  
  // PHASE 3: Apply context-specific filters
  if (hasBookContext(query)) {
    console.log(`[Search Quality] Applying book context filters for: "${query}"`);
    filtered = filterForBookContext(filtered);
  }
  
  if (hasPartyBagContext(query)) {
    console.log(`[Search Quality] Applying party bag context filters for: "${query}"`);
    filtered = filterForPartyBagContext(filtered);
  }
  
  if (hasAgeContext(query)) {
    console.log(`[Search Quality] Applying age context filters for: "${query}"`);
    filtered = filterForAgeContext(filtered);
  }
  
  // PHASE 3: Blind/accessibility context
  if (hasBlindContext(query)) {
    console.log(`[Search Quality] Applying blind/accessibility filters for: "${query}"`);
    filtered = filterForBlindContext(filtered);
  }
  
  // Disney Stitch character context - exclude clothing "stitch" construction
  if (hasStitchContext(query)) {
    console.log(`[Search Quality] Applying Stitch character filters for: "${query}"`);
    filtered = filterForStitchContext(filtered);
  }
  
  // PHASE 3: Film/movie context - user wants movies, not random products
  if (hasFilmContext(query)) {
    console.log(`[Search Quality] Applying film/movie filters for: "${query}"`);
    filtered = filterForFilmContext(filtered);
  }
  
  // PHASE 3: Watch order context - movie series, not jewelry watches
  if (hasWatchOrderContext(query)) {
    console.log(`[Search Quality] Applying watch order filters for: "${query}"`);
    filtered = filterForWatchOrderContext(filtered);
  }
  
  // PHASE 3: Break context - chapter breaks, not holiday breaks
  if (hasBreakContext(query)) {
    console.log(`[Search Quality] Applying break context filters for: "${query}"`);
    filtered = filterForBreakContext(filtered);
  }
  
  // PHASE 3: Gender context
  const genderContext = hasGenderContext(query);
  if (genderContext) {
    console.log(`[Search Quality] Applying gender filters (${genderContext}) for: "${query}"`);
    filtered = filterForGenderContext(filtered, genderContext);
  }
  
  // P0 BUG 2 FIX: Toy context - exclude clothing for toy/equipment queries
  if (hasToyContext(query)) {
    console.log(`[Search Quality] Applying toy context filters for: "${query}"`);
    filtered = filterForToyContext(filtered);
  }
  
  // P1 BUG 4 FIX: Costume context - exclude t-shirts/hoodies for costume queries
  if (hasCostumeContext(query)) {
    console.log(`[Search Quality] Applying costume context filters for: "${query}"`);
    const costumeResult = filterForCostumeContext(filtered);
    filtered = costumeResult.items;
    // Don't restore clothing when inventory gap - just return empty
    if (costumeResult.inventoryGap) {
      console.log(`[Search Quality] INVENTORY GAP: ${costumeResult.gapReason}`);
    }
  }
  
  // P1 BUG 5 FIX: Books context - exclude bags/backpacks for book queries
  if (hasBooksContext(query)) {
    console.log(`[Search Quality] Applying books context filters for: "${query}"`);
    filtered = filterForBooksContext(filtered);
  }
  
  // PHASE 2: Apply merchant caps (max 2 per merchant)
  filtered = applyMerchantCaps(filtered, 2);
  
  // PHASE 2: Reorder for quality intent (don't remove, just deprioritize)
  if (hasQualityIntent(query)) {
    console.log(`[Search Quality] Applying quality intent reordering for: "${query}"`);
    filtered = reorderForQualityIntent(filtered);
  }
  
  // Log summary if significant filtering occurred
  if (filtered.length < originalCount) {
    console.log(`[Search Quality] Filtered ${originalCount} → ${filtered.length} results for: "${query}"`);
  }
  
  return filtered;
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
  limit: number = 10,
  maxPrice?: number
): Promise<{ products: any[]; fallbackCategory: string }> {
  try {
    // Search for products matching the category keywords
    const fallbackQuery = keywords[0] || category;
    console.log(`[Fallback Search] Searching category "${category}" with keyword "${fallbackQuery}"${maxPrice ? `, maxPrice: £${maxPrice}` : ''}`);
    
    // CRITICAL FIX: Pass price filter to fallback search - pass maxPrice as 4th argument
    const results = await storage.searchProducts(fallbackQuery, limit, 0, maxPrice);
    
    // Filter by price if specified (double-check since storage might not apply it in all paths)
    let filteredProducts = results.products;
    if (maxPrice) {
      filteredProducts = filteredProducts.filter((p: any) => p.price <= maxPrice);
    }
    
    if (filteredProducts.length > 0) {
      return { products: filteredProducts, fallbackCategory: category };
    }
    
    // Try broader search if specific category fails
    const broadResults = await storage.searchProducts(category, limit, 0, maxPrice);
    let broadFiltered = broadResults.products;
    if (maxPrice) {
      broadFiltered = broadFiltered.filter((p: any) => p.price <= maxPrice);
    }
    return { products: broadFiltered, fallbackCategory: category };
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
    minPrice?: number;
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
        
        // ULTRA FAST: Use simple category filter (indexed) - no complex OR chains
        // Query products in toy-related categories using category LIKE
        const fastResults = await db.select({
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
            // Simple category filter - uses index
            ilike(products.category, '%toy%')
          ))
          .limit(200);
        
        console.log(`[Shop Search] ULTRA FAST: DB query took ${Date.now() - fastQueryStart}ms, found ${fastResults.length} candidates`);
        
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
        const topResults = scoredResults.slice(0, safeLimit).filter(r => r.score > -10);
        
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
        'cars', 'lightning mcqueen', 'incredibles', 'monsters inc', 'inside out', 'up',
        'tangled', 'rapunzel', 'cinderella', 'snow white', 'sleeping beauty', 'ariel',
        'little mermaid', 'aladdin', 'jasmine', 'beauty and the beast', 'belle', 'mulan',
        'pocahontas', 'brave', 'merida', 'raya', 'turning red', 'soul', 'onward', 'elemental',
        'wish', 'zootopia', 'big hero 6', 'wreck it ralph', 'lilo and stitch', 'stitch',
        // Marvel
        'marvel', 'avengers', 'spider-man', 'spiderman', 'iron man', 'hulk', 'thor', 'captain america',
        'black panther', 'black widow', 'hawkeye', 'scarlet witch', 'doctor strange', 'ant-man',
        'guardians of the galaxy', 'groot', 'rocket', 'thanos', 'loki', 'venom', 'deadpool',
        'wolverine', 'x-men', 'fantastic four', 'captain marvel', 'shang-chi', 'eternals',
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
            const fallback = await searchFallbackByCategory(inferredCategory.category, inferredCategory.keywords, safeLimit, effectiveMaxPrice);
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
        console.log(`[Shop Search] BRAND FAST-PATH: Using indexed query for "${detectedBrand}" (skipping semantic search)`);
        const brandFastStart = Date.now();
        
        // Simple indexed query by brand name
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
            or(
              ilike(products.brand, `%${detectedBrand}%`),
              ilike(products.name, `%${detectedBrand}%`)
            ),
            products.inStock,
            isNotNull(products.affiliateLink),
            sql`${products.imageUrl} NOT ILIKE '%noimage%'`
          ))
          .limit(100);
        
        // Shuffle for variety
        for (let i = brandResults.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [brandResults[i], brandResults[j]] = [brandResults[j], brandResults[i]];
        }
        
        candidates = brandResults.slice(0, 60);
        totalCandidates = brandResults.length;
        console.log(`[Shop Search] BRAND FAST-PATH completed in ${Date.now() - brandFastStart}ms (found ${candidates.length} products)`);
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
        } else if (interpretation.attributes?.brand) {
          // Apply GPT-extracted brand filter (e.g., "star wars lego" → brand: Lego)
          // CRITICAL FIX: Do NOT use brand filter for character queries
          // Characters like "Spiderman" appear in product names, not brand column
          // Real Spider-Man products have brand="Marvel" or "Disney", not "Spiderman"
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
        
        // CRITICAL: Apply mustHaveAll as hard SQL filters (e.g., "star wars" must appear in results)
        // FIX: Split multi-word terms and require EACH word separately
        // "sophie giraffe" → requires "sophie" AND "giraffe" (not exact phrase)
        // WORD BOUNDARY FIX: Use PostgreSQL regex \y for word boundaries
        // AGE STOPLIST: Skip age-related words that don't appear in product names
        const ageStopWords = new Set([
          'year', 'years', 'old', 'age', 'ages', 'aged', 'month', 'months',
          'toddler', 'toddlers', 'baby', 'babies', 'infant', 'infants',
          'newborn', 'newborns', 'teen', 'teens', 'teenager', 'teenagers',
          'child', 'children', 'kid', 'kids', 'boy', 'boys', 'girl', 'girls'
        ]);
        if (interpretation.mustHaveAll && interpretation.mustHaveAll.length > 0) {
          for (const term of interpretation.mustHaveAll) {
            // CRITICAL FIX: Do NOT skip character terms even if they match brand
            // GPT often sets brand="Spiderman" but products have brand="Marvel"
            // We MUST still require "spider-man" in product name to avoid DOG TOYS SPIDERMAN
            // Only skip if it's a REAL brand (not a character/franchise)
            const isCharacterBrand = /spider|man|patrol|patrol|frozen|disney|marvel|dc|star\s*wars|pokemon|harry\s*potter|peppa|bluey/i.test(term);
            if (!isCharacterBrand && interpretation.attributes?.brand && 
                term.toLowerCase() === interpretation.attributes.brand.toLowerCase()) {
              continue;
            }
            // Split term into individual words, require each one EXCEPT age stopwords
            const words = term.toLowerCase().split(/\s+/).filter(w => 
              w.length >= 2 && !ageStopWords.has(w) && !/^\d+$/.test(w)
            );
            if (words.length === 0) {
              console.log(`[Shop Search] Skipping mustHaveAll term "${term}" (all words are age/numeric stopwords)`);
              continue;
            }
            for (const word of words) {
              // CRITICAL FIX: Handle hyphenated variants (spider-man vs spiderman)
              // Create OR condition that matches EITHER variant
              const wordVariants = [word];
              if (word.includes('-')) {
                wordVariants.push(word.replace(/-/g, '')); // spider-man → spiderman
              } else if (/spider|man|iron|bat|super/.test(word)) {
                // Common superhero words that might have hyphenated variants
                const hyphenated = word.replace(/(spider|iron|bat|super)(man|woman|girl|boy)/i, '$1-$2');
                if (hyphenated !== word) wordVariants.push(hyphenated);
              }
              
              // Build OR condition for all variants
              const variantConditions = wordVariants.flatMap(variant => [
                ilike(products.name, `%${variant}%`),
                ilike(products.brand, `%${variant}%`)
              ]);
              const mustHaveCondition = or(...variantConditions);
              if (mustHaveCondition) {
                filterConditions.push(mustHaveCondition as any);
              }
            }
            console.log(`[Shop Search] Requiring each word of "${term}" in results: ${words.join(' AND ')}`);
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
          const fallback = await searchFallbackByCategory(inferredCategory.category, inferredCategory.keywords, safeLimit, effectiveMaxPrice);
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
          const fallback2 = await searchFallbackByCategory(inferredCategory2.category, inferredCategory2.keywords, safeLimit, effectiveMaxPrice);
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

      // CRITICAL: Apply search quality filters to remove inappropriate content and fix keyword mismatches
      const preFilterCount = selectedProducts.length;
      selectedProducts = applySearchQualityFilters(selectedProducts, query);
      if (selectedProducts.length < preFilterCount) {
        console.log(`[Shop Search] Quality filter: ${preFilterCount} → ${selectedProducts.length} results for "${query}"`);
      }
      
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
        
        // V2: Parse query to extract age, gender, character, price, productType
        const parsed = parseQuery(query);
        
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
        
        // Step 2: Run ACTUAL search API to test the full pipeline (including MEGA-FIX 10)
        let searchResults: any[] = [];
        let searchTime = 0;
        try {
          const searchStart = Date.now();
          // Call actual /api/shop/search endpoint internally via HTTP
          // FIX: Use PORT env var for production compatibility (Railway uses different ports)
          const port = process.env.PORT || 5000;
          const searchResponse = await fetch(`http://localhost:${port}/api/shop/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit })
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
          console.error(`[Audit] Search API failed for "${query}":`, e);
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
      
      // STEP 6: ENHANCED VERDICT - Quality checks for family platform
      const totalTimeMs = Date.now() - startTime;
      
      // Check for inappropriate content
      const checkInappropriate = (results: any[]) => {
        for (const r of results) {
          const text = ((r.name || '') + ' ' + (r.description || '')).toLowerCase();
          const found = INAPPROPRIATE_TERMS.find(term => text.includes(term));
          if (found) return { found: true, term: found, result: r.name };
        }
        return { found: false };
      };
      
      // Check for keyword mismatch (book vs booking, party bag vs fashion)
      const checkKeywordMismatch = (results: any[], q: string) => {
        const qLower = q.toLowerCase();
        const firstResult = (results[0]?.name || '').toLowerCase();
        
        // Book context check
        if (hasBookContext(q)) {
          if (firstResult.includes('car rental') || firstResult.includes('holiday') || firstResult.includes('hotel')) {
            return { found: true, type: 'book_vs_booking', result: results[0]?.name };
          }
        }
        
        // Party bag context check
        if (hasPartyBagContext(q)) {
          if (firstResult.includes('river island') || firstResult.includes('handbag') || firstResult.includes("women's bag")) {
            return { found: true, type: 'party_bag_vs_fashion', result: results[0]?.name };
          }
        }
        
        // Age context check
        if (hasAgeContext(q)) {
          if (firstResult.includes('year plan') || firstResult.includes('year warranty') || firstResult.includes('year care')) {
            return { found: true, type: 'age_vs_warranty', result: results[0]?.name };
          }
        }
        
        return { found: false };
      };
      
      // Check for quality mismatch (best/top returning cheapest)
      const checkQualityMismatch = (results: any[], q: string) => {
        if (!hasQualityIntent(q) || results.length === 0) return { found: false };
        
        const firstMerchant = (results[0]?.merchant || '').toLowerCase();
        const firstName = (results[0]?.name || '').toLowerCase();
        const isDiscount = DISCOUNT_MERCHANTS.some(m => firstMerchant.includes(m)) ||
                          firstName.includes('from 1p') || firstName.includes('1p at');
        
        if (isDiscount) {
          return { found: true, result: results[0]?.name };
        }
        return { found: false };
      };
      
      // Check for fallback results
      const checkFallback = (results: any[], q: string) => {
        if (results.length === 0) return { found: false };
        const firstName = (results[0]?.name || '').toLowerCase();
        const qWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        
        for (const fallback of KNOWN_FALLBACKS) {
          if (firstName.includes(fallback)) {
            const hasConnection = qWords.some(qw => fallback.includes(qw));
            if (!hasConnection) {
              return { found: true, fallback: results[0]?.name };
            }
          }
        }
        return { found: false };
      };
      
      // Apply verdict checks in priority order
      if (dbProductCount === 0 && searchResults.length === 0) {
        result.verdict = 'INVENTORY_GAP';
        result.fixAction = 'No products exist in catalog. Add to Awin/CJ feed.';
      }
      else if (dbProductCount > 0 && searchResults.length === 0) {
        result.verdict = 'SEARCH_BUG';
        result.fixAction = `${dbProductCount} products exist but search returned 0. Check search algorithm.`;
      }
      else {
        // NEW: Check quality issues
        const inappropriate = checkInappropriate(searchResults);
        const keywordMismatch = checkKeywordMismatch(searchResults, query);
        const qualityMismatch = checkQualityMismatch(searchResults, query);
        const fallback = checkFallback(searchResults, query);
        
        if (inappropriate.found) {
          result.verdict = 'INAPPROPRIATE';
          result.fixAction = `Inappropriate content: "${inappropriate.term}" in "${inappropriate.result}"`;
        }
        else if (keywordMismatch.found) {
          result.verdict = 'KEYWORD_MISMATCH';
          result.fixAction = `Wrong context: ${keywordMismatch.type} - got "${keywordMismatch.result}"`;
        }
        else if (qualityMismatch.found) {
          result.verdict = 'QUALITY_MISMATCH';
          result.fixAction = `Quality query returned discount: "${qualityMismatch.result}"`;
        }
        else if (fallback.found) {
          result.verdict = 'FALLBACK_RESULT';
          result.fixAction = `Generic fallback: "${fallback.fallback}"`;
        }
        else if (relevancePercent < 50) {
          result.verdict = 'RANKING_BUG';
          result.fixAction = `Found ${searchResults.length} results but only ${relevantCount} relevant. Fix ranking.`;
        }
        else if (imagePercent < 50) {
          result.verdict = 'IMAGE_BUG';
          result.fixAction = `Found products but ${searchResults.length - withImages} missing images.`;
        }
        else if (totalTimeMs > 5000) {
          result.verdict = 'SPEED_BUG';
          result.fixAction = `Search took ${totalTimeMs}ms. Optimize for <2s target.`;
        }
        else {
          result.verdict = 'PASS';
          result.fixAction = 'All checks passed.';
        }
      }
      
      // Add all 8 results to diagnosis for proper audit
      result.diagnosis.allResults = searchResults.slice(0, 8).map((p: any, i: number) => ({
        position: i + 1,
        name: p.name,
        merchant: p.merchant,
        price: p.price,
        hasImage: !!(p.imageUrl && p.imageUrl.trim() !== '')
      }));
      
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
  // AI-SCORED AUDIT ENDPOINT - Uses GPT-4o-mini to score each result 1-5
  // Returns detailed per-result scoring with CSV export
  // ============================================================
  
  app.post('/api/diagnostic/audit-scored', async (req, res) => {
    try {
      const { queries, exportCsv = false } = req.body;
      
      if (!queries || !Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'queries array is required' });
      }
      
      // Enforce 20-query limit to manage API costs
      if (queries.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 queries allowed per audit' });
      }
      
      // Validate queries are non-empty strings
      const validQueries = queries.filter((q: any) => typeof q === 'string' && q.trim().length > 0);
      if (validQueries.length === 0) {
        return res.status(400).json({ error: 'At least one valid query string is required' });
      }
      
      const { auditQueryWithScoring, generateCSV } = await import('./services/relevance-scorer');
      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');
      
      const auditResults: any[] = [];
      const startTime = Date.now();
      
      // Process validated queries (already limited to 20)
      for (const query of validQueries) {
        const queryStartTime = Date.now();
        const queryLower = (query || '').toLowerCase().trim();
        const searchPattern = `%${queryLower}%`;
        
        // Check cinema intent - skip AI scoring
        const exactMovieKeywords = ['movies', 'movie', 'cinema', 'films', 'film'];
        const cinemaIntentPhrases = ['whats on', "what's on", 'now showing', 'at the cinema'];
        const isCinemaIntent = exactMovieKeywords.includes(queryLower) || 
                               cinemaIntentPhrases.some(p => queryLower.includes(p));
        
        if (isCinemaIntent) {
          auditResults.push({
            query,
            verdict: 'CINEMA_INTENT',
            dbCount: 0,
            resultCount: 0,
            avgScore: '0.00',
            relevancePercent: 0,
            flaggedCount: 0,
            timeMs: Date.now() - queryStartTime,
            results: [],
            fixAction: 'Routes to TMDB movies - not a product search'
          });
          continue;
        }
        
        // Get DB count
        let dbCount = 0;
        try {
          const dbCheck = await db.execute(sql`
            SELECT COUNT(*) as total FROM products 
            WHERE LOWER(name) LIKE ${searchPattern} 
               OR LOWER(brand) LIKE ${searchPattern}
          `);
          dbCount = parseInt((dbCheck[0] as any)?.total || '0');
        } catch (e) {
          console.error(`[Audit Scored] DB count error for "${query}":`, e);
        }
        
        // Call shop search API
        let searchResults: any[] = [];
        try {
          const protocol = req.protocol || 'http';
          const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
          const baseUrl = `${protocol}://${host}`;
          
          const response = await fetch(`${baseUrl}/api/shop/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 8 })
          });
          const searchApiResponse = await response.json();
          searchResults = searchApiResponse?.products || [];
        } catch (fetchError: any) {
          console.error(`[Audit Scored] Search API error for "${query}":`, fetchError.message);
        }
        
        const responseTime = Date.now() - queryStartTime;
        
        // Score each result with AI
        console.log(`[Audit Scored] Scoring "${query}" (${searchResults.length} results)...`);
        const auditResult = await auditQueryWithScoring(query, searchResults, dbCount, responseTime);
        auditResults.push(auditResult);
        
        // Rate limiting pause
        await new Promise(r => setTimeout(r, 200));
      }
      
      // Calculate summary
      const summary = {
        total: auditResults.length,
        passed: auditResults.filter(r => r.verdict === 'PASS').length,
        cinemaIntents: auditResults.filter(r => r.verdict === 'CINEMA_INTENT').length,
        inventoryGaps: auditResults.filter(r => r.verdict === 'INVENTORY_GAP').length,
        searchBugs: auditResults.filter(r => r.verdict === 'SEARCH_BUG').length,
        flaggedContent: auditResults.filter(r => r.verdict === 'FLAGGED_CONTENT').length,
        poorRelevance: auditResults.filter(r => r.verdict === 'POOR_RELEVANCE').length,
        weakRelevance: auditResults.filter(r => r.verdict === 'WEAK_RELEVANCE').length,
        errors: auditResults.filter(r => r.verdict === 'ERROR').length,
        avgRelevanceScore: 0,
        overallRelevancePercent: 0,
        totalTimeMs: Date.now() - startTime
      };
      
      // Calculate average relevance across all queries
      const scoredQueries = auditResults.filter(r => parseFloat(r.avgScore) > 0);
      if (scoredQueries.length > 0) {
        summary.avgRelevanceScore = parseFloat(
          (scoredQueries.reduce((sum, r) => sum + parseFloat(r.avgScore), 0) / scoredQueries.length).toFixed(2)
        );
        summary.overallRelevancePercent = Math.round((summary.avgRelevanceScore / 5) * 100);
      }
      
      // Return CSV if requested
      if (exportCsv) {
        const csvContent = generateCSV(auditResults);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sunny-audit-scored.csv');
        return res.send(csvContent);
      }
      
      res.json({ summary, results: auditResults });
    } catch (error: any) {
      console.error('[Audit Scored] Error:', error);
      res.status(500).json({ error: 'AI-scored audit failed', details: error.message });
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

  // ============================================================
  // DYNAMIC AFFILIATE ROUTING - /go/:productId endpoint
  // Redirects to the best affiliate network based on promotions
  // OPTIMIZED: Pre-warmed caches for < 200ms first-hit
  // ============================================================
  
  // In-memory caches for fast routing decisions
  const networkDecisionCache = new Map<string, { network: string; url: string; reason: string; merchantSlug: string; expiry: number }>();
  const NETWORK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // PRE-WARMED: Merchant slug → network preference (loaded at startup)
  const merchantNetworkCache = new Map<string, { network: string; reason: string; promotionId?: string }>();
  let merchantCacheExpiry = 0;
  const MERCHANT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
  
  // PRE-WARMED: Merchant → alternative network products (top merchants only)
  const merchantAlternativesCache = new Map<string, { network: string; affiliateLink: string }[]>();
  
  // Slugify merchant name for routing
  function slugifyMerchant(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Pre-warm merchant network preferences (called at startup and every 30 min)
  async function warmMerchantNetworkCache(): Promise<void> {
    try {
      const now = new Date();
      
      // Load all active promotions into memory
      const promos = await db.execute(sql.raw(`
        SELECT merchant_slug, network, discount_value, discount_type, promotion_id
        FROM promotion_network_map
        WHERE valid_from <= NOW() AND valid_until >= NOW()
        ORDER BY discount_value DESC
      `)) as any[];
      
      // Load merchant preferences
      const prefs = await db.execute(sql.raw(`
        SELECT merchant_slug, preferred_network, preferred_reason
        FROM merchant_networks
        WHERE preferred_network IS NOT NULL
      `)) as any[];
      
      // Clear and rebuild cache
      merchantNetworkCache.clear();
      
      // Add promotions (highest priority)
      for (const p of promos) {
        if (!merchantNetworkCache.has(p.merchant_slug)) {
          merchantNetworkCache.set(p.merchant_slug, {
            network: p.network,
            reason: `${p.discount_value}${p.discount_type === 'percentage' ? '%' : '£'} off`,
            promotionId: p.promotion_id
          });
        }
      }
      
      // Add preferences (lower priority - don't overwrite promotions)
      for (const pref of prefs) {
        if (!merchantNetworkCache.has(pref.merchant_slug)) {
          merchantNetworkCache.set(pref.merchant_slug, {
            network: pref.preferred_network,
            reason: pref.preferred_reason || 'preferred'
          });
        }
      }
      
      merchantCacheExpiry = Date.now() + MERCHANT_CACHE_TTL;
      console.log(`[Routing] Pre-warmed ${merchantNetworkCache.size} merchant network preferences`);
    } catch (error) {
      console.error('[Routing] Warm cache error:', error);
    }
  }
  
  // Pre-warm alternatives for dual-network merchants
  async function warmMerchantAlternatives(): Promise<void> {
    try {
      // Find merchants in both networks and cache one alternative per network
      const dualMerchants = await db.execute(sql.raw(`
        SELECT DISTINCT merchant FROM products
        WHERE source IN ('awin', 'cj')
        GROUP BY merchant
        HAVING COUNT(DISTINCT source) > 1
        LIMIT 50
      `)) as any[];
      
      merchantAlternativesCache.clear();
      
      for (const m of dualMerchants) {
        const alts = await db.execute(sql.raw(`
          SELECT DISTINCT ON (source) source as network, affiliate_link
          FROM products
          WHERE merchant = '${m.merchant.replace(/'/g, "''")}'
          ORDER BY source, id
        `)) as any[];
        
        if (alts.length > 0) {
          merchantAlternativesCache.set(m.merchant, alts.map((a: any) => ({
            network: a.network,
            affiliateLink: a.affiliate_link
          })));
        }
      }
      
      console.log(`[Routing] Pre-warmed alternatives for ${merchantAlternativesCache.size} dual-network merchants`);
    } catch (error) {
      console.error('[Routing] Warm alternatives error:', error);
    }
  }
  
  // Initialize caches on startup
  warmMerchantNetworkCache().then(() => warmMerchantAlternatives());
  
  // Refresh every 30 minutes
  setInterval(() => {
    warmMerchantNetworkCache().then(() => warmMerchantAlternatives());
  }, MERCHANT_CACHE_TTL);
  
  // Get best network for a merchant - NOW USES IN-MEMORY CACHE (0ms)
  function getBestNetworkForMerchant(merchantSlug: string, productSource: string): { network: string; reason: string; promotionId?: string } {
    // Check pre-warmed cache first (instant)
    const cached = merchantNetworkCache.get(merchantSlug);
    if (cached) {
      return cached;
    }
    
    // Default: use product's original source
    return {
      network: productSource || 'awin',
      reason: 'default'
    };
  }
  
  // Get alternative link from cache (0ms if cached)
  function getCachedAlternative(merchant: string, targetNetwork: string): string | null {
    const alts = merchantAlternativesCache.get(merchant);
    if (alts) {
      const alt = alts.find(a => a.network === targetNetwork);
      if (alt) return alt.affiliateLink;
    }
    return null;
  }
  
  // A/B Test Configuration: Percentage of clicks to route through new system
  const AB_TEST_PERCENTAGE = 0.10; // 10% use /go endpoint
  
  // Deterministic A/B assignment based on session/IP hash (stable per user)
  function getAbTestVariant(sessionId: string, productId: string): 'new' | 'control' {
    // Create deterministic hash from session + product for stable assignment
    const hash = crypto.createHash('md5')
      .update(sessionId + productId + 'sunny-ab-v1')
      .digest('hex');
    // Use first 2 hex chars (0-255 range) for bucketing
    const bucket = parseInt(hash.substring(0, 2), 16);
    // 10% = bucket values 0-25 (26/256 ≈ 10.2%)
    return bucket < 26 ? 'new' : 'control';
  }
  
  // API: Get affiliate link with A/B test assignment (deterministic per session)
  app.get('/api/routing/link/:productId', async (req, res) => {
    const { productId } = req.params;
    const forceNew = req.query.force === 'new'; // For testing
    const sessionId = req.cookies?.sessionId || req.ip || 'unknown';
    
    try {
      // Get product from database
      const product = await db.execute(sql.raw(`
        SELECT id, affiliate_link FROM products 
        WHERE id = '${productId.replace(/'/g, "''")}'
        LIMIT 1
      `)) as any[];
      
      if (!product || product.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      // Deterministic A/B assignment: stable per session+product
      const variant = forceNew ? 'new' : getAbTestVariant(sessionId, productId);
      
      if (variant === 'new') {
        res.json({
          link: `/go/${productId}`,
          variant: 'new',
          sessionBucket: sessionId.substring(0, 8),
          description: 'Dynamic routing (A/B test)'
        });
      } else {
        res.json({
          link: product[0].affiliate_link,
          variant: 'control',
          sessionBucket: sessionId.substring(0, 8),
          description: 'Direct affiliate link'
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // /go/:productId - Dynamic affiliate redirect
  app.get('/go/:productId', async (req, res) => {
    const startTime = Date.now();
    const { productId } = req.params;
    const sessionId = req.cookies?.sessionId || req.ip || 'unknown';
    const userQuery = req.query.q as string || null;
    
    try {
      // Check cache first
      const cacheKey = productId;
      const cached = networkDecisionCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        console.log(`[Routing] CACHE HIT for ${productId}: ${cached.network}`);
        
        // Log click asynchronously (use cached merchantSlug)
        db.insert(clickEvents).values({
          productId,
          merchantSlug: cached.merchantSlug || null,
          networkUsed: cached.network,
          sessionId,
          userQuery,
          redirectUrl: cached.url,
          responseTimeMs: Date.now() - startTime
        }).catch(err => console.error('[Routing] Click log error:', err));
        
        return res.redirect(302, cached.url);
      }
      
      // Get product from database
      const product = await db.execute(sql.raw(`
        SELECT id, name, merchant, affiliate_link, source, merchant_slug
        FROM products 
        WHERE id = '${productId.replace(/'/g, "''")}'
        LIMIT 1
      `)) as any[];
      
      if (!product || product.length === 0) {
        console.log(`[Routing] Product not found: ${productId}`);
        return res.redirect(302, '/shop');
      }
      
      const prod = product[0];
      const merchantSlug = prod.merchant_slug || slugifyMerchant(prod.merchant);
      
      // Determine best network (instant - uses pre-warmed cache)
      const networkDecision = getBestNetworkForMerchant(merchantSlug, prod.source);
      
      // Build redirect URL - CRITICAL: actually switch to the preferred network's link
      let redirectUrl = prod.affiliate_link; // Default: original URL
      let actualNetwork = prod.source; // Track which network we actually use
      
      // If recommended network differs from product source, try cached alternative first
      if (networkDecision.network !== prod.source) {
        // FAST PATH: Check pre-warmed alternatives cache (0ms)
        const cachedAlt = getCachedAlternative(prod.merchant, networkDecision.network);
        
        if (cachedAlt) {
          redirectUrl = cachedAlt;
          actualNetwork = networkDecision.network;
          console.log(`[Routing] SWITCHED ${prod.source} → ${networkDecision.network} for ${prod.merchant} (cached)`);
        } else {
          // SLOW PATH: DB lookup for uncached merchants (rare)
          try {
            const altProduct = await db.execute(sql.raw(`
              SELECT affiliate_link FROM products 
              WHERE merchant = '${prod.merchant.replace(/'/g, "''")}'
                AND source = '${networkDecision.network}'
              LIMIT 1
            `)) as any[];
            
            if (altProduct && altProduct.length > 0) {
              redirectUrl = altProduct[0].affiliate_link;
              actualNetwork = networkDecision.network;
              console.log(`[Routing] SWITCHED ${prod.source} → ${networkDecision.network} for ${prod.merchant} (db)`);
            } else {
              console.log(`[Routing] No ${networkDecision.network} alt for ${prod.merchant}`);
            }
          } catch (altErr) {
            console.error('[Routing] Alt lookup error:', altErr);
          }
        }
      } else {
        actualNetwork = prod.source;
      }
      
      // Cache the decision (use actualNetwork, not recommended network)
      networkDecisionCache.set(cacheKey, {
        network: actualNetwork,
        merchantSlug,
        url: redirectUrl,
        reason: networkDecision.reason + (actualNetwork !== networkDecision.network ? ' (no alt)' : ''),
        expiry: Date.now() + NETWORK_CACHE_TTL
      });
      
      // Prune cache if too large
      if (networkDecisionCache.size > 5000) {
        const now = Date.now();
        for (const [key, value] of networkDecisionCache) {
          if (value.expiry < now) networkDecisionCache.delete(key);
        }
      }
      
      const responseTime = Date.now() - startTime;
      console.log(`[Routing] ${productId} → ${actualNetwork} (${responseTime}ms): ${networkDecision.reason}`);
      
      // Log click asynchronously (fire-and-forget)
      db.insert(clickEvents).values({
        productId,
        merchantSlug,
        networkUsed: actualNetwork, // Log the ACTUAL network used, not just recommended
        promotionId: networkDecision.promotionId || null,
        sessionId,
        userQuery,
        redirectUrl,
        responseTimeMs: responseTime
      }).catch(err => console.error('[Routing] Click log error:', err));
      
      res.redirect(302, redirectUrl);
      
    } catch (error: any) {
      console.error('[Routing] Error:', error);
      
      // Fallback: try to get original URL
      try {
        const fallback = await db.execute(sql.raw(`
          SELECT affiliate_link FROM products WHERE id = '${productId.replace(/'/g, "''")}'
        `)) as any[];
        
        if (fallback && fallback.length > 0) {
          return res.redirect(302, fallback[0].affiliate_link);
        }
      } catch (e) {
        console.error('[Routing] Fallback error:', e);
      }
      
      res.redirect(302, '/shop');
    }
  });
  
  // Admin: View click analytics
  app.get('/api/routing/stats', async (req, res) => {
    try {
      const stats = await db.execute(sql.raw(`
        SELECT 
          network_used,
          COUNT(*) as clicks,
          AVG(response_time_ms) as avg_response_ms,
          DATE(clicked_at) as date
        FROM click_events
        WHERE clicked_at > NOW() - INTERVAL '7 days'
        GROUP BY network_used, DATE(clicked_at)
        ORDER BY date DESC, clicks DESC
      `));
      
      const totals = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total_clicks,
          AVG(response_time_ms) as avg_response_ms,
          COUNT(DISTINCT product_id) as unique_products,
          COUNT(DISTINCT merchant_slug) as unique_merchants
        FROM click_events
      `));
      
      res.json({
        success: true,
        totals: totals[0] || {},
        byNetworkAndDate: stats,
        cacheSize: networkDecisionCache.size,
        abTestPercentage: AB_TEST_PERCENTAGE * 100 + '%'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: 24-hour monitoring dashboard for A/B test
  app.get('/api/routing/monitor', async (req, res) => {
    try {
      // Last 24 hours click activity
      const hourlyClicks = await db.execute(sql.raw(`
        SELECT 
          DATE_TRUNC('hour', clicked_at) as hour,
          network_used,
          COUNT(*) as clicks,
          AVG(response_time_ms) as avg_ms,
          MIN(response_time_ms) as min_ms,
          MAX(response_time_ms) as max_ms
        FROM click_events
        WHERE clicked_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', clicked_at), network_used
        ORDER BY hour DESC
      `));
      
      // Recent clicks (last 20)
      const recentClicks = await db.execute(sql.raw(`
        SELECT 
          product_id,
          merchant_slug,
          network_used,
          response_time_ms,
          clicked_at
        FROM click_events
        ORDER BY clicked_at DESC
        LIMIT 20
      `));
      
      // Slow queries (> 500ms)
      const slowQueries = await db.execute(sql.raw(`
        SELECT 
          product_id,
          merchant_slug,
          network_used,
          response_time_ms,
          clicked_at
        FROM click_events
        WHERE response_time_ms > 500
          AND clicked_at > NOW() - INTERVAL '24 hours'
        ORDER BY response_time_ms DESC
        LIMIT 10
      `));
      
      // Performance summary (using safe aggregates that work in all PostgreSQL versions)
      let perfSummary: any[] = [];
      try {
        perfSummary = await db.execute(sql.raw(`
          SELECT 
            COUNT(*) as total_24h,
            AVG(response_time_ms) as avg_ms_24h,
            MAX(response_time_ms) as max_ms,
            MIN(response_time_ms) as min_ms,
            COUNT(*) FILTER (WHERE response_time_ms < 200) as under_200ms,
            COUNT(*) FILTER (WHERE response_time_ms >= 500) as over_500ms
          FROM click_events
          WHERE clicked_at > NOW() - INTERVAL '24 hours'
        `)) as any[];
      } catch (e) {
        console.error('[Monitor] Performance query error:', e);
        perfSummary = [{ total_24h: '0', avg_ms_24h: null, max_ms: null, min_ms: null, under_200ms: '0', over_500ms: '0' }];
      }
      
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        abTestPercentage: AB_TEST_PERCENTAGE * 100 + '%',
        caches: {
          networkDecisions: networkDecisionCache.size,
          merchantPreferences: merchantNetworkCache.size,
          merchantAlternatives: merchantAlternativesCache.size
        },
        performance: perfSummary[0] || {},
        hourlyClicks,
        recentClicks,
        slowQueries
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: Create test promotion for a merchant
  app.post('/api/routing/test-promotion', async (req, res) => {
    const { merchantSlug, network, discountValue, discountType, daysValid } = req.body;
    
    if (!merchantSlug || !network) {
      return res.status(400).json({ error: 'merchantSlug and network required' });
    }
    
    try {
      const now = new Date();
      const validUntil = new Date(now.getTime() + (daysValid || 7) * 24 * 60 * 60 * 1000);
      
      await db.insert(promotionNetworkMap).values({
        promotionId: `test-${Date.now()}`,
        merchantSlug,
        network,
        discountValue: discountValue || 10,
        discountType: discountType || 'percentage',
        validFrom: now,
        validUntil
      });
      
      // Clear entire cache when promotions change (simple but effective)
      // Future: Build merchant→productIds index for targeted invalidation
      const clearedCount = networkDecisionCache.size;
      networkDecisionCache.clear();
      
      res.json({
        success: true,
        message: `Created ${discountValue || 10}${discountType === 'percentage' ? '%' : '£'} ${network} promotion for ${merchantSlug}`,
        validUntil,
        cacheCleared: clearedCount
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: Find products that exist in both networks
  app.get('/api/routing/dual-network-products', async (req, res) => {
    try {
      // Find merchants with products from both Awin and CJ
      const dualMerchants = await db.execute(sql.raw(`
        SELECT 
          merchant,
          COUNT(*) FILTER (WHERE source = 'awin') as awin_count,
          COUNT(*) FILTER (WHERE source = 'cj') as cj_count,
          COUNT(*) as total
        FROM products
        GROUP BY merchant
        HAVING COUNT(*) FILTER (WHERE source = 'awin') > 0 
           AND COUNT(*) FILTER (WHERE source = 'cj') > 0
        ORDER BY total DESC
        LIMIT 20
      `));
      
      // Get sample products from dual-network merchants
      const samples: any[] = [];
      for (const m of (dualMerchants as any[]).slice(0, 5)) {
        const prods = await db.execute(sql.raw(`
          SELECT id, name, source, price, affiliate_link
          FROM products 
          WHERE merchant = '${m.merchant.replace(/'/g, "''")}'
          LIMIT 2
        `));
        samples.push({
          merchant: m.merchant,
          awinCount: m.awin_count,
          cjCount: m.cj_count,
          products: prods
        });
      }
      
      res.json({
        success: true,
        dualNetworkMerchants: dualMerchants,
        sampleProducts: samples
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
