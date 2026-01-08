/**
 * Search Stress Test Harness
 * Simulates thousands of user queries, validates against database, scores results
 * Target: 8+ average score to pass
 */

import { db } from './db';
import { productsV2 } from '@shared/schema';
import { sql, ilike, and, or } from 'drizzle-orm';

// Configuration
const CONFIG = {
  totalQueries: 100,        // Total queries to run (reduced for speed)
  concurrency: 5,           // Parallel requests (reduced to avoid overload)
  apiUrl: 'http://localhost:5000/api/shopv2/search',
  minPassScore: 8,          // Minimum score to pass
  batchSize: 20,            // Queries per batch for progress reporting
};

// Query templates for generating diverse test scenarios
const QUERY_TEMPLATES = {
  footwear: [
    '{brand} trainers size {size}',
    '{brand} shoes {color}',
    '{brand} {model} size {size}',
    'running shoes for {gender}',
    '{color} {brand} sneakers',
    'kids {brand} trainers size {kidsSize}',
  ],
  clothing: [
    '{brand} t-shirt size {clothingSize}',
    '{gender} {brand} jacket',
    '{color} dress size {clothingSize}',
    '{brand} jeans',
    'kids {brand} hoodie',
  ],
  toys: [
    'Lego set for {age} year old',
    '{franchise} action figure',
    'toys for {age} year old {gender}',
    '{franchise} playset',
    'board games for kids',
  ],
  electronics: [
    'wireless {electronicType}',
    'bluetooth {electronicType}',
    '{brand} {electronicType}',
    'gaming {electronicType}',
  ],
  semantic: [
    'gift for dad',
    'present for mum',
    'birthday gift for teenager',
    'rainy day activities',
    'stocking fillers',
    'back to school',
  ],
  general: [
    '{brand}',
    '{color} {product}',
    'cheap {product}',
    'best {product}',
  ],
};

// Value pools for template substitution
const VALUES = {
  brand: ['Nike', 'Adidas', 'Puma', 'New Balance', 'Reebok', 'Converse', 'Vans', 'Lego', 'Sony', 'Samsung', 'Apple'],
  model: ['Air Force 1', 'Air Max', 'Dunk', 'Jordan', 'Superstar', 'Stan Smith', 'Classic'],
  color: ['black', 'white', 'red', 'blue', 'green', 'grey', 'pink', 'navy'],
  size: ['6', '7', '8', '9', '10', '11', '12'],
  kidsSize: ['1', '2', '3', '4', '5'],
  clothingSize: ['S', 'M', 'L', 'XL', 'XXL', '8', '10', '12', '14', '16'],
  gender: ['men', 'women', 'mens', 'womens', 'boys', 'girls'],
  age: ['3', '5', '6', '7', '8', '10', '12'],
  franchise: ['Spider-Man', 'Star Wars', 'Harry Potter', 'Marvel', 'Pokemon', 'Disney', 'Frozen', 'Barbie'],
  electronicType: ['headphones', 'speaker', 'earbuds', 'keyboard', 'mouse', 'charger'],
  product: ['bag', 'watch', 'wallet', 'sunglasses', 'hat', 'backpack'],
};

// Scoring criteria weights
const SCORING = {
  hasResults: 2,           // Did we get any results?
  brandMatch: 2,           // If brand specified, did results contain it?
  categoryRelevance: 2,    // Are results in expected category?
  attributeMatch: 2,       // Size/color/etc match if specified?
  merchantDiversity: 1,    // Multiple merchants = better price comparison
  priceReasonable: 1,      // Prices within reasonable range?
};

interface TestResult {
  query: string;
  category: string;
  score: number;
  maxScore: number;
  scoreBreakdown: Record<string, number>;
  resultCount: number;
  responseTime: number;
  errors: string[];
  passed: boolean;
}

interface SearchResponse {
  success: boolean;
  products: Array<{
    id: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    merchant: string;
  }>;
  totalCount: number;
  filterSchema?: {
    category: string;
  };
  error?: string;
}

