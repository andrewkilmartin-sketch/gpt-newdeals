import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

interface QueryResult {
  query: string;
  index: number;
  status: 'PASS' | 'PARTIAL' | 'FAIL' | 'ERROR';
  score?: number;
  resultCount?: number;
  parsed?: {
    character: string | null;
    age: number | null;
    priceMax: number | null;
    productType: string | null;
  };
  metrics?: {
    characterPct: number | null;
    pricePct: number | null;
    characterMatches: number;
    priceMatches: number;
  };
  topResults?: Array<{
    name: string;
    brand: string;
    price: number;
    merchant: string;
  }>;
  error?: string;
  timeMs: number;
}

interface BulkAuditResults {
  summary: {
    total: number;
    pass: number;
    partial: number;
    fail: number;
    errors: number;
    passRate: string;
    totalTimeMs: number;
    avgTimePerQuery: number;
    buildVersion: string;
  };
  results: QueryResult[];
}

async function parseQuery(query: string): Promise<any> {
  const charKeywords = [
    'paw patrol', 'peppa pig', 'bluey', 'cocomelon', 'lego', 'barbie', 'pokemon',
    'minecraft', 'fortnite', 'roblox', 'disney', 'marvel', 'frozen', 'spiderman',
    'batman', 'superman', 'harry potter', 'star wars', 'sonic', 'mario', 'pikachu',
    'elsa', 'anna', 'moana', 'encanto', 'stitch', 'hulk', 'iron man', 'avengers',
    'thor', 'captain america', 'paw', 'peppa', 'nerf', 'playmobil', 'lol', 'hot wheels',
    'transformers', 'thomas', 'fireman sam', 'teletubbies', 'bing', 'hey duggee',
    'gruffalo', 'peter rabbit', 'paddington', 'winnie', 'toy story', 'woody', 'buzz',
    'monsters inc', 'finding nemo', 'cars', 'incredibles', 'minions', 'trolls', 'shrek',
    'gabby', 'blippi', 'ryan', 'baby shark', 'numberblocks', 'sylvanian'
  ];

  const q = query.toLowerCase();
  let character: string | null = null;

  for (const char of charKeywords) {
    if (q.includes(char)) {
      character = char;
      break;
    }
  }

  const ageMatch = q.match(/(\d+)\s*year\s*old/);
  const ageMin = ageMatch ? parseInt(ageMatch[1]) : null;

  const priceMatch = q.match(/under\s*£?(\d+)/i) || q.match(/below\s*£?(\d+)/i) || q.match(/less than\s*£?(\d+)/i);
  const priceMax = priceMatch ? parseInt(priceMatch[1]) : null;

  return { character, ageMin, priceMax, productType: null };
}

async function runSingleQuery(query: string, index: number, limit: number = 10): Promise<QueryResult> {
  const queryStart = Date.now();
  const TIMEOUT_MS = 300000; // 5 minute timeout per query
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    console.log(`[Query ${index}] Starting: "${query.substring(0, 40)}..."`);
    
    const response = await fetch(`${BASE_URL}/api/shop/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[Query ${index}] ERROR: HTTP ${response.status}`);
      return { 
        query, 
        index, 
        status: 'ERROR', 
        error: `HTTP ${response.status}`, 
        timeMs: Date.now() - queryStart 
      };
    }

    const data = await response.json();
    const products = data.products || [];
    const parsed = await parseQuery(query);

    let characterMatches = 0;
    let priceMatches = 0;

    for (const product of products) {
      const productText = `${product.name || ''} ${product.brand || ''}`.toLowerCase();

      if (parsed.character && productText.includes(parsed.character.toLowerCase())) {
        characterMatches++;
      }

      if (parsed.priceMax && product.price !== undefined && product.price <= parsed.priceMax) {
        priceMatches++;
      }
    }

    const characterPct = parsed.character ? (products.length > 0 ? (characterMatches / products.length) * 100 : 0) : null;
    const pricePct = parsed.priceMax ? (products.length > 0 ? (priceMatches / products.length) * 100 : 0) : null;

    let totalScore = 0;
    let maxScore = 0;

    if (characterPct !== null) {
      maxScore += 40;
      totalScore += (characterPct / 100) * 40;
    }
    if (pricePct !== null) {
      maxScore += 20;
      totalScore += (pricePct / 100) * 20;
    }

    const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 70;
    const verdict: 'PASS' | 'PARTIAL' | 'FAIL' = finalScore >= 70 ? 'PASS' : finalScore >= 40 ? 'PARTIAL' : 'FAIL';
    
    const timeMs = Date.now() - queryStart;
    console.log(`[Query ${index}] ${verdict} (${finalScore}%) - ${products.length} results in ${timeMs}ms`);

    return {
      query,
      index,
      status: verdict,
      score: finalScore,
      resultCount: products.length,
      parsed: {
        character: parsed.character,
        age: parsed.ageMin,
        priceMax: parsed.priceMax,
        productType: null
      },
      metrics: {
        characterPct,
        pricePct,
        characterMatches,
        priceMatches
      },
      topResults: products.slice(0, 3).map((p: any) => ({
        name: (p.name || '').substring(0, 60),
        brand: p.brand || '',
        price: p.price || 0,
        merchant: p.merchant || ''
      })),
      timeMs
    };
  } catch (e: any) {
    const timeMs = Date.now() - queryStart;
    const errorMsg = e.name === 'AbortError' ? `Timeout after ${timeMs}ms` : String(e);
    console.log(`[Query ${index}] ERROR: ${errorMsg}`);
    return { 
      query, 
      index, 
      status: 'ERROR', 
      error: errorMsg, 
      timeMs 
    };
  }
}

