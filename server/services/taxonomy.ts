import { db } from "../db";
import { taxonomy } from "@shared/schema";
import type { SearchIntent, Taxonomy } from "@shared/schema";

interface TaxonomyMatch {
  keyword: string;
  category: string;
  subcategory: string | null;
  weight: number;
}

let taxonomyCache: Map<string, TaxonomyMatch> | null = null;
let taxonomyCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function loadTaxonomy(): Promise<Map<string, TaxonomyMatch>> {
  const now = Date.now();
  if (taxonomyCache && now - taxonomyCacheTime < CACHE_TTL) {
    return taxonomyCache;
  }

  const rows = await db.select().from(taxonomy);
  const map = new Map<string, TaxonomyMatch>();

  for (const row of rows) {
    map.set(row.keyword.toLowerCase(), {
      keyword: row.keyword,
      category: row.category,
      subcategory: row.subcategory,
      weight: row.weight ?? 1.0,
    });
  }

  taxonomyCache = map;
  taxonomyCacheTime = now;
  console.log(`[Taxonomy] Loaded ${map.size} keywords into cache`);
  return map;
}

function extractPriceRange(query: string): { min: number | null; max: number | null } {
  let min: number | null = null;
  let max: number | null = null;

  const underMatch = query.match(/(?:under|below|less than|max|up to)\s*£?\s*(\d+)/i);
  if (underMatch) {
    max = parseFloat(underMatch[1]);
  }

  const overMatch = query.match(/(?:over|above|more than|min|at least)\s*£?\s*(\d+)/i);
  if (overMatch) {
    min = parseFloat(overMatch[1]);
  }

  const rangeMatch = query.match(/£?\s*(\d+)\s*(?:-|to)\s*£?\s*(\d+)/);
  if (rangeMatch) {
    min = parseFloat(rangeMatch[1]);
    max = parseFloat(rangeMatch[2]);
  }

  return { min, max };
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'and', 'or', 'in', 'on', 'at', 'to',
  'is', 'are', 'was', 'were', 'i', 'me', 'my', 'want', 'need',
  'looking', 'find', 'get', 'buy', 'under', 'over', 'below', 'above',
  'with', 'from', 'of', 'some', 'any', 'size', 'age', 'year', 'years',
]);

export async function extractIntent(query: string): Promise<SearchIntent> {
  const taxonomyMap = await loadTaxonomy();
  const queryLower = query.toLowerCase();
  const words = queryLower.match(/\b\w+\b/g) || [];

  const { min: minPrice, max: maxPrice } = extractPriceRange(queryLower);

  const matchedCategories: string[] = [];
  const matchedFranchises: string[] = [];
  let matchedAge: string | null = null;
  let matchedIntent: string | null = null;
  const weights: Record<string, number> = {};
  const matchedKeywords: string[] = [];

  function applyMatch(match: TaxonomyMatch) {
    if (match.category === 'Franchise') {
      if (match.subcategory && !matchedFranchises.includes(match.subcategory)) {
        matchedFranchises.push(match.subcategory);
      }
      if (!matchedKeywords.includes(match.keyword.toLowerCase())) {
        matchedKeywords.push(match.keyword.toLowerCase());
      }
    } else if (match.category === 'AgeGroup') {
      matchedAge = match.subcategory;
    } else if (match.category === 'Intent') {
      matchedIntent = match.subcategory;
    } else {
      if (!matchedCategories.includes(match.category)) {
        matchedCategories.push(match.category);
      }
      if (!matchedKeywords.includes(match.keyword.toLowerCase())) {
        matchedKeywords.push(match.keyword.toLowerCase());
      }
    }
    weights[match.keyword.toLowerCase()] = match.weight;
  }

  // Track words that are part of multi-word matches (to suppress unigram category leak)
  const suppressedWords = new Set<number>();

  // PHASE 1: Match trigrams first (highest priority)
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    const match = taxonomyMap.get(trigram);
    if (match) {
      applyMatch(match);
      // Suppress component words from being re-matched as unigrams
      suppressedWords.add(i);
      suppressedWords.add(i + 1);
      suppressedWords.add(i + 2);
    }
  }

  // PHASE 2: Match bigrams (before unigrams)
  for (let i = 0; i < words.length - 1; i++) {
    if (suppressedWords.has(i) && suppressedWords.has(i + 1)) continue;
    const bigram = `${words[i]} ${words[i + 1]}`;
    const match = taxonomyMap.get(bigram);
    if (match) {
      applyMatch(match);
      // Suppress component words from being re-matched as unigrams
      suppressedWords.add(i);
      suppressedWords.add(i + 1);
    }
  }

  // PHASE 3: Match unigrams (only if not suppressed by multi-word match)
  for (let i = 0; i < words.length; i++) {
    if (suppressedWords.has(i)) continue;
    const word = words[i];
    const match = taxonomyMap.get(word);
    if (match) {
      applyMatch(match);
    }
  }

  // Add remaining words as keywords (for text matching), excluding suppressed
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!STOP_WORDS.has(word) && !matchedKeywords.includes(word) && word.length > 1) {
      matchedKeywords.push(word);
    }
  }

  return {
    rawQuery: query,
    keywords: matchedKeywords,
    categories: matchedCategories,
    franchises: matchedFranchises,
    ageGroup: matchedAge,
    intentType: matchedIntent,
    minPrice,
    maxPrice,
    weights,
  };
}