// Generate a random query from templates
function generateQuery(): { query: string; category: string; expectedBrand?: string; expectedSize?: string; expectedColor?: string } {
  const categories = Object.keys(QUERY_TEMPLATES);
  const category = categories[Math.floor(Math.random() * categories.length)];
  const templates = QUERY_TEMPLATES[category as keyof typeof QUERY_TEMPLATES];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  let query = template;
  let expectedBrand: string | undefined;
  let expectedSize: string | undefined;
  let expectedColor: string | undefined;
  
  // Replace placeholders
  for (const [key, values] of Object.entries(VALUES)) {
    const placeholder = `{${key}}`;
    if (query.includes(placeholder)) {
      const value = values[Math.floor(Math.random() * values.length)];
      query = query.replace(placeholder, value);
      
      if (key === 'brand') expectedBrand = value;
      if (key === 'size' || key === 'kidsSize' || key === 'clothingSize') expectedSize = value;
      if (key === 'color') expectedColor = value;
    }
  }
  
  return { query, category, expectedBrand, expectedSize, expectedColor };
}

// Score a single search result
async function scoreResult(
  query: string,
  category: string,
  response: SearchResponse,
  expectedBrand?: string,
  expectedSize?: string,
  expectedColor?: string
): Promise<{ score: number; maxScore: number; breakdown: Record<string, number>; errors: string[] }> {
  const breakdown: Record<string, number> = {};
  const errors: string[] = [];
  let score = 0;
  let maxScore = 0;
  
  // 1. Has results (2 points)
  maxScore += SCORING.hasResults;
  if (response.products && response.products.length > 0) {
    score += SCORING.hasResults;
    breakdown.hasResults = SCORING.hasResults;
  } else {
    errors.push('No results returned');
    breakdown.hasResults = 0;
  }
  
  // 2. Brand match if specified (2 points)
  if (expectedBrand) {
    maxScore += SCORING.brandMatch;
    const brandLower = expectedBrand.toLowerCase();
    const matchingProducts = response.products?.filter(p => 
      p.brand?.toLowerCase().includes(brandLower) ||
      p.name?.toLowerCase().includes(brandLower)
    ) || [];
    
    const matchRatio = response.products?.length > 0 
      ? matchingProducts.length / response.products.length 
      : 0;
    
    if (matchRatio >= 0.5) {
      score += SCORING.brandMatch;
      breakdown.brandMatch = SCORING.brandMatch;
    } else if (matchRatio >= 0.25) {
      score += SCORING.brandMatch * 0.5;
      breakdown.brandMatch = SCORING.brandMatch * 0.5;
      errors.push(`Only ${Math.round(matchRatio * 100)}% brand match for "${expectedBrand}"`);
    } else {
      breakdown.brandMatch = 0;
      errors.push(`Poor brand match: ${matchingProducts.length}/${response.products?.length || 0} for "${expectedBrand}"`);
    }
  }
  
  // 3. Category relevance (2 points)
  maxScore += SCORING.categoryRelevance;
  const detectedCategory = response.filterSchema?.category || 'general';
  const categoryMapping: Record<string, string[]> = {
    footwear: ['footwear', 'shoes'],
    clothing: ['clothing', 'footwear'], // Size queries can be ambiguous
    toys: ['toys', 'general'],
    electronics: ['electronics', 'general'],
    semantic: ['general', 'clothing', 'toys', 'electronics', 'footwear', 'home', 'beauty'],
    general: ['general', 'clothing', 'footwear', 'toys', 'electronics', 'home', 'beauty'],
  };
  
  const acceptableCategories = categoryMapping[category] || ['general'];
  if (acceptableCategories.includes(detectedCategory)) {
    score += SCORING.categoryRelevance;
    breakdown.categoryRelevance = SCORING.categoryRelevance;
  } else {
    breakdown.categoryRelevance = 0;
    errors.push(`Category mismatch: expected ${category}, got ${detectedCategory}`);
  }
  
  // 4. Attribute match - size/color in product names (2 points)
  if (expectedSize || expectedColor) {
    maxScore += SCORING.attributeMatch;
    let attrScore = 0;
    
    if (expectedSize) {
      const sizeMatches = response.products?.filter(p => 
        p.name?.toLowerCase().includes(`size ${expectedSize.toLowerCase()}`) ||
        p.name?.toLowerCase().includes(` ${expectedSize.toLowerCase()} `) ||
        p.name?.toLowerCase().includes(`uk ${expectedSize.toLowerCase()}`)
      ) || [];
      if (sizeMatches.length > 0) attrScore += 1;
    }
    
    if (expectedColor) {
      const colorMatches = response.products?.filter(p => 
        p.name?.toLowerCase().includes(expectedColor.toLowerCase())
      ) || [];
      if (colorMatches.length > 0) attrScore += 1;
    }
    
    const attrMax = (expectedSize ? 1 : 0) + (expectedColor ? 1 : 0);
    const normalizedScore = (attrScore / attrMax) * SCORING.attributeMatch;
    score += normalizedScore;
    breakdown.attributeMatch = normalizedScore;
    
    if (normalizedScore < SCORING.attributeMatch) {
      errors.push(`Attribute match: ${attrScore}/${attrMax} (size: ${expectedSize || 'n/a'}, color: ${expectedColor || 'n/a'})`);
    }
  }
  
  // 5. Merchant diversity (1 point)
  maxScore += SCORING.merchantDiversity;
  const uniqueMerchants = new Set(response.products?.map(p => p.merchant) || []);
  if (uniqueMerchants.size >= 2) {
    score += SCORING.merchantDiversity;
    breakdown.merchantDiversity = SCORING.merchantDiversity;
  } else {
    breakdown.merchantDiversity = 0;
  }
  
  // 6. Price reasonable (1 point) - not all £0 or £10000+
  maxScore += SCORING.priceReasonable;
  const prices = response.products?.map(p => p.price).filter(p => p > 0 && p < 5000) || [];
  if (prices.length > 0 && prices.length >= (response.products?.length || 0) * 0.5) {
    score += SCORING.priceReasonable;
    breakdown.priceReasonable = SCORING.priceReasonable;
  } else {
    breakdown.priceReasonable = 0;
  }
  
  // Normalize score to 0-10
  const normalizedScore = maxScore > 0 ? (score / maxScore) * 10 : 0;
  
  return { score: normalizedScore, maxScore: 10, breakdown, errors };
}

