import { db } from "../server/db";
import { products, productsV2 } from "../shared/schema";
import { sql } from "drizzle-orm";

async function migrateV2ToV1() {
  console.log("Starting V2 to V1 product migration...");
  
  const v1Count = await db.select({ count: sql<number>`count(*)` }).from(products);
  const v2Count = await db.select({ count: sql<number>`count(*)` }).from(productsV2);
  
  console.log(`V1 products before: ${v1Count[0].count}`);
  console.log(`V2 products to copy: ${v2Count[0].count}`);
  
  const BATCH_SIZE = 1000;
  let offset = 0;
  let totalInserted = 0;
  
  while (true) {
    console.log(`Processing batch at offset ${offset}...`);
    
    const batch = await db.select({
      id: productsV2.id,
      name: productsV2.name,
      description: productsV2.description,
      merchant: productsV2.merchant,
      merchantId: productsV2.merchantId,
      category: productsV2.category,
      brand: productsV2.brand,
      price: productsV2.price,
      affiliateLink: productsV2.affiliateLink,
      imageUrl: productsV2.imageUrl,
      inStock: productsV2.inStock,
    })
    .from(productsV2)
    .limit(BATCH_SIZE)
    .offset(offset);
    
    if (batch.length === 0) {
      console.log("No more products to process");
      break;
    }
    
    const toInsert = batch.map(p => ({
      id: `v2_${p.id}`,
      name: p.name,
      description: p.description,
      merchant: p.merchant,
      merchantId: p.merchantId,
      category: p.category,
      brand: p.brand,
      price: p.price,
      affiliateLink: p.affiliateLink,
      imageUrl: p.imageUrl,
      inStock: p.inStock ?? true,
    }));
    
    try {
      await db.insert(products).values(toInsert).onConflictDoNothing();
      totalInserted += batch.length;
      console.log(`Inserted batch of ${batch.length}, total: ${totalInserted}`);
    } catch (err) {
      console.error(`Error inserting batch at offset ${offset}:`, err);
    }
    
    offset += BATCH_SIZE;
    
    if (offset % 50000 === 0) {
      console.log(`Progress: ${offset} products processed...`);
    }
  }
  
  const finalCount = await db.select({ count: sql<number>`count(*)` }).from(products);
  console.log(`\nMigration complete!`);
  console.log(`V1 products after: ${finalCount[0].count}`);
  console.log(`Total inserted: ${totalInserted}`);
}

migrateV2ToV1()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
