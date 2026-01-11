/**
 * Quick Audit Loop - Runs 100 priority queries with 30s timeout each
 * Usage: npx tsx scripts/quick-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:5000';
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'audit-results-latest.csv');

interface TestQuery {
  query: string;
  category: string;
  expectedMinResults: number;
  mustNotContain?: string[];
}

const PRIORITY_QUERIES: TestQuery[] = [
  // Core 10
  { query: 'train set', category: 'core', expectedMinResults: 3, mustNotContain: ['trainer'] },
  { query: 'hot wheels', category: 'core', expectedMinResults: 3 },
  { query: 'water gun', category: 'core', expectedMinResults: 2 },
  { query: 'paw patrol toys', category: 'core', expectedMinResults: 2 },
  { query: 'lol dolls', category: 'core', expectedMinResults: 2, mustNotContain: ['nyx', 'makeup'] },
  { query: 'badminton set', category: 'core', expectedMinResults: 3 },
  { query: 'ipad case for kids', category: 'core', expectedMinResults: 1 },
  { query: 'super soaker', category: 'core', expectedMinResults: 2 },
  { query: 'birthday present 5 year old', category: 'core', expectedMinResults: 3 },
  { query: 'stocking fillers under 5 pounds', category: 'core', expectedMinResults: 3 },
  
  // Top brands (20)
  { query: 'lego', category: 'brand', expectedMinResults: 5 },
  { query: 'lego set', category: 'brand', expectedMinResults: 5 },
  { query: 'disney toys', category: 'brand', expectedMinResults: 3 },
  { query: 'marvel toys', category: 'brand', expectedMinResults: 3 },
  { query: 'barbie', category: 'brand', expectedMinResults: 3 },
  { query: 'peppa pig', category: 'brand', expectedMinResults: 2 },
  { query: 'pokemon', category: 'brand', expectedMinResults: 3 },
  { query: 'nerf gun', category: 'brand', expectedMinResults: 2 },
  { query: 'harry potter', category: 'brand', expectedMinResults: 3 },
  { query: 'frozen', category: 'brand', expectedMinResults: 2 },
  { query: 'spiderman', category: 'brand', expectedMinResults: 2 },
  { query: 'star wars', category: 'brand', expectedMinResults: 3 },
  { query: 'minecraft', category: 'brand', expectedMinResults: 2 },
  { query: 'sonic', category: 'brand', expectedMinResults: 2 },
  { query: 'mario', category: 'brand', expectedMinResults: 2 },
  { query: 'bluey toys', category: 'brand', expectedMinResults: 2 },
  { query: 'transformers', category: 'brand', expectedMinResults: 2 },
  { query: 'avengers', category: 'brand', expectedMinResults: 2 },
  { query: 'toy story', category: 'brand', expectedMinResults: 2 },
  { query: 'fortnite', category: 'brand', expectedMinResults: 2 },
  
  // Characters (10)
  { query: 'hulk toys', category: 'character', expectedMinResults: 1 },
  { query: 'elsa', category: 'character', expectedMinResults: 1 },
  { query: 'batman', category: 'character', expectedMinResults: 2 },
  { query: 'pikachu', category: 'character', expectedMinResults: 1 },
  { query: 'iron man', category: 'character', expectedMinResults: 1 },
  { query: 'moana', category: 'character', expectedMinResults: 1 },
  { query: 'chase paw patrol', category: 'character', expectedMinResults: 1 },
  { query: 'buzz lightyear', category: 'character', expectedMinResults: 1 },
  { query: 'woody', category: 'character', expectedMinResults: 1 },
  { query: 'lightning mcqueen', category: 'character', expectedMinResults: 1 },
  
  // Age (10)
  { query: 'toys for 3 year old', category: 'age', expectedMinResults: 3 },
  { query: 'gifts for 5 year old boy', category: 'age', expectedMinResults: 3 },
  { query: 'toys for 7 year old girl', category: 'age', expectedMinResults: 3 },
  { query: 'baby toys', category: 'age', expectedMinResults: 3 },
  { query: 'toddler toys', category: 'age', expectedMinResults: 3 },
  { query: 'newborn gifts', category: 'age', expectedMinResults: 2 },
  { query: 'toys for 10 year old', category: 'age', expectedMinResults: 3 },
  { query: 'first birthday gift', category: 'age', expectedMinResults: 2 },
  { query: 'christmas gift 8 year old', category: 'age', expectedMinResults: 3 },
  { query: 'teenager gift', category: 'age', expectedMinResults: 2 },
  
  // Price (10)
  { query: 'toys under 10 pounds', category: 'price', expectedMinResults: 5 },
  { query: 'gifts under 20', category: 'price', expectedMinResults: 5 },
  { query: 'cheap toys', category: 'price', expectedMinResults: 3 },
  { query: 'stocking fillers under 3 pounds', category: 'price', expectedMinResults: 2 },
  { query: 'party bag fillers', category: 'price', expectedMinResults: 2 },
  { query: 'budget toys', category: 'price', expectedMinResults: 3 },
  { query: 'affordable gifts', category: 'price', expectedMinResults: 3 },
  { query: 'gifts under 50', category: 'price', expectedMinResults: 5 },
  { query: 'premium lego', category: 'price', expectedMinResults: 2 },
  { query: 'luxury toys', category: 'price', expectedMinResults: 2 },
  
  // Product types (20)
  { query: 'board games', category: 'product_type', expectedMinResults: 3 },
  { query: 'puzzle', category: 'product_type', expectedMinResults: 3 },
  { query: 'stuffed animals', category: 'product_type', expectedMinResults: 3 },
  { query: 'dolls house', category: 'product_type', expectedMinResults: 2 },
  { query: 'action figures', category: 'product_type', expectedMinResults: 3 },
  { query: 'building blocks', category: 'product_type', expectedMinResults: 3 },
  { query: 'remote control car', category: 'product_type', expectedMinResults: 2 },
  { query: 'scooter for kids', category: 'product_type', expectedMinResults: 2 },
  { query: 'teddy bear', category: 'product_type', expectedMinResults: 2 },
  { query: 'toy car', category: 'product_type', expectedMinResults: 3 },
  { query: 'soft toy', category: 'product_type', expectedMinResults: 3 },
  { query: 'plush toy', category: 'product_type', expectedMinResults: 3 },
  { query: 'toy dinosaur', category: 'product_type', expectedMinResults: 2 },
  { query: 'play doh', category: 'product_type', expectedMinResults: 2 },
  { query: 'slime', category: 'product_type', expectedMinResults: 1 },
  { query: 'craft kit', category: 'product_type', expectedMinResults: 2 },
  { query: 'science kit', category: 'product_type', expectedMinResults: 2 },
  { query: 'outdoor toys', category: 'product_type', expectedMinResults: 3 },
  { query: 'garden toys', category: 'product_type', expectedMinResults: 3 },
  { query: 'football', category: 'product_type', expectedMinResults: 3 },
  
  // Edge cases/word boundary (10)
  { query: 'toy train', category: 'word_boundary', expectedMinResults: 2, mustNotContain: ['trainer'] },
  { query: 'duplo', category: 'edge_case', expectedMinResults: 2 },
  { query: 'lego duplo', category: 'edge_case', expectedMinResults: 2 },
  { query: 'lego technic', category: 'edge_case', expectedMinResults: 2 },
  { query: 'fidget toys', category: 'edge_case', expectedMinResults: 2 },
  { query: 'sensory toys', category: 'edge_case', expectedMinResults: 2 },
  { query: 'educational toys', category: 'edge_case', expectedMinResults: 3 },
  { query: 'stem toys', category: 'edge_case', expectedMinResults: 2 },
  { query: 'kinetic sand', category: 'edge_case', expectedMinResults: 1 },
  { query: 'advent calendar', category: 'seasonal', expectedMinResults: 2 },
];

const FAILURE_PATTERNS = {
  ZERO_RESULTS: 'ZERO_RESULTS',
  LOW_RESULTS: 'LOW_RESULTS', 
  WORD_BOUNDARY: 'WORD_BOUNDARY',
  CLOTHING_LEAK: 'CLOTHING_LEAK',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
};

async function runQuery(query: string): Promise<{ count: number; products: any[]; timeMs: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${API_URL}/api/shop/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 8 }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { count: 0, products: [], timeMs: Date.now() - start, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return { count: data.count || 0, products: data.products || [], timeMs: Date.now() - start };
  } catch (err: any) {
    return { count: 0, products: [], timeMs: Date.now() - start, error: err.message?.includes('abort') ? 'TIMEOUT' : err.message };
  }
}

function classifyFailure(test: TestQuery, result: { count: number; products: any[]; error?: string }): string | null {
  if (result.error === 'TIMEOUT') return FAILURE_PATTERNS.TIMEOUT;
  if (result.error) return FAILURE_PATTERNS.SERVER_ERROR;
  if (result.count === 0) return FAILURE_PATTERNS.ZERO_RESULTS;
  if (result.count < test.expectedMinResults) return FAILURE_PATTERNS.LOW_RESULTS;
  
  if (test.mustNotContain) {
    const allText = result.products.map(p => (p.name || '').toLowerCase()).join(' ');
    for (const term of test.mustNotContain) {
      if (allText.includes(term.toLowerCase())) {
        if (['trainer', 'training'].includes(term.toLowerCase())) return FAILURE_PATTERNS.WORD_BOUNDARY;
        if (['nyx', 'makeup', 'cosmetic'].includes(term.toLowerCase())) return FAILURE_PATTERNS.CLOTHING_LEAK;
      }
    }
  }
  
  return null;
}

async function runAudit(): Promise<void> {
  console.log('='.repeat(60));
  console.log('QUICK AUDIT - 100 PRIORITY QUERIES');
  console.log('='.repeat(60));
  
  const results: any[] = [];
  const failurePatterns: Record<string, number> = {};
  const categoryStats: Record<string, { pass: number; fail: number }> = {};
  let passed = 0, failed = 0;
  
  for (let i = 0; i < PRIORITY_QUERIES.length; i++) {
    const test = PRIORITY_QUERIES[i];
    const result = await runQuery(test.query);
    const failurePattern = classifyFailure(test, result);
    const didPass = failurePattern === null;
    
    if (didPass) { passed++; process.stdout.write('.'); }
    else { 
      failed++; 
      process.stdout.write('X');
      failurePatterns[failurePattern] = (failurePatterns[failurePattern] || 0) + 1;
    }
    
    if (!categoryStats[test.category]) categoryStats[test.category] = { pass: 0, fail: 0 };
    categoryStats[test.category][didPass ? 'pass' : 'fail']++;
    
    results.push({
      query: test.query,
      category: test.category,
      resultCount: result.count,
      passed: didPass,
      failurePattern,
      topResults: result.products.slice(0, 3).map((p: any) => p.name || 'unknown'),
      responseTimeMs: result.timeMs,
    });
    
    if ((i + 1) % 50 === 0) console.log(` [${i + 1}/${PRIORITY_QUERIES.length}]`);
  }
  
  console.log('\n');
  
  const passRate = ((passed / PRIORITY_QUERIES.length) * 100).toFixed(1);
  console.log('='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total: ${PRIORITY_QUERIES.length} | Passed: ${passed} | Failed: ${failed} | Pass Rate: ${passRate}%`);
  console.log('');
  
  console.log('FAILURE PATTERNS:');
  const sortedPatterns = Object.entries(failurePatterns).sort((a, b) => b[1] - a[1]);
  if (sortedPatterns.length === 0) console.log('  (none - all passed!)');
  else sortedPatterns.forEach(([p, c]) => console.log(`  ${p}: ${c}`));
  console.log('');
  
  console.log('BY CATEGORY:');
  Object.entries(categoryStats).forEach(([cat, s]) => {
    const rate = ((s.pass / (s.pass + s.fail)) * 100).toFixed(0);
    console.log(`  ${s.fail === 0 ? '✓' : '✗'} ${cat}: ${s.pass}/${s.pass + s.fail} (${rate}%)`);
  });
  console.log('');
  
  const failedResults = results.filter((r: any) => !r.passed);
  if (failedResults.length > 0) {
    console.log('FAILED QUERIES:');
    failedResults.slice(0, 15).forEach((r: any) => console.log(`  [${r.failurePattern}] "${r.query}" → ${r.resultCount} results`));
    if (failedResults.length > 15) console.log(`  ... and ${failedResults.length - 15} more`);
  }
  
  // Save CSV
  const csvHeader = 'query,category,result_count,passed,failure_pattern,response_time_ms';
  const csvRows = results.map((r: any) => `"${r.query}",${r.category},${r.resultCount},${r.passed},${r.failurePattern || ''},${r.responseTimeMs}`);
  fs.writeFileSync(OUTPUT_FILE, [csvHeader, ...csvRows].join('\n'));
  console.log(`\nResults saved to: ${OUTPUT_FILE}`);
}

runAudit().catch(console.error);