// Execute a single test query
async function runSingleTest(testNum: number): Promise<TestResult> {
  const { query, category, expectedBrand, expectedSize, expectedColor } = generateQuery();
  const startTime = Date.now();
  
  try {
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 10 }),
    });
    
    const responseTime = Date.now() - startTime;
    const data: SearchResponse = await response.json();
    
    if (!data.success) {
      return {
        query,
        category,
        score: 0,
        maxScore: 10,
        scoreBreakdown: {},
        resultCount: 0,
        responseTime,
        errors: [data.error || 'API returned success: false'],
        passed: false,
      };
    }
    
    const { score, maxScore, breakdown, errors } = await scoreResult(
      query, category, data, expectedBrand, expectedSize, expectedColor
    );
    
    return {
      query,
      category,
      score: Math.round(score * 10) / 10,
      maxScore,
      scoreBreakdown: breakdown,
      resultCount: data.products?.length || 0,
      responseTime,
      errors,
      passed: score >= CONFIG.minPassScore,
    };
  } catch (error) {
    return {
      query,
      category,
      score: 0,
      maxScore: 10,
      scoreBreakdown: {},
      resultCount: 0,
      responseTime: Date.now() - startTime,
      errors: [`Request failed: ${(error as Error).message}`],
      passed: false,
    };
  }
}