async function runBulkAudit(
  batchSize: number = 10,
  workers: number = 5,
  limit: number = 10,
  maxQueries: number = 1000
): Promise<void> {
  console.log(`\n========================================`);
  console.log(`BULK AUDIT - 1000 Query Test`);
  console.log(`========================================`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Workers: ${workers}`);
  console.log(`Results per query: ${limit}`);
  console.log(`Max queries: ${maxQueries}`);
  console.log(`========================================\n`);

  const queriesPath = path.join(process.cwd(), 'data', 'bulk_audit_queries.json');
  
  if (!fs.existsSync(queriesPath)) {
    console.error('ERROR: Queries file not found at', queriesPath);
    process.exit(1);
  }

  const queriesData = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
  const allQueries: string[] = queriesData.queries.slice(0, maxQueries);
  
  console.log(`Loaded ${allQueries.length} queries from ${queriesPath}\n`);

  const outputPath = path.join(process.cwd(), 'data', `bulk_audit_results_${Date.now()}.json`);
  const progressPath = path.join(process.cwd(), 'data', 'bulk_audit_progress.json');

  const results: QueryResult[] = [];
  let passCount = 0, partialCount = 0, failCount = 0, errorCount = 0;
  let processed = 0;
  const startTime = Date.now();

  const batches: string[][] = [];
  for (let i = 0; i < allQueries.length; i += batchSize) {
    batches.push(allQueries.slice(i, i + batchSize));
  }

  console.log(`Processing ${batches.length} batches with ${workers} parallel workers...\n`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx += workers) {
    const workerBatches = batches.slice(batchIdx, batchIdx + workers);

    const batchPromises = workerBatches.map((batch, workerIdx) => {
      const globalBatchIdx = batchIdx + workerIdx;
      return Promise.all(
        batch.map((query, queryIdx) => {
          const globalIdx = globalBatchIdx * batchSize + queryIdx;
          return runSingleQuery(query, globalIdx, limit);
        })
      );
    });

    const batchResults = await Promise.all(batchPromises);

    for (const workerResults of batchResults) {
      for (const result of workerResults) {
        results.push(result);
        processed++;

        if (result.status === 'PASS') passCount++;
        else if (result.status === 'PARTIAL') partialCount++;
        else if (result.status === 'FAIL') failCount++;
        else errorCount++;
      }
    }

    const progress = {
      processed,
      total: allQueries.length,
      percent: Math.round((processed / allQueries.length) * 100),
      pass: passCount,
      partial: partialCount,
      fail: failCount,
      errors: errorCount,
      elapsedMs: Date.now() - startTime,
      estimatedRemainingMs: processed > 0 ? Math.round(((Date.now() - startTime) / processed) * (allQueries.length - processed)) : 0
    };

    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
    
    // Save partial results every batch to preserve work on interruption
    const partialOutput = {
      summary: {
        total: processed,
        pass: passCount,
        partial: partialCount,
        fail: failCount,
        errors: errorCount,
        passRate: processed > errorCount ? Math.round((passCount / (processed - errorCount)) * 100) + '%' : '0%',
        totalTimeMs: Date.now() - startTime,
        avgTimePerQuery: Math.round((Date.now() - startTime) / processed),
        buildVersion: 'v5-stitchfix',
        status: 'in_progress'
      },
      results
    };
    fs.writeFileSync(outputPath, JSON.stringify(partialOutput, null, 2));

    if (processed % 50 === 0 || processed === allQueries.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const remaining = (progress.estimatedRemainingMs / 1000).toFixed(1);
      console.log(`Progress: ${processed}/${allQueries.length} (${progress.percent}%) | PASS: ${passCount} | PARTIAL: ${partialCount} | FAIL: ${failCount} | ERRORS: ${errorCount} | Elapsed: ${elapsed}s | Remaining: ~${remaining}s`);
    }
  }

  const totalTime = Date.now() - startTime;
  const passRate = Math.round((passCount / (results.length - errorCount)) * 100);

  const finalOutput: BulkAuditResults = {
    summary: {
      total: results.length,
      pass: passCount,
      partial: partialCount,
      fail: failCount,
      errors: errorCount,
      passRate: passRate + '%',
      totalTimeMs: totalTime,
      avgTimePerQuery: Math.round(totalTime / results.length),
      buildVersion: 'v5-stitchfix'
    },
    results
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));

  console.log(`\n========================================`);
  console.log(`BULK AUDIT COMPLETE`);
  console.log(`========================================`);
  console.log(`Total queries: ${results.length}`);
  console.log(`PASS: ${passCount} (${passRate}%)`);
  console.log(`PARTIAL: ${partialCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`ERRORS: ${errorCount}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`Avg time/query: ${Math.round(totalTime / results.length)}ms`);
  console.log(`Results saved to: ${outputPath}`);
  console.log(`========================================\n`);
}

const args = process.argv.slice(2);
const batchSize = parseInt(args[0] || '10');
const workers = parseInt(args[1] || '5');
const limit = parseInt(args[2] || '10');
const maxQueries = parseInt(args[3] || '1000');

runBulkAudit(batchSize, workers, limit, maxQueries).catch(console.error);
