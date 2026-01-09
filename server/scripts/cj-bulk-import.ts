// CJ Bulk Feed Import - Feed-based approach for 1M+ products
// Uses shoppingProductFeeds to discover feeds, then downloads each feed completely

import { db } from '../db';
import { products, cjImportState } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const CJ_API_TOKEN = process.env.CJ_API_TOKEN;
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID;
const CJ_API_URL = 'https://ads.api.cj.com/query';

interface FeedInfo {
  advertiserId: string;
  advertiserName: string;
  feedName: string;
  productCount: number;
  lastUpdated: string;
}

// Step 1: Discover all available product feeds
async function discoverFeeds(): Promise<FeedInfo[]> {
  console.log('[CJ Bulk] Discovering available product feeds...');
  
  const feeds: FeedInfo[] = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const query = `
      query {
        shoppingProductFeeds(
          companyId: "${CJ_PUBLISHER_ID}"
          limit: ${limit}
          offset: ${offset}
        ) {
          totalCount
          count
          resultList {
            advertiserId
            advertiserName
            feedName
            productCount
            lastUpdated
          }
        }
      }
    `;

    const response = await fetch(CJ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CJ_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error('[CJ Bulk] Feed discovery error:', response.status);
      break;
    }

    const data = await response.json();
    if (data.errors) {
      console.error('[CJ Bulk] GraphQL errors:', data.errors);
      break;
    }

    const results = data.data?.shoppingProductFeeds?.resultList || [];
    if (results.length === 0) break;

    feeds.push(...results);
    console.log(`[CJ Bulk] Discovered ${feeds.length} feeds so far...`);

    offset += limit;
    
    // Rate limit
    await new Promise(r => setTimeout(r, 3000));
    
    if (results.length < limit) break;
  }

  // Sort by product count descending - import largest feeds first
  feeds.sort((a, b) => (b.productCount || 0) - (a.productCount || 0));
  
  console.log(`[CJ Bulk] Total feeds discovered: ${feeds.length}`);
  const totalProducts = feeds.reduce((sum, f) => sum + (f.productCount || 0), 0);
  console.log(`[CJ Bulk] Total products available: ${totalProducts.toLocaleString()}`);
  
  return feeds;
}

// Step 2: Import all products from a specific feed
async function importFeed(feed: FeedInfo, stateId: string): Promise<number> {
  console.log(`\n[CJ Bulk] Importing feed: ${feed.advertiserName} (${feed.productCount} products)`);
  
  let imported = 0;
  let offset = 0;
  const limit = 100;
  
  // Check if we have a saved offset for this feed
  const savedState = await db.select()
    .from(cjImportState)
    .where(eq(cjImportState.id, stateId))
    .limit(1);
  
  if (savedState.length > 0 && savedState[0].keyword === feed.advertiserId) {
    offset = savedState[0].offset || 0;
    imported = savedState[0].totalImported || 0;
    console.log(`[CJ Bulk] Resuming from offset ${offset}, already imported ${imported}`);
  }

  while (true) {
    const query = `
      query {
        shoppingProducts(
          companyId: "${CJ_PUBLISHER_ID}"
          advertiserId: "${feed.advertiserId}"
          limit: ${limit}
          offset: ${offset}
        ) {
          totalCount
          count
          resultList {
            catalogId
            title
            description
            link
            imageLink
            price { amount currency }
            salePrice { amount currency }
            brand
            availability
            condition
            gtin
            mpn
            productType
          }
        }
      }
    `;

    try {
      const response = await fetch(CJ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CJ_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        if (response.status === 429 || response.status === 403) {
          console.log('[CJ Bulk] Rate limited, waiting 60s...');
          await new Promise(r => setTimeout(r, 60000));
          continue;
        }
        console.error(`[CJ Bulk] API error: ${response.status}`);
        break;
      }

      const data = await response.json();
      if (data.errors) {
        console.error('[CJ Bulk] GraphQL errors:', data.errors[0]?.message);
        break;
      }

      const results = data.data?.shoppingProducts?.resultList || [];
      if (results.length === 0) {
        console.log(`[CJ Bulk] Feed complete: ${feed.advertiserName}`);
        break;
      }

      // Batch insert products
      let batchInserted = 0;
      for (const p of results) {
        const productId = generateProductId(feed.advertiserId, p);
        
        try {
          const result = await db.insert(products).values({
            id: productId,
            name: p.title || 'Unknown',
            description: p.description || '',
            merchant: feed.advertiserName,
            merchantId: feed.advertiserId,
            brand: p.brand || '',
            price: parseFloat(p.price?.amount) || 0,
            affiliateLink: p.link || '',
            imageUrl: p.imageLink || '',
            inStock: p.availability === 'in stock',
            source: 'cj',
          }).onConflictDoNothing().returning({ id: products.id });
          
          if (result.length > 0) {
            batchInserted++;
            imported++;
          }
        } catch (e) {
          // Ignore individual insert errors
        }
      }

      offset += limit;
      
      // Save state after each batch
      await db.insert(cjImportState).values({
        id: stateId,
        keyword: feed.advertiserId,
        offset: offset,
        totalImported: imported,
        lastUpdated: new Date(),
      }).onConflictDoUpdate({
        target: cjImportState.id,
        set: { keyword: feed.advertiserId, offset: offset, totalImported: imported, lastUpdated: new Date() }
      });

      console.log(`[CJ Bulk] ${feed.advertiserName}@${offset}: +${batchInserted}, total=${imported}`);

      // Rate limit: 3 seconds between calls
      await new Promise(r => setTimeout(r, 3000));

      // Stop if we've gone past the feed's product count
      if (offset >= (feed.productCount || 10000)) break;
      
      // Safety limit
      if (offset >= 100000) {
        console.log('[CJ Bulk] Hit safety limit of 100k for single feed');
        break;
      }

    } catch (error) {
      console.error('[CJ Bulk] Error:', error);
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  return imported;
}

function generateProductId(advertiserId: string, p: any): string {
  if (p.catalogId && p.catalogId.trim()) {
    return `cj_${advertiserId}_${p.catalogId}`;
  }
  const hash = crypto.createHash('md5')
    .update(`${advertiserId}:${p.link || ''}:${p.title || ''}`)
    .digest('hex')
    .slice(0, 16);
  return `cj_${advertiserId}_${hash}`;
}

// Main bulk import function
async function runBulkImport() {
  console.log('=== CJ BULK FEED IMPORT STARTED ===');
  console.log('Publisher ID:', CJ_PUBLISHER_ID);
  
  if (!CJ_API_TOKEN || !CJ_PUBLISHER_ID) {
    console.error('Missing CJ_API_TOKEN or CJ_PUBLISHER_ID');
    process.exit(1);
  }

  // Step 1: Discover all feeds
  const feeds = await discoverFeeds();
  
  if (feeds.length === 0) {
    console.log('No feeds found. Check your CJ publisher account.');
    process.exit(1);
  }

  // Step 2: Import each feed
  let totalImported = 0;
  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    const stateId = `bulk_${i}`;
    
    console.log(`\n=== Feed ${i + 1}/${feeds.length}: ${feed.advertiserName} ===`);
    
    const imported = await importFeed(feed, stateId);
    totalImported += imported;
    
    console.log(`[CJ Bulk] Running total: ${totalImported.toLocaleString()} products`);
    
    // Pause between feeds
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('\n=== CJ BULK IMPORT COMPLETE ===');
  console.log(`Total products imported: ${totalImported.toLocaleString()}`);
}

// Run
runBulkImport()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Bulk import failed:', err);
    process.exit(1);
  });
