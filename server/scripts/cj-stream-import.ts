// CJ Streaming Feed Import - Uses GraphQL subscription for bulk download
// This approach streams entire feeds via NDJSON for maximum throughput

import { db } from '../db';
import { products, cjImportState } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const CJ_API_TOKEN = process.env.CJ_API_TOKEN;
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID;
const CJ_API_URL = 'https://ads.api.cj.com/query';

interface FeedInfo {
  adId: string;
  advertiserId: string;
  advertiserName: string;
  feedName: string;
  productCount: number;
}

// Discover all product feeds
async function discoverFeeds(): Promise<FeedInfo[]> {
  console.log('[CJ Stream] Discovering product feeds...');
  
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
          resultList {
            adId
            advertiserId
            advertiserName
            feedName
            productCount
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

    if (!response.ok) break;

    const data = await response.json();
    if (data.errors) {
      console.error('[CJ Stream] Error:', data.errors[0]?.message);
      break;
    }

    const results = data.data?.shoppingProductFeeds?.resultList || [];
    if (results.length === 0) break;

    feeds.push(...results);
    console.log(`[CJ Stream] Found ${feeds.length} feeds...`);

    offset += limit;
    await new Promise(r => setTimeout(r, 3000));
    
    if (results.length < limit) break;
  }

  feeds.sort((a, b) => (b.productCount || 0) - (a.productCount || 0));
  
  const totalProducts = feeds.reduce((sum, f) => sum + (f.productCount || 0), 0);
  console.log(`[CJ Stream] Total: ${feeds.length} feeds, ${totalProducts.toLocaleString()} products available`);
  
  return feeds;
}

// Import products from a single feed using shoppingProducts with advertiserId filter
async function importFeedProducts(feed: FeedInfo): Promise<number> {
  console.log(`\n[CJ Stream] Importing: ${feed.advertiserName} (${feed.productCount} products)`);
  
  let imported = 0;
  let offset = 0;
  const limit = 100;
  const stateId = `feed_${feed.advertiserId}`;
  
  // Check for saved state
  const savedState = await db.select()
    .from(cjImportState)
    .where(eq(cjImportState.id, stateId))
    .limit(1);
  
  if (savedState.length > 0) {
    offset = savedState[0].offset || 0;
    imported = savedState[0].totalImported || 0;
    if (offset > 0) {
      console.log(`[CJ Stream] Resuming from offset ${offset} (${imported} already imported)`);
    }
  }

  const maxOffset = Math.min(feed.productCount || 10000, 50000);
  
  while (offset < maxOffset) {
    const query = `
      query {
        shoppingProducts(
          companyId: "${CJ_PUBLISHER_ID}"
          advertiserId: "${feed.advertiserId}"
          limit: ${limit}
          offset: ${offset}
        ) {
          totalCount
          resultList {
            catalogId
            title
            description
            link
            imageLink
            price { amount currency }
            brand
            availability
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
          console.log('[CJ Stream] Rate limited, waiting 60s...');
          await new Promise(r => setTimeout(r, 60000));
          continue;
        }
        console.error(`[CJ Stream] API error: ${response.status}`);
        break;
      }

      const data = await response.json();
      if (data.errors) {
        console.error('[CJ Stream] GraphQL error:', data.errors[0]?.message);
        break;
      }

      const results = data.data?.shoppingProducts?.resultList || [];
      if (results.length === 0) {
        console.log(`[CJ Stream] Feed complete: ${feed.advertiserName}`);
        break;
      }

      // Batch insert
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
        } catch {}
      }

      offset += limit;
      
      // Save state
      await db.insert(cjImportState).values({
        id: stateId,
        keyword: feed.advertiserId,
        offset: offset,
        totalImported: imported,
        lastUpdated: new Date(),
      }).onConflictDoUpdate({
        target: cjImportState.id,
        set: { offset, totalImported: imported, lastUpdated: new Date() }
      });

      if (batchInserted > 0 || offset % 1000 === 0) {
        console.log(`[CJ Stream] ${feed.advertiserName}@${offset}: +${batchInserted}, total=${imported}`);
      }

      await new Promise(r => setTimeout(r, 3000));

    } catch (error) {
      console.error('[CJ Stream] Error:', error);
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

async function main() {
  console.log('=== CJ STREAM IMPORT ===');
  console.log('Publisher ID:', CJ_PUBLISHER_ID);
  
  if (!CJ_API_TOKEN || !CJ_PUBLISHER_ID) {
    console.error('Missing CJ credentials');
    process.exit(1);
  }

  const feeds = await discoverFeeds();
  
  if (feeds.length === 0) {
    console.log('No feeds found');
    process.exit(1);
  }

  // Import top 100 feeds by product count first
  const topFeeds = feeds.slice(0, 100);
  let totalImported = 0;
  
  for (let i = 0; i < topFeeds.length; i++) {
    const feed = topFeeds[i];
    console.log(`\n=== Feed ${i + 1}/${topFeeds.length} ===`);
    
    const count = await importFeedProducts(feed);
    totalImported += count;
    
    console.log(`[CJ Stream] Progress: ${totalImported.toLocaleString()} products`);
    
    // Check database count periodically
    if (i % 10 === 0) {
      const dbCount = await db.execute<{count: string}>(`SELECT COUNT(*) as count FROM products WHERE source = 'cj'`);
      console.log(`[CJ Stream] Database CJ count: ${dbCount.rows[0]?.count || 0}`);
    }
    
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Total imported: ${totalImported.toLocaleString()}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
