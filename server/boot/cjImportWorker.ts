// CJ Background Import Worker
// Runs continuously in the server process

import { db } from '../db';
import { products, cjImportState } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

function generateProductId(p: any): string {
  if (p.catalogId && p.catalogId.trim()) {
    return `cj_${p.catalogId}`;
  }
  const hash = crypto.createHash('md5')
    .update(`${p.advertiserId}:${p.link}:${p.title}`)
    .digest('hex')
    .slice(0, 16);
  return `cj_${hash}`;
}

const CJ_API_TOKEN = process.env.CJ_API_TOKEN;
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID;
const CJ_API_URL = 'https://ads.api.cj.com/query';

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

async function fetchCJProducts(keyword: string, limit: number, offset: number) {
  const query = `
    query {
      products(
        companyId: "${CJ_PUBLISHER_ID}"
        limit: ${limit}
        offset: ${offset}
        keywords: "${keyword}"
      ) {
        totalCount
        resultList {
          catalogId
          title
          description
          link
          imageLink
          price { amount }
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

  if (!response.ok) throw new Error(`CJ API: ${response.status}`);
  const data = await response.json();
  if (data.errors) throw new Error(data.errors[0]?.message);
  return data.data.products;
}

async function getState() {
  const state = await db.select().from(cjImportState).where(eq(cjImportState.id, 'bg')).limit(1);
  if (state.length === 0) {
    await db.insert(cjImportState).values({
      id: 'bg', keyword: KEYWORDS[0], offset: 0, totalImported: 0, lastUpdated: new Date()
    });
    return { keyword: KEYWORDS[0], offset: 0, totalImported: 0 };
  }
  return state[0];
}

async function saveState(keyword: string, offset: number, totalImported: number) {
  await db.update(cjImportState)
    .set({ keyword, offset, totalImported, lastUpdated: new Date() })
    .where(eq(cjImportState.id, 'bg'));
}

async function runImportCycle() {
  if (!CJ_API_TOKEN || !CJ_PUBLISHER_ID) return;
  
  let state = await getState();
  let { keyword, offset, totalImported } = state;
  let keywordIndex = KEYWORDS.indexOf(keyword);
  if (keywordIndex === -1) keywordIndex = 0;
  
  try {
    const result = await fetchCJProducts(keyword, 100, offset);
    
    if (!result?.resultList?.length || offset >= 10000) {
      keywordIndex = (keywordIndex + 1) % KEYWORDS.length;
      keyword = KEYWORDS[keywordIndex];
      offset = 0;
      await saveState(keyword, offset, totalImported);
      console.log(`[CJ] Switching to: "${keyword}"`);
      return;
    }

    let newInserts = 0;
    let duplicates = 0;
    for (const p of result.resultList) {
      try {
        const productId = generateProductId(p);
        const result = await db.insert(products).values({
          id: productId,
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
        }).onConflictDoNothing().returning({ id: products.id });
        
        if (result.length > 0) {
          newInserts++;
          totalImported++;
        } else {
          duplicates++;
        }
      } catch {}
    }

    offset += 100;
    await saveState(keyword, offset, totalImported);
    console.log(`[CJ] ${keyword}@${offset}: +${newInserts} new, ${duplicates} dupe, total=${totalImported}`);
    
  } catch (error) {
    console.error('[CJ] Error:', (error as Error).message);
  }
}

export async function startCJImportWorker() {
  if (!CJ_API_TOKEN || !CJ_PUBLISHER_ID) {
    console.log('[CJ] Import worker disabled - missing API credentials');
    return;
  }
  
  console.log('[CJ] Background import worker starting...');
  
  // Run import every 3 seconds (respects 25 calls/min limit)
  setInterval(async () => {
    try {
      await runImportCycle();
    } catch (err) {
      console.error('[CJ] Worker error:', err);
    }
  }, 3000);
}
