import { db } from './db';
import { products, taxonomy } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';

const CATEGORY_MAPPING: Record<string, string> = {
  'toys': 'toys',
  'other toys': 'toys',
  'outdoor toys': 'toys',
  'soft toys': 'toys',
  'baby toys': 'toys',
  'creative & construction': 'toys',
  'games, puzzles & learning': 'toys',
  'electronic & rc toys': 'toys',
  'dolls': 'toys',
  'action figures': 'toys',
  'toy models': 'toys',
  'collectibles': 'toys',
  'children\'s clothing': 'clothing',
  'girls\' clothes': 'clothing',
  'boys\' clothes': 'clothing',
  'baby clothes': 'clothing',
  'dress': 'clothing',
  'children\'s footwear': 'footwear',
  'decorations': 'home',
  'arts & crafts': 'home',
  'greeting cards': 'home',
  'calendars': 'home',
  'books': 'books',
  'gifts': 'accessories',
  'novelty gifts': 'accessories',
  'christmas gifts': 'accessories',
  'birthday gifts': 'accessories',
  'hampers': 'accessories',
  'flowers': 'accessories',
  'valentine\'s day': 'accessories',
  'baby products': 'baby',
  'console accessories': 'electronics',
  'blu-ray': 'electronics',
  'hd dvd': 'electronics',
  'dvds': 'electronics',
  'electronic gadgets': 'electronics',
  'video gaming': 'electronics',
  'gadgets': 'electronics',
  'musical instruments': 'electronics',
  'football': 'sports',
  'wine': 'other',
  'other occasions': 'other',
  'music': 'other',
  'experiences': 'other',
  'lifestyle': 'other',
};

async function loadFranchises(): Promise<Set<string>> {
  const result = await db.select({ keyword: taxonomy.keyword })
    .from(taxonomy)
    .where(eq(taxonomy.category, 'Franchise'));
  
  const franchises = new Set<string>();
  for (const row of result) {
    franchises.add(row.keyword.toLowerCase());
  }
  console.log(`Loaded ${franchises.size} franchises from taxonomy`);
  return franchises;
}

function normalizeCategory(rawCategory: string | null): string | null {
  if (!rawCategory) return null;
  const lower = rawCategory.toLowerCase();
  return CATEGORY_MAPPING[lower] || null;
}

function extractFranchises(name: string, brand: string | null, franchiseSet: Set<string>): string[] {
  const text = ` ${name} ${brand || ''} `.toLowerCase();
  const found: string[] = [];
  
  // Sort franchises by length descending to match longer phrases first
  const sortedFranchises = Array.from(franchiseSet).sort((a, b) => b.length - a.length);
  
  for (const franchise of sortedFranchises) {
    // Use word boundary matching to avoid false positives
    // e.g., "it" shouldn't match in "white"
    // For multi-word franchises, use simple includes
    if (franchise.includes(' ')) {
      if (text.includes(franchise)) {
        found.push(franchise);
      }
    } else {
      // For single-word franchises, require word boundaries
      const regex = new RegExp(`\\b${franchise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        found.push(franchise);
      }
    }
  }
  
  return [...new Set(found)];
}

async function backfill() {
  console.log('Starting canonical backfill...');
  
  const franchiseSet = await loadFranchises();
  
  const allProducts = await db.select({
    id: products.id,
    name: products.name,
    category: products.category,
    brand: products.brand,
  }).from(products);
  
  console.log(`Processing ${allProducts.length} products...`);
  
  let updated = 0;
  let batchSize = 1000;
  let batch: { id: string; canonicalCategory: string | null; canonicalFranchises: string[] }[] = [];
  
  for (const product of allProducts) {
    const canonicalCategory = normalizeCategory(product.category);
    const canonicalFranchises = extractFranchises(product.name, product.brand, franchiseSet);
    
    batch.push({
      id: product.id,
      canonicalCategory,
      canonicalFranchises,
    });
    
    if (batch.length >= batchSize) {
      await updateBatch(batch);
      updated += batch.length;
      console.log(`Updated ${updated}/${allProducts.length} products...`);
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    await updateBatch(batch);
    updated += batch.length;
  }
  
  console.log(`Backfill complete! Updated ${updated} products.`);
  console.log('\nRun SQL queries to check distribution after backfill completes.');
}

async function updateBatch(batch: { id: string; canonicalCategory: string | null; canonicalFranchises: string[] }[]) {
  for (const item of batch) {
    if (item.canonicalFranchises.length > 0) {
      const arrayLiteral = `{${item.canonicalFranchises.map(f => `"${f.replace(/"/g, '\\"')}"`).join(',')}}`;
      await db.execute(sql.raw(`
        UPDATE products 
        SET canonical_category = ${item.canonicalCategory ? `'${item.canonicalCategory}'` : 'NULL'},
            canonical_franchises = '${arrayLiteral}'::text[]
        WHERE id = '${item.id}'
      `));
    } else {
      await db.execute(sql.raw(`
        UPDATE products 
        SET canonical_category = ${item.canonicalCategory ? `'${item.canonicalCategory}'` : 'NULL'},
            canonical_franchises = NULL
        WHERE id = '${item.id}'
      `));
    }
  }
}

backfill().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
