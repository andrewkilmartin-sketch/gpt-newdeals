import OpenAI from "openai";
import { db } from "./db";
import { sql } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs per batch
const DELAY_MS = 500; // Rate limiting delay between batches

async function getEmbedding(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

async function generateEmbeddings() {
  console.log("Starting embedding generation for products...");
  
  // Get count of products without embeddings
  const countResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM products WHERE embedding IS NULL
  `);
  const totalWithoutEmbedding = Number((countResult as any)[0]?.count || 0);
  console.log(`Products without embeddings: ${totalWithoutEmbedding}`);
  
  if (totalWithoutEmbedding === 0) {
    console.log("All products already have embeddings!");
    return;
  }
  
  let processed = 0;
  let errors = 0;
  
  while (processed < totalWithoutEmbedding) {
    // Fetch batch of products without embeddings
    const productsResult = await db.execute(sql`
      SELECT id, name, description, brand, category 
      FROM products 
      WHERE embedding IS NULL 
      LIMIT ${BATCH_SIZE}
    `);
    
    const products = productsResult as any[];
    if (products.length === 0) break;
    
    // Create text for embedding (combine name + description + brand + category)
    const texts = products.map(p => {
      const parts = [p.name || ""];
      if (p.brand) parts.push(p.brand);
      if (p.category) parts.push(p.category);
      if (p.description) parts.push((p.description as string).slice(0, 500)); // Limit description length
      return parts.join(" | ").slice(0, 2000); // Max 2000 chars per text
    });
    
    try {
      // Generate embeddings
      const embeddings = await getEmbedding(texts);
      
      // Update products with embeddings
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const embedding = embeddings[i];
        const embeddingStr = `[${embedding.join(",")}]`;
        
        await db.execute(sql`
          UPDATE products 
          SET embedding = ${embeddingStr}::vector 
          WHERE id = ${product.id}
        `);
      }
      
      processed += products.length;
      const percent = ((processed / totalWithoutEmbedding) * 100).toFixed(1);
      console.log(`Processed ${processed}/${totalWithoutEmbedding} (${percent}%)`);
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      
    } catch (error) {
      console.error(`Error processing batch:`, error);
      errors++;
      if (errors > 10) {
        console.error("Too many errors, stopping");
        break;
      }
      // Wait longer on error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log(`\nEmbedding generation complete!`);
  console.log(`Processed: ${processed}`);
  console.log(`Errors: ${errors}`);
  
  // Verify count
  const verifyResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM products WHERE embedding IS NOT NULL
  `);
  console.log(`Products with embeddings: ${(verifyResult as any)[0]?.count}`);
}

// Run if called directly
generateEmbeddings().catch(console.error);
