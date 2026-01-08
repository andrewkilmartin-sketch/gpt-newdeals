import { pipeline } from '@xenova/transformers';

let embedder: any = null;
let promotionEmbeddings: Map<string, number[]> = new Map();
let isInitialized = false;

// Initialize the embedding model
async function initEmbedder(): Promise<void> {
  if (embedder) return;
  
  console.log('Loading embedding model (all-MiniLM-L6-v2)...');
  const startTime = Date.now();
  
  // Use a small, fast model optimized for semantic similarity
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  
  console.log(`Embedding model loaded in ${Date.now() - startTime}ms`);
}

// Generate embedding for a text string
async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    await initEmbedder();
  }
  
  // Get embedding from model
  const output = await embedder!(text, { pooling: 'mean', normalize: true });
  
  // Convert to array
  return Array.from(output.data);
}

// Compute cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Index all promotions with embeddings
export async function indexPromotions(promotions: any[]): Promise<void> {
  console.log(`Indexing ${promotions.length} promotions with embeddings...`);
  const startTime = Date.now();
  
  await initEmbedder();
  
  // Process in batches to avoid memory issues
  const batchSize = 50;
  let processed = 0;
  
  for (let i = 0; i < promotions.length; i += batchSize) {
    const batch = promotions.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (promo) => {
      // Create searchable text from promotion
      const text = [
        promo.title || '',
        promo.description || '',
        promo.merchant || promo.advertiser?.name || '',
        (promo.categories || []).join(' ')
      ].join(' ').slice(0, 512); // Limit text length
      
      // Generate unique ID for this promotion
      const id = promo.id || promo.promotionId || `${promo.merchant}-${promo.title}`.slice(0, 100);
      
      try {
        const embedding = await embed(text);
        promotionEmbeddings.set(id, embedding);
        promo._embeddingId = id; // Store reference on promotion object
      } catch (err) {
        console.error(`Failed to embed promotion: ${id}`);
      }
    }));
    
    processed += batch.length;
    if (processed % 200 === 0) {
      console.log(`Indexed ${processed}/${promotions.length} promotions...`);
    }
  }
  
  isInitialized = true;
  console.log(`Embedding index complete: ${promotionEmbeddings.size} promotions in ${Date.now() - startTime}ms`);
}

// UK to US term mappings for query expansion before embedding
const QUERY_EXPANSIONS: Record<string, string> = {
  'trainers': 'sneakers athletic shoes running shoes footwear sports shoes',
  'running shoes': 'trainers sneakers athletic footwear jogging shoes',
  'wellies': 'wellington boots rain boots rubber boots',
  'nappies': 'diapers baby nappies',
  'pushchair': 'stroller baby pushchair pram',
  'pram': 'stroller pushchair baby carriage',
  'jumper': 'sweater pullover knitwear',
  'trousers': 'pants trousers slacks',
  'mobile': 'cell phone mobile phone smartphone',
  'lorry': 'truck lorry hgv',
  'petrol': 'gas fuel petrol',
  'holiday': 'vacation holiday trip getaway',
  'flat': 'apartment flat housing',
};

function expandQueryForEmbedding(query: string): string {
  const lowerQuery = query.toLowerCase();
  const expansions: string[] = [];
  
  // Check if query contains any UK terms and accumulate all expansions
  for (const [ukTerm, expansion] of Object.entries(QUERY_EXPANSIONS)) {
    if (lowerQuery.includes(ukTerm)) {
      expansions.push(expansion);
    }
  }
  
  // Return original query plus all matched expansions
  if (expansions.length > 0) {
    return `${query} ${expansions.join(' ')}`;
  }
  return query;
}

// Semantic search - find promotions similar to query
export async function semanticSearch(
  query: string, 
  promotions: any[], 
  topK: number = 100
): Promise<Array<{ promotion: any; similarity: number }>> {
  
  if (!isInitialized || promotionEmbeddings.size === 0) {
    console.log('Embeddings not ready, falling back to empty results');
    return [];
  }
  
  // Expand query with UK/US equivalents before embedding
  const expandedQuery = expandQueryForEmbedding(query);
  
  // Get query embedding
  const queryEmbedding = await embed(expandedQuery);
  
  // Calculate similarity for each promotion
  const scored: Array<{ promotion: any; similarity: number }> = [];
  
  for (const promo of promotions) {
    const id = promo._embeddingId;
    if (!id) continue;
    
    const promoEmbedding = promotionEmbeddings.get(id);
    if (!promoEmbedding) continue;
    
    const similarity = cosineSimilarity(queryEmbedding, promoEmbedding);
    scored.push({ promotion: promo, similarity });
  }
  
  // Sort by similarity and return top K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

// Check if embeddings are ready
export function isEmbeddingsReady(): boolean {
  return isInitialized && promotionEmbeddings.size > 0;
}

// Get embedding count for debugging
export function getEmbeddingCount(): number {
  return promotionEmbeddings.size;
}
