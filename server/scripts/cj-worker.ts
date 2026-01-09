// CJ Product Import Worker - Resumable, Long-Running
// Tracks progress in database, handles interruptions gracefully

import { db } from '../db';
import { products, cjImportState } from '@shared/schema';
import { eq } from 'drizzle-orm';

const CJ_API_TOKEN = process.env.CJ_API_TOKEN;
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID;
const CJ_API_URL = 'https://ads.api.cj.com/query';

// Expanded keywords for maximum product coverage
const KEYWORDS = [
  'barbie', 'playmobil', 'sylvanian', 'lego', 'hot wheels', 'pokemon', 'cocomelon',
  'baby shark', 'thomas train', 'paddington', 'peppa pig', 'paw patrol', 'disney',
  'marvel', 'frozen', 'bluey', 'minecraft', 'fortnite', 'harry potter', 'star wars',
  'dr martens', 'clarks', 'start rite', 'geox', 'nike', 'adidas', 'crocs', 'converse',
  'vans', 'school shoes', 'trainers', 'boots', 'sandals', 'kids clothing', 'boys',
  'girls', 'baby', 'toddler', 'jacket', 'dress', 'uniform', 'jeans', 'toys', 'gear',
  'pushchair', 'car seat', 'monitor', 'feeding', 'nappies', 'home', 'kitchen', 'garden',
  'furniture', 'bedding', 'storage', 'games', 'console', 'tablet', 'headphones', 'gift',
  'christmas', 'birthday', 'present', 'fashion', 'accessories', 'bags', 'watches',
  'jewellery', 'beauty', 'health', 'sports', 'outdoor', 'camping', 'travel', 'luggage',
  'electronics', 'phone', 'laptop', 'camera', 'tv', 'audio', 'books', 'dvd', 'music',
  'pet', 'dog', 'cat', 'food', 'drink', 'grocery', 'cleaning', 'diy', 'tools', 'car',
];

// Fetch products from CJ API
async function fetchCJProducts(keyword: string, limit: number, offset: number) {
  const query = `
    query {
      products(
        companyId: "${CJ_PUBLISHER_ID}"
        partnerStatus: JOINED
        limit: ${limit}
        offset: ${offset}
        keywords: "${keyword}"
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
          brand
          advertiserName
          advertiserId
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
    throw new Error(`CJ API Error: ${response.status}`);
  }

  const data = await response.json();
  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'GraphQL Error');
  }

  return data.data.products;
}

// Get or create import state
async function getState() {
  const state = await db.select().from(cjImportState).where(eq(cjImportState.id, 'worker')).limit(1);
  if (state.length === 0) {
    await db.insert(cjImportState).values({
      id: 'worker',
      keyword: KEYWORDS[0],
      offset: 0,
      totalImported: 0,
      lastUpdated: new Date(),
    });
    return { keyword: KEYWORDS[0], offset: 0, totalImported: 0 };
  }
  return state[0];
}

// Save state to database
async function saveState(keyword: string, offset: number, totalImported: number) {
  await db.update(cjImportState)
    .set({ keyword, offset, totalImported, lastUpdated: new Date() })
    .where(eq(cjImportState.id, 'worker'));
}

// Main worker loop
async function runWorker() {
  console.log('=== CJ IMPORT WORKER STARTED ===');
  console.log(`Keywords: ${KEYWORDS.length}`);
  
  if (!CJ_API_TOKEN || !CJ_PUBLISHER_ID) {
    console.error('Missing CJ_API_TOKEN or CJ_PUBLISHER_ID');
    process.exit(1);
  }

  let state = await getState();
  let { keyword, offset, totalImported } = state;
  
  console.log(`Resuming from: keyword="${keyword}", offset=${offset}, total=${totalImported}`);
  
  const LIMIT = 100;
  const MAX_OFFSET = 10000; // CJ API limit
  let consecutiveErrors = 0;
  
  while (true) {
    try {
      // Find keyword index
      let keywordIndex = KEYWORDS.indexOf(keyword);
      if (keywordIndex === -1) keywordIndex = 0;
      
      // Fetch products
      const result = await fetchCJProducts(keyword, LIMIT, offset);
      consecutiveErrors = 0;
      
      if (!result?.resultList?.length || offset >= MAX_OFFSET) {
        // Move to next keyword
        keywordIndex++;
        if (keywordIndex >= KEYWORDS.length) {
          console.log(`\n=== COMPLETE: All ${KEYWORDS.length} keywords processed ===`);
          console.log(`Total imported: ${totalImported}`);
          
          // Reset for next cycle
          keywordIndex = 0;
        }
        keyword = KEYWORDS[keywordIndex];
        offset = 0;
        await saveState(keyword, offset, totalImported);
        console.log(`\n--- Switching to: "${keyword}" ---`);
        continue;
      }

      // Insert products
      let pageImported = 0;
      for (const p of result.resultList) {
        try {
          await db.insert(products).values({
            id: `cj_${p.catalogId}`,
            name: p.title || 'Unknown',
            description: p.description || '',
            merchant: p.advertiserName || 'Unknown',
            merchantId: p.advertiserId?.toString() || '',
            brand: p.brand || '',
            price: parseFloat(p.price?.amount) || 0,
            affiliateLink: p.link || '',
            imageUrl: p.imageLink || '',
            inStock: true,
            source: 'cj',
          }).onConflictDoUpdate({
            target: products.id,
            set: { price: parseFloat(p.price?.amount) || 0 }
          });
          pageImported++;
          totalImported++;
        } catch (e) {
          // Ignore duplicate errors
        }
      }

      offset += LIMIT;
      await saveState(keyword, offset, totalImported);
      
      // Progress log every page
      console.log(`[${keyword}] offset=${offset}, page=+${pageImported}, total=${totalImported}`);
      
      // Rate limit: 3 seconds between calls (25/min = 2.4s, using 3s for safety)
      await new Promise(r => setTimeout(r, 3000));
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`Error (${consecutiveErrors}):`, (error as Error).message);
      
      if (consecutiveErrors > 5) {
        console.log('Too many errors, pausing 30 seconds...');
        await new Promise(r => setTimeout(r, 30000));
        consecutiveErrors = 0;
      } else {
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
}

// Run the worker
runWorker().catch(err => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
