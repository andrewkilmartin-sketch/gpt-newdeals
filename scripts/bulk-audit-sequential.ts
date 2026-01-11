import fs from 'fs';
import path from 'path';

const QUERIES_FILE = path.join(process.cwd(), 'data', 'test-queries-2000.json');
const RESULTS_FILE = path.join(process.cwd(), 'data', 'bulk-audit-results-final.json');
const PROGRESS_FILE = path.join(process.cwd(), 'data', 'audit-progress.json');

const DELAY_MS = 100;
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

interface AuditResult {
  query: string;
  passed: boolean;
  verdict: string;
  resultCount: number;
  topProducts: string[];
  elapsed: number;
}

interface Progress {
  processed: number;
  results: AuditResult[];
  lastUpdated: string;
}

const CHAR_BRANDS = [
  'paw patrol', 'peppa pig', 'frozen', 'disney', 'marvel', 'pokemon', 
  'lego', 'bluey', 'cocomelon', 'barbie', 'hot wheels', 'nerf',
  'spiderman', 'spider-man', 'batman', 'avengers', 'mario', 'sonic',
  'minecraft', 'roblox', 'fortnite', 'harry potter', 'star wars'
];

async function auditQuery(query: string): Promise<AuditResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const start = Date.now();
      const res = await fetch('http://localhost:5000/api/shop/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 8 }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const elapsed = Date.now() - start;
      
      if (!res.ok) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        return { query, passed: false, verdict: 'API_ERROR', resultCount: 0, topProducts: [], elapsed };
      }
      
      const data = await res.json();
      const products = data.products || [];
      const count = products.length;
      const topProducts = products.slice(0, 3).map((p: any) => p.name || 'Unknown');
      
      let verdict = 'PASS';
      let passed = true;
      
      if (elapsed > 5000) { 
        verdict = 'TIMEOUT'; 
        passed = false; 
      } else if (count === 0) { 
        verdict = 'ZERO_RESULTS'; 
        passed = false; 
      } else if (count < 3) { 
        verdict = 'LOW_RESULTS'; 
        passed = false; 
      } else {
        const queryLower = query.toLowerCase();
        const brandMatch = CHAR_BRANDS.find(b => queryLower.includes(b));
        if (brandMatch) {
          const hasCorrectBrand = products.some((p: any) => {
            const name = (p.name || '').toLowerCase();
            const brand = (p.brand || '').toLowerCase();
            return name.includes(brandMatch) || brand.includes(brandMatch);
          });
          if (!hasCorrectBrand) { 
            verdict = 'WRONG_BRAND'; 
            passed = false; 
          }
        }
      }
      
      return { query, passed, verdict, resultCount: count, topProducts, elapsed };
      
    } catch (e: any) {
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      return { query, passed: false, verdict: 'ERROR', resultCount: 0, topProducts: [], elapsed: 0 };
    }
  }
  return { query, passed: false, verdict: 'ERROR', resultCount: 0, topProducts: [], elapsed: 0 };
}

function loadProgress(): Progress {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { processed: 0, results: [], lastUpdated: new Date().toISOString() };
}

function saveProgress(progress: Progress) {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function main() {
  console.log('=== Sequential Bulk Audit ===');
  
  const queries: string[] = JSON.parse(fs.readFileSync(QUERIES_FILE, 'utf8'));
  console.log('Total queries:', queries.length);
  
  let progress = loadProgress();
  console.log('Resuming from query:', progress.processed);
  
  const startTime = Date.now();
  
  for (let i = progress.processed; i < queries.length; i++) {
    const query = queries[i];
    const result = await auditQuery(query);
    progress.results.push(result);
    progress.processed = i + 1;
    
    if ((i + 1) % 50 === 0) {
      const passCount = progress.results.filter(r => r.passed).length;
      const passRate = (passCount / progress.results.length * 100).toFixed(1);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[${i + 1}/${queries.length}] Pass: ${passCount} (${passRate}%) | Time: ${elapsed}s`);
      saveProgress(progress);
    }
    
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  saveProgress(progress);
  
  const passed = progress.results.filter(r => r.passed);
  const failed = progress.results.filter(r => !r.passed);
  
  const patterns: Record<string, { count: number; examples: string[] }> = {};
  failed.forEach(f => {
    if (!patterns[f.verdict]) patterns[f.verdict] = { count: 0, examples: [] };
    patterns[f.verdict].count++;
    if (patterns[f.verdict].examples.length < 10) {
      patterns[f.verdict].examples.push(f.query);
    }
  });
  
  const finalResults = {
    timestamp: new Date().toISOString(),
    totalQueries: queries.length,
    passed: passed.length,
    failed: failed.length,
    passRate: Math.round(passed.length / queries.length * 100),
    failurePatterns: Object.entries(patterns)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([pattern, data]) => ({ pattern, ...data })),
    passingQueries: passed.map(p => p.query),
    failingQueries: failed.slice(0, 50).map(f => ({
      query: f.query,
      verdict: f.verdict,
      resultCount: f.resultCount,
      topProduct: f.topProducts[0] || null
    })),
    allResults: progress.results
  };
  
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(finalResults, null, 2));
  
  console.log('\n=== FINAL RESULTS ===');
  console.log('Pass Rate:', finalResults.passRate + '%');
  console.log('Passed:', passed.length, '| Failed:', failed.length);
  console.log('\nFailure Patterns:');
  finalResults.failurePatterns.forEach(p => {
    console.log(`  ${p.pattern}: ${p.count}`);
  });
  
  console.log('\nResults saved to:', RESULTS_FILE);
}

main().catch(console.error);
