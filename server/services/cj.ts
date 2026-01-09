import { db } from "../db";
import { products } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const CJ_API_TOKEN = process.env.CJ_API_TOKEN;
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID;

// CJ Product Feed API endpoint (from docs: https://ads.api.cj.com/query)
const CJ_GRAPHQL_ENDPOINT = 'https://ads.api.cj.com/query';

export interface CJProduct {
  id: string;
  title: string;
  description: string;
  price: { amount: number; currency: string };
  link: string;
  imageLink: string;
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

export async function searchCJProducts(
  keywords: string,
  limit: number = 20,
  offset: number = 0
): Promise<CJSearchResult> {
  if (!isCJConfigured()) {
    console.log('[CJ] API not configured - missing CJ_API_TOKEN or CJ_PUBLISHER_ID');
    return { totalCount: 0, products: [] };
  }

  // CJ Product Feed API - uses 'products' query with companyId
  // See: https://developers.cj.com/graphql/reference/Product%20Feed
  // Field names verified from API error messages
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
    console.log(`[CJ] Searching for "${keywords}" (limit: ${limit})`);
    
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
      if (response.status === 429) {
        console.error('[CJ] Rate limited by CJ API - please wait before retrying');
        throw new Error('CJ API rate limit exceeded. Please wait before retrying.');
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
      advertiserName: r.advertiserName || '',
      advertiserCountry: r.advertiserCountry || 'UK',
      brand: r.brand || '',
      category: '',
      inStock: true, // Not available in CJ API
    }));

    return { totalCount, products };
  } catch (error) {
    console.error('[CJ] Search error:', error);
    return { totalCount: 0, products: [] };
  }
}

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
  
  // Priority 2: STRICT - Only assign search keyword as brand if the FULL keyword appears in the title
  // This prevents "Sylvanian Families" being assigned to "Hair Dryer For Families"
  const keywordLower = searchKeyword.toLowerCase().trim();
  const titleLower = product.title.toLowerCase();
  
  // Check if the COMPLETE keyword phrase appears in the title
  if (titleLower.includes(keywordLower)) {
    // Verify this is a real match - the keyword should appear as a distinct phrase
    // For multi-word brands, require ALL words to appear together or at start
    const keywordWords = keywordLower.split(/\s+/);
    if (keywordWords.length > 1) {
      // Multi-word brand: require consecutive appearance or prominent placement
      const titleStart = titleLower.substring(0, 50);
      if (titleLower.includes(keywordLower) || titleStart.includes(keywordWords[0])) {
        return searchKeyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    } else {
      // Single word brand
      return searchKeyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }
  
  // Priority 3: Return null - don't force a brand if we can't verify it
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
  const maxEmptyPages = 3; // Stop after 3 consecutive pages with 0 new imports
  
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
        // Create unique ID using advertiser name hash + catalog ID to avoid collisions
        // across different advertisers who might reuse numeric catalogIds
        const advertiserHash = product.advertiserName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
        const productId = `cj_${advertiserHash}_${product.id}`;
        
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
          affiliateLink: product.link || '',
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
            affiliateLink: product.link || '',
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
