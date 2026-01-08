import { db } from '../db';
import { productsV2 } from '../../shared/schema';
import { sql } from 'drizzle-orm';

const AWIN_API_KEY = process.env.AWIN_API_KEY;
const AWIN_PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;
const MIN_PRODUCTS_THRESHOLD = 1000;

interface BootstrapStatus {
  status: 'idle' | 'checking' | 'importing' | 'complete' | 'error';
  message: string;
  productsCount: number;
  importedCount: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

let bootstrapStatus: BootstrapStatus = {
  status: 'idle',
  message: 'Not started',
  productsCount: 0,
  importedCount: 0
};

export function getBootstrapStatus(): BootstrapStatus {
  return { ...bootstrapStatus };
}

interface AwinEnhancedProduct {
  meta?: { advertiser_id: number; advertiser_name: string };
  id?: string;
  title?: string;
  description?: string;
  link?: string;
  image_link?: string;
  price?: string;
  sale_price?: string;
  brand?: string;
  google_product_category?: string;
  product_type?: string;
  availability?: string;
}

const ENHANCED_FEED_ADVERTISERS = [
  899, 2642, 1234, 5678
];

async function fetchEnhancedFeed(advertiserId: number): Promise<AwinEnhancedProduct[]> {
  if (!AWIN_API_KEY || !AWIN_PUBLISHER_ID) return [];

  try {
    const url = `https://api.awin.com/publishers/${AWIN_PUBLISHER_ID}/awinfeeds/download/${advertiserId}-retail-en_GB.jsonl`;
    console.log(`[Bootstrap] Fetching Enhanced Feed for advertiser ${advertiserId}...`);
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AWIN_API_KEY}` }
    });

    if (!response.ok) {
      console.log(`[Bootstrap] Advertiser ${advertiserId} feed not available (${response.status})`);
      return [];
    }

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    const products: AwinEnhancedProduct[] = [];
    
    for (const line of lines) {
      try {
        const product = JSON.parse(line);
        products.push(product);
      } catch {
      }
    }
    
    console.log(`[Bootstrap] Fetched ${products.length} products from advertiser ${advertiserId}`);
    return products;
  } catch (error) {
    console.error(`[Bootstrap] Error fetching feed for advertiser ${advertiserId}:`, error);
    return [];
  }
}

function parsePrice(priceStr?: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function importProducts(products: AwinEnhancedProduct[]): Promise<number> {
  if (products.length === 0) return 0;
  
  const BATCH_SIZE = 500;
  let imported = 0;
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const validProducts = batch
      .filter(p => p.id && p.title && p.link && parsePrice(p.price))
      .map(p => {
        const price = parsePrice(p.price);
        return {
          id: p.id!,
          name: (p.title || '').slice(0, 500),
          description: (p.description || '').slice(0, 2000),
          merchant: p.meta?.advertiser_name || 'Unknown',
          category: p.google_product_category || p.product_type || null,
          brand: p.brand || null,
          price: price!,
          imageUrl: p.image_link || null,
          affiliateLink: p.link!, // Already filtered for link above
          inStock: p.availability === 'in stock'
        };
      });
    
    if (validProducts.length > 0) {
      try {
        await db.insert(productsV2)
          .values(validProducts)
          .onConflictDoNothing();
        imported += validProducts.length;
        bootstrapStatus.importedCount = imported;
        console.log(`[Bootstrap] Imported batch: ${imported} total products`);
      } catch (error) {
        console.error(`[Bootstrap] Error inserting batch:`, error);
      }
    }
  }
  
  return imported;
}

export async function checkAndBootstrapProducts(): Promise<void> {
  bootstrapStatus = {
    status: 'checking',
    message: 'Checking products count...',
    productsCount: 0,
    importedCount: 0,
    startedAt: new Date()
  };
  
  try {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(productsV2)
      .limit(1);
    
    const count = result[0]?.count || 0;
    bootstrapStatus.productsCount = count;
    
    console.log(`[Bootstrap] Current products_v2 count: ${count}`);
    
    if (count >= MIN_PRODUCTS_THRESHOLD) {
      bootstrapStatus = {
        ...bootstrapStatus,
        status: 'complete',
        message: `Database already has ${count} products. No bootstrap needed.`,
        completedAt: new Date()
      };
      console.log(`[Bootstrap] Database has ${count} products. No bootstrap needed.`);
      return;
    }
    
    console.log(`[Bootstrap] Database has only ${count} products. Starting import from Awin...`);
    bootstrapStatus.status = 'importing';
    bootstrapStatus.message = 'Fetching products from Awin feeds...';
    
    if (!AWIN_API_KEY || !AWIN_PUBLISHER_ID) {
      bootstrapStatus = {
        ...bootstrapStatus,
        status: 'error',
        message: 'AWIN_API_KEY or AWIN_PUBLISHER_ID not configured',
        error: 'Missing Awin credentials'
      };
      console.error('[Bootstrap] AWIN_API_KEY or AWIN_PUBLISHER_ID not configured');
      return;
    }
    
    let totalImported = 0;
    for (const advertiserId of ENHANCED_FEED_ADVERTISERS) {
      const products = await fetchEnhancedFeed(advertiserId);
      if (products.length > 0) {
        const imported = await importProducts(products);
        totalImported += imported;
      }
    }
    
    bootstrapStatus = {
      ...bootstrapStatus,
      status: 'complete',
      message: `Bootstrap complete. Imported ${totalImported} products.`,
      importedCount: totalImported,
      completedAt: new Date()
    };
    
    console.log(`[Bootstrap] Complete. Imported ${totalImported} products.`);
    
  } catch (error) {
    const err = error as Error;
    bootstrapStatus = {
      ...bootstrapStatus,
      status: 'error',
      message: `Bootstrap failed: ${err.message}`,
      error: err.message
    };
    console.error('[Bootstrap] Error:', err);
  }
}

export async function triggerManualBootstrap(): Promise<BootstrapStatus> {
  if (bootstrapStatus.status === 'importing') {
    return bootstrapStatus;
  }
  
  checkAndBootstrapProducts();
  
  return bootstrapStatus;
}
