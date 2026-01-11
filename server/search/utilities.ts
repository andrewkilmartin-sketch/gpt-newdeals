/**
 * Search Utilities Module
 * Contains helper functions for query preprocessing, synonym expansion,
 * intent detection, typo correction, and search quality filtering.
 */

import {
  filterInappropriateContent,
  filterPromoOnlyResults,
  filterFallbackSpam,
  demoteKidsPassResults,
  filterKeywordCollisions,
  isGamingQuery,
  filterForGamingQuery,
  hasBookContext,
  filterForBookContext,
  hasPartyBagContext,
  filterForPartyBagContext,
  hasAgeContext,
  filterForAgeContext,
  hasBlindContext,
  filterForBlindContext,
  hasStitchContext,
  filterForStitchContext,
  hasFilmContext,
  filterForFilmContext,
  hasWatchOrderContext,
  filterForWatchOrderContext,
  hasBreakContext,
  filterForBreakContext,
  filterForGenderContext,
  hasWaterGunContext,
  filterForWaterGunContext,
  hasToyContext,
  filterForToyContext,
  hasCostumeContext,
  filterForCostumeContext,
  filterMakeupFromToyQueries,
  filterCraftSuppliesFromToyQueries,
  filterMediaFromToyQueries,
  filterWordBoundaryCollisions
} from './filters';

import { deduplicateResults, applyMerchantCaps } from './dedup';
import { hasGenderContext, hasQualityIntent } from './brands';
import { reorderForQualityIntent } from './ranking';
import { QueryIntent } from './types';

export function sanitizeMediaSuffix(query: string): { sanitized: string; stripped: boolean } {
  const mediaSuffixes = ['film', 'films', 'movie', 'movies'];
  const words = query.toLowerCase().trim().split(/\s+/);
  
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

export const PROMO_ONLY_PATTERNS = [
  /^\d+% off/i,
  /^up to \d+% off/i,
  /^save \d+%/i,
  /^save up to \d+%/i,
  /^buy \d+ get \d+/i,
  /^buy one get one/i,
  /^any \d+ .*£\d+/i,
  /free delivery/i,
  /free next day/i,
  /from 1p/i,
  /extra \d+% off/i,
  /£\d+ off/i,
  /^\d+% discount/i,
  /sale ends/i,
];

export function isPromoOnly(title: string): boolean {
  if (!title) return false;
  const t = title.trim();
  return PROMO_ONLY_PATTERNS.some(pattern => pattern.test(t));
}

export const ILIKE_FALLBACK_TIMEOUT_MS = 3000;

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`[Shop Search] TIMEOUT: ${label} exceeded ${timeoutMs}ms limit`);
      resolve(null);
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    console.log(`[Shop Search] ERROR in ${label}: ${error}`);
    return null;
  }
}

