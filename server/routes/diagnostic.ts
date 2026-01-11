import { Express } from 'express';
import { db } from '../db';
import { sql, inArray } from 'drizzle-orm';
import { products } from '@shared/schema';

export function registerDiagnosticRoutes(app: Express): void {
  
  app.post('/api/diagnostic/search', async (req, res) => {
    try {
      const { query, limit = 20 } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      const startTime = Date.now();
      const result: any = {
        query: query,
        timestamp: new Date().toISOString(),
        diagnosis: {},
        verdict: null,
        fixAction: null
      };
      
      const queryLower = query.toLowerCase().trim();
      const exactMovieKeywords = ['movies', 'movie', 'cinema', 'films', 'film'];
      const cinemaIntentPhrases = ['whats on', "what's on", 'now showing', 'at the cinema', 'at the movies'];
      const isCinemaIntent = exactMovieKeywords.includes(queryLower) || 
                             cinemaIntentPhrases.some(p => queryLower.includes(p));
      
      const queryWords = queryLower.split(' ').filter((w: string) => w.length > 2);
      
      result.diagnosis.intent = {
        detected: isCinemaIntent ? 'cinema' : 'product',
        queryWords: queryWords,
        isCinemaQuery: isCinemaIntent
      };
      
      if (isCinemaIntent) {
        result.verdict = 'CINEMA_INTENT';
        result.fixAction = 'Routes to TMDB movies.';
        result.diagnosis.search = { returnedCount: 0, searchTimeMs: Date.now() - startTime };
        result.diagnosis.database = { exactMatches: 0, productsExist: false };
        result.diagnosis.relevance = { exactMatchCount: 0, relevancePercent: 0 };
        result.diagnosis.images = { withImages: 0, imagePercent: 0 };
        return res.json(result);
      }
      
      const dbCheckStart = Date.now();
      const searchPattern = `%${queryLower}%`;
      
      const dbCheckResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_matches,
          COUNT(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 END) as with_images,
          COUNT(CASE WHEN source = 'awin' THEN 1 END) as awin_count,
          COUNT(CASE WHEN source = 'cj' THEN 1 END) as cj_count
        FROM products 
        WHERE 
          LOWER(name) LIKE ${searchPattern}
          OR LOWER(brand) LIKE ${searchPattern}
          OR LOWER(merchant) LIKE ${searchPattern}
      `);
      
      const dbRow = dbCheckResult[0] as any;
      const dbProductCount = parseInt(dbRow?.total_matches || '0');
      
      result.diagnosis.database = {
        exactMatches: dbProductCount,
        productsExist: dbProductCount > 0,
        withImages: parseInt(dbRow?.with_images || '0'),
        awinProducts: parseInt(dbRow?.awin_count || '0'),
        cjProducts: parseInt(dbRow?.cj_count || '0'),
        checkTimeMs: Date.now() - dbCheckStart
      };
      
      const searchStart = Date.now();
      
      let searchResults: any[] = [];
      let searchApiResponse: any = null;
      
      try {
        const protocol = req.protocol || 'http';
        const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
        const baseUrl = `${protocol}://${host}`;
        
        const response = await fetch(`${baseUrl}/api/shop/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: Math.min(limit, 20) })
        });
        searchApiResponse = await response.json();
        searchResults = searchApiResponse?.products || [];
      } catch (fetchError: any) {
        console.error('[Diagnostic] Failed to call shop search:', fetchError.message);
      }
      
      const searchTime = Date.now() - searchStart;
      
      result.diagnosis.search = {
        returnedCount: searchResults.length,
        searchTimeMs: searchTime,
        apiSuccess: searchApiResponse?.success ?? false,
        interpretation: searchApiResponse?.interpretation,
        totalFromApi: searchApiResponse?.total || searchResults.length,
        topResults: searchResults.slice(0, 5).map((p: any) => ({
          name: (p.name || '').substring(0, 50),
          merchant: p.merchant,
          category: p.category,
          price: p.price,
          hasImage: !!(p.imageUrl && p.imageUrl.trim() !== '')
        }))
      };
      
      let exactMatchCount = 0;
      for (const prod of searchResults) {
        const prodName = (prod.name || '').toLowerCase();
        const prodBrand = (prod.brand || '').toLowerCase();
        const prodCategory = (prod.category || '').toLowerCase();
        
        for (const word of queryWords) {
          if (prodName.includes(word) || prodBrand.includes(word) || prodCategory.includes(word)) {
            exactMatchCount++;
            break;
          }
        }
      }
      
      const relevancePercent = searchResults.length > 0 
        ? Math.round((exactMatchCount / searchResults.length) * 100) 
        : 0;
      
      result.diagnosis.relevance = {
        exactMatchCount,
        relevancePercent,
        expectedTerms: queryWords
      };
      
      const resultsWithImages = searchResults.filter(p => p.imageUrl && p.imageUrl.trim() !== '').length;
      const imagePercent = searchResults.length > 0 
        ? Math.round((resultsWithImages / searchResults.length) * 100) 
        : 0;
      
      result.diagnosis.images = {
        withImages: resultsWithImages,
        withoutImages: searchResults.length - resultsWithImages,
        imagePercent
      };
      
      if (dbProductCount === 0) {
        result.verdict = 'INVENTORY_GAP';
        result.fixAction = 'No matching products in database. Need to import products for this category.';
      } else if (searchResults.length === 0) {
        result.verdict = 'SEARCH_BUG';
        result.fixAction = `Database has ${dbProductCount} products but search returned 0. Check: GPT interpretation, searchTerms, mustHaveAll filter, category filter.`;
      } else if (relevancePercent < 50) {
        result.verdict = 'RANKING_BUG';
        result.fixAction = `Only ${relevancePercent}% of results match query. Check: GPT reranker, searchTerms injection, character detection.`;
      } else if (imagePercent < 80 && result.diagnosis.database.withImages > searchResults.length) {
        result.verdict = 'IMAGE_BUG';
        result.fixAction = `${100 - imagePercent}% of results have no images, but database has ${result.diagnosis.database.withImages} products with images.`;
      } else if (searchTime > 3000) {
        result.verdict = 'SPEED_BUG';
        result.fixAction = `Search took ${searchTime}ms (>3s). Check: ILIKE fallback triggered, tsvector disabled, complex OR chains.`;
      } else {
        result.verdict = 'PASS';
        result.fixAction = 'No issues detected. Results are relevant and fast.';
      }
      
      result.diagnosis.timing = {
        totalMs: Date.now() - startTime,
        dbCheckMs: result.diagnosis.database.checkTimeMs,
        searchMs: searchTime
      };
      
      res.json(result);
    } catch (error: any) {
      console.error('[Diagnostic] Error:', error);
      res.status(500).json({ error: 'Diagnostic failed', details: error.message });
    }
  });

  app.post('/api/diagnostic/batch', async (req, res) => {
    try {
      const { queries } = req.body;
      
      if (!queries || !Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'queries array is required' });
      }
      
      const results: any[] = [];
      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
      const baseUrl = `${protocol}://${host}`;
      
      for (const query of queries.slice(0, 50)) {
        try {
          const queryLower = (query || '').toLowerCase().trim();
          const searchPattern = `%${queryLower}%`;
          
          const exactMovieKeywords = ['movies', 'movie', 'cinema', 'films', 'film'];
          const cinemaIntentPhrases = ['whats on', "what's on", 'now showing', 'at the cinema'];
          const isCinemaIntent = exactMovieKeywords.includes(queryLower) || 
                                 cinemaIntentPhrases.some(p => queryLower.includes(p));
          
          if (isCinemaIntent) {
            results.push({ query, verdict: 'CINEMA_INTENT', fixAction: 'Routes to TMDB movies' });
            continue;
          }
          
          let dbCount = 0;
          try {
            const dbCheck = await db.execute(sql.raw(`
              SELECT COUNT(*) as total FROM products 
              WHERE LOWER(name) LIKE '${searchPattern.replace(/'/g, "''")}' 
                 OR LOWER(brand) LIKE '${searchPattern.replace(/'/g, "''")}'
            `));
            dbCount = parseInt((dbCheck[0] as any)?.total || '0');
          } catch (e) {
            console.error(`[Diagnostic] DB check error for "${query}":`, e);
          }
          
          let searchResults: any[] = [];
          const searchStart = Date.now();
          
          try {
            const response = await fetch(`${baseUrl}/api/shop/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, limit: 10 })
            });
            const searchApiResponse = await response.json();
            searchResults = searchApiResponse?.products || [];
          } catch (fetchError: any) {
            console.error(`[Diagnostic] Search error for "${query}":`, fetchError.message);
          }
          
          const searchTime = Date.now() - searchStart;
          
          const queryWords = queryLower.split(' ').filter((w: string) => w.length > 2);
          let exactMatchCount = 0;
          for (const prod of searchResults) {
            const prodName = (prod.name || '').toLowerCase();
            for (const word of queryWords) {
              if (prodName.includes(word)) {
                exactMatchCount++;
                break;
              }
            }
          }
          
          const relevance = searchResults.length > 0 
            ? (exactMatchCount / searchResults.length) * 100 
            : 0;
          
          const resultsWithImages = searchResults.filter(p => p.imageUrl && p.imageUrl.trim() !== '').length;
          const imagePercent = searchResults.length > 0 
            ? (resultsWithImages / searchResults.length) * 100 
            : 0;
          
          let verdict = 'PASS';
          let fixAction = 'OK';
          
          if (dbCount === 0) {
            verdict = 'INVENTORY_GAP';
            fixAction = 'No products in database';
          } else if (searchResults.length === 0) {
            verdict = 'SEARCH_BUG';
            fixAction = `DB has ${dbCount} products but search returned 0`;
          } else if (relevance < 50) {
            verdict = 'RANKING_BUG';
            fixAction = `Only ${Math.round(relevance)}% relevant`;
          } else if (imagePercent < 80) {
            verdict = 'IMAGE_BUG';
            fixAction = `${Math.round(100 - imagePercent)}% missing images`;
          } else if (searchTime > 3000) {
            verdict = 'SPEED_BUG';
            fixAction = `${searchTime}ms (>3s)`;
          }
          
          results.push({
            query,
            verdict,
            fixAction,
            dbCount,
            searchCount: searchResults.length,
            relevance: Math.round(relevance),
            imagePercent: Math.round(imagePercent),
            timeMs: searchTime
          });
          
        } catch (err) {
          results.push({ query, verdict: 'ERROR', fixAction: 'Test failed', error: (err as Error).message });
        }
      }
      
      const summary = {
        total: results.length,
        passed: results.filter(r => r.verdict === 'PASS').length,
        cinemaIntents: results.filter(r => r.verdict === 'CINEMA_INTENT').length,
        inventoryGaps: results.filter(r => r.verdict === 'INVENTORY_GAP').length,
        searchBugs: results.filter(r => r.verdict === 'SEARCH_BUG').length,
        rankingBugs: results.filter(r => r.verdict === 'RANKING_BUG').length,
        imageBugs: results.filter(r => r.verdict === 'IMAGE_BUG').length,
        speedBugs: results.filter(r => r.verdict === 'SPEED_BUG').length,
        errors: results.filter(r => r.verdict === 'ERROR').length
      };
      
      res.json({ summary, results });
    } catch (error: any) {
      console.error('[Diagnostic] Batch error:', error);
      res.status(500).json({ error: 'Batch diagnostic failed', details: error.message });
    }
  });

  app.post('/api/diagnostic/audit-scored', async (req, res) => {
    try {
      const { queries, exportCsv = false } = req.body;
      
      if (!queries || !Array.isArray(queries) || queries.length === 0) {
        return res.status(400).json({ error: 'queries array is required' });
      }
      
      if (queries.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 queries allowed per audit' });
      }
      
      const validQueries = queries.filter((q: any) => typeof q === 'string' && q.trim().length > 0);
      if (validQueries.length === 0) {
        return res.status(400).json({ error: 'At least one valid query string is required' });
      }
      
      const { auditQueryWithScoring, generateCSV } = await import('../services/relevance-scorer');
      
      const auditResults: any[] = [];
      const startTime = Date.now();
      
      for (const query of validQueries) {
        const queryStartTime = Date.now();
        const queryLower = (query || '').toLowerCase().trim();
        const searchPattern = `%${queryLower}%`;
        
        const exactMovieKeywords = ['movies', 'movie', 'cinema', 'films', 'film'];
        const cinemaIntentPhrases = ['whats on', "what's on", 'now showing', 'at the cinema'];
        const isCinemaIntent = exactMovieKeywords.includes(queryLower) || 
                               cinemaIntentPhrases.some(p => queryLower.includes(p));
        
        if (isCinemaIntent) {
          auditResults.push({
            query,
            verdict: 'CINEMA_INTENT',
            dbCount: 0,
            resultCount: 0,
            avgScore: '0.00',
            relevancePercent: 0,
            flaggedCount: 0,
            timeMs: Date.now() - queryStartTime,
            results: [],
            fixAction: 'Routes to TMDB movies - not a product search'
          });
          continue;
        }
        
        let dbCount = 0;
        try {
          const dbCheck = await db.execute(sql`
            SELECT COUNT(*) as total FROM products 
            WHERE LOWER(name) LIKE ${searchPattern} 
               OR LOWER(brand) LIKE ${searchPattern}
          `);
          dbCount = parseInt((dbCheck[0] as any)?.total || '0');
        } catch (e) {
          console.error(`[Audit Scored] DB count error for "${query}":`, e);
        }
        
        let searchResults: any[] = [];
        try {
          const protocol = req.protocol || 'http';
          const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
          const baseUrl = `${protocol}://${host}`;
          
          const response = await fetch(`${baseUrl}/api/shop/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 8 })
          });
          const searchApiResponse = await response.json();
          searchResults = searchApiResponse?.products || [];
        } catch (fetchError: any) {
          console.error(`[Audit Scored] Search API error for "${query}":`, fetchError.message);
        }
        
        const responseTime = Date.now() - queryStartTime;
        
        console.log(`[Audit Scored] Scoring "${query}" (${searchResults.length} results)...`);
        const auditResult = await auditQueryWithScoring(query, searchResults, dbCount, responseTime);
        auditResults.push(auditResult);
      }
      
      const summary = {
        totalQueries: auditResults.length,
        passed: auditResults.filter(r => r.verdict === 'PASS').length,
        failed: auditResults.filter(r => r.verdict === 'FAIL').length,
        cinemaIntents: auditResults.filter(r => r.verdict === 'CINEMA_INTENT').length,
        noResults: auditResults.filter(r => r.verdict === 'NO_RESULTS').length,
        weakRelevance: auditResults.filter(r => r.verdict === 'WEAK_RELEVANCE').length,
        errors: auditResults.filter(r => r.verdict === 'ERROR').length,
        avgRelevanceScore: 0,
        overallRelevancePercent: 0,
        totalTimeMs: Date.now() - startTime
      };
      
      const scoredQueries = auditResults.filter(r => parseFloat(r.avgScore) > 0);
      if (scoredQueries.length > 0) {
        summary.avgRelevanceScore = parseFloat(
          (scoredQueries.reduce((sum, r) => sum + parseFloat(r.avgScore), 0) / scoredQueries.length).toFixed(2)
        );
        summary.overallRelevancePercent = Math.round((summary.avgRelevanceScore / 5) * 100);
      }
      
      if (exportCsv) {
        const csvContent = generateCSV(auditResults);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sunny-audit-scored.csv');
        return res.send(csvContent);
      }
      
      res.json({ summary, results: auditResults });
    } catch (error: any) {
      console.error('[Audit Scored] Error:', error);
      res.status(500).json({ error: 'AI-scored audit failed', details: error.message });
    }
  });

  app.post('/api/diagnostic/check-images', async (req, res) => {
    try {
      const { productIds } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: 'productIds array is required' });
      }
      
      const prods = await db.select({
        id: products.id,
        name: products.name,
        imageUrl: products.imageUrl,
        merchant: products.merchant
      }).from(products)
        .where(inArray(products.id, productIds.slice(0, 10)));
      
      const results = [];
      
      for (const prod of prods) {
        let imageStatus = 'unknown';
        let redirectsTo = null;
        
        if (!prod.imageUrl || prod.imageUrl.trim() === '') {
          imageStatus = 'missing_in_db';
        } else {
          try {
            const response = await fetch(prod.imageUrl, { 
              method: 'HEAD',
              redirect: 'manual'
            });
            
            if (response.status === 200) {
              imageStatus = 'working';
            } else if (response.status === 302 || response.status === 301) {
              const location = response.headers.get('location');
              if (location?.includes('noimage') || location?.includes('placeholder')) {
                imageStatus = 'broken_at_source';
                redirectsTo = location;
              } else {
                imageStatus = 'redirected';
                redirectsTo = location;
              }
            } else {
              imageStatus = `error_${response.status}`;
            }
          } catch (err) {
            imageStatus = 'fetch_error';
          }
        }
        
        results.push({
          id: prod.id,
          name: (prod.name || '').substring(0, 50),
          merchant: prod.merchant,
          imageUrl: prod.imageUrl?.substring(0, 80) + '...',
          imageStatus,
          redirectsTo
        });
      }
      
      const summary = {
        total: results.length,
        working: results.filter(r => r.imageStatus === 'working').length,
        brokenAtSource: results.filter(r => r.imageStatus === 'broken_at_source').length,
        missingInDb: results.filter(r => r.imageStatus === 'missing_in_db').length,
        other: results.filter(r => !['working', 'broken_at_source', 'missing_in_db'].includes(r.imageStatus)).length
      };
      
      res.json({ summary, results });
    } catch (error: any) {
      console.error('[Diagnostic] Check images error:', error);
      res.status(500).json({ error: 'Image check failed', details: error.message });
    }
  });

  app.post('/api/diagnostic/validate-search-images', async (req, res) => {
    try {
      const { query, limit = 5 } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'query is required' });
      }
      
      const queryWords = query.toLowerCase().split(' ').filter((w: string) => w.length > 2);
      const likeConditions = queryWords.map((w: string) => `LOWER(name) LIKE '%${w}%'`).join(' AND ');
      
      const prods = await db.execute(sql.raw(`
        SELECT id, name, image_url, merchant, price
        FROM products
        WHERE ${likeConditions || '1=1'}
        ORDER BY RANDOM()
        LIMIT ${Math.min(limit, 10)}
      `)) as any[];
      
      const results = [];
      
      for (const prod of prods) {
        let imageStatus = 'unknown';
        
        if (!prod.image_url || prod.image_url.trim() === '') {
          imageStatus = 'missing_in_db';
        } else {
          try {
            const response = await fetch(prod.image_url, { 
              method: 'HEAD',
              redirect: 'manual',
              signal: AbortSignal.timeout(3000)
            });
            
            if (response.status === 200) {
              imageStatus = 'working';
            } else if (response.status === 302 || response.status === 301) {
              const location = response.headers.get('location');
              imageStatus = location?.includes('noimage') ? 'broken_at_source' : 'redirected';
            } else {
              imageStatus = `error_${response.status}`;
            }
          } catch (err) {
            imageStatus = 'timeout_or_error';
          }
        }
        
        results.push({
          id: prod.id,
          name: (prod.name || '').substring(0, 60),
          merchant: prod.merchant,
          price: prod.price,
          imageStatus
        });
      }
      
      res.json({
        query,
        checked: results.length,
        working: results.filter(r => r.imageStatus === 'working').length,
        broken: results.filter(r => r.imageStatus !== 'working').length,
        results
      });
    } catch (error: any) {
      console.error('[Diagnostic] Validate search images error:', error);
      res.status(500).json({ error: 'Validation failed', details: error.message });
    }
  });

  app.get('/api/diagnostic/image-stats', async (req, res) => {
    try {
      const stats = await db.execute(sql.raw(`
        SELECT 
          merchant,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE image_status = 'valid') as valid_images,
          COUNT(*) FILTER (WHERE image_status = 'broken') as broken_images,
          COUNT(*) FILTER (WHERE image_status IS NULL OR image_status = 'unknown') as unknown_status
        FROM products
        WHERE image_url IS NOT NULL AND image_url != ''
        GROUP BY merchant
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `)) as any[];
      
      const totals = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(*) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as with_images,
          COUNT(*) FILTER (WHERE image_status = 'valid') as valid_images,
          COUNT(*) FILTER (WHERE image_status = 'broken') as broken_images,
          COUNT(*) FILTER (WHERE image_status IS NULL OR image_status = 'unknown') as pending_validation
        FROM products
      `)) as any[];
      
      res.json({
        totals: totals[0],
        byMerchant: stats
      });
    } catch (error: any) {
      console.error('[Diagnostic] Image stats error:', error);
      res.status(500).json({ error: 'Stats failed', details: error.message });
    }
  });
}
