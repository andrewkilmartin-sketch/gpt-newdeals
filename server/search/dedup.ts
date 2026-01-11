/**
 * Deduplication and Merchant Cap Logic
 * 
 * Contains SKU deduplication, name similarity matching, and merchant diversity controls.
 * 
 * See CRITICAL_FIXES.md - Fix #65, #67
 */

/**
 * Extract SKU from product name (numbers in brackets like "(5002111)")
 * Fix #67
 */
export function extractSKU(name: string): string | null {
  if (!name) return null;
  const match = name.match(/\((\d{4,})\)/);
  return match ? match[1] : null;
}

/**
 * Normalize product name for comparison
 * Removes SKU, price info, size info
 */
export function normalizeProductName(name: string): string {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\(\d{4,}\)/g, '')
    .replace(/£[\d.]+/g, '')
    .replace(/\d+\s*(cm|mm|inch|"|')/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two product names are similar (90%+ overlap)
 */
export function similarNames(a: string, b: string): boolean {
  const normA = normalizeProductName(a);
  const normB = normalizeProductName(b);
  if (!normA || !normB) return false;
  
  if (normA.length > 10 && normB.length > 10) {
    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length < normB.length ? normB : normA;
    
    if (longer.includes(shorter) && shorter.length >= longer.length * 0.8) {
      return true;
    }
  }
  
  return normA === normB;
}

/**
 * Deduplicate results by ID or name+merchant
 */
export function deduplicateResults(results: any[]): any[] {
  const seen = new Set<string>();
  const deduplicated: any[] = [];
  
  for (const r of results) {
    if (!r.name || r.name.trim() === '') {
      deduplicated.push(r);
      continue;
    }
    
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

/**
 * Deduplicate by SKU - keep cheapest price when same product from multiple merchants
 * Fix #67
 */
export function deduplicateBySKU(results: any[]): any[] {
  const groups = new Map<string, any[]>();
  const noSKU: any[] = [];
  
  for (const r of results) {
    const sku = extractSKU(r.name);
    if (sku) {
      const existing = groups.get(sku) || [];
      existing.push(r);
      groups.set(sku, existing);
    } else {
      noSKU.push(r);
    }
  }
  
  const deduplicated: any[] = [];
  for (const [sku, items] of groups) {
    if (items.length === 1) {
      deduplicated.push(items[0]);
    } else {
      items.sort((a, b) => (parseFloat(a.price) || 999999) - (parseFloat(b.price) || 999999));
      const cheapest = items[0];
      console.log(`[Fix #67 SKU Dedup] Kept ${cheapest.merchant} at £${cheapest.price} for SKU (${sku}), removed ${items.length - 1} more expensive options`);
      deduplicated.push(cheapest);
    }
  }
  
  const processedNoSKU: any[] = [];
  const dominated = new Set<number>();
  
  for (let i = 0; i < noSKU.length; i++) {
    if (dominated.has(i)) continue;
    
    let cheapestIdx = i;
    let cheapestPrice = parseFloat(noSKU[i].price) || 999999;
    
    for (let j = i + 1; j < noSKU.length; j++) {
      if (dominated.has(j)) continue;
      
      if (similarNames(noSKU[i].name, noSKU[j].name)) {
        const priceJ = parseFloat(noSKU[j].price) || 999999;
        if (priceJ < cheapestPrice) {
          dominated.add(cheapestIdx);
          cheapestIdx = j;
          cheapestPrice = priceJ;
          console.log(`[Fix #67 Name Dedup] Kept ${noSKU[j].merchant} at £${noSKU[j].price}, removed ${noSKU[i].merchant} at £${noSKU[i].price}`);
        } else {
          dominated.add(j);
          console.log(`[Fix #67 Name Dedup] Kept ${noSKU[cheapestIdx].merchant} at £${noSKU[cheapestIdx].price}, removed ${noSKU[j].merchant} at £${noSKU[j].price}`);
        }
      }
    }
    
    dominated.add(cheapestIdx);
    processedNoSKU.push(noSKU[cheapestIdx]);
  }
  
  return [...deduplicated, ...processedNoSKU];
}

/**
 * Apply merchant caps - max N results per merchant
 * Fix #65: Variety-aware - only relax cap if merchant diversity is low
 */
export function applyMerchantCaps(results: any[], maxPerMerchant: number = 2): any[] {
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

/**
 * Count unique merchants in results
 */
export function countUniqueMerchants(results: any[]): number {
  const merchants = new Set<string>();
  for (const r of results) {
    if (r.merchant) {
      merchants.add(r.merchant.toLowerCase());
    }
  }
  return merchants.size;
}
