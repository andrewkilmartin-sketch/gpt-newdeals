import { db } from "../db";
import { products, cjImportState } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const CJ_API_TOKEN = process.env.CJ_API_TOKEN;
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID;
const CJ_WEBSITE_ID = process.env.CJ_WEBSITE_ID; // Required for Link-Search promotions API

// CJ Product Search API endpoint
// See: https://developers.cj.com/graphql/reference/Product%20Search
const CJ_GRAPHQL_ENDPOINT = 'https://ads.api.cj.com/query';

// Rate limit: 25 calls per minute = 2500ms between calls
const CJ_RATE_LIMIT_DELAY = 2500;

// Generate proper CJ affiliate tracking link
// CJ uses deep linking via their tracking domains
function generateCJAffiliateLink(merchantUrl: string, advertiserId: string): string {
  if (!CJ_PUBLISHER_ID || !merchantUrl) {
    return merchantUrl;
  }
  
  // CJ deep link format: https://www.jdoqocy.net/click-{pid}-{aid}?url={encoded_url}
  // Alternative domains: anrdoezrs.net, dpbolvw.net, kqzyfj.com
  const encodedUrl = encodeURIComponent(merchantUrl);
  return `https://www.jdoqocy.net/click-${CJ_PUBLISHER_ID}-${advertiserId}?url=${encodedUrl}`;
}

export interface CJProduct {
  id: string;
  catalogId: string;
  title: string;
  description: string;
  price: { amount: number; currency: string };
  link: string;
  imageLink: string;
  advertiserId: string;
  advertiserName: string;
  advertiserCountry: string;
  brand?: string;
  category?: string;
  inStock?: boolean;
}

export interface CJSearchResult {
  totalCount: number;
  products: CJProduct[];
}

export function isCJConfigured(): boolean {
  return !!(CJ_API_TOKEN && CJ_PUBLISHER_ID);
}

// CJ Promotions requires website-id which is different from publisher-id
export function isCJPromotionsConfigured(): boolean {
  return !!(CJ_API_TOKEN && CJ_WEBSITE_ID);
}

