import fs from 'fs';
import { parse } from 'csv-parse';
import { db } from '../server/db';
import { productsV2 } from '../shared/schema';
import { sql } from 'drizzle-orm';

const CSV_PATH = '/tmp/newdata/datafeed_511345.csv';
const BATCH_SIZE = 1000;

interface CsvRow {
  aw_deep_link: string;
  product_name: string;
  aw_product_id: string;
  merchant_product_id: string;
  merchant_image_url: string;
  description: string;
  merchant_category: string;
  search_price: string;
  merchant_name: string;
  merchant_id: string;
  category_name: string;
  category_id: string;
  aw_image_url: string;
  currency: string;
  store_price: string;
  delivery_cost: string;
  merchant_deep_link: string;
  language: string;
  last_updated: string;
  display_price: string;
  data_feed_id: string;
  brand_name: string;
  brand_id: string;
  product_short_description: string;
  keywords: string;
  promotional_text: string;
  rrp_price: string;
  saving: string;
  savings_percent: string;
  base_price: string;
  base_price_amount: string;
  base_price_text: string;
  product_price_old: string;
  merchant_thumb_url: string;
  large_image: string;
  alternate_image: string;
  aw_thumb_url: string;
  alternate_image_two: string;
  alternate_image_three: string;
  alternate_image_four: string;
  reviews: string;
  average_rating: string;
  rating: string;
  number_available: string;
  'Fashion:suitable_for': string;
  'Fashion:category': string;
  'Fashion:size': string;
  'Fashion:material': string;
  'Fashion:pattern': string;
  'Fashion:swatch': string;
}

function parseNumber(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const cleaned = val.replace(/[£$€,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseInt2(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}

async function importProducts() {
  console.log('Starting products_v2 import from:', CSV_PATH);
  
  const seenIds = new Set<string>();
  let batch: any[] = [];
  let totalImported = 0;
  let duplicatesSkipped = 0;
  let errorCount = 0;

  const parser = fs
    .createReadStream(CSV_PATH)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    }));

  for await (const row of parser as AsyncIterable<CsvRow>) {
    try {
      const productId = row.aw_product_id;
      
      if (!productId || seenIds.has(productId)) {
        duplicatesSkipped++;
        continue;
      }
      seenIds.add(productId);

      const price = parseNumber(row.search_price);
      if (!price || price <= 0) continue;

      const affiliateLink = row.aw_deep_link;
      if (!affiliateLink) continue;

      const merchantName = row.merchant_name;
      if (!merchantName) continue;

      const productName = row.product_name;
      if (!productName) continue;

      batch.push({
        id: productId,
        name: productName.slice(0, 500),
        description: (row.description || '').slice(0, 2000),
        shortDescription: (row.product_short_description || '').slice(0, 500),
        merchant: merchantName,
        merchantId: parseInt2(row.merchant_id),
        category: row.category_name || null,
        merchantCategory: row.merchant_category || null,
        brand: row.brand_name || null,
        price: price,
        rrpPrice: parseNumber(row.rrp_price),
        savingsPercent: parseNumber(row.savings_percent),
        affiliateLink: affiliateLink,
        imageUrl: row.aw_image_url || row.merchant_image_url || null,
        largeImageUrl: row.large_image || null,
        inStock: true,
        numberAvailable: parseInt2(row.number_available),
        keywords: row.keywords || null,
        promotionalText: row.promotional_text || null,
        averageRating: parseNumber(row.average_rating),
        reviewCount: parseInt2(row.reviews),
        currency: row.currency || 'GBP',
        lastUpdated: row.last_updated || null,
      });

      if (batch.length >= BATCH_SIZE) {
        await db.insert(productsV2).values(batch).onConflictDoNothing();
        totalImported += batch.length;
        console.log(`Imported ${totalImported} products (${duplicatesSkipped} duplicates skipped)`);
        batch = [];
      }
    } catch (err) {
      errorCount++;
      if (errorCount <= 5) {
        console.error('Row error:', err);
      }
    }
  }

  if (batch.length > 0) {
    await db.insert(productsV2).values(batch).onConflictDoNothing();
    totalImported += batch.length;
  }

  console.log('='.repeat(50));
  console.log(`Import complete!`);
  console.log(`Total imported: ${totalImported}`);
  console.log(`Duplicates skipped: ${duplicatesSkipped}`);
  console.log(`Errors: ${errorCount}`);

  const countResult = await db.select({ count: sql<number>`count(*)` }).from(productsV2);
  console.log(`Products in products_v2 table: ${countResult[0]?.count}`);
}

importProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