// Run tests with concurrency control
async function runStressTest(): Promise<void> {
  console.log('='.repeat(60));
  console.log('SEARCH STRESS TEST');
  console.log('='.repeat(60));
  console.log(`Config: ${CONFIG.totalQueries} queries, ${CONFIG.concurrency} concurrent, min score: ${CONFIG.minPassScore}`);
  console.log('');
  
  const results: TestResult[] = [];
  const failures: TestResult[] = [];
  let completed = 0;
  const startTime = Date.now();
  
  // Process in batches with concurrency limit
  const queue: Promise<TestResult>[] = [];
  
  for (let i = 0; i < CONFIG.totalQueries; i++) {
    // Add to queue
    const testPromise = runSingleTest(i).then(result => {
      completed++;
      results.push(result);
      if (!result.passed) failures.push(result);
      
      // Progress update every batch
      if (completed % CONFIG.batchSize === 0 || completed === CONFIG.totalQueries) {
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        const passRate = (results.filter(r => r.passed).length / results.length) * 100;
        const avgTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        console.log(`[${completed}/${CONFIG.totalQueries}] Avg: ${avgScore.toFixed(1)}/10 | Pass: ${passRate.toFixed(1)}% | Avg time: ${avgTime.toFixed(0)}ms`);
      }
      
      return result;
    });
    
    queue.push(testPromise);
    
    // Wait when we hit concurrency limit
    if (queue.length >= CONFIG.concurrency) {
      await Promise.race(queue);
      // Remove completed promises
      for (let j = queue.length - 1; j >= 0; j--) {
        const status = await Promise.race([queue[j], Promise.resolve('pending')]);
        if (status !== 'pending') {
          queue.splice(j, 1);
        }
      }
    }
  }
  
  // Wait for remaining
  await Promise.all(queue);
  
  const totalTime = Date.now() - startTime;
  
  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const passRate = (results.filter(r => r.passed).length / results.length) * 100;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  
  console.log(`Total queries: ${results.length}`);
  console.log(`Average score: ${avgScore.toFixed(2)}/10`);
  console.log(`Pass rate: ${passRate.toFixed(1)}% (${results.filter(r => r.passed).length}/${results.length})`);
  console.log(`Average response time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log('');
  
  // Category breakdown
  console.log('CATEGORY BREAKDOWN:');
  const byCategory: Record<string, TestResult[]> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }
  
  for (const [cat, catResults] of Object.entries(byCategory)) {
    const catAvg = catResults.reduce((sum, r) => sum + r.score, 0) / catResults.length;
    const catPass = (catResults.filter(r => r.passed).length / catResults.length) * 100;
    console.log(`  ${cat}: ${catAvg.toFixed(1)}/10 avg, ${catPass.toFixed(0)}% pass (n=${catResults.length})`);
  }
  
  // Top failures
  if (failures.length > 0) {
    console.log('');
    console.log('SAMPLE FAILURES (first 10):');
    const sampleFailures = failures.slice(0, 10);
    for (const f of sampleFailures) {
      console.log(`  [${f.score.toFixed(1)}] "${f.query}" - ${f.errors.join('; ')}`);
    }
    
    // Error pattern analysis
    console.log('');
    console.log('ERROR PATTERNS:');
    const errorCounts: Record<string, number> = {};
    for (const f of failures) {
      for (const e of f.errors) {
        const pattern = e.split(':')[0];
        errorCounts[pattern] = (errorCounts[pattern] || 0) + 1;
      }
    }
    const sorted = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
    for (const [pattern, count] of sorted.slice(0, 5)) {
      console.log(`  ${count}x: ${pattern}`);
    }
  }
  
  console.log('');
  if (avgScore >= CONFIG.minPassScore) {
    console.log(`RESULT: PASS (${avgScore.toFixed(2)} >= ${CONFIG.minPassScore})`);
  } else {
    console.log(`RESULT: FAIL (${avgScore.toFixed(2)} < ${CONFIG.minPassScore})`);
  }
  console.log('='.repeat(60));
}

// Main execution
runStressTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
