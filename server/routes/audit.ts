import type { Express } from "express";
import * as fs from "fs";
import * as path from "path";
import { parseQuery, BRAND_CHARACTERS } from "../services/queryParser";
import { db } from "../db";
import { verifiedResults } from "@shared/schema";

const BUILD_VERSION = 92;

export function registerAuditRoutes(app: Express): void {
  app.get("/api/audit/db-check", async (req, res) => {
    try {
      const keywords = (req.query.keywords as string || '').split(',').filter(k => k.trim());
      const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      
      if (keywords.length === 0) {
        return res.status(400).json({ error: 'keywords parameter required (comma-separated)' });
      }
      
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      for (const keyword of keywords) {
        conditions.push(`(LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex} OR LOWER(brand) LIKE $${paramIndex})`);
        params.push(`%${keyword.toLowerCase().trim()}%`);
        paramIndex++;
      }
      
      let sql = `SELECT id, name, brand, price, merchant, category FROM products WHERE ${conditions.join(' AND ')}`;
      
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        sql += ` AND price <= $${paramIndex}`;
        params.push(maxPrice);
        paramIndex++;
      }
      
      sql += ` LIMIT ${limit}`;
      
      const { db } = await import('../db');
      const { sql: sqlTag } = await import('drizzle-orm');
      
      const countResult = await db.execute(sqlTag.raw(`SELECT COUNT(*) as total FROM products WHERE ${conditions.map((_, i) => `(LOWER(name) LIKE '%${keywords[i].toLowerCase().trim()}%' OR LOWER(description) LIKE '%${keywords[i].toLowerCase().trim()}%' OR LOWER(brand) LIKE '%${keywords[i].toLowerCase().trim()}%')`).join(' AND ')}${maxPrice !== undefined ? ` AND price <= ${maxPrice}` : ''}`)) as any;
      
      const sampleResult = await db.execute(sqlTag.raw(`SELECT id, name, brand, price, merchant, category FROM products WHERE ${conditions.map((_, i) => `(LOWER(name) LIKE '%${keywords[i].toLowerCase().trim()}%' OR LOWER(description) LIKE '%${keywords[i].toLowerCase().trim()}%' OR LOWER(brand) LIKE '%${keywords[i].toLowerCase().trim()}%')`).join(' AND ')}${maxPrice !== undefined ? ` AND price <= ${maxPrice}` : ''} LIMIT ${limit}`)) as any;
      
      const total = parseInt(countResult[0]?.total || countResult.rows?.[0]?.total || '0');
      
      res.json({
        keywords,
        max_price: maxPrice,
        exists: total > 0,
        count: total,
        sample_products: sampleResult.rows || sampleResult
      });
    } catch (error) {
      console.error('[Audit] DB check error:', error);
      res.status(500).json({ error: 'Database check failed', details: String(error) });
    }
  });
  
  app.post("/api/audit/run", async (req, res) => {
    try {
      const { queries, check_relevance = true, limit = 10, use_ai_scoring = false } = req.body;
      
      console.log(`[Audit V2] Starting audit for ${queries?.length || 0} queries, use_ai_scoring=${use_ai_scoring}`);
      
      if (!queries || !Array.isArray(queries)) {
        return res.status(400).json({ error: 'queries array required' });
      }
      
      let scoreResults: typeof import('../services/relevance-scorer').scoreResults | null = null;
      if (use_ai_scoring) {
        const scorer = await import('../services/relevance-scorer');
        scoreResults = scorer.scoreResults;
      }
      
      const estimateProductAge = (product: any): number | null => {
        const text = ((product.name || product.title || '') + ' ' + (product.description || '')).toLowerCase();
        const ageMatch = text.match(/(\d+)\+/) || text.match(/ages?\s*(\d+)/);
        if (ageMatch) return parseInt(ageMatch[1]);
        if (text.includes('duplo') || text.includes('toddler')) return 2;
        if (text.includes('baby') || text.includes('infant') || text.includes('newborn')) return 0;
        if (text.includes('teen') || text.includes('teenage')) return 14;
        return null;
      };
      
      const isAgeAppropriate = (productAge: number | null, queryAge: number | null): boolean | null => {
        if (productAge === null || queryAge === null) return null;
        const diff = Math.abs(productAge - queryAge);
        return diff <= 3;
      };
      
      const results: any[] = [];
      let passCount = 0, partialCount = 0, failCount = 0;
      
      for (const testQuery of queries) {
        const isStringQuery = typeof testQuery === 'string';
        const query = isStringQuery ? testQuery : testQuery.query;
        const required_keywords = isStringQuery ? '' : (testQuery.required_keywords || '');
        const max_price = isStringQuery ? undefined : testQuery.max_price;
        const expected_brand = isStringQuery ? undefined : testQuery.expected_brand;
        const expected_character = isStringQuery ? undefined : testQuery.expected_character;
        const category = isStringQuery ? undefined : testQuery.category;
        
        const cleanQuery = query.replace(/^["']+|["']+$/g, '').replace(/,+$/, '').trim();
        
        const parsed = parseQuery(cleanQuery);
        
        if (!cleanQuery || typeof cleanQuery !== 'string' || cleanQuery.trim().length === 0) {
          console.log(`[Audit] Skipping invalid query:`, testQuery);
          continue;
        }
        
        const requiredKws = (required_keywords || '').split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k);
        
        const startTime = Date.now();
        
        let dbExists = false;
        let dbCount = 0;
        try {
          const { db } = await import('../db');
          const { sql: sqlTag } = await import('drizzle-orm');
          
          const kwConditions = requiredKws.length > 0
            ? requiredKws.map((kw: string) => `(LOWER(name) LIKE '%${kw.replace(/'/g, "''")}%' OR LOWER(brand) LIKE '%${kw.replace(/'/g, "''")}%')`).join(' AND ')
            : `LOWER(name) LIKE '%${cleanQuery.toLowerCase().replace(/'/g, "''").split(' ')[0]}%'`;
          
          const priceCondition = max_price ? ` AND price <= ${parseFloat(max_price)}` : '';
          const countResult = await db.execute(sqlTag.raw(`SELECT COUNT(*) as total FROM products WHERE (${kwConditions})${priceCondition}`)) as any;
          dbCount = parseInt(countResult[0]?.total || countResult.rows?.[0]?.total || '0');
          dbExists = dbCount > 0;
          console.log(`[Audit] DB check for "${cleanQuery}": ${dbCount} products found`);
        } catch (e) {
          console.error(`[Audit] DB check failed for "${cleanQuery}":`, e);
        }
        
        let searchResults: any[] = [];
        let searchTime = 0;
        try {
          const searchStart = Date.now();
          const port = process.env.PORT || 5000;
          const searchResponse = await fetch(`http://localhost:${port}/api/shop/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: cleanQuery, limit })
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            searchTime = Date.now() - searchStart;
            
            searchResults = (searchData.products || []).map((p: any) => ({
              title: p.name,
              name: p.name,
              description: p.description || '',
              salePrice: p.price,
              price: p.price,
              merchant: p.merchant,
              brand: p.brand,
              category: p.category,
              imageUrl: p.imageUrl || p.image,
              link: p.affiliateLink || p.link
            }));
          } else {
            console.error(`[Audit] Search API returned ${searchResponse.status}`);
          }
        } catch (e) {
          console.error(`[Audit] Search API failed for "${cleanQuery}":`, e);
        }
        
        let relevantCount = 0;
        const scoredProducts: any[] = [];
        
        let characterMatches = 0;
        let ageMatches = 0;
        let priceMatches = 0;
        let ageCheckable = 0;
        const brandSet = new Set<string>();
        const titleSet = new Set<string>();
        let duplicateCount = 0;
        
        for (const product of searchResults) {
          const productText = `${product.title} ${product.description || ''} ${product.merchant || ''}`.toLowerCase();
          let isRelevant = true;
          const issues: string[] = [];
          
          const brand = (product.brand || product.merchant || 'Unknown').toLowerCase();
          brandSet.add(brand);
          
          const normalizedTitle = (product.title || '').toLowerCase().trim();
          if (titleSet.has(normalizedTitle)) {
            duplicateCount++;
          } else {
            titleSet.add(normalizedTitle);
          }
          
          const AMBIGUOUS_CHARACTERS = ['stitch', 'flash', 'link', 'belle', 'aurora', 'chase', 'rocky'];
          let matchesCharacter: boolean | null = null;
          if (parsed.character) {
            const charLower = parsed.character.toLowerCase();
            const brandLower = (product.brand || '').toLowerCase();
            const nameLower = (product.title || '').toLowerCase();
            const isAmbiguous = AMBIGUOUS_CHARACTERS.includes(charLower);
            
            if (isAmbiguous) {
              const hasDisneyContext = brandLower.includes('disney') || nameLower.includes('disney') ||
                                       nameLower.includes('lilo') || brandLower.includes('lilo');
              matchesCharacter = nameLower.includes(charLower) || brandLower.includes(charLower) ||
                                (charLower === 'stitch' && hasDisneyContext);
            } else {
              matchesCharacter = productText.includes(charLower) || brandLower.includes(charLower);
            }
            
            if (matchesCharacter) {
              characterMatches++;
            } else {
              issues.push(`Missing character: ${parsed.character}`);
            }
          }
          
          let matchesAge: boolean | null = null;
          const productAge = estimateProductAge(product);
          const queryAge = parsed.ageMin !== undefined ? parsed.ageMin : null;
          if (queryAge !== null) {
            matchesAge = isAgeAppropriate(productAge, queryAge);
            if (matchesAge !== null) {
              ageCheckable++;
              if (matchesAge) ageMatches++;
              else issues.push(`Age mismatch: product ${productAge}+, query ${queryAge}`);
            }
          }
          
          let matchesPrice: boolean | null = null;
          const priceLimit = parsed.priceMax !== undefined ? parsed.priceMax : (max_price ? parseFloat(max_price) : null);
          if (priceLimit && product.salePrice !== undefined) {
            matchesPrice = product.salePrice <= priceLimit;
            if (matchesPrice) {
              priceMatches++;
            } else {
              issues.push(`Price £${product.salePrice} > £${priceLimit}`);
            }
          }
          
          if (check_relevance && requiredKws.length > 0) {
            for (const kw of requiredKws) {
              if (!productText.includes(kw)) {
                isRelevant = false;
                issues.push(`Missing: ${kw}`);
                break;
              }
            }
          }
          
          if (parsed.character && !matchesCharacter) {
            isRelevant = false;
          }
          if (priceLimit && matchesPrice === false) {
            isRelevant = false;
          }
          
          if (isRelevant) relevantCount++;
          
          scoredProducts.push({
            name: product.title,
            price: product.salePrice,
            merchant: product.merchant,
            brand: product.brand || product.merchant,
            description: product.description || '',
            hasImage: !!product.imageUrl,
            matchesCharacter,
            matchesAge,
            matchesPrice,
            productAge,
            relevant: isRelevant,
            issues: issues.length > 0 ? issues : undefined
          });
        }
        
        const n = searchResults.length;
        const characterMatchPct = parsed.character && n > 0 ? Math.round((characterMatches / n) * 100) : null;
        const ageMatchPct = ageCheckable > 0 ? Math.round((ageMatches / ageCheckable) * 100) : null;
        const priceMaxUsed = parsed.priceMax !== undefined ? parsed.priceMax : (max_price ? parseFloat(max_price) : null);
        const priceMatchPct = priceMaxUsed && n > 0 ? Math.round((priceMatches / n) * 100) : null;
        const diversityScore = brandSet.size;
        
        const relevanceScore = searchResults.length > 0 ? relevantCount / searchResults.length : 0;
        
        let totalScore = 0;
        let maxScore = 0;
        
        if (parsed.character) {
          maxScore += 40;
          totalScore += ((characterMatchPct || 0) / 100) * 40;
        }
        if (parsed.ageMin !== null || parsed.ageMax !== null) {
          maxScore += 30;
          totalScore += ((ageMatchPct || 0) / 100) * 30;
        }
        if (priceMaxUsed) {
          maxScore += 20;
          totalScore += ((priceMatchPct || 0) / 100) * 20;
        }
        const isBrandQuery = parsed.character && BRAND_CHARACTERS.includes(parsed.character.toLowerCase());
        
        if (!isBrandQuery) {
          maxScore += 10;
          totalScore += Math.min(diversityScore, 10);
        }
        
        const v2Score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : (n > 0 ? 100 : 0);
        
        let status: string;
        let statusNote = '';
        
        const topResultRelevant = scoredProducts.length > 0 && scoredProducts[0].relevant === true;
        
        const isInventoryGap = searchResults.length === 0 && !dbExists;
        
        if (isInventoryGap) {
          status = 'INVENTORY_GAP';
          statusNote = 'Brand/product not in catalog';
        } else if (searchResults.length === 0 && dbExists) {
          status = 'FAIL';
          statusNote = 'Products exist in DB but search returned nothing';
          failCount++;
        } else if (searchResults.length === 0) {
          status = 'INVENTORY_GAP';
          statusNote = 'No matching products in catalog';
        } else if (v2Score >= 70) {
          status = 'PASS';
          statusNote = `Score ${v2Score}%: Good relevance`;
          passCount++;
        } else if (v2Score >= 40) {
          status = 'PARTIAL';
          statusNote = `Score ${v2Score}%: Needs improvement`;
          partialCount++;
        } else {
          status = 'FAIL';
          statusNote = `Score ${v2Score}%: Poor relevance`;
          failCount++;
        }
        
        const limitedProducts = scoredProducts.slice(0, 10);
        
        let aiScores: { score: number; reason: string; flagged: boolean }[] = [];
        let avgAiScore: number | null = null;
        let aiScoringFailed = false;
        
        if (use_ai_scoring && scoreResults && limitedProducts.length > 0) {
          console.log(`[Audit] Running AI scoring for "${query}" with ${limitedProducts.length} products`);
          try {
            const productsForScoring = limitedProducts.map((p, idx) => ({
              position: idx + 1,
              title: p.name || '',
              merchant: p.merchant || '',
              price: String(p.price || 0),
              description: p.description || ''
            }));
            
            aiScores = await scoreResults(query, productsForScoring);
            
            const validScores = aiScores.filter(s => s.score >= 0);
            if (validScores.length > 0) {
              avgAiScore = validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length;
            } else {
              aiScoringFailed = true;
              avgAiScore = null;
            }
          } catch (aiError: any) {
            console.error(`[Audit] AI scoring failed for "${query}":`, aiError.message);
            aiScoringFailed = true;
            aiScores = limitedProducts.map(() => ({
              score: -1,
              reason: 'SCORING_ERROR: API call failed',
              flagged: false
            }));
          }
        }
        
        const productsWithAiScores = limitedProducts.map((p, idx) => {
          const aiScore = aiScores[idx];
          return {
            ...p,
            aiScore: aiScore?.score !== undefined ? aiScore.score : null,
            aiReason: aiScore?.reason || (use_ai_scoring ? 'No AI score' : undefined),
            flagged: aiScore?.flagged || false
          };
        });
        
        results.push({
          query,
          category,
          parsed_query: {
            age: parsed.ageMin,
            ageRange: parsed.ageMin !== null || parsed.ageMax !== null 
              ? `${parsed.ageMin ?? '?'}-${parsed.ageMax ?? '?'}` : null,
            gender: parsed.gender || null,
            character: parsed.character || null,
            priceMax: parsed.priceMax,
            productType: parsed.productType || null,
            keywords: parsed.keywords
          },
          database_check: { exists: dbExists, count: dbCount },
          search_result: {
            count: searchResults.length,
            time_ms: searchTime,
            products: productsWithAiScores
          },
          analysis: {
            status,
            status_note: statusNote || undefined,
            score: v2Score,
            breakdown: {
              characterMatch: characterMatchPct !== null ? `${characterMatchPct}%` : 'N/A',
              ageMatch: ageMatchPct !== null ? `${ageMatchPct}%` : 'N/A',
              priceMatch: priceMatchPct !== null ? `${priceMatchPct}%` : 'N/A',
              diversity: isBrandQuery ? 'N/A (brand query)' : `${diversityScore}/10 brands`
            },
            characterMatchPct,
            ageMatchPct,
            priceMatchPct,
            diversityScore,
            duplicateCount,
            top_result_relevant: topResultRelevant,
            relevance_score: Math.round(relevanceScore * 100) / 100,
            relevant_count: relevantCount,
            total_returned: searchResults.length,
            ai_avg_score: use_ai_scoring && avgAiScore !== null ? Math.round(avgAiScore * 100) / 100 : undefined,
            ai_flagged_count: use_ai_scoring ? aiScores.filter(s => s.flagged).length : undefined,
            ai_scoring_failed: aiScoringFailed || undefined
          }
        });
      }
      
      const inventoryGapCount = results.filter((r: any) => r.analysis.status === 'INVENTORY_GAP').length;
      const searchableTotal = results.length - inventoryGapCount;
      const searchPassRate = searchableTotal > 0 ? Math.round((passCount / searchableTotal) * 100) : 0;
      
      res.json({
        summary: {
          total: results.length,
          pass: passCount,
          partial: partialCount,
          inventory_gap: inventoryGapCount,
          fail: failCount,
          pass_rate: searchPassRate + '%',
          note: inventoryGapCount > 0 ? `${inventoryGapCount} queries have no products in catalog (merchandising issue, not search bug)` : undefined
        },
        results
      });
    } catch (error) {
      console.error('[Audit] Run error:', error);
      res.status(500).json({ error: 'Audit failed', details: String(error) });
    }
  });
  
  app.get("/api/audit/queries", async (req, res) => {
    try {
      const csvPath = path.join(process.cwd(), 'public', 'test-queries.csv');
      if (fs.existsSync(csvPath)) {
        const csv = fs.readFileSync(csvPath, 'utf8');
        const lines = csv.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',');
        const queries = lines.slice(1).map(line => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (const char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          
          return {
            query: values[0]?.replace(/^"|"$/g, ''),
            category: values[1]?.replace(/^"|"$/g, ''),
            required_keywords: values[2]?.replace(/^"|"$/g, ''),
            optional_keywords: values[3]?.replace(/^"|"$/g, ''),
            max_price: values[4] ? parseFloat(values[4]) : undefined,
            expected_brand: values[5]?.replace(/^"|"$/g, ''),
            expected_character: values[6]?.replace(/^"|"$/g, ''),
            notes: values[7]?.replace(/^"|"$/g, '')
          };
        }).filter(q => q.query);
        
        res.json({ count: queries.length, queries });
      } else {
        res.status(404).json({ error: 'Test queries file not found' });
      }
    } catch (error) {
      console.error('[Audit] Queries error:', error);
      res.status(500).json({ error: 'Failed to load queries' });
    }
  });

  app.post("/api/audit/bulk", async (req, res) => {
    try {
      const { 
        batch_size = 10, 
        workers = 5, 
        limit = 10,
        start_index = 0,
        max_queries = 1000,
        target_url,
        target_db_url
      } = req.body;
      
      const isProductionAudit = !!target_url || !!target_db_url;
      console.log(`[Bulk Audit] Starting bulk audit: batch_size=${batch_size}, workers=${workers}, limit=${limit}, start=${start_index}, max=${max_queries}${isProductionAudit ? ' (PRODUCTION MODE)' : ''}`);
      
      let productionDb: any = null;
      if (target_db_url) {
        try {
          const { drizzle } = await import('drizzle-orm/postgres-js');
          const postgres = (await import('postgres')).default;
          const schema = await import('@shared/schema');
          const prodClient = postgres(target_db_url, { max: 5, connect_timeout: 10 });
          productionDb = drizzle(prodClient, { schema });
          console.log(`[Bulk Audit] Connected to production database for cache writes`);
        } catch (dbErr) {
          console.error(`[Bulk Audit] Failed to connect to production database:`, dbErr);
        }
      }
      
      const queriesPath = path.join(process.cwd(), 'data', 'bulk_audit_queries.json');
      if (!fs.existsSync(queriesPath)) {
        return res.status(404).json({ error: 'Bulk queries file not found at data/bulk_audit_queries.json' });
      }
      
      const queriesData = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
      let allQueries: string[] = queriesData.queries || [];
      
      allQueries = allQueries.slice(start_index, start_index + max_queries);
      console.log(`[Bulk Audit] Loaded ${allQueries.length} queries (starting from index ${start_index})`);
      
      const outputPath = path.join(process.cwd(), 'data', `bulk_audit_results_${Date.now()}.json`);
      const progressPath = path.join(process.cwd(), 'data', 'bulk_audit_progress.json');
      
      const port = process.env.PORT || 5000;
      const baseUrl = target_url || `http://localhost:${port}`;
      const results: any[] = [];
      let passCount = 0, partialCount = 0, failCount = 0, errorCount = 0;
      let processed = 0;
      const startTime = Date.now();
      
      const runSingleQuery = async (query: string, index: number): Promise<any> => {
        const queryStart = Date.now();
        try {
          const searchResponse = await fetch(`${baseUrl}/api/shop/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit })
          });
          
          if (!searchResponse.ok) {
            return { query, index, status: 'ERROR', error: `HTTP ${searchResponse.status}`, timeMs: Date.now() - queryStart };
          }
          
          const searchData = await searchResponse.json();
          const products = searchData.products || [];
          
          const parsed = parseQuery(query);
          
          let characterMatches = 0;
          let priceMatches = 0;
          
          for (const product of products) {
            const productText = `${product.name || ''} ${product.brand || ''}`.toLowerCase();
            
            if (parsed.character) {
              if (productText.includes(parsed.character.toLowerCase())) {
                characterMatches++;
              }
            }
            
            if (parsed.priceMax && product.price !== undefined) {
              if (product.price <= parsed.priceMax) {
                priceMatches++;
              }
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
          const verdict = finalScore >= 70 ? 'PASS' : finalScore >= 40 ? 'PARTIAL' : 'FAIL';
          
          // FIX #70: Auto-cache PASS results to verified_results table
          // FIX #72: Use production database when target_db_url is provided
          // FIX #73: Use static imports to avoid dynamic import issues on production
          // FIX #74: Added explicit logging to debug production caching
          console.log(`[Audit Cache Debug] query="${query}" verdict=${verdict} products=${products.length} dbReady=${!!db}`);
          
          if (verdict === 'PASS' && products.length >= 3) {
            try {
              const normalizedQuery = query.toLowerCase().trim();
              
              // Use production database if provided, otherwise use local db
              const targetDb = productionDb || db;
              console.log(`[Audit Cache] Attempting insert for "${normalizedQuery}" using ${productionDb ? 'productionDb' : 'local db'}`);
              
              await targetDb.insert(verifiedResults).values({
                query: normalizedQuery,
                verifiedProductIds: JSON.stringify(products.slice(0, 10).map((p: any) => p.id)),
                verifiedProductNames: JSON.stringify(products.slice(0, 10).map((p: any) => p.name)),
                verifiedBy: 'audit-bot',
                confidence: 'auto'
              }).onConflictDoNothing();
              
              console.log(`[Audit Cache] SUCCESS: Saved "${normalizedQuery}"${productionDb ? ' (PRODUCTION DB)' : ' (LOCAL DB)'}`);
            } catch (cacheError) {
              console.error(`[Audit Cache] FAILED to cache "${query}":`, cacheError);
            }
          } else {
            console.log(`[Audit Cache] SKIPPED: "${query}" - verdict=${verdict}, products=${products.length}`);
          }
          
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
              productType: parsed.productType
            },
            metrics: {
              characterPct,
              pricePct,
              characterMatches,
              priceMatches
            },
            topResults: products.slice(0, 3).map((p: any) => ({
              name: p.name?.substring(0, 60),
              brand: p.brand,
              price: p.price,
              merchant: p.merchant
            })),
            timeMs: Date.now() - queryStart
          };
        } catch (e) {
          return { query, index, status: 'ERROR', error: String(e), timeMs: Date.now() - queryStart };
        }
      };
      
      const batches: string[][] = [];
      for (let i = 0; i < allQueries.length; i += batch_size) {
        batches.push(allQueries.slice(i, i + batch_size));
      }
      
      console.log(`[Bulk Audit] Processing ${batches.length} batches of ${batch_size} queries each with ${workers} parallel workers`);
      
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx += workers) {
        const workerBatches = batches.slice(batchIdx, batchIdx + workers);
        
        const batchPromises = workerBatches.map((batch, workerIdx) => {
          const globalBatchIdx = batchIdx + workerIdx;
          return Promise.all(
            batch.map((query, queryIdx) => {
              const globalIdx = globalBatchIdx * batch_size + queryIdx + start_index;
              return runSingleQuery(query, globalIdx);
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
        
        if (processed % 50 === 0 || processed === allQueries.length) {
          console.log(`[Bulk Audit] Progress: ${processed}/${allQueries.length} (${progress.percent}%) - PASS: ${passCount}, PARTIAL: ${partialCount}, FAIL: ${failCount}, ERRORS: ${errorCount}`);
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      const finalOutput = {
        summary: {
          total: results.length,
          pass: passCount,
          partial: partialCount,
          fail: failCount,
          errors: errorCount,
          passRate: Math.round((passCount / (results.length - errorCount)) * 100) + '%',
          totalTimeMs: totalTime,
          avgTimePerQuery: Math.round(totalTime / results.length),
          buildVersion: BUILD_VERSION
        },
        results
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
      console.log(`[Bulk Audit] Complete! Results saved to ${outputPath}`);
      
      res.json({
        success: true,
        outputFile: outputPath,
        summary: finalOutput.summary
      });
      
    } catch (error) {
      console.error('[Bulk Audit] Error:', error);
      res.status(500).json({ error: 'Bulk audit failed', details: String(error) });
    }
  });
  
  app.get("/api/audit/bulk/progress", async (req, res) => {
    try {
      const progressPath = path.join(process.cwd(), 'data', 'bulk_audit_progress.json');
      if (fs.existsSync(progressPath)) {
        const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
        res.json(progress);
      } else {
        res.json({ status: 'not_started', message: 'No bulk audit in progress' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get progress' });
    }
  });

  app.get("/api/verify/stats", async (req, res) => {
    try {
      const { db } = await import('../db');
      const { verifiedResults } = await import('@shared/schema');
      
      const allResults = await db.select().from(verifiedResults);
      
      const verified = allResults.filter(r => r.confidence === 'manual' || r.confidence === 'auto').length;
      const flagged = allResults.filter(r => r.confidence === 'flagged').length;
      
      let totalQueries = 0;
      try {
        const queriesPath = path.join(process.cwd(), 'data', 'test-queries-2000.json');
        if (fs.existsSync(queriesPath)) {
          const queries = JSON.parse(fs.readFileSync(queriesPath, 'utf8'));
          totalQueries = queries.length;
        }
      } catch (e) {}
      
      res.json({
        total: totalQueries,
        verified,
        flagged,
        remaining: Math.max(0, totalQueries - verified - flagged)
      });
    } catch (error) {
      console.error('[Verify Stats] Error:', error);
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });
  
  app.post("/api/verify/save", async (req, res) => {
    try {
      const { query, productIds, productNames, confidence, verifiedBy } = req.body;
      
      if (!query || !productIds) {
        return res.status(400).json({ error: 'Query and productIds are required' });
      }
      
      const { db } = await import('../db');
      const { verifiedResults } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const normalizedQuery = query.toLowerCase().trim();
      
      const existing = await db.select().from(verifiedResults).where(eq(verifiedResults.query, normalizedQuery)).limit(1);
      
      if (existing.length > 0) {
        await db.update(verifiedResults)
          .set({
            verifiedProductIds: JSON.stringify(productIds),
            verifiedProductNames: JSON.stringify(productNames || []),
            confidence: confidence || 'manual',
            verifiedBy: verifiedBy || 'admin',
            verifiedAt: new Date()
          })
          .where(eq(verifiedResults.query, normalizedQuery));
        
        console.log(`[Verify] Updated cache for "${normalizedQuery}" (${confidence})`);
      } else {
        await db.insert(verifiedResults).values({
          query: normalizedQuery,
          verifiedProductIds: JSON.stringify(productIds),
          verifiedProductNames: JSON.stringify(productNames || []),
          confidence: confidence || 'manual',
          verifiedBy: verifiedBy || 'admin'
        });
        
        console.log(`[Verify] Created cache for "${normalizedQuery}" (${confidence})`);
      }
      
      res.json({ success: true, query: normalizedQuery, confidence });
    } catch (error) {
      console.error('[Verify Save] Error:', error);
      res.status(500).json({ error: 'Failed to save verification' });
    }
  });
  
  app.get("/api/verify/list", async (req, res) => {
    try {
      const { db } = await import('../db');
      const { verifiedResults } = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      
      const results = await db.select({
        query: verifiedResults.query,
        confidence: verifiedResults.confidence,
        verifiedBy: verifiedResults.verifiedBy,
        verifiedAt: verifiedResults.verifiedAt
      }).from(verifiedResults).orderBy(desc(verifiedResults.verifiedAt)).limit(100);
      
      res.json({ results });
    } catch (error) {
      console.error('[Verify List] Error:', error);
      res.status(500).json({ error: 'Failed to list verifications' });
    }
  });
}