// Fast search without per-call delay - for high throughput imports
// Rate limiting is managed at chunk level, not per call
export async function searchCJProductsFast(
  keywords: string,
  limit: number = 1000,
  offset: number = 0
): Promise<CJSearchResult> {
  if (!isCJConfigured()) {
    return { totalCount: 0, products: [] };
  }

  // Note: Removed partnerStatus: JOINED to access wider catalog
  // Products from non-joined advertisers may require approval for full affiliate links
  const query = `
    {
      products(
        companyId: "${CJ_PUBLISHER_ID}",
        keywords: "${keywords.replace(/"/g, '\\"')}",
        limit: ${limit},
        offset: ${offset}
      ) {
        totalCount
        count
        resultList {
          catalogId
          title
          description
          price { amount currency }
          imageLink
          link
          brand
          advertiserId
          advertiserName
          advertiserCountry
        }
      }
    }
  `;

  try {
    const response = await fetch(CJ_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CJ_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.log(`[CJ Fast] API error ${response.status}`);
      if (response.status === 429 || response.status === 403) {
        console.log('[CJ] Rate limited - waiting 3s');
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { totalCount: 0, products: [] };
      }
      return { totalCount: 0, products: [] };
    }

    const data = await response.json();
    if (data.errors) {
      console.log('[CJ Fast] GraphQL errors:', JSON.stringify(data.errors).substring(0, 200));
      return { totalCount: 0, products: [] };
    }

    const records = data.data?.products?.resultList || [];
    const totalCount = data.data?.products?.totalCount || 0;
    console.log(`[CJ Fast] "${keywords}" offset=${offset}: ${records.length} results, total=${totalCount}`);

    const products: CJProduct[] = records.map((r: any) => ({
      id: r.catalogId || `cj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      catalogId: r.catalogId || '',
      title: r.title || '',
      description: r.description || '',
      price: { amount: parseFloat(r.price?.amount) || 0, currency: r.price?.currency || 'GBP' },
      link: r.link || '',
      imageLink: r.imageLink || '',
      advertiserId: r.advertiserId || '',
      advertiserName: r.advertiserName || '',
      advertiserCountry: r.advertiserCountry || 'UK',
      brand: r.brand || '',
      category: '',
      inStock: true,
    }));

    return { totalCount, products };
  } catch (error) {
    return { totalCount: 0, products: [] };
  }
}

export async function searchCJProducts(
  keywords: string,
  limit: number = 20,
  offset: number = 0
): Promise<CJSearchResult> {
  if (!isCJConfigured()) {
    console.log('[CJ] API not configured - missing CJ_API_TOKEN or CJ_PUBLISHER_ID');
    return { totalCount: 0, products: [] };
  }

  // CJ Product Search API - uses 'products' query
  // See: https://developers.cj.com/graphql/reference/Product%20Search
  const query = `
    {
      products(
        companyId: "${CJ_PUBLISHER_ID}",
        partnerStatus: JOINED,
        keywords: "${keywords.replace(/"/g, '\\"')}",
        limit: ${limit},
        offset: ${offset}
      ) {
        totalCount
        count
        resultList {
          catalogId
          title
          description
          price {
            amount
            currency
          }
          imageLink
          link
          brand
          advertiserId
          advertiserName
          advertiserCountry
        }
      }
    }
  `;

  try {
    console.log(`[CJ] Searching for "${keywords}" (limit: ${limit}, offset: ${offset})`);
    
    // Rate limit: 25 calls per minute = 2.5 second delay
    await new Promise(resolve => setTimeout(resolve, CJ_RATE_LIMIT_DELAY));
    
    const response = await fetch(CJ_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CJ_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CJ] API error ${response.status}: ${errorText}`);
      
      // Handle rate limiting with specific error message
      if (response.status === 429 || response.status === 403) {
        console.error('[CJ] Rate limited by CJ API (403/429) - waiting 60 seconds before retry');
        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds
        return { totalCount: 0, products: [] }; // Return empty to let caller continue
      }
      
      // Handle server errors
      if (response.status >= 500) {
        console.error('[CJ] CJ API server error - service may be temporarily unavailable');
        throw new Error('CJ API server error. Please try again later.');
      }
      
      return { totalCount: 0, products: [] };
    }

    const data = await response.json();

    if (data.errors) {
      console.error('[CJ] GraphQL errors:', JSON.stringify(data.errors, null, 2));
      return { totalCount: 0, products: [] };
    }

    const records = data.data?.products?.resultList || [];
    const totalCount = data.data?.products?.totalCount || 0;

    console.log(`[CJ] Found ${records.length} products (total: ${totalCount})`);

    const products: CJProduct[] = records.map((r: any) => ({
      id: r.catalogId || `cj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: r.title || '',
      description: r.description || '',
      price: {
        amount: parseFloat(r.price?.amount) || 0,
        currency: r.price?.currency || 'GBP',
      },
      link: r.link || '',
      imageLink: r.imageLink || '',
      advertiserId: r.advertiserId || '',
      advertiserName: r.advertiserName || '',
      advertiserCountry: r.advertiserCountry || 'UK',
      brand: r.brand || '',
      category: '',
      inStock: true,
    }));

    return { totalCount, products };
  } catch (error) {
    console.error('[CJ] Search error:', error);
    return { totalCount: 0, products: [] };
  }
}

// Known brand names that can be assigned as brands (NOT categories)
const KNOWN_BRANDS = [
  'Barbie', 'Playmobil', 'Sylvanian Families', 'Dr Martens', 'Geox',
  'Start Rite', 'Timberland', 'Pokemon', 'Cocomelon', 'Baby Shark',
  'Thomas the Tank Engine', 'Paddington', 'Bluey', 'Paw Patrol', 'Peppa Pig',
  'Lego', 'Nike', 'Adidas', 'Clarks', 'Crocs', 'Converse', 'Vans',
  'Disney', 'Marvel', 'Star Wars', 'Harry Potter', 'Minecraft', 'Fortnite',
  'Ray-Ban', 'Costa', 'Funko', 'Hasbro', 'Mattel', 'Fisher-Price'
];

// Generic category keywords that should NEVER be assigned as brands
const CATEGORY_KEYWORDS = [
  'toys', 'games', 'kids', 'children', 'baby', 'nursery', 'school',
  'shoes', 'trainers', 'boots', 'sandals', 'sneakers', 'clothing', 'jacket', 'coat', 'dress',
  'home', 'kitchen', 'garden', 'furniture', 'bedding', 'decor',
  'electronics', 'phone', 'tablet', 'laptop', 'headphones', 'speaker',
  'sports', 'fitness', 'outdoor', 'camping', 'cycling', 'running',
  'beauty', 'skincare', 'makeup', 'health', 'wellness',
  'books', 'dvd', 'music', 'gifts', 'christmas',
  'luggage', 'travel', 'holiday'
];

// Helper to derive brand from CJ product data
function deriveBrand(product: CJProduct, searchKeyword: string): string | null {
  // Priority 1: Use CJ brand field if valid (not empty, not generic)
  const genericTerms = ['temu', 'amazon', 'ebay', 'marketplace', 'store', 'shop', 'warner home video'];
  if (product.brand && product.brand.trim().length > 0) {
    const brandLower = product.brand.toLowerCase().trim();
    if (!genericTerms.includes(brandLower)) {
      return product.brand.trim();
    }
  }
  
  // Priority 2: NEVER assign category keywords as brands
  // This prevents "Toys" being assigned as a brand for toy products
  const keywordLower = searchKeyword.toLowerCase().trim();
  if (CATEGORY_KEYWORDS.includes(keywordLower)) {
    return null; // Category keyword, not a brand - don't assign
  }
  
  // Priority 3: STRICT - Only assign search keyword as brand if it's a known brand AND appears in title
  // This prevents "Sylvanian Families" being assigned to "Hair Dryer For Families"
  const titleLower = product.title.toLowerCase();
  
  // Only consider as brand if it's from the known brands list
  const isKnownBrand = KNOWN_BRANDS.some(b => b.toLowerCase() === keywordLower);
  if (!isKnownBrand) {
    return null; // Not a known brand, don't force it
  }
  
  // Check if the COMPLETE keyword phrase appears in the title
  if (titleLower.includes(keywordLower)) {
    return searchKeyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  
  // Priority 4: Return null - don't force a brand if we can't verify it
  return null;
}

export async function importCJProductsToDatabase(
  keywords: string,
  limit: number = 100
): Promise<{ imported: number; skipped: number; errors: number }> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;
  const pageSize = 100; // CJ API typically returns max 100 per page
  let totalAvailable = 0;
  
  let consecutiveEmptyPages = 0;
  const maxEmptyPages = 20; // Increased from 3 - CJ returns overlapping results, need to push through
  
  // Paginate through results until we import 'limit' products or run out of products
  while (imported < limit) {
    const result = await searchCJProducts(keywords, pageSize, offset);
    totalAvailable = result.totalCount;
    
    if (result.products.length === 0) {
      console.log(`[CJ] No more products found for "${keywords}" at offset ${offset}`);
      break;
    }
    
    const importedBefore = imported;

    for (const product of result.products) {
      if (imported >= limit) break;
      
      try {
        // Create unique ID using hash of the product link (contains unique goods_id)
        // CJ often returns duplicate catalogIds from same advertiser for different products
        const linkHash = Buffer.from(product.link).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
        const advertiserHash = product.advertiserName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8);
        const productId = `cj_${advertiserHash}_${linkHash}`;
        
        const existing = await db.select({ id: products.id })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);
        
        if (existing.length > 0) {
          skipped++;
          continue;
        }

        // Map to all required fields that the products schema expects
        const priceValue = product.price.amount > 0 ? product.price.amount : 0.01;
        
        // CRITICAL: Derive proper brand for search visibility
        const derivedBrand = deriveBrand(product, keywords);
        
        // Generate proper CJ affiliate tracking link
        const affiliateLink = generateCJAffiliateLink(product.link, product.advertiserId);
        
        await db.insert(products).values({
          id: productId,
          name: product.title || 'Unknown Product',
          description: product.description || null,
          price: priceValue,
          merchant: product.advertiserName || 'CJ Affiliate',
          merchantId: null, // CJ doesn't provide numeric merchant IDs
          brand: derivedBrand,
          category: product.category || null,
          imageUrl: product.imageLink || null,
          affiliateLink: affiliateLink,
          inStock: product.inStock ?? true,
          // Optional fields set to null - will be populated by search enrichment later
          embedding: null,
          canonicalCategory: null,
          canonicalFranchises: null,
        });
        
        imported++;
      } catch (error) {
        console.error(`[CJ] Failed to import product ${product.id}:`, error);
        errors++;
      }
    }
    
    // Check if we made progress on this page
    if (imported === importedBefore) {
      consecutiveEmptyPages++;
      if (consecutiveEmptyPages >= maxEmptyPages) {
        console.log(`[CJ] Stopping "${keywords}" - ${consecutiveEmptyPages} consecutive pages with no new imports`);
        break;
      }
    } else {
      consecutiveEmptyPages = 0;
    }
    
    offset += pageSize;
    
    // Safety: if we got less than a full page, we've reached the end
    if (result.products.length < pageSize) {
      break;
    }
    
    // Safety: if we've gone past the total available, stop
    if (offset >= totalAvailable) {
      console.log(`[CJ] Reached end of available products for "${keywords}" (${totalAvailable} total)`);
      break;
    }
  }

  console.log(`[CJ] Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return { imported, skipped, errors };
}

export async function testCJConnection(): Promise<{
  success: boolean;
  message: string;
  sampleProducts?: CJProduct[];
}> {
  if (!isCJConfigured()) {
    return {
      success: false,
      message: 'CJ API not configured. Please set CJ_API_TOKEN and CJ_PUBLISHER_ID secrets.',
    };
  }

  try {
    const result = await searchCJProducts('toy', 3);
    
    if (result.totalCount > 0) {
      return {
        success: true,
        message: `CJ API connected! Found ${result.totalCount} products for "toy".`,
        sampleProducts: result.products,
      };
    } else {
      return {
        success: false,
        message: 'CJ API connected but returned no results. Check your publisher ID.',
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `CJ API connection failed: ${error}`,
    };
  }
}

export const PRIORITY_BRANDS = [
  'Barbie',
  'Playmobil',
  'Sylvanian Families',
  'Dr Martens',
  'Geox',
  'Start Rite',
  'Timberland',
  'Pokemon',
  'Cocomelon',
  'Baby Shark',
  'Thomas the Tank Engine',
  'Paddington',
  'Bluey',
  'Paw Patrol',
  'Peppa Pig',
];

// Broad category keywords to access different product segments from CJ's 5.2M catalog
export const BULK_IMPORT_CATEGORIES = [
  // Kids & Family
  'toys', 'games', 'kids', 'children', 'baby', 'nursery', 'school',
  // Fashion & Footwear
  'shoes', 'trainers', 'boots', 'sandals', 'sneakers', 'clothing', 'jacket', 'coat', 'dress',
  // Home & Living
  'home', 'kitchen', 'garden', 'furniture', 'bedding', 'decor',
  // Electronics & Tech
  'electronics', 'phone', 'tablet', 'laptop', 'headphones', 'speaker',
  // Sports & Outdoors
  'sports', 'fitness', 'outdoor', 'camping', 'cycling', 'running',
  // Beauty & Health
  'beauty', 'skincare', 'makeup', 'health', 'wellness',
  // Entertainment
  'books', 'dvd', 'music', 'gifts', 'christmas',
  // Travel
  'luggage', 'travel', 'holiday',
];

export async function importPriorityBrands(limitPerBrand: number = 100): Promise<{
  total: number;
  byBrand: Record<string, number>;
}> {
  const byBrand: Record<string, number> = {};
  let total = 0;

  for (const brand of PRIORITY_BRANDS) {
    console.log(`[CJ] Importing brand: ${brand}`);
    const result = await importCJProductsToDatabase(brand, limitPerBrand);
    byBrand[brand] = result.imported;
    total += result.imported;
  }

  console.log(`[CJ] Priority brands import complete: ${total} total products`);
  return { total, byBrand };
}

// Mass import using price bands and letter prefixes to get unique product sets
// This bypasses keyword overlap and accesses different segments of CJ's 5.2M catalog
export async function massImportCJ(targetProducts: number = 1000000): Promise<{
  total: number;
  byShard: Record<string, number>;
}> {
  const byShard: Record<string, number> = {};
  let total = 0;
  
  // Price bands to segment the catalog
  const priceBands = [
    { label: 'under10', min: 0, max: 10 },
    { label: '10to25', min: 10, max: 25 },
    { label: '25to50', min: 25, max: 50 },
    { label: '50to100', min: 50, max: 100 },
    { label: '100to200', min: 100, max: 200 },
    { label: 'over200', min: 200, max: 10000 },
  ];
  
  // Letter prefixes for product names (a-z)
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  
  console.log(`[CJ Mass Import] Starting - target: ${targetProducts} products`);
  
  // First pass: import by price bands with generic queries
  for (const band of priceBands) {
    if (total >= targetProducts) break;
    
    const shardKey = `price_${band.label}`;
    const limitPerShard = Math.min(50000, targetProducts - total);
    
    console.log(`[CJ Mass Import] Importing shard: ${shardKey} (limit: ${limitPerShard})`);
    
    // Use price band as a filter keyword
    const result = await importCJProductsByPriceRange(band.min, band.max, limitPerShard);
    byShard[shardKey] = result.imported;
    total += result.imported;
    
    console.log(`[CJ Mass Import] Shard ${shardKey}: imported ${result.imported}, total so far: ${total}`);
  }
  
  // Second pass: import by letter prefix to get more unique products
  for (const letter of letters) {
    if (total >= targetProducts) break;
    
    const shardKey = `letter_${letter}`;
    const limitPerShard = Math.min(20000, targetProducts - total);
    
    console.log(`[CJ Mass Import] Importing shard: ${shardKey} (limit: ${limitPerShard})`);
    
    const result = await importCJProductsToDatabase(letter, limitPerShard);
    byShard[shardKey] = result.imported;
    total += result.imported;
    
    console.log(`[CJ Mass Import] Shard ${shardKey}: imported ${result.imported}, total so far: ${total}`);
  }
  
  // Third pass: category keywords with high limits
  for (const category of BULK_IMPORT_CATEGORIES) {
    if (total >= targetProducts) break;
    
    const shardKey = `category_${category}`;
    const limitPerShard = Math.min(30000, targetProducts - total);
    
    console.log(`[CJ Mass Import] Importing shard: ${shardKey} (limit: ${limitPerShard})`);
    
    const result = await importCJProductsToDatabase(category, limitPerShard);
    byShard[shardKey] = result.imported;
    total += result.imported;
    
    console.log(`[CJ Mass Import] Shard ${shardKey}: imported ${result.imported}, total so far: ${total}`);
  }
  
  console.log(`[CJ Mass Import] Complete: ${total} total products imported`);
  return { total, byShard };
}

// Import products within a price range (no keyword filter)
async function importCJProductsByPriceRange(
  minPrice: number,
  maxPrice: number,
  limit: number
): Promise<{ imported: number; skipped: number; errors: number }> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;
  const pageSize = 100;
  
  // CJ doesn't support price filtering in GraphQL, so we use a broad query and filter client-side
  const keywords = maxPrice <= 25 ? 'gift' : maxPrice <= 100 ? 'home' : 'premium';
  
  while (imported < limit && offset < 10000) { // CJ offset limit
    const result = await searchCJProducts(keywords, pageSize, offset);
    
    if (result.products.length === 0) break;
    
    for (const product of result.products) {
      if (imported >= limit) break;
      
      // Filter by price range
      const price = product.price.amount;
      if (price < minPrice || price > maxPrice) continue;
      
      try {
        // Create unique ID using hash of the product link
        const linkHash = Buffer.from(product.link).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
        const advertiserHash = product.advertiserName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 8);
        const productId = `cj_${advertiserHash}_${linkHash}`;
        
        const existing = await db.select({ id: products.id })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);
        
        if (existing.length > 0) {
          skipped++;
          continue;
        }

        const priceValue = product.price.amount > 0 ? product.price.amount : 0.01;
        const affiliateLink = generateCJAffiliateLink(product.link, product.advertiserId);
        
        await db.insert(products).values({
          id: productId,
          name: product.title || 'Unknown Product',
          description: product.description || null,
          price: priceValue,
          merchant: product.advertiserName || 'CJ Affiliate',
          merchantId: null,
          brand: product.brand || null,
          category: product.category || null,
          imageUrl: product.imageLink || null,
          affiliateLink: affiliateLink,
          inStock: product.inStock ?? true,
          embedding: null,
          canonicalCategory: null,
          canonicalFranchises: null,
        });
        
        imported++;
      } catch (error) {
        errors++;
      }
    }
    
    offset += pageSize;
  }

  return { imported, skipped, errors };
}

// Backfill brands for existing CJ products that have null or generic brands
export async function backfillCJBrands(): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;
  
  // Get CJ products with null or generic brands
  const genericBrands = ['temu', 'amazon', 'ebay', ''];
  const cjProducts = await db.select({ 
    id: products.id, 
    name: products.name, 
    brand: products.brand 
  })
    .from(products)
    .where(sql`id LIKE 'cj_%'`);
  
  console.log(`[CJ Backfill] Found ${cjProducts.length} CJ products to check`);
  
  for (const product of cjProducts) {
    const currentBrand = product.brand?.toLowerCase().trim() || '';
    
    // Skip if brand is already valid
    if (currentBrand && !genericBrands.includes(currentBrand) && currentBrand !== 'warner home video') {
      continue;
    }
    
    try {
      // Try to extract brand from product name
      let newBrand: string | null = null;
      const nameLower = product.name.toLowerCase();
      
      for (const priorityBrand of PRIORITY_BRANDS) {
        if (nameLower.includes(priorityBrand.toLowerCase())) {
          newBrand = priorityBrand;
          break;
        }
      }
      
      if (newBrand) {
        await db.update(products)
          .set({ brand: newBrand })
          .where(eq(products.id, product.id));
        updated++;
        console.log(`[CJ Backfill] Updated ${product.id}: brand = "${newBrand}"`);
      }
    } catch (error) {
      console.error(`[CJ Backfill] Error updating ${product.id}:`, error);
      errors++;
    }
  }
  
  console.log(`[CJ Backfill] Complete: ${updated} updated, ${errors} errors`);
  return { updated, errors };
}

