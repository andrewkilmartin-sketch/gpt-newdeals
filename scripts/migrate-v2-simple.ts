import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function migrate() {
  console.log("Starting simple V2 to V1 migration...");
  
  // Get counts
  const [{ count: before }] = await sql`SELECT COUNT(*) as count FROM products`;
  const [{ count: v2Migrated }] = await sql`SELECT COUNT(*) as count FROM products WHERE id LIKE 'v2_%'`;
  
  console.log(`V1 before: ${before}, Already migrated: ${v2Migrated}`);
  
  const BATCH_SIZE = 5000;
  let offset = parseInt(v2Migrated as string);
  let totalInserted = 0;
  
  while (offset < 1000000) {
    console.log(`Processing offset ${offset}...`);
    
    const result = await sql`
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
      FROM (
        SELECT * FROM products_v2 ORDER BY id LIMIT ${BATCH_SIZE} OFFSET ${offset}
      ) AS batch
      ON CONFLICT (id) DO NOTHING
    `;
    
    totalInserted += result.count;
    offset += BATCH_SIZE;
    
    if (offset % 50000 === 0) {
      const [{ count: current }] = await sql`SELECT COUNT(*) as count FROM products`;
      console.log(`Progress: offset ${offset}, total products: ${current}`);
    }
    
    // Check if we got an empty batch
    if (result.count === 0 && offset > 1000000) break;
  }
  
  const [{ count: after }] = await sql`SELECT COUNT(*) as count FROM products`;
  console.log(`\nDone! Products: ${before} -> ${after}`);
  
  await sql.end();
}

migrate().catch(console.error);