export const QUERY_SYNONYMS: { [key: string]: string[] } = {
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

export const PHRASE_SYNONYMS: { [key: string]: string } = {
  'calico critters': 'sylvanian families',
  'calico critter': 'sylvanian families',
  'thomas the tank engine': 'thomas friends',
  'thomas tank engine': 'thomas friends',
  'play-doh': 'playdough',
  'playdoh': 'playdough',
  'legos': 'lego',
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
  'color': 'colour',
  'colors': 'colours',
  'favorite': 'favourite',
  'favorites': 'favourites',
  'gray': 'grey',
  'sidewalk chalk': 'pavement chalk',
  'kinetic sand': 'play sand',
  'sensory toys': 'baby toys',
  'sensory toy': 'baby toy',
  'fidget spinner': 'fidget',
  'stem toys': 'educational toys',
  'stem toy': 'educational toy',
  'science kit': 'experiment',
  'science kits': 'experiment',
  'stuffed animals': 'plush soft toy',
  'stuffed animal': 'plush soft toy',
};

export function applyPhraseSynonyms(query: string): string {
  let result = query.toLowerCase();
  for (const [phrase, replacement] of Object.entries(PHRASE_SYNONYMS)) {
    if (result.includes(phrase)) {
      console.log(`[PhraseSynonym] Replaced "${phrase}" with "${replacement}"`);
      result = result.replace(phrase, replacement);
    }
  }
  return result;
}

export function expandQueryWithSynonyms(query: string): string[] {
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

export function detectQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase();
  
  if (q.includes('game') || q.includes('xbox') || q.includes('playstation') || 
      q.includes('nintendo') || q.includes('switch') || q.includes('console') ||
      q.includes('ps5') || q.includes('ps4') || q.includes('gaming')) {
    if (!q.includes('board game') && !q.includes('game set')) {
      return 'GAMING';
    }
  }
  
  if (q.includes('film') || q.includes('movie') || q.includes('cinema') ||
      q.includes('dvd') || q.includes('blu-ray') || q.includes('streaming') ||
      (q.includes('watch') && (q.includes('order') || q.includes('list') || q.includes('marathon')))) {
    return 'ENTERTAINMENT';
  }
  
  if (q.includes('near me') || q.includes('nearby') || q.includes('local') ||
      q.includes('visit') || q.includes('day out') || q.includes('days out') ||
      q.includes('attraction') || q.includes('theme park') || q.includes('zoo') ||
      q.includes('aquarium') || q.includes('museum')) {
    return 'DAYS_OUT';
  }
  
  if (q.includes('party bag') || q.includes('party supplies') || 
      q.includes('goody bag') || q.includes('pass the parcel') ||
      q.includes('party favour') || q.includes('party favor')) {
    return 'PARTY';
  }
  
  if ((q.includes('book') && (q.includes('token') || q.includes('voucher') || q.includes('reading'))) ||
      q.includes('story book') || q.includes('picture book')) {
    return 'BOOKS';
  }
  
  return 'PRODUCTS';
}

export const TYPO_CORRECTIONS: Record<string, string> = {
  'leggo': 'lego', 'legos': 'lego', 'legao': 'lego', 'lgeo': 'lego',
  'barbi': 'barbie', 'barbee': 'barbie', 'barbei': 'barbie', 'brbie': 'barbie',
  'peper pig': 'peppa pig', 'pepa pig': 'peppa pig', 'pepper pig': 'peppa pig', 
  'peppapig': 'peppa pig',
  'paw partol': 'paw patrol', 'pawpatrol': 'paw patrol', 'paw petrol': 'paw patrol',
  'pokeman': 'pokemon', 'pokémon': 'pokemon', 'pokemons': 'pokemon', 'pokimon': 'pokemon',
  'disnep': 'disney', 'diseny': 'disney', 'dinsey': 'disney',
  'marvle': 'marvel', 'marval': 'marvel',
  'batmam': 'batman', 'bat man': 'batman', 'batrman': 'batman',
  'forzen': 'frozen', 'frozem': 'frozen',
  'mindcraft': 'minecraft', 'mincraft': 'minecraft', 'minecarft': 'minecraft',
  'bluee': 'bluey', 'blueey': 'bluey',
  'coco melon': 'cocomelon', 'cocomelen': 'cocomelon',
  'hotwheels': 'hot wheels', 'hot wheel': 'hot wheels',
  'hary potter': 'harry potter', 'harry poter': 'harry potter', 'harrypotter': 'harry potter'
};

export function correctTypos(query: string): { corrected: string; wasCorrected: boolean; original: string } {
  let corrected = query.toLowerCase();
  let wasCorrected = false;
  
  for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
    const wordBoundaryRegex = new RegExp(`\\b${typo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (wordBoundaryRegex.test(corrected)) {
      corrected = corrected.replace(wordBoundaryRegex, correction);
      wasCorrected = true;
      console.log(`[Typo Fix] Corrected "${typo}" → "${correction}" in query`);
    }
  }
  
  if (wasCorrected) {
    return { corrected, wasCorrected, original: query };
  }
  
  return { corrected: query, wasCorrected: false, original: query };
}

export function applySearchQualityFilters(results: any[], query: string): any[] {
  const originalCount = results.length;
  let filtered = results;
  
  const queryIntent = detectQueryIntent(query);
  if (queryIntent !== 'PRODUCTS') {
    console.log(`[Intent Router] Query "${query}" → ${queryIntent}`);
  }
  
  filtered = filterInappropriateContent(filtered);
  filtered = filterPromoOnlyResults(filtered);
  filtered = deduplicateResults(filtered);
  filtered = filterFallbackSpam(filtered, query);
  filtered = demoteKidsPassResults(filtered, queryIntent);
  filtered = filterKeywordCollisions(query, filtered);
  
  if (isGamingQuery(query)) {
    console.log(`[Gaming Router] Gaming query detected: "${query}"`);
    filtered = filterForGamingQuery(filtered);
  }
  
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
  
  if (hasBlindContext(query)) {
    console.log(`[Search Quality] Applying blind/accessibility filters for: "${query}"`);
    filtered = filterForBlindContext(filtered);
  }
  
  if (hasStitchContext(query)) {
    console.log(`[Search Quality] Applying Stitch character filters for: "${query}"`);
    filtered = filterForStitchContext(filtered);
  }
  
  if (hasFilmContext(query)) {
    console.log(`[Search Quality] Applying film/movie filters for: "${query}"`);
    filtered = filterForFilmContext(filtered);
  }
  
  if (hasWatchOrderContext(query)) {
    console.log(`[Search Quality] Applying watch order filters for: "${query}"`);
    filtered = filterForWatchOrderContext(filtered);
  }
  
  if (hasBreakContext(query)) {
    console.log(`[Search Quality] Applying break context filters for: "${query}"`);
    filtered = filterForBreakContext(filtered);
  }
  
  const genderContext = hasGenderContext(query);
  if (genderContext) {
    console.log(`[Search Quality] Applying gender filters (${genderContext}) for: "${query}"`);
    filtered = filterForGenderContext(filtered, genderContext);
  }
  
  if (hasWaterGunContext(query)) {
    console.log(`[Search Quality] Applying water gun context filters for: "${query}"`);
    filtered = filterForWaterGunContext(filtered);
  }
  
  if (hasToyContext(query) && !hasCostumeContext(query)) {
    console.log(`[Search Quality] Applying toy context filters for: "${query}"`);
    filtered = filterForToyContext(filtered);
  } else if (hasToyContext(query) && hasCostumeContext(query)) {
    console.log(`[Search Quality] Skipping toy context filter for costume query: "${query}"`);
  }
  
  const preMakeupCount = filtered.length;
  filtered = filterMakeupFromToyQueries(filtered, query);
  if (filtered.length < preMakeupCount) {
    console.log(`[Fix #39] Makeup filter: ${preMakeupCount} → ${filtered.length} for: "${query}"`);
  }
  
  const preCraftCount = filtered.length;
  filtered = filterCraftSuppliesFromToyQueries(filtered, query);
  if (filtered.length < preCraftCount) {
    console.log(`[Fix #47] Craft supply filter: ${preCraftCount} → ${filtered.length} for: "${query}"`);
  }
  
  const preMediaCount = filtered.length;
  filtered = filterMediaFromToyQueries(filtered, query);
  if (filtered.length < preMediaCount) {
    console.log(`[Fix #64] Media exclusion filter: ${preMediaCount} → ${filtered.length} for: "${query}"`);
  }
  
  if (hasCostumeContext(query)) {
    console.log(`[Search Quality] Applying costume context filters for: "${query}"`);
    const costumeResult = filterForCostumeContext(filtered);
    filtered = costumeResult.items;
    if (costumeResult.inventoryGap) {
      console.log(`[Search Quality] INVENTORY GAP: ${costumeResult.gapReason}`);
    }
  }
  
  if (hasBookContext(query)) {
    console.log(`[Search Quality] Applying books context filters for: "${query}"`);
    filtered = filterForBookContext(filtered);
  }
  
  const preBoundaryCount = filtered.length;
  filtered = filterWordBoundaryCollisions(filtered, query);
  if (filtered.length < preBoundaryCount) {
    console.log(`[Word Boundary] Filtered ${preBoundaryCount} → ${filtered.length} for: "${query}"`);
  }
  
  const TARGET_MIN_RESULTS = 8;
  const preMerchantCapCount = filtered.length;
  
  const uniqueMerchants = new Set(filtered.map(r => (r.merchant || 'unknown').toLowerCase()));
  const merchantCount = uniqueMerchants.size;
  
  let cappedFiltered = applyMerchantCaps(filtered, 2);
  
  const hasGoodMerchantDiversity = merchantCount >= 4;
  
  if (hasGoodMerchantDiversity) {
    console.log(`[Fix #65] Good merchant diversity (${merchantCount} merchants), maintaining strict cap of 2`);
  } else if (cappedFiltered.length < TARGET_MIN_RESULTS && preMerchantCapCount > cappedFiltered.length) {
    console.log(`[Filter Relaxation] Low merchant diversity (${merchantCount}), cap too aggressive (${cappedFiltered.length} < ${TARGET_MIN_RESULTS}), raising cap to 4`);
    cappedFiltered = applyMerchantCaps(filtered, 4);
    
    if (cappedFiltered.length < TARGET_MIN_RESULTS && preMerchantCapCount > cappedFiltered.length) {
      console.log(`[Filter Relaxation] Still below target (${cappedFiltered.length}), raising cap to 6`);
      cappedFiltered = applyMerchantCaps(filtered, 6);
    }
    
    if (cappedFiltered.length < TARGET_MIN_RESULTS && preMerchantCapCount > cappedFiltered.length) {
      console.log(`[Filter Relaxation] Removing merchant cap to maximize results (${cappedFiltered.length} → ${preMerchantCapCount})`);
      cappedFiltered = filtered;
    }
  }
  filtered = cappedFiltered;
  
  if (hasQualityIntent(query)) {
    console.log(`[Search Quality] Applying quality intent reordering for: "${query}"`);
    filtered = reorderForQualityIntent(filtered);
  }
  
  if (filtered.length < originalCount) {
    console.log(`[Search Quality] Filtered ${originalCount} → ${filtered.length} results for: "${query}"`);
  }
  
  return filtered;
}
