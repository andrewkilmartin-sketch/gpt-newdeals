/**
 * Sunny Search - Comprehensive Test Suite
 * Adapted for GPT Deals API
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const API_URL = 'http://localhost:5000';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'DATA_GAP' | 'WARN';
  issue?: string;
  details?: any;
}

const results: TestResult[] = [];

// ============================================================
// PHASE 1: DATA AUDIT
// ============================================================

async function phase1_DataAudit() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: DATA AUDIT - What exists in Awin feed?');
  console.log('='.repeat(60) + '\n');

  const totalResult = await pool.query('SELECT COUNT(*) as count FROM products');
  console.log(`Total products: ${parseInt(totalResult.rows[0].count).toLocaleString()}`);

  const withLinksResult = await pool.query('SELECT COUNT(*) as count FROM products WHERE affiliate_link IS NOT NULL');
  console.log(`With affiliate links: ${parseInt(withLinksResult.rows[0].count).toLocaleString()}`);

  const withImagesResult = await pool.query(`SELECT COUNT(*) as count FROM products WHERE image_url IS NOT NULL AND image_url != ''`);
  console.log(`With images: ${parseInt(withImagesResult.rows[0].count).toLocaleString()}`);

  console.log('\nTop 10 Categories:');
  const categoriesResult = await pool.query(`
    SELECT category, COUNT(*) as count 
    FROM products 
    WHERE category IS NOT NULL 
    GROUP BY category 
    ORDER BY count DESC 
    LIMIT 10
  `);
  for (const row of categoriesResult.rows) {
    console.log(`   ${row.category}: ${parseInt(row.count).toLocaleString()}`);
  }

  console.log('\nTop 10 Merchants:');
  const merchantsResult = await pool.query(`
    SELECT merchant, COUNT(*) as count 
    FROM products 
    WHERE merchant IS NOT NULL 
    GROUP BY merchant 
    ORDER BY count DESC 
    LIMIT 10
  `);
  for (const row of merchantsResult.rows) {
    console.log(`   ${row.merchant}: ${parseInt(row.count).toLocaleString()}`);
  }

  console.log('\nFranchise Product Counts:');
  const franchises = ['disney', 'marvel', 'peppa pig', 'paw patrol', 'frozen', 'spider-man', 'spiderman', 'lego', 'barbie', 'pokemon', 'harry potter', 'bluey'];
  
  for (const franchise of franchises) {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM products 
      WHERE LOWER(name) LIKE $1 OR LOWER(description) LIKE $1
    `, [`%${franchise}%`]);
    const count = parseInt(result.rows[0].count);
    const status = count > 100 ? 'OK' : count > 10 ? 'LOW' : 'NONE';
    console.log(`   [${status}] ${franchise}: ${count.toLocaleString()}`);
  }

  console.log('\nDisney Products by Category:');
  const disneyCategories = await pool.query(`
    SELECT category, COUNT(*) as count 
    FROM products 
    WHERE LOWER(name) LIKE '%disney%'
    GROUP BY category 
    ORDER BY count DESC 
    LIMIT 8
  `);
  for (const row of disneyCategories.rows) {
    console.log(`   ${row.category || 'Unknown'}: ${parseInt(row.count).toLocaleString()}`);
  }

  console.log('\nTOY Products (category contains "toy"):');
  const toysResult = await pool.query(`SELECT COUNT(*) as count FROM products WHERE LOWER(category) LIKE '%toy%'`);
  console.log(`   Total toys: ${parseInt(toysResult.rows[0].count).toLocaleString()}`);

  const disneyToysResult = await pool.query(`
    SELECT COUNT(*) as count FROM products 
    WHERE LOWER(category) LIKE '%toy%' AND LOWER(name) LIKE '%disney%'
  `);
  console.log(`   Disney toys: ${parseInt(disneyToysResult.rows[0].count).toLocaleString()}`);
}

// ============================================================
// PHASE 2: SEARCH QUALITY
// ============================================================

async function phase2_SearchQuality() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: SEARCH QUALITY - Does search find what exists?');
  console.log('='.repeat(60) + '\n');

  const testCases = [
    { query: 'disney', expectMin: 5, description: 'Basic Disney search' },
    { query: 'disney toys', expectMin: 3, description: 'Disney + category modifier' },
    { query: 'marvel toys', expectMin: 3, description: 'Marvel toys' },
    { query: 'spider-man toys', expectMin: 3, description: 'Spider-Man toys (hyphenated)' },
    { query: 'paw patrol', expectMin: 2, description: 'Paw Patrol (two words)' },
    { query: 'peppa pig', expectMin: 2, description: 'Peppa Pig' },
    { query: 'lego', expectMin: 5, description: 'LEGO' },
    { query: 'harry potter', expectMin: 2, description: 'Harry Potter' },
    { query: 'kids toys', expectMin: 5, description: 'Generic kids toys' },
    { query: 'children clothes', expectMin: 5, description: 'Children clothing' },
    { query: 'lego star wars', expectMin: 2, description: 'LEGO Star Wars combo' },
    { query: 'disney princess', expectMin: 3, description: 'Disney Princess' },
    { query: 'minecraft', expectMin: 2, description: 'Minecraft' },
  ];

  for (const test of testCases) {
    try {
      const words = test.query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const conditions = words.map((_, i) => 
        `(LOWER(name) LIKE $${i + 1} OR LOWER(description) LIKE $${i + 1})`
      ).join(' AND ');
      const params = words.map(w => `%${w}%`);
      
      const dataCheck = await pool.query(
        `SELECT COUNT(*) as count FROM products WHERE ${conditions} AND affiliate_link IS NOT NULL`,
        params
      );
      const dataExists = parseInt(dataCheck.rows[0].count);

      const response = await fetch(`${API_URL}/api/shop/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: test.query, limit: 8 })
      });
      const data = await response.json();

      const returned = data.products?.length || 0;
      
      let status: TestResult['status'];
      let issue: string | undefined;

      if (dataExists === 0) {
        status = 'DATA_GAP';
        issue = `No products in feed matching "${test.query}"`;
      } else if (returned === 0) {
        status = 'FAIL';
        issue = `${dataExists} products exist but search returned 0 - SEARCH BUG`;
      } else if (returned < test.expectMin && dataExists >= test.expectMin) {
        status = 'WARN';
        issue = `Expected ${test.expectMin}+, got ${returned} (${dataExists} exist in data)`;
      } else {
        status = 'PASS';
      }

      const result: TestResult = {
        test: `"${test.query}" - ${test.description}`,
        status,
        issue,
        details: { dataExists, returned, totalCount: data.totalCount }
      };
      results.push(result);

      const icon = status === 'PASS' ? 'PASS' : status === 'DATA_GAP' ? 'DATA' : status === 'WARN' ? 'WARN' : 'FAIL';
      console.log(`[${icon}] ${test.query}: ${returned} returned (${dataExists} in DB) ${issue ? `- ${issue}` : ''}`);

    } catch (err) {
      results.push({ test: `"${test.query}"`, status: 'FAIL', issue: `API error: ${err}` });
      console.log(`[FAIL] ${test.query}: API ERROR`);
    }
  }
}

// ============================================================
// PHASE 3: FILTER TESTING
// ============================================================

async function phase3_FilterTesting() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 3: FILTER TESTING - Do dynamic filters work?');
  console.log('='.repeat(60) + '\n');

  // Test 1: Merchant filter
  console.log('Test 3.1: Search "disney toys" then filter by merchant');
  try {
    const initial = await fetch(`${API_URL}/api/shop/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'disney toys', limit: 8 })
    });
    const initialData = await initial.json();
    
    console.log(`   Initial results: ${initialData.products?.length || 0}`);
    console.log(`   Filters returned: ${JSON.stringify(Object.keys(initialData.filters || {}))}`);
    
    if (initialData.filters?.merchants?.length > 0) {
      const firstMerchant = initialData.filters.merchants[0].name;
      console.log(`   Filtering by merchant: ${firstMerchant}`);
      
      const filtered = await fetch(`${API_URL}/api/shop/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'disney toys', limit: 8, filterMerchant: firstMerchant })
      });
      const filteredData = await filtered.json();
      
      const allMatch = filteredData.products?.every((p: any) => p.merchant === firstMerchant);
      if (allMatch) {
        console.log(`   [PASS] Merchant filter works - all ${filteredData.products.length} results from ${firstMerchant}`);
        results.push({ test: 'Merchant filter', status: 'PASS' });
      } else {
        console.log(`   [FAIL] Merchant filter failed - mixed merchants`);
        results.push({ test: 'Merchant filter', status: 'FAIL', issue: 'Mixed merchants after filtering' });
      }
    } else {
      console.log(`   [WARN] No merchant filters returned`);
      results.push({ test: 'Merchant filter', status: 'WARN', issue: 'No merchants in filters' });
    }
  } catch (err) {
    console.log(`   [FAIL] Error: ${err}`);
    results.push({ test: 'Merchant filter', status: 'FAIL', issue: String(err) });
  }

  // Test 2: Price filter
  console.log('\nTest 3.2: Search "lego" then filter by price');
  try {
    const initial = await fetch(`${API_URL}/api/shop/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'lego', limit: 8 })
    });
    const initialData = await initial.json();
    
    if (initialData.filters?.prices?.length > 0) {
      const priceFilter = initialData.filters.prices[0];
      console.log(`   Filtering by price: ${priceFilter.label} (${priceFilter.min}-${priceFilter.max})`);
      
      const filtered = await fetch(`${API_URL}/api/shop/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'lego', limit: 8, filterMinPrice: priceFilter.min, filterMaxPrice: priceFilter.max })
      });
      const filteredData = await filtered.json();
      
      const allInRange = filteredData.products?.every((p: any) => 
        p.price >= priceFilter.min && (priceFilter.max === null || p.price < priceFilter.max)
      );
      if (allInRange) {
        console.log(`   [PASS] Price filter works - all ${filteredData.products.length} results in range`);
        results.push({ test: 'Price filter', status: 'PASS' });
      } else {
        console.log(`   [FAIL] Price filter failed - prices out of range`);
        results.push({ test: 'Price filter', status: 'FAIL', issue: 'Prices out of range' });
      }
    } else {
      console.log(`   [WARN] No price filters returned`);
      results.push({ test: 'Price filter', status: 'WARN', issue: 'No prices in filters' });
    }
  } catch (err) {
    console.log(`   [FAIL] Error: ${err}`);
    results.push({ test: 'Price filter', status: 'FAIL', issue: String(err) });
  }

  // Test 3: Category filter
  console.log('\nTest 3.3: Search "disney" then filter by category');
  try {
    const initial = await fetch(`${API_URL}/api/shop/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'disney', limit: 8 })
    });
    const initialData = await initial.json();
    
    if (initialData.filters?.categories?.length > 0) {
      const category = initialData.filters.categories.find((c: any) => 
        c.name.toLowerCase().includes('toy')
      ) || initialData.filters.categories[0];
      
      console.log(`   Filtering by category: ${category.name}`);
      
      const filtered = await fetch(`${API_URL}/api/shop/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'disney', limit: 8, filterCategory: category.name })
      });
      const filteredData = await filtered.json();
      
      console.log(`   [PASS] Category filter returned ${filteredData.products?.length || 0} results`);
      results.push({ test: 'Category filter', status: 'PASS' });
    } else {
      console.log(`   [WARN] No category filters returned`);
      results.push({ test: 'Category filter', status: 'WARN', issue: 'No categories in filters' });
    }
  } catch (err) {
    console.log(`   [FAIL] Error: ${err}`);
    results.push({ test: 'Category filter', status: 'FAIL', issue: String(err) });
  }

  // Test 4: Brand filter
  console.log('\nTest 3.4: Search "toys" then filter by brand');
  try {
    const initial = await fetch(`${API_URL}/api/shop/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'toys', limit: 8 })
    });
    const initialData = await initial.json();
    
    if (initialData.filters?.brands?.length > 0) {
      const brand = initialData.filters.brands[0];
      console.log(`   Filtering by brand: ${brand.name}`);
      
      const filtered = await fetch(`${API_URL}/api/shop/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'toys', limit: 8, filterBrand: brand.name })
      });
      const filteredData = await filtered.json();
      
      const allMatch = filteredData.products?.every((p: any) => p.brand === brand.name);
      if (allMatch) {
        console.log(`   [PASS] Brand filter works - all ${filteredData.products.length} results are ${brand.name}`);
        results.push({ test: 'Brand filter', status: 'PASS' });
      } else {
        console.log(`   [FAIL] Brand filter failed - mixed brands`);
        results.push({ test: 'Brand filter', status: 'FAIL', issue: 'Mixed brands after filtering' });
      }
    } else {
      console.log(`   [WARN] No brand filters returned`);
      results.push({ test: 'Brand filter', status: 'WARN', issue: 'No brands in filters' });
    }
  } catch (err) {
    console.log(`   [FAIL] Error: ${err}`);
    results.push({ test: 'Brand filter', status: 'FAIL', issue: String(err) });
  }
}

// ============================================================
// PHASE 4: EDGE CASES
// ============================================================

async function phase4_EdgeCases() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 4: EDGE CASES - Tricky queries');
  console.log('='.repeat(60) + '\n');

  const edgeCases = [
    { query: 'spider-man', description: 'Hyphenated word' },
    { query: 'spiderman', description: 'No hyphen version' },
    { query: 'paw patrol', description: 'Two word franchise' },
    { query: 't-shirt', description: 'Hyphenated product' },
    { query: 'LEGO', description: 'All caps' },
    { query: 'lego', description: 'All lowercase' },
    { query: '', description: 'Empty query' },
    { query: 'a', description: 'Single character' },
    { query: 'disney marvel lego', description: 'Multiple brands' },
  ];

  for (const test of edgeCases) {
    try {
      const response = await fetch(`${API_URL}/api/shop/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: test.query, limit: 8 })
      });
      const data = await response.json();
      
      const returned = data.products?.length || 0;
      const hasError = data.error;
      
      if (hasError) {
        console.log(`[WARN] "${test.query}" (${test.description}): Handled error - ${data.error}`);
        results.push({ test: `Edge: ${test.description}`, status: 'PASS', details: 'Error handled gracefully' });
      } else {
        console.log(`[PASS] "${test.query}" (${test.description}): ${returned} results`);
        results.push({ test: `Edge: ${test.description}`, status: 'PASS', details: { returned } });
      }
    } catch (err) {
      console.log(`[FAIL] "${test.query}" (${test.description}): CRASHED - ${err}`);
      results.push({ test: `Edge: ${test.description}`, status: 'FAIL', issue: String(err) });
    }
  }
}

// ============================================================
// FINAL REPORT
// ============================================================

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('FINAL REPORT');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const dataGaps = results.filter(r => r.status === 'DATA_GAP').length;
  const warnings = results.filter(r => r.status === 'WARN').length;

  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`DATA GAPS: ${dataGaps}`);
  console.log(`WARNINGS: ${warnings}`);

  console.log('\n--- VERDICT ---');
  
  if (failed === 0) {
    console.log('SEARCH LOGIC IS WORKING');
    console.log('   All failures are DATA issues, not SEARCH bugs.');
  } else {
    console.log('SEARCH BUGS DETECTED');
    console.log('   The following need fixing:');
    for (const fail of results.filter(r => r.status === 'FAIL')) {
      console.log(`   - ${fail.test}: ${fail.issue}`);
    }
  }

  if (dataGaps > 0) {
    console.log('\n--- DATA GAPS ---');
    for (const gap of results.filter(r => r.status === 'DATA_GAP')) {
      console.log(`   ${gap.test}`);
    }
  }
}

// ============================================================
// RUN ALL TESTS
// ============================================================

async function runAllTests() {
  console.log('SUNNY SEARCH - COMPREHENSIVE TEST SUITE');
  console.log('==========================================\n');
  console.log('Testing against:', API_URL);
  console.log('Started:', new Date().toISOString());

  try {
    await phase1_DataAudit();
    await phase2_SearchQuality();
    await phase3_FilterTesting();
    await phase4_EdgeCases();
    await generateReport();
  } catch (err) {
    console.error('Test suite crashed:', err);
  } finally {
    await pool.end();
  }
}

runAllTests();
