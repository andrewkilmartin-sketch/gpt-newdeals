/**
 * Automated Audit Learning Loop - Fix #42
 * Runs 200 test queries, classifies failures, outputs summary
 * Usage: npx tsx scripts/auto-audit-learn.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:5000';
const OUTPUT_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'audit-results-latest.csv');

interface TestQuery {
  query: string;
  category: string;
  expectedMinResults: number;
  mustContain?: string[];
  mustNotContain?: string[];
}

interface AuditResult {
  query: string;
  category: string;
  resultCount: number;
  passed: boolean;
  failurePattern: string | null;
  topResults: string[];
  responseTimeMs: number;
}

const FAILURE_PATTERNS = {
  ZERO_RESULTS: 'ZERO_RESULTS',
  LOW_RESULTS: 'LOW_RESULTS', 
  WORD_BOUNDARY: 'WORD_BOUNDARY',
  CLOTHING_LEAK: 'CLOTHING_LEAK',
  ADULT_LEAK: 'ADULT_LEAK',
  WRONG_CATEGORY: 'WRONG_CATEGORY',
  BRAND_MISMATCH: 'BRAND_MISMATCH',
  TIMEOUT: 'TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

const TEST_QUERIES: TestQuery[] = [
  // Core 10 queries (must pass)
  { query: 'train set', category: 'core', expectedMinResults: 3, mustNotContain: ['trainer', 'training'] },
  { query: 'hot wheels', category: 'core', expectedMinResults: 3 },
  { query: 'water gun', category: 'core', expectedMinResults: 2 },
  { query: 'paw patrol toys', category: 'core', expectedMinResults: 2, mustContain: ['paw patrol'] },
  { query: 'lol dolls', category: 'core', expectedMinResults: 2, mustContain: ['lol'], mustNotContain: ['nyx', 'makeup', 'cosmetic'] },
  { query: 'badminton set', category: 'core', expectedMinResults: 3, mustContain: ['badminton'] },
  { query: 'ipad case for kids', category: 'core', expectedMinResults: 1 },
  { query: 'super soaker', category: 'core', expectedMinResults: 2 },
  { query: 'birthday present 5 year old', category: 'core', expectedMinResults: 3 },
  { query: 'stocking fillers under 5 pounds', category: 'core', expectedMinResults: 3 },
  
  // Brand queries
  { query: 'lego', category: 'brand', expectedMinResults: 5 },
  { query: 'lego set', category: 'brand', expectedMinResults: 5 },
  { query: 'disney toys', category: 'brand', expectedMinResults: 3 },
  { query: 'marvel toys', category: 'brand', expectedMinResults: 3 },
  { query: 'barbie', category: 'brand', expectedMinResults: 3 },
  { query: 'peppa pig', category: 'brand', expectedMinResults: 2 },
  { query: 'bluey toys', category: 'brand', expectedMinResults: 2 },
  { query: 'pokemon', category: 'brand', expectedMinResults: 3 },
  { query: 'nerf gun', category: 'brand', expectedMinResults: 2 },
  { query: 'playmobil', category: 'brand', expectedMinResults: 2 },
  { query: 'sylvanian families', category: 'brand', expectedMinResults: 2 },
  { query: 'transformers', category: 'brand', expectedMinResults: 2 },
  { query: 'harry potter', category: 'brand', expectedMinResults: 3 },
  { query: 'frozen', category: 'brand', expectedMinResults: 2 },
  { query: 'spiderman', category: 'brand', expectedMinResults: 2 },
  { query: 'star wars', category: 'brand', expectedMinResults: 3 },
  { query: 'minecraft', category: 'brand', expectedMinResults: 2 },
  { query: 'fortnite', category: 'brand', expectedMinResults: 2 },
  { query: 'sonic', category: 'brand', expectedMinResults: 2 },
  { query: 'mario', category: 'brand', expectedMinResults: 2 },
  
  // Character queries
  { query: 'hulk toys', category: 'character', expectedMinResults: 1, mustContain: ['hulk'] },
  { query: 'elsa', category: 'character', expectedMinResults: 1 },
  { query: 'spiderman toys', category: 'character', expectedMinResults: 2 },
  { query: 'batman', category: 'character', expectedMinResults: 2 },
  { query: 'pikachu', category: 'character', expectedMinResults: 1 },
  { query: 'iron man', category: 'character', expectedMinResults: 1 },
  { query: 'captain america', category: 'character', expectedMinResults: 1 },
  { query: 'moana', category: 'character', expectedMinResults: 1 },
  { query: 'encanto', category: 'character', expectedMinResults: 1 },
  { query: 'chase paw patrol', category: 'character', expectedMinResults: 1 },
  
  // Age-specific queries
  { query: 'toys for 3 year old', category: 'age', expectedMinResults: 3 },
  { query: 'gifts for 5 year old boy', category: 'age', expectedMinResults: 3 },
  { query: 'toys for 7 year old girl', category: 'age', expectedMinResults: 3 },
  { query: 'baby toys', category: 'age', expectedMinResults: 3 },
  { query: 'toddler toys', category: 'age', expectedMinResults: 3 },
  { query: 'toys for teenager', category: 'age', expectedMinResults: 2 },
  { query: 'newborn gifts', category: 'age', expectedMinResults: 2 },
  { query: 'toys for 10 year old', category: 'age', expectedMinResults: 3 },
  { query: 'first birthday gift', category: 'age', expectedMinResults: 2 },
  { query: 'christmas gift 8 year old', category: 'age', expectedMinResults: 3 },
  
  // Price queries  
  { query: 'toys under 10 pounds', category: 'price', expectedMinResults: 5 },
  { query: 'gifts under 20', category: 'price', expectedMinResults: 5 },
  { query: 'cheap toys', category: 'price', expectedMinResults: 3 },
  { query: 'budget friendly gifts', category: 'price', expectedMinResults: 3 },
  { query: 'stocking fillers under 3 pounds', category: 'price', expectedMinResults: 2 },
  { query: 'premium lego set', category: 'price', expectedMinResults: 2 },
  { query: 'gifts between 10 and 20 pounds', category: 'price', expectedMinResults: 3 },
  { query: 'party bag fillers under 2', category: 'price', expectedMinResults: 2 },
  
  // Product type queries
  { query: 'board games', category: 'product_type', expectedMinResults: 3 },
  { query: 'puzzle', category: 'product_type', expectedMinResults: 3 },
  { query: 'stuffed animals', category: 'product_type', expectedMinResults: 3 },
  { query: 'dolls house', category: 'product_type', expectedMinResults: 2 },
  { query: 'action figures', category: 'product_type', expectedMinResults: 3 },
  { query: 'building blocks', category: 'product_type', expectedMinResults: 3 },
  { query: 'remote control car', category: 'product_type', expectedMinResults: 2 },
  { query: 'toy kitchen', category: 'product_type', expectedMinResults: 2 },
  { query: 'play tent', category: 'product_type', expectedMinResults: 1 },
  { query: 'scooter for kids', category: 'product_type', expectedMinResults: 2 },
  { query: 'bike for 5 year old', category: 'product_type', expectedMinResults: 1 },
  { query: 'trampoline', category: 'product_type', expectedMinResults: 1 },
  { query: 'swing set', category: 'product_type', expectedMinResults: 1 },
  { query: 'sandpit', category: 'product_type', expectedMinResults: 1 },
  { query: 'paddling pool', category: 'product_type', expectedMinResults: 1 },
  
  // Outdoor/Sport queries
  { query: 'football', category: 'outdoor', expectedMinResults: 3 },
  { query: 'tennis racket kids', category: 'outdoor', expectedMinResults: 1 },
  { query: 'cricket set', category: 'outdoor', expectedMinResults: 1 },
  { query: 'garden toys', category: 'outdoor', expectedMinResults: 3 },
  { query: 'outdoor toys', category: 'outdoor', expectedMinResults: 3 },
  { query: 'bubble machine', category: 'outdoor', expectedMinResults: 1 },
  { query: 'kite', category: 'outdoor', expectedMinResults: 1 },
  { query: 'frisbee', category: 'outdoor', expectedMinResults: 1 },
  
  // Educational queries
  { query: 'educational toys', category: 'educational', expectedMinResults: 3 },
  { query: 'stem toys', category: 'educational', expectedMinResults: 2 },
  { query: 'learning toys', category: 'educational', expectedMinResults: 3 },
  { query: 'science kit', category: 'educational', expectedMinResults: 2 },
  { query: 'art supplies for kids', category: 'educational', expectedMinResults: 2 },
  { query: 'craft kit', category: 'educational', expectedMinResults: 2 },
  { query: 'musical instruments kids', category: 'educational', expectedMinResults: 2 },
  { query: 'coding toys', category: 'educational', expectedMinResults: 1 },
  
  // Books queries
  { query: 'childrens books', category: 'books', expectedMinResults: 3 },
  { query: 'picture books', category: 'books', expectedMinResults: 2 },
  { query: 'bedtime stories', category: 'books', expectedMinResults: 2 },
  { query: 'activity book', category: 'books', expectedMinResults: 2 },
  { query: 'colouring book', category: 'books', expectedMinResults: 2 },
  
  // Seasonal/Event queries
  { query: 'christmas toys', category: 'seasonal', expectedMinResults: 3 },
  { query: 'easter gifts', category: 'seasonal', expectedMinResults: 2 },
  { query: 'birthday party supplies', category: 'seasonal', expectedMinResults: 2 },
  { query: 'halloween costume kids', category: 'seasonal', expectedMinResults: 2 },
  { query: 'advent calendar', category: 'seasonal', expectedMinResults: 2 },
  
  // Clothing/Accessories (should filter appropriately)
  { query: 'kids shoes', category: 'clothing', expectedMinResults: 2 },
  { query: 'children backpack', category: 'clothing', expectedMinResults: 2 },
  { query: 'school bag', category: 'clothing', expectedMinResults: 2 },
  { query: 'lunch box kids', category: 'clothing', expectedMinResults: 2 },
  { query: 'water bottle kids', category: 'clothing', expectedMinResults: 2 },
  
  // Electronics/Gaming
  { query: 'nintendo switch games', category: 'electronics', expectedMinResults: 2 },
  { query: 'kids tablet', category: 'electronics', expectedMinResults: 1 },
  { query: 'headphones for kids', category: 'electronics', expectedMinResults: 1 },
  { query: 'karaoke machine', category: 'electronics', expectedMinResults: 1 },
  
  // Word boundary tests (trainers vs train, etc)
  { query: 'toy train', category: 'word_boundary', expectedMinResults: 2, mustNotContain: ['trainer', 'training'] },
  { query: 'watch for kids', category: 'word_boundary', expectedMinResults: 1, mustNotContain: ['smartwatch'] },
  { query: 'book token', category: 'word_boundary', expectedMinResults: 1, mustNotContain: ['booking.com'] },
  
  // Complex/semantic queries
  { query: 'something for my daughter who loves horses', category: 'semantic', expectedMinResults: 2 },
  { query: 'gift for nephew who likes dinosaurs', category: 'semantic', expectedMinResults: 2 },
  { query: 'present for granddaughter', category: 'semantic', expectedMinResults: 3 },
  { query: 'what to buy for 6 year old', category: 'semantic', expectedMinResults: 3 },
  { query: 'ideas for kids party', category: 'semantic', expectedMinResults: 2 },
  
  // Edge cases
  { query: 'duplo', category: 'edge_case', expectedMinResults: 2 },
  { query: 'lego duplo', category: 'edge_case', expectedMinResults: 2 },
  { query: 'lego technic', category: 'edge_case', expectedMinResults: 2 },
  { query: 'fidget toys', category: 'edge_case', expectedMinResults: 2 },
  { query: 'sensory toys', category: 'edge_case', expectedMinResults: 2 },
  { query: 'slime', category: 'edge_case', expectedMinResults: 1 },
  { query: 'play doh', category: 'edge_case', expectedMinResults: 2 },
  { query: 'kinetic sand', category: 'edge_case', expectedMinResults: 1 },
  
  // More brands to hit 200
  { query: 'vtech', category: 'brand', expectedMinResults: 2 },
  { query: 'fisher price', category: 'brand', expectedMinResults: 2 },
  { query: 'melissa and doug', category: 'brand', expectedMinResults: 1 },
  { query: 'tomy', category: 'brand', expectedMinResults: 1 },
  { query: 'hasbro', category: 'brand', expectedMinResults: 2 },
  { query: 'mattel', category: 'brand', expectedMinResults: 2 },
  { query: 'ravensburger', category: 'brand', expectedMinResults: 2 },
  { query: 'orchard toys', category: 'brand', expectedMinResults: 1 },
  { query: 'hey duggee', category: 'brand', expectedMinResults: 1 },
  { query: 'cocomelon', category: 'brand', expectedMinResults: 1 },
  { query: 'thomas the tank engine', category: 'brand', expectedMinResults: 1 },
  { query: 'bob the builder', category: 'brand', expectedMinResults: 1 },
  { query: 'postman pat', category: 'brand', expectedMinResults: 1 },
  { query: 'fireman sam', category: 'brand', expectedMinResults: 1 },
  { query: 'bing bunny', category: 'brand', expectedMinResults: 1 },
  { query: 'teletubbies', category: 'brand', expectedMinResults: 1 },
  { query: 'pj masks', category: 'brand', expectedMinResults: 1 },
  { query: 'my little pony', category: 'brand', expectedMinResults: 1 },
  { query: 'care bears', category: 'brand', expectedMinResults: 1 },
  { query: 'trolls', category: 'brand', expectedMinResults: 1 },
  { query: 'minions', category: 'brand', expectedMinResults: 1 },
  { query: 'toy story', category: 'brand', expectedMinResults: 2 },
  { query: 'cars disney', category: 'brand', expectedMinResults: 1 },
  { query: 'finding nemo', category: 'brand', expectedMinResults: 1 },
  { query: 'lion king', category: 'brand', expectedMinResults: 1 },
  { query: 'avengers', category: 'brand', expectedMinResults: 2 },
  { query: 'justice league', category: 'brand', expectedMinResults: 1 },
  { query: 'super mario', category: 'brand', expectedMinResults: 2 },
  { query: 'zelda', category: 'brand', expectedMinResults: 1 },
  { query: 'roblox', category: 'brand', expectedMinResults: 1 },
  
  // More product types
  { query: 'tea set toy', category: 'product_type', expectedMinResults: 1 },
  { query: 'toy car', category: 'product_type', expectedMinResults: 3 },
  { query: 'toy truck', category: 'product_type', expectedMinResults: 2 },
  { query: 'toy plane', category: 'product_type', expectedMinResults: 1 },
  { query: 'toy boat', category: 'product_type', expectedMinResults: 1 },
  { query: 'toy dinosaur', category: 'product_type', expectedMinResults: 2 },
  { query: 'toy animal', category: 'product_type', expectedMinResults: 3 },
  { query: 'soft toy', category: 'product_type', expectedMinResults: 3 },
  { query: 'plush toy', category: 'product_type', expectedMinResults: 3 },
  { query: 'cuddly toy', category: 'product_type', expectedMinResults: 2 },
  { query: 'teddy bear', category: 'product_type', expectedMinResults: 2 },
  { query: 'baby doll', category: 'product_type', expectedMinResults: 2 },
  { query: 'fashion doll', category: 'product_type', expectedMinResults: 2 },
  { query: 'doll clothes', category: 'product_type', expectedMinResults: 1 },
  { query: 'doll accessories', category: 'product_type', expectedMinResults: 1 },
  { query: 'play food', category: 'product_type', expectedMinResults: 1 },
  { query: 'cash register toy', category: 'product_type', expectedMinResults: 1 },
  { query: 'doctor kit', category: 'product_type', expectedMinResults: 1 },
  { query: 'tool set toy', category: 'product_type', expectedMinResults: 1 },
  { query: 'workbench toy', category: 'product_type', expectedMinResults: 1 },
];

async function runQuery(query: string): Promise<{ count: number; products: any[]; timeMs: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    
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
    return {
      count: data.count || 0,
      products: data.products || [],
      timeMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      count: 0,
      products: [],
      timeMs: Date.now() - start,
      error: err.message?.includes('abort') ? 'TIMEOUT' : err.message,
    };
  }
}

function classifyFailure(test: TestQuery, result: { count: number; products: any[]; error?: string }): string | null {
  if (result.error === 'TIMEOUT') return FAILURE_PATTERNS.TIMEOUT;
  if (result.error) return FAILURE_PATTERNS.SERVER_ERROR;
  if (result.count === 0) return FAILURE_PATTERNS.ZERO_RESULTS;
  if (result.count < test.expectedMinResults) return FAILURE_PATTERNS.LOW_RESULTS;
  
  const productNames = result.products.map(p => (p.name || '').toLowerCase());
  const allText = productNames.join(' ');
  
  // Check mustContain
  if (test.mustContain) {
    for (const term of test.mustContain) {
      if (!allText.includes(term.toLowerCase())) {
        return FAILURE_PATTERNS.BRAND_MISMATCH;
      }
    }
  }
  
  // Check mustNotContain
  if (test.mustNotContain) {
    for (const term of test.mustNotContain) {
      if (allText.includes(term.toLowerCase())) {
        // Specific pattern detection
        if (['trainer', 'training'].includes(term.toLowerCase())) {
          return FAILURE_PATTERNS.WORD_BOUNDARY;
        }
        if (['nyx', 'makeup', 'cosmetic'].includes(term.toLowerCase())) {
          return FAILURE_PATTERNS.CLOTHING_LEAK;
        }
        if (['adult', 'mature', 'explicit'].includes(term.toLowerCase())) {
          return FAILURE_PATTERNS.ADULT_LEAK;
        }
        return FAILURE_PATTERNS.WRONG_CATEGORY;
      }
    }
  }
  
  return null; // PASS
}

async function runAudit(): Promise<void> {
  console.log('='.repeat(60));
  console.log('AUTOMATED AUDIT LEARNING LOOP');
  console.log(`Running ${TEST_QUERIES.length} test queries...`);
  console.log('='.repeat(60));
  console.log('');
  
  const results: AuditResult[] = [];
  const failurePatterns: Record<string, number> = {};
  const categoryStats: Record<string, { pass: number; fail: number }> = {};
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const test = TEST_QUERIES[i];
    const result = await runQuery(test.query);
    const failurePattern = classifyFailure(test, result);
    const didPass = failurePattern === null;
    
    if (didPass) {
      passed++;
      process.stdout.write('.');
    } else {
      failed++;
      process.stdout.write('X');
      failurePatterns[failurePattern] = (failurePatterns[failurePattern] || 0) + 1;
    }
    
    // Track by category
    if (!categoryStats[test.category]) {
      categoryStats[test.category] = { pass: 0, fail: 0 };
    }
    if (didPass) {
      categoryStats[test.category].pass++;
    } else {
      categoryStats[test.category].fail++;
    }
    
    results.push({
      query: test.query,
      category: test.category,
      resultCount: result.count,
      passed: didPass,
      failurePattern,
      topResults: result.products.slice(0, 3).map(p => p.name || 'unknown'),
      responseTimeMs: result.timeMs,
    });
    
    // Progress indicator every 50
    if ((i + 1) % 50 === 0) {
      console.log(` [${i + 1}/${TEST_QUERIES.length}]`);
    }
  }
  
  console.log('');
  console.log('');
  
  // Summary
  const passRate = ((passed / TEST_QUERIES.length) * 100).toFixed(1);
  console.log('='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Queries: ${TEST_QUERIES.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${passRate}%`);
  console.log('');
  
  // Failure patterns
  console.log('TOP FAILURE PATTERNS:');
  console.log('-'.repeat(40));
  const sortedPatterns = Object.entries(failurePatterns)
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedPatterns.length === 0) {
    console.log('  (none - all tests passed!)');
  } else {
    for (const [pattern, count] of sortedPatterns) {
      const pct = ((count / failed) * 100).toFixed(1);
      console.log(`  ${pattern}: ${count} (${pct}% of failures)`);
    }
  }
  console.log('');
  
  // Category breakdown
  console.log('CATEGORY BREAKDOWN:');
  console.log('-'.repeat(40));
  const sortedCategories = Object.entries(categoryStats)
    .sort((a, b) => (b[1].pass / (b[1].pass + b[1].fail)) - (a[1].pass / (a[1].pass + a[1].fail)));
  
  for (const [cat, stats] of sortedCategories) {
    const total = stats.pass + stats.fail;
    const rate = ((stats.pass / total) * 100).toFixed(0);
    const status = stats.fail === 0 ? '✓' : '✗';
    console.log(`  ${status} ${cat}: ${stats.pass}/${total} (${rate}%)`);
  }
  console.log('');
  
  // Failed queries list
  const failedResults = results.filter(r => !r.passed);
  if (failedResults.length > 0) {
    console.log('FAILED QUERIES:');
    console.log('-'.repeat(40));
    for (const r of failedResults.slice(0, 20)) {
      console.log(`  [${r.failurePattern}] "${r.query}" → ${r.resultCount} results`);
    }
    if (failedResults.length > 20) {
      console.log(`  ... and ${failedResults.length - 20} more`);
    }
  }
  console.log('');
  
  // Save to CSV
  const csvHeader = 'query,category,result_count,passed,failure_pattern,response_time_ms,top_result_1,top_result_2,top_result_3';
  const csvRows = results.map(r => {
    const escapeCsv = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    return [
      escapeCsv(r.query),
      r.category,
      r.resultCount,
      r.passed,
      r.failurePattern || '',
      r.responseTimeMs,
      escapeCsv(r.topResults[0] || ''),
      escapeCsv(r.topResults[1] || ''),
      escapeCsv(r.topResults[2] || ''),
    ].join(',');
  });
  
  const csvContent = [csvHeader, ...csvRows].join('\n');
  fs.writeFileSync(OUTPUT_FILE, csvContent);
  console.log(`Results saved to: ${OUTPUT_FILE}`);
  console.log('='.repeat(60));
}

runAudit().catch(console.error);
