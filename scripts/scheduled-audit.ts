import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_URL || 'http://localhost:5000';

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
const RESULTS_DIR = path.join(process.cwd(), 'data', 'audit-history');
const ALERT_LOG = path.join(process.cwd(), 'data', 'audit-alerts.log');
const PASS_RATE_THRESHOLD = 90;

const PRIORITY_QUERIES = [
  { query: 'peppa pig', category: 'core' },
  { query: 'paw patrol toys', category: 'core' },
  { query: 'lego star wars', category: 'core' },
  { query: 'barbie dolls', category: 'core' },
  { query: 'hot wheels cars', category: 'core' },
  { query: 'pokemon cards', category: 'core' },
  { query: 'nerf gun', category: 'core' },
  { query: 'bluey toys', category: 'core' },
  { query: 'spider man toys', category: 'core' },
  { query: 'dinosaur toys', category: 'core' },
  { query: 'lego', category: 'brand' },
  { query: 'barbie', category: 'brand' },
  { query: 'hot wheels', category: 'brand' },
  { query: 'playmobil', category: 'brand' },
  { query: 'fisher price', category: 'brand' },
  { query: 'nerf', category: 'brand' },
  { query: 'vtech', category: 'brand' },
  { query: 'melissa and doug', category: 'brand' },
  { query: 'sylvanian families', category: 'brand' },
  { query: 'duplo', category: 'brand' },
  { query: 'playdough', category: 'brand' },
  { query: 'transformers', category: 'brand' },
  { query: 'my little pony', category: 'brand' },
  { query: 'hello kitty', category: 'brand' },
  { query: 'furby', category: 'brand' },
  { query: 'tamagotchi', category: 'brand' },
  { query: 'leapfrog', category: 'brand' },
  { query: 'little tikes', category: 'brand' },
  { query: 'hatchimals', category: 'brand' },
  { query: 'squishmallows', category: 'brand' },
  { query: 'frozen', category: 'character' },
  { query: 'moana', category: 'character' },
  { query: 'elsa', category: 'character' },
  { query: 'hulk', category: 'character' },
  { query: 'batman', category: 'character' },
  { query: 'mario', category: 'character' },
  { query: 'sonic', category: 'character' },
  { query: 'minions', category: 'character' },
  { query: 'mickey mouse', category: 'character' },
  { query: 'encanto', category: 'character' },
  { query: 'toys for 3 year old', category: 'age' },
  { query: 'toys for 5 year old', category: 'age' },
  { query: 'baby toys 6 months', category: 'age' },
  { query: 'toddler toys', category: 'age' },
  { query: 'toys for 8 year old boy', category: 'age' },
  { query: 'toys for 10 year old girl', category: 'age' },
  { query: 'toys for 2 year old', category: 'age' },
  { query: 'toys for 7 year old', category: 'age' },
  { query: 'newborn toys', category: 'age' },
  { query: 'teenage gifts', category: 'age' },
  { query: 'toys under 10 pounds', category: 'price' },
  { query: 'gifts under 20 pounds', category: 'price' },
  { query: 'toys under 5 pounds', category: 'price' },
  { query: 'cheap toys', category: 'price' },
  { query: 'budget friendly toys', category: 'price' },
  { query: 'toys under 50', category: 'price' },
  { query: 'affordable gifts', category: 'price' },
  { query: 'toys under 15 pounds', category: 'price' },
  { query: 'gifts under 30 pounds', category: 'price' },
  { query: 'toys under 25', category: 'price' },
  { query: 'board games', category: 'product_type' },
  { query: 'puzzle', category: 'product_type' },
  { query: 'action figures', category: 'product_type' },
  { query: 'stuffed animals', category: 'product_type' },
  { query: 'building blocks', category: 'product_type' },
  { query: 'dolls', category: 'product_type' },
  { query: 'rc cars', category: 'product_type' },
  { query: 'educational toys', category: 'product_type' },
  { query: 'outdoor toys', category: 'product_type' },
  { query: 'craft kits', category: 'product_type' },
  { query: 'play kitchen', category: 'product_type' },
  { query: 'train set', category: 'product_type' },
  { query: 'doll house', category: 'product_type' },
  { query: 'water toys', category: 'product_type' },
  { query: 'science toys', category: 'product_type' },
  { query: 'musical toys', category: 'product_type' },
  { query: 'pretend play', category: 'product_type' },
  { query: 'ride on toys', category: 'product_type' },
  { query: 'bath toys', category: 'product_type' },
  { query: 'sensory toys', category: 'product_type' },
  { query: 'book', category: 'word_boundary' },
  { query: 'kinetic sand', category: 'edge_case' },
  { query: 'fidget toys', category: 'edge_case' },
  { query: 'stem toys', category: 'edge_case' },
  { query: 'science kit', category: 'edge_case' },
  { query: 'badminton set', category: 'edge_case' },
  { query: 'water gun', category: 'edge_case' },
  { query: 'witch costume', category: 'edge_case' },
  { query: 'super soaker', category: 'edge_case' },
  { query: 'christmas toys', category: 'seasonal' },
];

interface AuditResult {
  query: string;
  category: string;
  resultCount: number;
  passed: boolean;
  responseTimeMs: number;
  failureReason?: string;
}