// Get total available products and advertiser info from CJ
export async function getCJStats(): Promise<{
  totalAvailable: number;
  advertisers: { id: string; name: string; country: string }[];
  currentImported: number;
}> {
  if (!isCJConfigured()) {
    return { totalAvailable: 0, advertisers: [], currentImported: 0 };
  }

  // Get a sample to find total count and unique advertisers
  const query = `
    {
      products(
        companyId: "${CJ_PUBLISHER_ID}",
        partnerStatus: JOINED,
        limit: 100,
        offset: 0
      ) {
        totalCount
        resultList {
          advertiserId
          advertiserName
          advertiserCountry
        }
      }
    }
  `;

  try {
    await new Promise(resolve => setTimeout(resolve, CJ_RATE_LIMIT_DELAY));
    
    const response = await fetch(CJ_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CJ_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    const advertisersMap = new Map<string, { name: string; country: string }>();
    
    data.data?.products?.resultList?.forEach((p: any) => {
      if (!advertisersMap.has(p.advertiserId)) {
        advertisersMap.set(p.advertiserId, { 
          name: p.advertiserName, 
          country: p.advertiserCountry 
        });
      }
    });

    // Count current CJ products in database
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(sql`id LIKE 'cj_%'`);
    
    const currentImported = Number(countResult[0]?.count) || 0;

    return {
      totalAvailable: data.data?.products?.totalCount || 0,
      advertisers: Array.from(advertisersMap.entries()).map(([id, info]) => ({
        id,
        name: info.name,
        country: info.country,
      })),
      currentImported,
    };
  } catch (error) {
    console.error('[CJ] Error getting stats:', error);
    return { totalAvailable: 0, advertisers: [], currentImported: 0 };
  }
}

// Bulk import using category keywords (bypasses pagination limit)
export async function bulkImportCJProducts(
  limitPerCategory: number = 5000,
  categories?: string[]
): Promise<{
  total: number;
  byCategory: Record<string, number>;
  duration: number;
}> {
  const startTime = Date.now();
  const byCategory: Record<string, number> = {};
  let total = 0;
  
  const categoriesToImport = categories || BULK_IMPORT_CATEGORIES;
  
  console.log(`[CJ Bulk] Starting bulk import for ${categoriesToImport.length} categories (${limitPerCategory} max per category)`);
  
  for (const category of categoriesToImport) {
    console.log(`[CJ Bulk] Importing category: ${category}`);
    const result = await importCJProductsToDatabase(category, limitPerCategory);
    byCategory[category] = result.imported;
    total += result.imported;
    
    // Small delay between categories to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[CJ Bulk] Complete: ${total} products in ${duration}s`);
  
  return { total, byCategory, duration };
}

// Import products by specific advertiser ID
export async function importByAdvertiser(
  advertiserId: string,
  limit: number = 10000
): Promise<{ imported: number; skipped: number; errors: number }> {
  // Use a broad query to get products from specific advertiser
  // CJ API doesn't have direct advertiser filter, so we search and filter
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;
  const pageSize = 100;
  
  console.log(`[CJ] Importing from advertiser ${advertiserId} (limit: ${limit})`);
  
  while (imported < limit) {
    const query = `
      {
        products(
          companyId: "${CJ_PUBLISHER_ID}",
          partnerStatus: JOINED,
          limit: ${pageSize},
          offset: ${offset}
        ) {
          totalCount
          resultList {
            catalogId
            title
            description
            price { amount currency }
            imageLink
            link
            brand
            advertiserId
            advertiserName
            advertiserCountry
          }
        }
      }
    `;

    try {
      await new Promise(resolve => setTimeout(resolve, CJ_RATE_LIMIT_DELAY));
      
      const response = await fetch(CJ_GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CJ_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      const results = data.data?.products?.resultList || [];
      
      if (results.length === 0) break;
      
      // Filter and import products from target advertiser
      for (const product of results) {
        if (product.advertiserId !== advertiserId) continue;
        if (imported >= limit) break;
        
        try {
          const advertiserHash = product.advertiserName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
          const productId = `cj_${advertiserHash}_${product.catalogId}`;
          
          const existing = await db.select({ id: products.id })
            .from(products)
            .where(eq(products.id, productId))
            .limit(1);
          
          if (existing.length > 0) {
            skipped++;
            continue;
          }
          
          // Generate proper CJ affiliate tracking link
          const affiliateLink = generateCJAffiliateLink(product.link, product.advertiserId);
          
          await db.insert(products).values({
            id: productId,
            name: product.title || 'Unknown',
            description: product.description || null,
            price: parseFloat(product.price?.amount) || 0.01,
            merchant: product.advertiserName || 'CJ Affiliate',
            merchantId: null,
            brand: product.brand || null,
            category: null,
            imageUrl: product.imageLink || null,
            affiliateLink: affiliateLink,
            inStock: true,
            embedding: null,
            canonicalCategory: null,
            canonicalFranchises: null,
          });
          
          imported++;
        } catch (error) {
          errors++;
        }
      }
      
      offset += pageSize;
      if (offset >= 10000) break; // CJ pagination limit
      
    } catch (error) {
      console.error(`[CJ] Error fetching page at offset ${offset}:`, error);
      break;
    }
  }
  
  console.log(`[CJ] Advertiser import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  return { imported, skipped, errors };
}

// Keywords to cycle through for bulk import
const IMPORT_KEYWORDS = [
  'gift', 'toys', 'kids', 'baby', 'shoes', 'home', 'kitchen', 'garden',
  'electronics', 'phone', 'sports', 'fitness', 'beauty', 'books', 'clothing',
  'jacket', 'dress', 'furniture', 'games', 'outdoor', 'camping', 'luggage'
];

// Chunked import - imports a small batch and saves progress
// Call this repeatedly until done. Each call takes ~50 seconds.
export async function importCJChunk(maxCalls: number = 20): Promise<{
  imported: number;
  keyword: string;
  offset: number;
  totalImported: number;
  done: boolean;
}> {
  // Get or create import state
  let state = await db.select().from(cjImportState).where(eq(cjImportState.id, 'current')).limit(1);
  
  if (state.length === 0) {
    await db.insert(cjImportState).values({
      id: 'current',
      keyword: IMPORT_KEYWORDS[0],
      offset: 0,
      totalImported: 0,
    });
    state = await db.select().from(cjImportState).where(eq(cjImportState.id, 'current')).limit(1);
  }
  
  let { keyword, offset, totalImported } = state[0];
  let imported = 0;
  let callsMade = 0;
  const pageSize = 1000; // CJ supports up to 1000 per page for high throughput
  const startTime = Date.now();
  const maxDurationMs = 50000; // 50 second max for good progress
  
  console.log(`[CJ Chunk] Starting from keyword="${keyword}", offset=${offset}, total=${totalImported}`);
  
  while (callsMade < maxCalls && (Date.now() - startTime) < maxDurationMs) {
    const result = await searchCJProductsFast(keyword, pageSize, offset);
    callsMade++;
    
    if (result.products.length === 0 || offset >= 10000) {
      // Move to next keyword
      const currentIndex = IMPORT_KEYWORDS.indexOf(keyword);
      const nextIndex = currentIndex + 1;
      
      if (nextIndex >= IMPORT_KEYWORDS.length) {
        // All keywords done - reset for next cycle
        await db.update(cjImportState)
          .set({ keyword: IMPORT_KEYWORDS[0], offset: 0, totalImported, lastUpdated: new Date() })
          .where(eq(cjImportState.id, 'current'));
        console.log(`[CJ Chunk] All keywords complete. Total: ${totalImported}`);
        return { imported, keyword, offset: 0, totalImported, done: true };
      }
      
      keyword = IMPORT_KEYWORDS[nextIndex];
      offset = 0;
      console.log(`[CJ Chunk] Moving to next keyword: ${keyword}`);
      continue;
    }
    
    // Import products
    let skipped = 0;
    let errors = 0;
    for (const product of result.products) {
      try {
        // Use catalogId for unique ID, or create robust hash from link+title
        let productSuffix: string;
        if (product.catalogId && product.catalogId.length > 0) {
          productSuffix = product.catalogId;
        } else {
          // Create collision-resistant hash from link + title
          const hashInput = `${product.advertiserId}:${product.link}:${product.title}`;
          const hash = Buffer.from(hashInput).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
          productSuffix = hash.substring(0, 24);
        }
        const advertiserHash = product.advertiserName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
        const productId = `cj_${advertiserHash}_${productSuffix}`;
        
        const existing = await db.select({ id: products.id })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);
        
        if (existing.length > 0) {
          skipped++;
          if (skipped <= 5) {
            console.log(`[CJ Chunk] Skip exists: ${productId}`);
          }
          continue;
        }
        
        if (imported < 5) {
          console.log(`[CJ Chunk] New product: ${productId}`);
        }
        
        const affiliateLink = generateCJAffiliateLink(product.link, product.advertiserId);
        
        await db.insert(products).values({
          id: productId,
          name: product.title || 'Unknown Product',
          description: product.description || null,
          price: product.price.amount > 0 ? product.price.amount : 0.01,
          merchant: product.advertiserName || 'CJ Affiliate',
          merchantId: null,
          brand: product.brand || null,
          category: product.category || null,
          imageUrl: product.imageLink || null,
          affiliateLink: affiliateLink,
          inStock: product.inStock ?? true,
          source: 'cj',
        });
        
        imported++;
        totalImported++;
      } catch (error) {
        errors++;
        if (errors <= 3) {
          console.log('[CJ Chunk] Insert error:', (error as Error).message);
        }
      }
    }
    
    console.log(`[CJ Chunk] Page done: ${result.products.length} fetched, ${imported} new, ${skipped} skipped, ${errors} errors`);
    offset += pageSize;
  }
  
  // Save progress
  await db.update(cjImportState)
    .set({ keyword, offset, totalImported, lastUpdated: new Date() })
    .where(eq(cjImportState.id, 'current'));
  
  console.log(`[CJ Chunk] Chunk complete: +${imported} this chunk, ${totalImported} total`);
  return { imported, keyword, offset, totalImported, done: false };
}

// Reset import state to start fresh
export async function resetCJImportState(): Promise<void> {
  await db.delete(cjImportState).where(eq(cjImportState.id, 'current'));
  console.log('[CJ] Import state reset');
}

// Get current import status
export async function getCJImportStatus(): Promise<{
  keyword: string;
  offset: number;
  totalImported: number;
  lastUpdated: Date | null;
} | null> {
  const state = await db.select().from(cjImportState).where(eq(cjImportState.id, 'current')).limit(1);
  if (state.length === 0) return null;
  return state[0];
}

// ============================================
// CJ PROMOTIONS / LINK-SEARCH API
// ============================================
// CJ Link-Search REST API for promotions/vouchers/coupons
// See: https://developers.cj.com/docs/rest-apis/link-search

const CJ_LINK_SEARCH_ENDPOINT = 'https://link-search.api.cj.com/v2/link-search';

export interface CJPromotion {
  linkId: number;
  advertiserId: number;
  advertiserName: string;
  linkName: string;
  description: string;
  linkType: string;
  promotionType?: string;
  couponCode?: string;
  startDate?: string;
  endDate?: string;
  clickUrl: string;
  category?: string;
}

// Cache for CJ promotions
let cjPromotionsCache: CJPromotion[] | null = null;
let cjPromotionsCacheTime: number = 0;
const CJ_PROMOTIONS_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

// CJ promotions indexed by normalized advertiser name
let cjPromotionsByMerchant: Map<string, CJPromotion[]> = new Map();
let cjPromotionsIndexTime: number = 0;

// Normalize merchant name for matching
function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*(uk|eu|europe|usa|us|gb|direct|plc|ltd|limited|com|co\.uk)\s*$/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/and/g, '')
    .trim();
}

// Fetch CJ promotions using Link-Search API
export async function fetchCJPromotions(): Promise<CJPromotion[]> {
  if (!isCJPromotionsConfigured()) {
    console.log('[CJ Promotions] Not configured - need CJ_API_TOKEN and CJ_WEBSITE_ID');
    return [];
  }

  if (cjPromotionsCache && Date.now() - cjPromotionsCacheTime < CJ_PROMOTIONS_CACHE_DURATION) {
    return cjPromotionsCache;
  }

  try {
    console.log('[CJ Promotions] Fetching promotions from Link-Search API...');
    const allPromotions: CJPromotion[] = [];
    
    // Fetch different promotion types
    const promotionTypes = ['coupon', 'sale'];
    
    for (const promoType of promotionTypes) {
      const params = new URLSearchParams({
        'website-id': CJ_WEBSITE_ID!,
        'link-type': 'Text Link',
        'promotion-type': promoType,
        'records-per-page': '100'
      });
      
      const url = `${CJ_LINK_SEARCH_ENDPOINT}?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${CJ_API_TOKEN}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(`[CJ Promotions] API error for ${promoType}: ${response.status} - ${errorText.substring(0, 200)}`);
        continue;
      }
      
      const data = await response.json();
      const links = data?.links || [];
      
      console.log(`[CJ Promotions] Found ${links.length} ${promoType} promotions`);
      
      for (const link of links) {
        allPromotions.push({
          linkId: link.linkId,
          advertiserId: link.advertiserId,
          advertiserName: link.advertiserName || '',
          linkName: link.linkName || '',
          description: link.description || '',
          linkType: link.linkType || '',
          promotionType: link.promotionType || promoType,
          couponCode: link.couponCode || undefined,
          startDate: link.promotionStartDate,
          endDate: link.promotionEndDate,
          clickUrl: link.clickUrl || link.linkCodeJavascript || '',
          category: link.category || undefined
        });
      }
      
      // Rate limit between calls
      await new Promise(r => setTimeout(r, 500));
    }
    
    cjPromotionsCache = allPromotions;
    cjPromotionsCacheTime = Date.now();
    console.log(`[CJ Promotions] Cached ${allPromotions.length} total promotions`);
    
    return allPromotions;
  } catch (error) {
    console.error('[CJ Promotions] Fetch error:', error);
    return cjPromotionsCache || [];
  }
}

// Build index of CJ promotions by merchant name
export async function buildCJPromotionsIndex(): Promise<void> {
  const promotions = await fetchCJPromotions();
  const now = Date.now();
  
  if (cjPromotionsIndexTime > 0 && now - cjPromotionsIndexTime < CJ_PROMOTIONS_CACHE_DURATION) {
    return;
  }
  
  cjPromotionsByMerchant.clear();
  
  for (const promo of promotions) {
    if (!promo.advertiserName) continue;
    
    const normalizedName = normalizeMerchantName(promo.advertiserName);
    if (!cjPromotionsByMerchant.has(normalizedName)) {
      cjPromotionsByMerchant.set(normalizedName, []);
    }
    cjPromotionsByMerchant.get(normalizedName)!.push(promo);
  }
  
  cjPromotionsIndexTime = now;
  console.log(`[CJ Promotions] Built index with ${cjPromotionsByMerchant.size} merchants, ${promotions.length} total promotions`);
}

// CJ promotion metadata (matching Awin's ProductPromotion interface)
export interface CJProductPromotion {
  promotionTitle: string;
  voucherCode?: string;
  expiresAt?: string;
  promotionType: string;
  advertiserId: number;
  source: 'cj';
}

// Get active CJ promotions for a merchant name
export async function getCJPromotionsForMerchant(merchantName: string): Promise<CJProductPromotion[]> {
  await buildCJPromotionsIndex();
  
  const normalizedName = normalizeMerchantName(merchantName);
  const promos = cjPromotionsByMerchant.get(normalizedName) || [];
  
  // Also try partial matches
  const allMatches: CJPromotion[] = [...promos];
  for (const [key, values] of cjPromotionsByMerchant) {
    if (key !== normalizedName && (key.includes(normalizedName) || normalizedName.includes(key))) {
      allMatches.push(...values);
    }
  }
  
  // Filter to active promotions only
  const now = new Date();
  const activePromos = allMatches.filter(p => {
    if (!p.endDate) return true; // No end date = always active
    const endDate = new Date(p.endDate);
    return endDate > now;
  });
  
  return activePromos.map(p => ({
    promotionTitle: p.linkName || p.description,
    voucherCode: p.couponCode,
    expiresAt: p.endDate?.split('T')[0],
    promotionType: p.promotionType || 'promotion',
    advertiserId: p.advertiserId,
    source: 'cj' as const
  }));
}

// Get all active CJ promotions indexed by merchant name
export async function getAllCJActivePromotions(): Promise<Map<string, CJProductPromotion[]>> {
  await buildCJPromotionsIndex();
  
  const result = new Map<string, CJProductPromotion[]>();
  const now = new Date();
  
  for (const [merchantName, promos] of cjPromotionsByMerchant) {
    const activePromos = promos
      .filter(p => !p.endDate || new Date(p.endDate) > now)
      .map(p => ({
        promotionTitle: p.linkName || p.description,
        voucherCode: p.couponCode,
        expiresAt: p.endDate?.split('T')[0],
        promotionType: p.promotionType || 'promotion',
        advertiserId: p.advertiserId,
        source: 'cj' as const
      }));
    
    if (activePromos.length > 0) {
      result.set(merchantName, activePromos);
    }
  }
  
  return result;
}

// Get CJ promotions count for status reporting
export function getCJPromotionsCount(): number {
  return cjPromotionsCache?.length || 0;
}
