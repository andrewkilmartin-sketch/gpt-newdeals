/**
 * Comprehensive API Test Harness
 * Tests all 6 endpoints with real GPT-style queries
 * Run with: npx tsx tests/api-test-harness.ts
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

interface TestCase {
  name: string;
  endpoint: string;
  params: Record<string, string>;
  expectations: {
    minResults?: number;
    maxResults?: number;
    hasField?: string;
    messageContains?: string;
  };
}

interface TestResult {
  name: string;
  endpoint: string;
  passed: boolean;
  error?: string;
  resultCount?: number;
  responseTime?: number;
}

// ============================================================
// SHOPPING ENDPOINT TESTS (/shopping/awin-link)
// ============================================================
const shoppingTests: TestCase[] = [
  // Synonym tests - these were breaking before
  {
    name: 'Shopping: sleepwear finds pyjamas (synonym)',
    endpoint: '/shopping/awin-link',
    params: { query: 'kids marvel sleepwear', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Shopping: nightwear finds pyjamas (synonym)',
    endpoint: '/shopping/awin-link',
    params: { query: 'nightwear', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Shopping: pyjamas direct search',
    endpoint: '/shopping/awin-link',
    params: { query: 'marvel pyjamas', limit: '5' },
    expectations: { minResults: 1 }
  },
  // Brand searches
  {
    name: 'Shopping: M&S brand search',
    endpoint: '/shopping/awin-link',
    params: { query: 'marks spencer', limit: '5' },
    expectations: { minResults: 1 }
  },
  // Product type searches
  {
    name: 'Shopping: trainers/sneakers (synonym)',
    endpoint: '/shopping/awin-link',
    params: { query: 'kids trainers', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Shopping: toys search',
    endpoint: '/shopping/awin-link',
    params: { query: 'lego toys', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Shopping: barbie dolls (synonym)',
    endpoint: '/shopping/awin-link',
    params: { query: 'barbie', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Shopping: disney products',
    endpoint: '/shopping/awin-link',
    params: { query: 'disney frozen', limit: '5' },
    expectations: { minResults: 1 }
  },
  // Edge cases
  {
    name: 'Shopping: respects limit parameter',
    endpoint: '/shopping/awin-link',
    params: { query: 'shoes', limit: '3' },
    expectations: { maxResults: 3 }
  },
  {
    name: 'Shopping: has message field for GPT',
    endpoint: '/shopping/awin-link',
    params: { query: 'marvel', limit: '3' },
    expectations: { hasField: 'message', minResults: 1 }
  },
  {
    name: 'Shopping: affiliate links are valid',
    endpoint: '/shopping/awin-link',
    params: { query: 'boots', limit: '3' },
    expectations: { minResults: 1 }
  },
];

// ============================================================
// CINEMA ENDPOINT TESTS (/cinema/search)
// ============================================================
const cinemaTests: TestCase[] = [
  {
    name: 'Cinema: general movie search',
    endpoint: '/cinema/search',
    params: { limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Cinema: genre filter - Action',
    endpoint: '/cinema/search',
    params: { genre: 'Action', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Cinema: genre filter - Comedy',
    endpoint: '/cinema/search',
    params: { genre: 'Comedy', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Cinema: genre filter - Animation',
    endpoint: '/cinema/search',
    params: { genre: 'Animation', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Cinema: now playing status',
    endpoint: '/cinema/search',
    params: { status: 'now_playing', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Cinema: upcoming status',
    endpoint: '/cinema/search',
    params: { status: 'upcoming', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Cinema: query search',
    endpoint: '/cinema/search',
    params: { query: 'disney', limit: '5' },
    expectations: { minResults: 0 }  // May or may not have Disney films
  },
  {
    name: 'Cinema: respects limit',
    endpoint: '/cinema/search',
    params: { limit: '3' },
    expectations: { maxResults: 3 }
  },
];

// ============================================================
// ATTRACTIONS ENDPOINT TESTS (/attractions/search)
// ============================================================
const attractionsTests: TestCase[] = [
  {
    name: 'Attractions: general search',
    endpoint: '/attractions/search',
    params: { limit: '10' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: Theme Parks category',
    endpoint: '/attractions/search',
    params: { category: 'Theme Parks', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: Zoo category',
    endpoint: '/attractions/search',
    params: { category: 'Zoo', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: Museum category',
    endpoint: '/attractions/search',
    params: { category: 'Museum', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: Safari Parks',
    endpoint: '/attractions/search',
    params: { query: 'safari', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: London location',
    endpoint: '/attractions/search',
    params: { location: 'London', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: Edinburgh location',
    endpoint: '/attractions/search',
    params: { location: 'Edinburgh', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: query - castle',
    endpoint: '/attractions/search',
    params: { query: 'castle', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: query - aquarium',
    endpoint: '/attractions/search',
    params: { query: 'aquarium', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Attractions: respects limit',
    endpoint: '/attractions/search',
    params: { limit: '3' },
    expectations: { maxResults: 3 }
  },
];

// ============================================================
// ACTIVITIES ENDPOINT TESTS (/activities/search)
// ============================================================
const activitiesTests: TestCase[] = [
  {
    name: 'Activities: general search',
    endpoint: '/activities/search',
    params: { limit: '10' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Activities: indoor setting',
    endpoint: '/activities/search',
    params: { setting: 'INDOOR', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Activities: outdoor setting',
    endpoint: '/activities/search',
    params: { setting: 'OUTDOOR', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Activities: car setting',
    endpoint: '/activities/search',
    params: { setting: 'CAR', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Activities: low energy',
    endpoint: '/activities/search',
    params: { energy: 'LOW', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Activities: high energy',
    endpoint: '/activities/search',
    params: { energy: 'HIGH', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Activities: age 5',
    endpoint: '/activities/search',
    params: { age: '5', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Activities: age 10',
    endpoint: '/activities/search',
    params: { age: '10', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'Activities: toddler indoor low energy combo',
    endpoint: '/activities/search',
    params: { age: '2', setting: 'INDOOR', energy: 'LOW', limit: '5' },
    expectations: { minResults: 0 }  // May be restrictive
  },
  {
    name: 'Activities: respects limit',
    endpoint: '/activities/search',
    params: { limit: '3' },
    expectations: { maxResults: 3 }
  },
];

// ============================================================
// NIGHTIN ENDPOINT TESTS (/nightin/search)
// ============================================================
const nightinTests: TestCase[] = [
  {
    name: 'NightIn: general search',
    endpoint: '/nightin/search',
    params: { limit: '10' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: Netflix service',
    endpoint: '/nightin/search',
    params: { service: 'Netflix', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: Prime Video service',
    endpoint: '/nightin/search',
    params: { service: 'Prime Video', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: Disney+ service',
    endpoint: '/nightin/search',
    params: { service: 'Disney+', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: Comedy genre',
    endpoint: '/nightin/search',
    params: { category: 'Comedy', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: Action genre',
    endpoint: '/nightin/search',
    params: { category: 'Action', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: Romantic mood',
    endpoint: '/nightin/search',
    params: { mood: 'Romantic', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: Fun mood',
    endpoint: '/nightin/search',
    params: { mood: 'Fun', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: Scary mood',
    endpoint: '/nightin/search',
    params: { mood: 'Scary', limit: '5' },
    expectations: { minResults: 1 }
  },
  {
    name: 'NightIn: query search - marvel',
    endpoint: '/nightin/search',
    params: { query: 'marvel', limit: '5' },
    expectations: { minResults: 0 }  // May or may not have Marvel
  },
  {
    name: 'NightIn: respects limit',
    endpoint: '/nightin/search',
    params: { limit: '3' },
    expectations: { maxResults: 3 }
  },
];

// ============================================================
// HINTS AND TIPS ENDPOINT TESTS (/hintsandtips/search)
// ============================================================
const hintsandtipsTests: TestCase[] = [
  {
    name: 'HintsAndTips: general search',
    endpoint: '/hintsandtips/search',
    params: { limit: '10' },
    expectations: { minResults: 1 }
  },
  {
    name: 'HintsAndTips: Shopping category',
    endpoint: '/hintsandtips/search',
    params: { category: 'Shopping', limit: '5' },
    expectations: { minResults: 0 }  // Category may not exist
  },
  {
    name: 'HintsAndTips: query search',
    endpoint: '/hintsandtips/search',
    params: { query: 'save money', limit: '5' },
    expectations: { minResults: 0 }  // Flexible
  },
  {
    name: 'HintsAndTips: respects limit',
    endpoint: '/hintsandtips/search',
    params: { limit: '3' },
    expectations: { maxResults: 3 }
  },
];

// ============================================================
// HEALTH CHECK TEST
// ============================================================
const healthTests: TestCase[] = [
  {
    name: 'Health: endpoint responds',
    endpoint: '/healthz',
    params: {},
    expectations: { hasField: 'status' }
  },
];

// ============================================================
// TEST RUNNER
// ============================================================

async function runTest(test: TestCase): Promise<TestResult> {
  const startTime = Date.now();
  const url = new URL(test.endpoint, BASE_URL);
  
  for (const [key, value] of Object.entries(test.params)) {
    url.searchParams.set(key, value);
  }
  
  try {
    const response = await fetch(url.toString());
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      return {
        name: test.name,
        endpoint: test.endpoint,
        passed: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime
      };
    }
    
    const data = await response.json();
    const resultCount = data.results?.length ?? data.count ?? 0;
    
    // Check expectations
    const errors: string[] = [];
    
    if (test.expectations.minResults !== undefined && resultCount < test.expectations.minResults) {
      errors.push(`Expected min ${test.expectations.minResults} results, got ${resultCount}`);
    }
    
    if (test.expectations.maxResults !== undefined && resultCount > test.expectations.maxResults) {
      errors.push(`Expected max ${test.expectations.maxResults} results, got ${resultCount}`);
    }
    
    if (test.expectations.hasField && !(test.expectations.hasField in data)) {
      errors.push(`Expected field '${test.expectations.hasField}' not found`);
    }
    
    if (test.expectations.messageContains && data.message) {
      if (!data.message.toLowerCase().includes(test.expectations.messageContains.toLowerCase())) {
        errors.push(`Message doesn't contain '${test.expectations.messageContains}'`);
      }
    }
    
    // Validate affiliate links for shopping
    if (test.endpoint === '/shopping/awin-link' && resultCount > 0) {
      const hasValidLinks = data.results.every((r: any) => 
        r.affiliateLink && r.affiliateLink.includes('awin')
      );
      if (!hasValidLinks) {
        errors.push('Some results have invalid affiliate links');
      }
    }
    
    return {
      name: test.name,
      endpoint: test.endpoint,
      passed: errors.length === 0,
      error: errors.join('; '),
      resultCount,
      responseTime
    };
    
  } catch (error) {
    return {
      name: test.name,
      endpoint: test.endpoint,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime
    };
  }
}

async function runAllTests(): Promise<void> {
  console.log('='.repeat(70));
  console.log('API TEST HARNESS - Comprehensive Production Readiness Check');
  console.log('='.repeat(70));
  console.log(`Testing against: ${BASE_URL}`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('');
  
  const allTests = [
    ...healthTests,
    ...shoppingTests,
    ...cinemaTests,
    ...attractionsTests,
    ...activitiesTests,
    ...nightinTests,
    ...hintsandtipsTests,
  ];
  
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;
  
  // Group tests by endpoint
  const testGroups = [
    { name: 'HEALTH CHECK', tests: healthTests },
    { name: 'SHOPPING (/shopping/awin-link)', tests: shoppingTests },
    { name: 'CINEMA (/cinema/search)', tests: cinemaTests },
    { name: 'ATTRACTIONS (/attractions/search)', tests: attractionsTests },
    { name: 'ACTIVITIES (/activities/search)', tests: activitiesTests },
    { name: 'NIGHTIN (/nightin/search)', tests: nightinTests },
    { name: 'HINTS & TIPS (/hintsandtips/search)', tests: hintsandtipsTests },
  ];
  
  for (const group of testGroups) {
    console.log('-'.repeat(70));
    console.log(group.name);
    console.log('-'.repeat(70));
    
    for (const test of group.tests) {
      const result = await runTest(test);
      results.push(result);
      
      if (result.passed) {
        passed++;
        console.log(`  [PASS] ${result.name} (${result.resultCount} results, ${result.responseTime}ms)`);
      } else {
        failed++;
        console.log(`  [FAIL] ${result.name}`);
        console.log(`         Error: ${result.error}`);
      }
    }
    console.log('');
  }
  
  // Summary
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total tests: ${allTests.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass rate: ${((passed / allTests.length) * 100).toFixed(1)}%`);
  console.log('');
  
  if (failed > 0) {
    console.log('FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    console.log('');
    console.log('STATUS: FAILED - Do not deploy to production');
    process.exit(1);
  } else {
    console.log('STATUS: PASSED - Ready for production deployment');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