const INTENT_CATEGORY_WEIGHTS: Record<string, number> = {
  'Gift:Toys': 1.3,
  'Gift:Games': 1.2,
  'Gift:Clothing': 1.1,
  'Budget:Toys': 1.0,
  'Budget:Clothing': 1.1,
  'Premium:Toys': 0.9,
  'Premium:Clothing': 1.2,
};

interface ProductForScoring {
  name: string;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  price: number;
  imageUrl?: string | null;
  inStock?: boolean | null;
  canonicalCategory?: string | null;
  canonicalFranchises?: string[] | null;
}

export interface RelevanceResult {
  score: number;
  hardFail: boolean;
}

export function calculateRelevanceScore(product: ProductForScoring, intent: SearchIntent): RelevanceResult {
  let score = 0;
  const nameLower = product.name.toLowerCase();
  const descLower = (product.description || '').toLowerCase();
  const combinedText = `${nameLower} ${descLower}`;
  const productBrand = (product.brand || '').toLowerCase();
  
  // Use pre-computed canonical fields for ZERO HALLUCINATION matching
  const canonicalCat = product.canonicalCategory?.toLowerCase() || null;
  const canonicalFranchises = product.canonicalFranchises || [];

  // Category matching using pre-computed canonical_category
  function matchesCategory(wanted: string): boolean {
    if (!canonicalCat) return false;
    return canonicalCat === wanted.toLowerCase();
  }

  // Franchise matching using pre-computed canonical_franchises array
  function matchesFranchise(): boolean {
    if (canonicalFranchises.length === 0) return false;
    for (const wanted of intent.franchises) {
      const wantedLower = wanted.toLowerCase();
      if (canonicalFranchises.some(f => f.toLowerCase() === wantedLower)) {
        return true;
      }
    }
    return false;
  }

  // Keyword matching (still useful for ranking)
  for (const keyword of intent.keywords) {
    const weight = intent.weights[keyword] || 1.0;
    if (nameLower.includes(keyword)) {
      score += 15 * weight;
    } else if (combinedText.includes(keyword)) {
      score += 7 * weight;
    }
  }

  // Category matching using canonical field
  let hasCategoryMatch = false;
  for (const cat of intent.categories) {
    if (matchesCategory(cat)) {
      hasCategoryMatch = true;
      score += 25;
    }
  }

  // Franchise matching using canonical field
  let hasFranchiseMatch = matchesFranchise();
  if (hasFranchiseMatch) {
    score += 30;
  }

  // CRITICAL: When BOTH franchise AND category are specified, HARD GATE - REQUIRE BOTH
  // e.g. "Marvel trainers" = must be Marvel AND must be Footwear
  // Products not matching BOTH are HARD FAILED and excluded from results
  if (intent.franchises.length > 0 && intent.categories.length > 0) {
    if (hasFranchiseMatch && hasCategoryMatch) {
      score += 150; // HUGE bonus for matching both
    } else {
      // HARD GATE: Return hardFail=true for any mismatch
      return { score: -1000, hardFail: true };
    }
  } else if (intent.categories.length > 0 && !hasCategoryMatch) {
    // Category-only search with wrong category - hard gate
    return { score: -500, hardFail: true };
  } else if (intent.franchises.length > 0 && !hasFranchiseMatch) {
    // Franchise-only search with wrong franchise
    score -= 100;
  }

  // Intent-based multiplier
  if (intent.intentType) {
    for (const cat of intent.categories) {
      const key = `${intent.intentType}:${cat}`;
      if (INTENT_CATEGORY_WEIGHTS[key]) {
        score *= INTENT_CATEGORY_WEIGHTS[key];
      }
    }
  }

  // Price filtering
  if (intent.maxPrice && product.price > 0) {
    if (product.price <= intent.maxPrice) {
      const budgetUsage = product.price / intent.maxPrice;
      score += 5 * budgetUsage;
    } else {
      score -= 50;
    }
  }

  if (intent.minPrice && product.price > 0) {
    if (product.price < intent.minPrice) {
      score -= 50;
    }
  }

  // Quality signals
  if (product.imageUrl) {
    score += 3;
  }

  if (product.inStock) {
    score += 5;
  }

  return { score, hardFail: false };
}

export function clearTaxonomyCache() {
  taxonomyCache = null;
  taxonomyCacheTime = 0;
}
