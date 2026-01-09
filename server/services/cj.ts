import { db } from "../db";
import { products } from "@shared/schema";
import { eq } from "drizzle-orm";

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
  limit: number = 20
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
        limit: ${limit}
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

export async function importCJProductsToDatabase(
  keywords: string,
  limit: number = 100
): Promise<{ imported: number; skipped: number; errors: number }> {
  const result = await searchCJProducts(keywords, limit);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const product of result.products) {
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
      
      await db.insert(products).values({
        id: productId,
        name: product.title || 'Unknown Product',
        description: product.description || null,
        price: priceValue,
        merchant: product.advertiserName || 'CJ Affiliate',
        merchantId: null, // CJ doesn't provide numeric merchant IDs
        brand: product.brand || null,
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

export async function importPriorityBrands(): Promise<{
  total: number;
  byBrand: Record<string, number>;
}> {
  const byBrand: Record<string, number> = {};
  let total = 0;

  for (const brand of PRIORITY_BRANDS) {
    console.log(`[CJ] Importing brand: ${brand}`);
    const result = await importCJProductsToDatabase(brand, 100);
    byBrand[brand] = result.imported;
    total += result.imported;
  }

  console.log(`[CJ] Priority brands import complete: ${total} total products`);
  return { total, byBrand };
}
