import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateV2ToV1Fast() {
  console.log("Starting fast V2 to V1 product migration...");
  
  // Get initial counts
  const v1Before = await db.execute(sql`SELECT COUNT(*) as count FROM products`) as any;
  const v1Count = v1Before[0]?.count || v1Before.rows?.[0]?.count;
  console.log(`V1 products before: ${v1Count}`);
  
  // Calculate starting offset based on already migrated v2 products
  const v2Migrated = await db.execute(sql`SELECT COUNT(*) as count FROM products WHERE id LIKE 'v2_%'`) as any;
  const startOffset = parseInt(v2Migrated[0]?.count || v2Migrated.rows?.[0]?.count || 0);
  console.log(`Already migrated V2 products: ${startOffset}, continuing from there...`);
  
  // Use larger batches for speed
  const BATCH_SIZE = 2000;
  let offset = startOffset;
  let batchNum = 0;
  
  while (true) {
    batchNum++;
    
    // Direct insert using OFFSET/LIMIT - skip verbose logging for speed
    const result = await db.execute(sql`
      WITH batch AS (
        SELECT id, name, description, merchant, merchant_id, category, brand, price, affiliate_link, image_url, in_stock
        FROM products_v2
        ORDER BY id
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      )
      INSERT INTO products (id, name, description, merchant, merchant_id, category, brand, price, affiliate_link, image_url, in_stock)
      SELECT 
        'v2_' || id,
        name,
        description,
        merchant,
        merchant_id,
        category,
        brand,
        price,
        affiliate_link,
        image_url,
        COALESCE(in_stock, true)
      FROM batch
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `) as any;
    
    const rows = result.rows || result;
    const insertedCount = rows?.length || 0;
    
    if (batchNum % 25 === 0 || insertedCount === 0) {
      console.log(`Batch ${batchNum}: offset ${offset}, inserted ${insertedCount}`);
    }
    
    if (insertedCount === 0) {
      console.log("No more products to process");
      break;
    }
    
    offset += BATCH_SIZE;
    
    // Safety limit
    if (offset >= 1100000) {
      console.log("Reached safety limit");
      break;
    }
  }
  
  const v1After = await db.execute(sql`SELECT COUNT(*) as count FROM products`) as any;
  const finalCount = v1After[0]?.count || v1After.rows?.[0]?.count;
  console.log(`\nMigration complete!`);
  console.log(`V1 products after: ${finalCount}`);
  console.log(`Total batches processed: ${batchNum}`);
}

migrateV2ToV1Fast()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
