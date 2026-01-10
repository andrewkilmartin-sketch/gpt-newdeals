/**
 * PERFORMANCE GUARD TESTS
 * 
 * These tests enforce the fixes documented in CRITICAL_FIXES.md
 * They should NEVER be removed or modified without explicit approval.
 * 
 * Run with: npx tsx tests/performance-guards.test.ts
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  const start = Date.now();
  try {
    await testFn();
    return { name, passed: true, duration: Date.now() - start };
  } catch (error: any) {
    return { name, passed: false, duration: Date.now() - start, error: error.message };
  }
}

async function searchProducts(query: string, limit = 10): Promise<{ count: number; products: any[]; duration: number }> {
  const start = Date.now();
  const response = await fetch(`${BASE_URL}/api/shop/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit })
  });
  const data = await response.json();
  return { ...data, duration: Date.now() - start };
}

// ============================================================================
// PERFORMANCE TESTS - Enforce speed fixes from CRITICAL_FIXES.md
// ============================================================================

const performanceTests = [
  {
    name: 'Age query completes under 1 second (toys for 1 year old)',
    maxMs: 1000,
    query: 'toys for 1 year old',
    test: async function() {
      const result = await searchProducts(this.query);
      if (result.duration > this.maxMs) {
        throw new Error(`Query took ${result.duration}ms, expected <${this.maxMs}ms. Check ULTRA FAST PATH in routes.ts`);
      }
      if (result.count === 0) {
        throw new Error('Query returned 0 results. Check category filter logic.');
      }
    }
  },
  {
    name: 'Age query completes under 1 second (gifts for 7 year old boy)',
    maxMs: 1000,
    query: 'gifts for 7 year old boy',
    test: async function() {
      const result = await searchProducts(this.query);
      if (result.duration > this.maxMs) {
        throw new Error(`Query took ${result.duration}ms, expected <${this.maxMs}ms`);
      }
    }
  },
  {
    name: 'Brand query completes under 500ms (lego)',
    maxMs: 500,
    query: 'lego',
    test: async function() {
      const result = await searchProducts(this.query);
      if (result.duration > this.maxMs) {
        throw new Error(`Query took ${result.duration}ms, expected <${this.maxMs}ms. Check KNOWN_BRANDS_CACHE.`);
      }
      if (result.count === 0) {
        throw new Error('LEGO query returned 0 results. Check brand search logic.');
      }
    }
  }
];

// ============================================================================
// RELEVANCE TESTS - Enforce search quality fixes from CRITICAL_FIXES.md
// ============================================================================

const relevanceTests = [
  {
    name: 'No substring matching: "bike" should not return "biker"',
    query: 'bike for kids',
    test: async function() {
      const result = await searchProducts(this.query);
      const bikerProducts = result.products.filter((p: any) => 
        p.name?.toLowerCase().includes('biker') && !p.name?.toLowerCase().includes('bike ')
      );
      if (bikerProducts.length > 0) {
        throw new Error(`Found ${bikerProducts.length} "biker" products. Check word boundary regex in routes.ts. Products: ${bikerProducts.map((p: any) => p.name).join(', ')}`);
      }
    }
  },
  {
    name: 'Character search works: "hulk" returns products',
    query: 'hulk toys',
    test: async function() {
      const result = await searchProducts(this.query);
      if (result.count === 0) {
        throw new Error('Hulk query returned 0 results. Check brand+name OR logic.');
      }
    }
  },
  {
    name: 'Age queries return toys, not random products',
    query: 'toys for 3 year old',
    test: async function() {
      const result = await searchProducts(this.query);
      const nonToyKeywords = ['candle', 'makeup', 'cosmetic', 'wine', 'perfume', 'jewelry'];
      const badProducts = result.products.filter((p: any) => 
        nonToyKeywords.some(keyword => 
          p.name?.toLowerCase().includes(keyword) || 
          p.category?.toLowerCase().includes(keyword)
        )
      );
      if (badProducts.length > 0) {
        throw new Error(`Found ${badProducts.length} non-toy products. Check ULTRA FAST PATH category filter. Products: ${badProducts.map((p: any) => p.name).join(', ')}`);
      }
    }
  },
  {
    name: 'No blocked merchants in results',
    query: 'gifts for kids',
    test: async function() {
      const result = await searchProducts(this.query);
      const BLOCKED_MERCHANTS = ['Bottle Club', 'Naked Wines', 'Virgin Wines', 'Majestic Wine', 'Beer Hawk'];
      const blockedProducts = result.products.filter((p: any) => 
        BLOCKED_MERCHANTS.some(m => p.merchant?.toLowerCase().includes(m.toLowerCase()))
      );
      if (blockedProducts.length > 0) {
        throw new Error(`Found products from blocked merchants: ${blockedProducts.map((p: any) => p.merchant).join(', ')}`);
      }
    }
  },
  {
    name: 'Spiderman toys returns Marvel/Disney products, not pet toys',
    query: 'spiderman toys',
    test: async function() {
      const result = await searchProducts(this.query);
      if (result.count === 0) {
        throw new Error('Spiderman query returned 0 results. Check character variant injection.');
      }
      const petProducts = result.products.filter((p: any) => 
        p.name?.toLowerCase().includes('dog') || 
        p.name?.toLowerCase().includes('pet') ||
        p.category?.toLowerCase().includes('pet')
      );
      if (petProducts.length > result.products.length / 2) {
        throw new Error(`Too many pet products (${petProducts.length}/${result.products.length}). Check character searchTerms injection.`);
      }
    }
  },
  {
    name: 'Paw Patrol toys returns real franchise products',
    query: 'paw patrol toys',
    test: async function() {
      const result = await searchProducts(this.query);
      if (result.count < 3) {
        throw new Error(`Paw Patrol returned only ${result.count} results. Should have 3+ products.`);
      }
      const hasRealPawPatrol = result.products.some((p: any) => 
        p.name?.toLowerCase().includes('paw patrol')
      );
      if (!hasRealPawPatrol) {
        throw new Error('No real Paw Patrol products found. Check character detection.');
      }
    }
  },
  {
    name: 'Price filter works: toys under 10 returns products ≤£10',
    query: 'toys under 10',
    test: async function() {
      const result = await searchProducts(this.query);
      if (result.count === 0) {
        throw new Error('Price query returned 0 results.');
      }
      const overPriced = result.products.filter((p: any) => p.price > 10);
      if (overPriced.length > 0) {
        throw new Error(`Found ${overPriced.length} products over £10. Check price filter in fallback. Products: ${overPriced.map((p: any) => `${p.name}: £${p.price}`).join(', ')}`);
      }
    }
  },
  {
    name: 'Stocking fillers under 10 respects price limit',
    query: 'stocking fillers under 10',
    test: async function() {
      const result = await searchProducts(this.query);
      const overPriced = result.products.filter((p: any) => p.price > 10);
      if (overPriced.length > 0) {
        throw new Error(`Found ${overPriced.length} products over £10: ${overPriced.map((p: any) => `${p.name}: £${p.price}`).join(', ')}`);
      }
    }
  }
];

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function main() {
  console.log('\\n========================================');
  console.log('PERFORMANCE GUARD TESTS');
  console.log('Testing fixes documented in CRITICAL_FIXES.md');
  console.log('========================================\\n');

  const allTests = [...performanceTests, ...relevanceTests];
  const results: TestResult[] = [];

  for (const test of allTests) {
    process.stdout.write(`Testing: ${test.name}... `);
    const result = await runTest(test.name, test.test.bind(test));
    results.push(result);
    
    if (result.passed) {
      console.log(`PASS (${result.duration}ms)`);
    } else {
      console.log(`FAIL`);
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log('\\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log('\\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    console.log('\\nCheck CRITICAL_FIXES.md for fix details.');
    process.exit(1);
  } else {
    console.log('\\nAll performance guards passed!');
    process.exit(0);
  }
}

main().catch(console.error);
