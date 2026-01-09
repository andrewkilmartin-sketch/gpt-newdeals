import { db } from "../db";
import { products } from "../../shared/schema";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface CJRow {
  ID: string;
  TITLE: string;
  DESCRIPTION: string;
  LINK: string;
  IMAGE_LINK: string;
  PRICE: string;
  SALE_PRICE: string;
  BRAND: string;
  GOOGLE_PRODUCT_CATEGORY_NAME: string;
  PRODUCT_TYPE: string;
  AVAILABILITY: string;
  COLOR: string;
  GENDER: string;
  SIZE: string;
  GTIN: string;
  MPN: string;
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

function mapCJProduct(row: Record<string, string>) {
  const price = parsePrice(row.SALE_PRICE) || parsePrice(row.PRICE);
  
  return {
    id: `cj_${row.ID}`,
    name: row.TITLE || '',
    description: row.DESCRIPTION || '',
    affiliateLink: row.LINK || '',
    imageUrl: row.IMAGE_LINK || '',
    price: price,
    brand: row.BRAND || 'BrandAlley',
    merchant: 'BrandAlley UK',
    category: row.GOOGLE_PRODUCT_CATEGORY_NAME || row.PRODUCT_TYPE || 'Fashion',
    inStock: row.AVAILABILITY === 'in stock' || row.AVAILABILITY === 'in_stock',
    source: 'cj',
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

async function importBrandAlley() {
  console.log('[Import] Starting BrandAlley CJ import...');
  
  const filePath = path.join(process.cwd(), 'attached_assets/brandally_extract/BrandAlley-Intelligent_Reach-shopping.txt');
  
  if (!fs.existsSync(filePath)) {
    console.error('[Import] File not found:', filePath);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  console.log(`[Import] Found ${lines.length} lines in file`);
  
  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  console.log('[Import] Headers:', headers.slice(0, 10).join(', '), '...');
  
  const stats = {
    total: 0,
    imported: 0,
    skipped: {
      noTitle: 0,
      noPrice: 0,
      noLink: 0,
    }
  };
  
  const batchSize = 500;
  let batch: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    stats.total++;
    
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    
    for (let j = 0; j < headers.length && j < values.length; j++) {
      row[headers[j]] = values[j];
    }
    
    // Validation
    if (!row.TITLE || row.TITLE.length < 3) {
      stats.skipped.noTitle++;
      continue;
    }
    
    const price = parsePrice(row.SALE_PRICE) || parsePrice(row.PRICE);
    if (!price || price <= 0) {
      stats.skipped.noPrice++;
      continue;
    }
    
    if (!row.LINK) {
      stats.skipped.noLink++;
      continue;
    }
    
    const product = mapCJProduct(row);
    batch.push(product);
    
    if (batch.length >= batchSize) {
      try {
        await db.insert(products)
          .values(batch)
          .onConflictDoUpdate({
            target: products.id,
            set: {
              name: sql`EXCLUDED.name`,
              description: sql`EXCLUDED.description`,
              price: sql`EXCLUDED.price`,
              imageUrl: sql`EXCLUDED.image_url`,
              affiliateLink: sql`EXCLUDED.affiliate_link`,
              inStock: sql`EXCLUDED.in_stock`,
            }
          });
        
        stats.imported += batch.length;
        console.log(`[Import] Inserted batch: ${stats.imported} products so far...`);
      } catch (error) {
        console.error('[Import] Batch error:', error);
      }
      
      batch = [];
    }
  }
  
  // Insert remaining batch
  if (batch.length > 0) {
    try {
      await db.insert(products)
        .values(batch)
        .onConflictDoUpdate({
          target: products.id,
          set: {
            name: sql`EXCLUDED.name`,
            description: sql`EXCLUDED.description`,
            price: sql`EXCLUDED.price`,
            imageUrl: sql`EXCLUDED.image_url`,
            affiliateLink: sql`EXCLUDED.affiliate_link`,
            inStock: sql`EXCLUDED.in_stock`,
          }
        });
      
      stats.imported += batch.length;
    } catch (error) {
      console.error('[Import] Final batch error:', error);
    }
  }
  
  console.log('\n========================================');
  console.log('BRANDALLEY CJ IMPORT COMPLETE');
  console.log('========================================');
  console.log(`Total rows processed: ${stats.total}`);
  console.log(`Successfully imported: ${stats.imported}`);
  console.log(`Skipped - No title: ${stats.skipped.noTitle}`);
  console.log(`Skipped - No price: ${stats.skipped.noPrice}`);
  console.log(`Skipped - No link: ${stats.skipped.noLink}`);
  console.log('========================================\n');
  
  // Verify counts
  try {
    const countBySource = await db.execute(sql`
      SELECT source, COUNT(*) as count FROM products GROUP BY source
    `);
    console.log('\nProducts by source:');
    console.log(JSON.stringify(countBySource, null, 2));
    
    const brandAlleyCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM products WHERE merchant = 'BrandAlley UK'
    `);
    console.log('\nBrandAlley UK products:');
    console.log(JSON.stringify(brandAlleyCount, null, 2));
    
    const sampleProducts = await db.execute(sql`
      SELECT name, price, brand, source FROM products WHERE source = 'cj' LIMIT 10
    `);
    console.log('\nSample CJ products:');
    console.log(JSON.stringify(sampleProducts, null, 2));
  } catch (err) {
    console.error('Verification query error:', err);
  }
}

importBrandAlley()
  .then(() => {
    console.log('[Import] Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Import] Fatal error:', error);
    process.exit(1);
  });
