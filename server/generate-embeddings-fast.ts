import OpenAI from "openai";
import { db } from "./db";
import { sql } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const API_BATCH_SIZE = 500; // Smaller to avoid token limit (300K max)
const DB_BATCH_SIZE = 100; // Smaller DB writes to prevent connection issues
const CONCURRENCY = 3; // Parallel API calls
const MAX_RETRIES = 5;

interface Product {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
}

async function getEmbeddingWithRetry(texts: string[], retries = 0): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    });
    return response.data.map(d => d.embedding);
  } catch (error: any) {
    if (retries < MAX_RETRIES && (error?.status === 429 || error?.status >= 500)) {
      const delay = Math.pow(2, retries) * 1000;
      console.log(`Rate limited, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      return getEmbeddingWithRetry(texts, retries + 1);
    }
    throw error;
  }
}

async function updateProductsInSmallBatches(products: Product[], embeddings: number[][]): Promise<void> {
  // Split into smaller DB batches to prevent connection overload
  for (let i = 0; i < products.length; i += DB_BATCH_SIZE) {
    const batch = products.slice(i, i + DB_BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + DB_BATCH_SIZE);
    
    const updateValues = batch.map((p, idx) => {
      const embStr = `[${batchEmbeddings[idx].join(",")}]`;
      return `('${p.id}', '${embStr}'::vector)`;
    }).join(",");

    await db.execute(sql.raw(`
      UPDATE products AS p
      SET embedding = v.emb
      FROM (VALUES ${updateValues}) AS v(id, emb)
      WHERE p.id = v.id
    `));
  }
}

async function processBatch(products: Product[], batchNum: number): Promise<number> {
  const texts = products.map(p => {
    const parts = [p.name || ""];
    if (p.brand) parts.push(p.brand);
    if (p.category) parts.push(p.category);
    if (p.description) parts.push((p.description).slice(0, 500));
    return parts.join(" | ").slice(0, 2000);
  });

  try {
    const embeddings = await getEmbeddingWithRetry(texts);
    await updateProductsInSmallBatches(products, embeddings);
    console.log(`Batch ${batchNum}: Updated ${products.length} products`);
    return products.length;
  } catch (error: any) {
    console.error(`Batch ${batchNum} failed:`, error.message?.slice(0, 100));
    return 0;
  }
}

async function generateEmbeddingsFast() {
  console.log("=== FAST EMBEDDING GENERATION ===");
  console.log(`API Batch: ${API_BATCH_SIZE}, DB Batch: ${DB_BATCH_SIZE}, Concurrency: ${CONCURRENCY}`);
  
  // Get all products without embeddings
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM products WHERE embedding IS NULL
  `);
  const totalWithout = Number((countResult as any)[0]?.count || 0);
  console.log(`Products needing embeddings: ${totalWithout}`);
  
  if (totalWithout === 0) {
    console.log("All products already have embeddings!");
    return;
  }

  // Fetch all products at once
  console.log("Loading all products...");
  const allProducts = await db.execute(sql`
    SELECT id, name, description, brand, category 
    FROM products 
    WHERE embedding IS NULL
    ORDER BY id
  `) as Product[];
  console.log(`Loaded ${allProducts.length} products`);

  // Split into API batches
  const batches: Product[][] = [];
  for (let i = 0; i < allProducts.length; i += API_BATCH_SIZE) {
    batches.push(allProducts.slice(i, i + API_BATCH_SIZE));
  }
  console.log(`Created ${batches.length} batches`);

  const startTime = Date.now();
  let processed = 0;

  // Process batches with limited concurrency
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const promises = chunk.map((batch, idx) => processBatch(batch, i + idx + 1));
    
    const results = await Promise.all(promises);
    processed += results.reduce((a, b) => a + b, 0);
    
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = (totalWithout - processed) / rate;
    console.log(`Progress: ${processed}/${totalWithout} (${(processed/totalWithout*100).toFixed(1)}%) - ${rate.toFixed(0)}/sec - ETA: ${remaining.toFixed(0)}s`);
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n=== COMPLETE ===`);
  console.log(`Processed: ${processed} products`);
  console.log(`Time: ${totalTime.toFixed(1)}s`);
  console.log(`Rate: ${(processed / totalTime).toFixed(0)} products/sec`);

  // Verify
  const verifyResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM products WHERE embedding IS NOT NULL
  `);
  console.log(`Products with embeddings: ${(verifyResult as any)[0]?.count}`);
}

generateEmbeddingsFast().catch(console.error);
