import { db } from '../db';
import { products } from '@shared/schema';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

interface CJProduct {
  PROGRAM_NAME: string;
  ID: string;
  TITLE: string;
  DESCRIPTION: string;
  LINK: string;
  IMAGE_LINK: string;
  AVAILABILITY: string;
  PRICE: string;
  SALE_PRICE?: string;
  BRAND: string;
  GOOGLE_PRODUCT_CATEGORY?: string;
  GOOGLE_PRODUCT_CATEGORY_NAME?: string;
  PRODUCT_TYPE?: string;
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  const match = priceStr.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function isUKProduct(row: CJProduct): boolean {
  const price = row.PRICE || '';
  const program = row.PROGRAM_NAME || '';
  
  if (price.includes('GBP')) return true;
  if (program.toLowerCase().includes('uk') || program.toLowerCase().includes('gb')) return true;
  if (row.LINK?.includes('.co.uk')) return true;
  
  return false;
}

function mapCJProduct(row: CJProduct) {
  return {
    id: `cj_bose_${row.ID}`,
    name: row.TITLE,
    description: row.DESCRIPTION || null,
    affiliateLink: row.LINK,
    imageUrl: row.IMAGE_LINK || null,
    price: parsePrice(row.SALE_PRICE || row.PRICE),
    currency: 'GBP',
    brand: row.BRAND || 'Bose',
    merchant: row.PROGRAM_NAME || 'Bose UK',
    merchantId: null,
    category: row.GOOGLE_PRODUCT_CATEGORY_NAME || row.PRODUCT_TYPE || 'Electronics',
    inStock: row.AVAILABILITY?.toLowerCase() === 'in stock',
    source: 'cj',
    lastUpdated: new Date(),
  };
}

async function importCJProducts(filePath: string) {
  console.log(`[CJ Import] Reading file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`[CJ Import] File not found: ${filePath}`);
    return;
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as CJProduct[];
  
  console.log(`[CJ Import] Parsed ${records.length} records`);
  
  const ukProducts = records.filter(isUKProduct);
  console.log(`[CJ Import] ${ukProducts.length} UK products after filtering`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const row of ukProducts) {
    try {
      const product = mapCJProduct(row);
      
      if (!product.name || !product.affiliateLink) {
        skipped++;
        continue;
      }
      
      await db.insert(products).values(product)
        .onConflictDoUpdate({
          target: products.id,
          set: {
            name: product.name,
            description: product.description,
            price: product.price,
            imageUrl: product.imageUrl,
            inStock: product.inStock,
            lastUpdated: product.lastUpdated,
          }
        });
      
      imported++;
      
      if (imported % 50 === 0) {
        console.log(`[CJ Import] Progress: ${imported}/${ukProducts.length}`);
      }
    } catch (err) {
      errors++;
      console.error(`[CJ Import] Error importing ${row.ID}:`, err);
    }
  }
  
  console.log(`[CJ Import] Complete!`);
  console.log(`[CJ Import] Imported: ${imported}`);
  console.log(`[CJ Import] Skipped: ${skipped}`);
  console.log(`[CJ Import] Errors: ${errors}`);
  
  return { imported, skipped, errors };
}

const csvPath = process.argv[2] || path.join(process.cwd(), 'attached_assets/BOSE_EMEA-bose_epic_gb_commissionjunction-shopping.txt');
importCJProducts(csvPath)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[CJ Import] Fatal error:', err);
    process.exit(1);
  });
