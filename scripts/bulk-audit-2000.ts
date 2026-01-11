import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000';
const QUERIES_FILE = path.join(process.cwd(), 'data', 'test-queries-2000.json');
const RESULTS_FILE = path.join(process.cwd(), 'data', 'bulk-audit-results-2000.json');
const PROGRESS_FILE = path.join(process.cwd(), 'data', 'bulk-audit-progress-2000.json');

interface AuditResult {
  query: string;
  passed: boolean;
  verdict: string;
  resultCount: number;
  responseTimeMs: number;
  products: { id: number; name: string; price: number; brand: string }[];
  timestamp: string;
}

interface FailurePattern {
  pattern: string;
  count: number;
  examples: string[];
}

async function searchQuery(query: string): Promise<{
  products: any[];
  responseTimeMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const response = await fetch(`${API_BASE}/api/shop/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 8 })
    });
    const data = await response.json();
    return {
      products: data.products || [],
      responseTimeMs: Date.now() - start
    };
  } catch (error: any) {
    return {
      products: [],
      responseTimeMs: Date.now() - start,
      error: error.message
    };
  }
}

function analyzeResult(query: string, products: any[], responseTimeMs: number): AuditResult {
  const queryLower = query.toLowerCase();
  let verdict = 'PASS';
  let passed = true;
  
  if (products.length === 0) {
    verdict = 'ZERO_RESULTS';
    passed = false;
  } else if (products.length < 3) {
    verdict = 'LOW_RESULTS';
    passed = false;
  } else if (responseTimeMs > 5000) {
    verdict = 'TIMEOUT';
    passed = false;
  } else {
    const hasClothing = products.some(p => {
      const name = (p.name || '').toLowerCase();
      const category = (p.category || '').toLowerCase();
      return (name.includes('t-shirt') || name.includes('hoodie') || 
              name.includes('sweatshirt') || name.includes('pyjama') ||
              category.includes('clothing') || category.includes('apparel'));
    });
    
    const isToyQuery = queryLower.includes('toy') || queryLower.includes('gift') || 
                       queryLower.includes('lego') || queryLower.includes('doll') ||
                       queryLower.includes('game') || queryLower.includes('puzzle');
    
    if (isToyQuery && hasClothing && products.length <= 3) {
      verdict = 'CLOTHING_LEAK';
      passed = false;
    }
    
    const hasWrongBrand = products.some(p => {
      const name = (p.name || '').toLowerCase();
      if (queryLower.includes('paw patrol') && !name.includes('paw patrol') && !name.includes('paw')) return true;
      if (queryLower.includes('peppa pig') && !name.includes('peppa')) return true;
      if (queryLower.includes('frozen') && !name.includes('frozen') && !name.includes('elsa') && !name.includes('anna')) return true;
      if (queryLower.includes('spiderman') && !name.includes('spider')) return true;
      return false;
    });
    
    if (hasWrongBrand && products.filter(p => {
      const name = (p.name || '').toLowerCase();
      return !name.includes(queryLower.split(' ')[0]);
    }).length > products.length / 2) {
      verdict = 'WRONG_BRAND';
      passed = false;
    }
  }
  
  return {
    query,
    passed,
    verdict,
    resultCount: products.length,
    responseTimeMs,
    products: products.slice(0, 5).map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      brand: p.brand
    })),
    timestamp: new Date().toISOString()
  };
}

async function runBulkAudit() {
  console.log('='.repeat(60));
  console.log('BULK AUDIT - 1,700 QUERIES');
  console.log('='.repeat(60));
  
  const queries: string[] = JSON.parse(fs.readFileSync(QUERIES_FILE, 'utf8'));
  console.log(`Loaded ${queries.length} queries from ${QUERIES_FILE}`);
  
  let startIndex = 0;
  let results: AuditResult[] = [];
  
  if (fs.existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    if (progress.results && progress.lastIndex) {
      results = progress.results;
      startIndex = progress.lastIndex + 1;
      console.log(`Resuming from query ${startIndex} (${results.length} already completed)`);
    }
  }
  
  const BATCH_SIZE = 20;
  const DELAY_BETWEEN_BATCHES = 50;
  
  for (let i = startIndex; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, Math.min(i + BATCH_SIZE, queries.length));
    
    const batchResults = await Promise.all(batch.map(async (query) => {
      const { products, responseTimeMs, error } = await searchQuery(query);
      if (error) {
        return {
          query,
          passed: false,
          verdict: 'ERROR',
          resultCount: 0,
          responseTimeMs,
          products: [],
          timestamp: new Date().toISOString()
        };
      }
      return analyzeResult(query, products, responseTimeMs);
    }));
    
    results.push(...batchResults);
    
    if (i % 50 === 0) {
      const progress = results.filter(r => r.passed).length;
      const total = results.length;
      const passRate = ((progress / total) * 100).toFixed(1);
      console.log(`[${i + batch.length}/${queries.length}] Pass rate: ${passRate}% (${progress}/${total})`);
      
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        lastIndex: i + batch.length - 1,
        total: queries.length,
        passRate: parseFloat(passRate),
        results
      }, null, 2));
    }
    
    if (i + BATCH_SIZE < queries.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const passRate = ((passed / results.length) * 100).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total queries: ${results.length}`);
  console.log(`Passed: ${passed} (${passRate}%)`);
  console.log(`Failed: ${failed}`);
  
  const failurePatterns: Record<string, FailurePattern> = {};
  results.filter(r => !r.passed).forEach(r => {
    if (!failurePatterns[r.verdict]) {
      failurePatterns[r.verdict] = { pattern: r.verdict, count: 0, examples: [] };
    }
    failurePatterns[r.verdict].count++;
    if (failurePatterns[r.verdict].examples.length < 10) {
      failurePatterns[r.verdict].examples.push(r.query);
    }
  });
  
  console.log('\nTOP FAILURE PATTERNS:');
  Object.values(failurePatterns)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .forEach((p, i) => {
      console.log(`${i + 1}. ${p.pattern}: ${p.count} queries`);
      console.log(`   Examples: ${p.examples.slice(0, 3).join(', ')}`);
    });
  
  console.log('\nTOP 20 FAILING QUERIES:');
  results.filter(r => !r.passed).slice(0, 20).forEach((r, i) => {
    console.log(`${i + 1}. "${r.query}" → ${r.verdict} (${r.resultCount} results, ${r.responseTimeMs}ms)`);
    if (r.products.length > 0) {
      console.log(`   Top result: ${r.products[0]?.name?.slice(0, 50)}...`);
    }
  });
  
  const summary = {
    timestamp: new Date().toISOString(),
    totalQueries: results.length,
    passed,
    failed,
    passRate: parseFloat(passRate),
    failurePatterns: Object.values(failurePatterns).sort((a, b) => b.count - a.count),
    failingQueries: results.filter(r => !r.passed).map(r => ({
      query: r.query,
      verdict: r.verdict,
      resultCount: r.resultCount,
      responseTimeMs: r.responseTimeMs,
      topProducts: r.products.slice(0, 3).map(p => p.name)
    })),
    passingQueries: results.filter(r => r.passed).map(r => ({
      query: r.query,
      productIds: r.products.map(p => p.id),
      productNames: r.products.map(p => p.name)
    })),
    allResults: results
  };
  
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2));
  console.log(`\nResults saved to ${RESULTS_FILE}`);
  
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
  
  return summary;
}

runBulkAudit().catch(console.error);
