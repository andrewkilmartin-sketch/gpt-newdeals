/**
 * Fast Search Stress Test - Uses simpler queries to avoid GPT overhead
 * Runs 500 queries in parallel batches for quick validation
 */

// Configuration
const CONFIG = {
  totalQueries: 500,
  concurrency: 20,          // Higher concurrency for faster tests
  apiUrl: 'http://localhost:5000/api/shopv2/search',
  minPassScore: 8,
  batchSize: 100,
};

// Simple query templates (brand + product type = fast keyword search, no GPT needed)
const SIMPLE_QUERIES = [
  // Footwear - clear keyword matches
  'Nike trainers', 'Adidas shoes', 'Puma sneakers', 'New Balance running shoes',
  'Converse trainers', 'Vans shoes', 'Reebok trainers', 'Nike Air Force',
  'Nike Air Max', 'Adidas Superstar', 'kids trainers', 'womens shoes',
  
  // Clothing
  'Nike t-shirt', 'Adidas jacket', 'mens jeans', 'womens dress',
  'kids hoodie', 'winter coat', 'summer dress',
  
  // Toys
  'Lego set', 'Barbie doll', 'action figure', 'board game',
  'Spider-Man toy', 'Star Wars Lego', 'Harry Potter Lego',
  
  // Electronics  
  'bluetooth headphones', 'wireless speaker', 'USB charger', 'gaming keyboard',
  
  // Brands only
  'Nike', 'Adidas', 'Puma', 'Lego', 'Sony', 'Samsung',
  
  // With attributes
  'Nike size 10', 'Adidas black', 'blue dress', 'red shoes',
  'white trainers', 'black jacket', 'kids size 5',
];

interface TestResult {
  query: string;
  score: number;
  resultCount: number;
  responseTime: number;
  brandMatch: boolean;
  hasResults: boolean;
  passed: boolean;
  errors: string[];
}

// Extract expected brand from query
function extractBrand(query: string): string | null {
  const brands = ['Nike', 'Adidas', 'Puma', 'New Balance', 'Converse', 'Vans', 'Reebok', 
                  'Lego', 'Sony', 'Samsung', 'Barbie', 'Spider-Man', 'Star Wars', 'Harry Potter'];
  const lowerQuery = query.toLowerCase();
  for (const brand of brands) {
    if (lowerQuery.includes(brand.toLowerCase())) return brand;
  }
  return null;
}

// Score a result
function scoreResult(query: string, data: any): TestResult {
  const errors: string[] = [];
  let score = 0;
  
  const products = data.products || [];
  const expectedBrand = extractBrand(query);
  
  // Has results (3 points)
  const hasResults = products.length > 0;
  if (hasResults) score += 3;
  else errors.push('No results');
  
  // Brand match (3 points)
  let brandMatch = true;
  if (expectedBrand && hasResults) {
    const brandLower = expectedBrand.toLowerCase();
    const matching = products.filter((p: any) => 
      p.brand?.toLowerCase().includes(brandLower) ||
      p.name?.toLowerCase().includes(brandLower)
    );
    const ratio = matching.length / products.length;
    if (ratio >= 0.5) {
      score += 3;
    } else if (ratio >= 0.2) {
      score += 1.5;
      brandMatch = false;
      errors.push(`Low brand match: ${Math.round(ratio * 100)}%`);
    } else {
      brandMatch = false;
      errors.push(`Brand mismatch: ${matching.length}/${products.length}`);
    }
  } else if (!expectedBrand) {
    score += 3; // No brand expected, full points
  }
  
  // Result count (2 points)
  if (products.length >= 3) score += 2;
  else if (products.length > 0) score += 1;
  
  // Merchant diversity (1 point)
  const merchants = new Set(products.map((p: any) => p.merchant));
  if (merchants.size >= 2) score += 1;
  
  // Valid prices (1 point)
  const validPrices = products.filter((p: any) => p.price > 0 && p.price < 5000);
  if (validPrices.length >= products.length * 0.5) score += 1;
  
  return {
    query,
    score,
    resultCount: products.length,
    responseTime: 0, // Set by caller
    brandMatch,
    hasResults,
    passed: score >= CONFIG.minPassScore,
    errors,
  };
}

// Run a single test
async function runTest(query: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 10 }),
    });
    const data = await res.json();
    const result = scoreResult(query, data);
    result.responseTime = Date.now() - start;
    return result;
  } catch (err) {
    return {
      query,
      score: 0,
      resultCount: 0,
      responseTime: Date.now() - start,
      brandMatch: false,
      hasResults: false,
      passed: false,
      errors: [`Error: ${(err as Error).message}`],
    };
  }
}

// Generate random queries from templates
function generateQueries(count: number): string[] {
  const queries: string[] = [];
  for (let i = 0; i < count; i++) {
    queries.push(SIMPLE_QUERIES[i % SIMPLE_QUERIES.length]);
  }
  return queries;
}

// Parallel batch execution
async function runBatch(queries: string[]): Promise<TestResult[]> {
  return Promise.all(queries.map(q => runTest(q)));
}

// Main
async function main() {
  console.log('='.repeat(60));
  console.log('FAST STRESS TEST (Simple Keyword Queries)');
  console.log('='.repeat(60));
  console.log(`Config: ${CONFIG.totalQueries} queries, ${CONFIG.concurrency} concurrent`);
  console.log('');

  const allQueries = generateQueries(CONFIG.totalQueries);
  const results: TestResult[] = [];
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < allQueries.length; i += CONFIG.concurrency) {
    const batch = allQueries.slice(i, i + CONFIG.concurrency);
    const batchResults = await runBatch(batch);
    results.push(...batchResults);

    // Progress
    if (results.length % CONFIG.batchSize === 0 || results.length === CONFIG.totalQueries) {
      const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
      const pass = results.filter(r => r.passed).length / results.length * 100;
      const avgTime = results.reduce((s, r) => s + r.responseTime, 0) / results.length;
      console.log(`[${results.length}/${CONFIG.totalQueries}] Avg: ${avg.toFixed(1)}/10 | Pass: ${pass.toFixed(0)}% | Time: ${avgTime.toFixed(0)}ms`);
    }
  }

  // Summary
  const totalTime = (Date.now() - startTime) / 1000;
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
  const passRate = results.filter(r => r.passed).length / results.length * 100;
  const avgTime = results.reduce((s, r) => s + r.responseTime, 0) / results.length;
  const failures = results.filter(r => !r.passed);

  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total: ${results.length} queries in ${totalTime.toFixed(1)}s`);
  console.log(`Average Score: ${avgScore.toFixed(2)}/10`);
  console.log(`Pass Rate: ${passRate.toFixed(1)}%`);
  console.log(`Avg Response Time: ${avgTime.toFixed(0)}ms`);

  if (failures.length > 0) {
    console.log('');
    console.log('FAILURES (sample):');
    for (const f of failures.slice(0, 10)) {
      console.log(`  [${f.score}] "${f.query}" - ${f.errors.join('; ')}`);
    }
  }

  console.log('');
  console.log(avgScore >= CONFIG.minPassScore ? 'RESULT: PASS' : 'RESULT: FAIL');
  console.log('='.repeat(60));
}

main().catch(console.error);
