/**
 * Ranking and Sorting Functions
 * 
 * Contains price sorting, quality intent detection, and value scoring.
 * 
 * See CRITICAL_FIXES.md - Fix #68
 */

import { DISCOUNT_MERCHANTS, hasQualityIntent } from './brands';

/**
 * Sort results by price ascending (cheapest first)
 * Fix #68
 */
export function sortByPrice(results: any[]): any[] {
  return [...results].sort((a, b) => {
    const priceA = parseFloat(a.price) || 999999;
    const priceB = parseFloat(b.price) || 999999;
    return priceA - priceB;
  });
}

/**
 * Reorder results for quality intent queries
 * Deprioritize discount merchants when user wants "best" or "premium"
 */
export function reorderForQualityIntent(results: any[]): any[] {
  const discountResults: any[] = [];
  const qualityResults: any[] = [];
  
  for (const r of results) {
    const merchant = (r.merchant || '').toLowerCase();
    const isDiscount = DISCOUNT_MERCHANTS.some(dm => merchant.includes(dm));
    
    if (isDiscount) {
      discountResults.push(r);
    } else {
      qualityResults.push(r);
    }
  }
  
  return [...qualityResults, ...discountResults];
}

/**
 * Apply price sorting with quality intent gate
 * If user has quality intent, skip price sorting to preserve quality-based ordering
 * Fix #68
 */
export function applyPriceSorting(results: any[], query: string): any[] {
  if (hasQualityIntent(query)) {
    console.log(`[Fix #68] SKIPPED price sort - quality intent detected in: "${query}"`);
    return results;
  }
  
  console.log(`[Fix #68] Sorted by price (cheapest first)`);
  return sortByPrice(results);
}