async function searchProducts(query: string): Promise<{ count: number; timeMs: number }> {
  const start = Date.now();
  try {
    const response = await fetchWithTimeout(`${API_BASE}/api/shop/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 10 }),
    }, 15000);
    const data = await response.json() as { count?: number };
    return { count: data.count || 0, timeMs: Date.now() - start };
  } catch (error) {
    return { count: -1, timeMs: Date.now() - start };
  }
}

function getFailureReason(count: number, timeMs: number): string | undefined {
  if (count === -1) return 'API_ERROR';
  if (count === 0) return 'ZERO_RESULTS';
  if (count < 3) return 'LOW_RESULTS';
  if (timeMs > 10000) return 'SLOW_RESPONSE';
  return undefined;
}

async function runAudit(): Promise<{
  results: AuditResult[];
  passRate: number;
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  const results: AuditResult[] = [];
  let passed = 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SCHEDULED AUDIT - ${timestamp}`);
  console.log(`${'='.repeat(60)}`);

  for (let i = 0; i < PRIORITY_QUERIES.length; i++) {
    const { query, category } = PRIORITY_QUERIES[i];
    const { count, timeMs } = await searchProducts(query);
    const failureReason = getFailureReason(count, timeMs);
    const queryPassed = !failureReason;

    results.push({
      query,
      category,
      resultCount: count,
      passed: queryPassed,
      responseTimeMs: timeMs,
      failureReason,
    });

    if (queryPassed) passed++;
    process.stdout.write(queryPassed ? '.' : 'X');
    
    if ((i + 1) % 50 === 0) {
      process.stdout.write(` [${i + 1}/${PRIORITY_QUERIES.length}]\n`);
    }
  }

  console.log('\n');
  const passRate = (passed / PRIORITY_QUERIES.length) * 100;
  
  return { results, passRate, timestamp };
}

function saveResults(results: AuditResult[], passRate: number, timestamp: string): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const filename = `audit-${timestamp.replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(RESULTS_DIR, filename);
  
  const data = {
    timestamp,
    passRate: passRate.toFixed(1),
    totalQueries: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
    failedQueries: results.filter(r => !r.passed).map(r => ({
      query: r.query,
      category: r.category,
      reason: r.failureReason,
      resultCount: r.resultCount,
    })),
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Results saved to: ${filepath}`);
  
  const latestPath = path.join(RESULTS_DIR, 'audit-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
}

function checkAndAlert(passRate: number, timestamp: string, results: AuditResult[]): void {
  if (passRate < PASS_RATE_THRESHOLD) {
    const alertMessage = `
${'!'.repeat(60)}
AUDIT ALERT: Pass rate ${passRate.toFixed(1)}% below threshold ${PASS_RATE_THRESHOLD}%
Time: ${timestamp}
${'!'.repeat(60)}

Failed queries:
${results.filter(r => !r.passed).map(r => `  - "${r.query}" (${r.failureReason})`).join('\n')}

Action required: Review and fix failing queries.
`;

    console.error(alertMessage);
    
    if (!fs.existsSync(path.dirname(ALERT_LOG))) {
      fs.mkdirSync(path.dirname(ALERT_LOG), { recursive: true });
    }
    
    fs.appendFileSync(ALERT_LOG, `${alertMessage}\n---\n`);
    console.log(`Alert logged to: ${ALERT_LOG}`);
  }
}

function printSummary(results: AuditResult[], passRate: number): void {
  console.log('='.repeat(60));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Pass Rate: ${passRate.toFixed(1)}%`);
  
  if (passRate >= PASS_RATE_THRESHOLD) {
    console.log(`\n✓ PASS: Above ${PASS_RATE_THRESHOLD}% threshold`);
  } else {
    console.log(`\n✗ FAIL: Below ${PASS_RATE_THRESHOLD}% threshold - ALERT TRIGGERED`);
  }
  
  const byCategory: Record<string, { passed: number; total: number }> = {};
  for (const result of results) {
    if (!byCategory[result.category]) {
      byCategory[result.category] = { passed: 0, total: 0 };
    }
    byCategory[result.category].total++;
    if (result.passed) byCategory[result.category].passed++;
  }
  
  console.log('\nBY CATEGORY:');
  for (const [cat, stats] of Object.entries(byCategory).sort()) {
    const pct = ((stats.passed / stats.total) * 100).toFixed(0);
    const symbol = stats.passed === stats.total ? '✓' : '✗';
    console.log(`  ${symbol} ${cat}: ${stats.passed}/${stats.total} (${pct}%)`);
  }
  
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('\nFAILED QUERIES:');
    for (const f of failures) {
      console.log(`  [${f.failureReason}] "${f.query}" → ${f.resultCount} results`);
    }
  }
  
  const avgTime = results.reduce((sum, r) => sum + r.responseTimeMs, 0) / results.length;
  console.log(`\nAvg Response Time: ${avgTime.toFixed(0)}ms`);
}

async function main() {
  try {
    const { results, passRate, timestamp } = await runAudit();
    printSummary(results, passRate);
    saveResults(results, passRate, timestamp);
    checkAndAlert(passRate, timestamp, results);
    
    process.exit(passRate >= PASS_RATE_THRESHOLD ? 0 : 1);
  } catch (error) {
    console.error('Audit failed:', error);
    process.exit(1);
  }
}

main();
