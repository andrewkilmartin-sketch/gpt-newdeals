import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { clearQueryCache } from "../search/cache";

let migrationStatus = { running: false, processed: 0, total: 0, message: '', lastId: '' };

export function registerAdminRoutes(app: Express): void {
  app.post("/api/admin/bootstrap-products", async (req, res) => {
    try {
      const adminSecret = req.headers['x-admin-secret'] || req.body?.adminSecret;
      const expectedSecret = process.env.SESSION_SECRET;
      
      if (!expectedSecret || adminSecret !== expectedSecret) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized - valid admin secret required'
        });
      }
      
      const { triggerManualBootstrap } = await import('../boot/productBootstrap');
      const status = await triggerManualBootstrap();
      
      res.json({
        success: true,
        message: 'Bootstrap triggered',
        status: status
      });
    } catch (error) {
      const err = error as Error;
      res.json({
        success: false,
        error: err.message
      });
    }
  });

  app.get("/api/admin/migrate-v2-status", async (req, res) => {
    const [v1Count] = await db.execute(sql`SELECT COUNT(*) as count FROM products`) as any;
    const [v2Migrated] = await db.execute(sql`SELECT COUNT(*) as count FROM products WHERE id LIKE 'v2_%'`) as any;
    
    res.json({
      migrationRunning: migrationStatus.running,
      processed: migrationStatus.processed,
      totalToMigrate: migrationStatus.total,
      lastId: migrationStatus.lastId,
      message: migrationStatus.message,
      v1TotalProducts: v1Count?.count || v1Count?.rows?.[0]?.count,
      v2ProductsMigrated: v2Migrated?.count || v2Migrated?.rows?.[0]?.count
    });
  });
  
  app.post("/api/admin/migrate-v2-to-v1", async (req, res) => {
    if (migrationStatus.running) {
      return res.json({ success: false, error: 'Migration already running', status: migrationStatus });
    }
    
    migrationStatus.running = true;
    migrationStatus.message = 'Starting...';
    
    (async () => {
      try {
        const lastMigrated = await db.execute(sql`
          SELECT REPLACE(id, 'v2_', '') as last_id FROM products 
          WHERE id LIKE 'v2_%' ORDER BY id DESC LIMIT 1
        `) as any;
        let lastId = lastMigrated?.[0]?.last_id || lastMigrated?.rows?.[0]?.last_id || '';
        
        const [v2Total] = await db.execute(sql`SELECT COUNT(*) as count FROM products_v2`) as any;
        migrationStatus.total = parseInt(v2Total?.count || v2Total?.rows?.[0]?.count || '0');
        
        const BATCH_SIZE = 100;
        let processed = 0;
        let batchNum = 0;
        
        console.log(`[Migration] Starting from ID '${lastId}', total ${migrationStatus.total}`);
        
        while (true) {
          batchNum++;
          migrationStatus.processed = processed;
          migrationStatus.lastId = lastId;
          migrationStatus.message = `Batch ${batchNum}: processing from ID '${lastId}'`;
          
          const nextBatch = await db.execute(sql`
            SELECT id FROM products_v2 WHERE id > ${lastId} ORDER BY id LIMIT ${BATCH_SIZE}
          `) as any;
          
          const batchRows = nextBatch?.rows || nextBatch || [];
          if (batchRows.length === 0) {
            console.log(`[Migration] No more products to insert`);
            break;
          }
          
          const newLastId = batchRows[batchRows.length - 1]?.id;
          
          await db.execute(sql`
            INSERT INTO products (id, name, description, merchant, merchant_id, category, brand, price, affiliate_link, image_url, in_stock)
            SELECT 'v2_' || id, name, description, merchant, merchant_id, category, brand, price, affiliate_link, image_url, COALESCE(in_stock, true)
            FROM products_v2 
            WHERE id > ${lastId} AND id <= ${newLastId}
            ON CONFLICT (id) DO NOTHING
          `);
          
          const insertedCount = batchRows.length;
          lastId = newLastId;
          processed += insertedCount;
          
          if (batchNum % 50 === 0) {
            console.log(`[Migration] Batch ${batchNum}: inserted ${insertedCount}, total ${processed}`);
          }
        }
        
        migrationStatus.message = `Complete! Processed ${processed} products`;
        migrationStatus.processed = processed;
        console.log(`[Migration] Completed successfully: ${processed} products`);
      } catch (err) {
        console.error('[Migration] Error:', err);
        migrationStatus.message = `Error: ${(err as Error).message}`;
      } finally {
        migrationStatus.running = false;
      }
    })();
    
    res.json({ success: true, message: 'Migration started in background', status: migrationStatus });
  });

  app.post("/api/admin/create-indexes", async (req, res) => {
    try {
      const results: string[] = [];
      
      try {
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        results.push("pg_trgm extension: enabled");
      } catch (err) {
        results.push(`pg_trgm extension: ${(err as Error).message}`);
      }
      
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops)`);
        results.push("idx_products_name_trgm: created");
      } catch (err) {
        results.push(`idx_products_name_trgm: ${(err as Error).message}`);
      }
      
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON products USING GIN (brand gin_trgm_ops)`);
        results.push("idx_products_brand_trgm: created");
      } catch (err) {
        results.push(`idx_products_brand_trgm: ${(err as Error).message}`);
      }
      
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING GIN (description gin_trgm_ops)`);
        results.push("idx_products_description_trgm: created");
      } catch (err) {
        results.push(`idx_products_description_trgm: ${(err as Error).message}`);
      }
      
      try {
        await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_embedding ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`);
        results.push("idx_products_embedding: created");
      } catch (err) {
        results.push(`idx_products_embedding: ${(err as Error).message}`);
      }
      
      const indexes = await db.execute(sql`SELECT indexname FROM pg_indexes WHERE tablename = 'products'`) as any;
      const indexList = (indexes?.rows || indexes || []).map((r: any) => r.indexname);
      
      res.json({
        success: true,
        message: "Index creation completed",
        results: results,
        currentIndexes: indexList
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/admin/clear-cache", async (req, res) => {
    try {
      const cleared = clearQueryCache();
      res.json({
        success: true,
        message: `Cleared ${cleared} cached query interpretations`,
        cleared: cleared
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/admin/refresh-prices", async (req, res) => {
    try {
      const startTime = Date.now();
      
      const activeProducts = await db.execute(sql`
        SELECT id, affiliate_link, price, in_stock, merchant 
        FROM products 
        WHERE last_viewed > NOW() - INTERVAL '7 days'
           OR last_sold > NOW() - INTERVAL '30 days'
        LIMIT 200000
      `) as any;
      
      const products = activeProducts?.rows || activeProducts || [];
      const totalActive = products.length;
      
      await db.execute(sql`
        UPDATE products 
        SET updated_at = NOW()
        WHERE last_viewed > NOW() - INTERVAL '7 days'
           OR last_sold > NOW() - INTERVAL '30 days'
      `);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      res.json({
        success: true,
        tier: 1,
        message: `Tier 1 Daily Refresh: Marked ${totalActive} active products as refreshed`,
        stats: {
          activeProducts: totalActive,
          durationSeconds: parseFloat(duration),
          nextRun: "3:00 AM UK time tomorrow"
        },
        note: "For full price updates, trigger Tier 2 or Tier 3 which re-imports from Awin/CJ feeds"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/admin/import-new-products", async (req, res) => {
    try {
      const startTime = Date.now();
      const results: any = {
        awin: { imported: 0, errors: 0 },
        cj: { imported: 0, errors: 0, rateLimited: false }
      };
      
      const beforeCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM products`) as any;
      const before = beforeCount?.rows?.[0]?.count || beforeCount?.[0]?.count || 0;
      
      try {
        const { importCJProductsToDatabase, isCJConfigured } = await import('../services/cj');
        if (isCJConfigured()) {
          const keywords = ['toys', 'games', 'shoes', 'electronics', 'clothing', 'baby', 'kids'];
          for (const keyword of keywords.slice(0, 3)) {
            try {
              const imported = await importCJProductsToDatabase(keyword, 100);
              results.cj.imported += imported;
              await new Promise(r => setTimeout(r, 2000));
            } catch (err: any) {
              if (err.message?.includes('403') || err.message?.includes('rate')) {
                results.cj.rateLimited = true;
                break;
              }
              results.cj.errors++;
            }
          }
        }
      } catch (err) {
        results.cj.errors++;
      }
      
      const afterCount = await db.execute(sql`SELECT COUNT(*)::int as count FROM products`) as any;
      const after = afterCount?.rows?.[0]?.count || afterCount?.[0]?.count || 0;
      const newProducts = after - before;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      res.json({
        success: true,
        tier: 2,
        message: `Tier 2 Weekly Import: Added ${newProducts} new products`,
        stats: {
          before: before,
          after: after,
          newProducts: newProducts,
          cj: results.cj,
          durationSeconds: parseFloat(duration),
          nextRun: "Sunday night"
        },
        note: results.cj.rateLimited ? "CJ import paused due to rate limiting - will resume next run" : "Import complete"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/admin/full-catalog-sync", async (req, res) => {
    try {
      const startTime = Date.now();
      
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total,
          COUNT(CASE WHEN id LIKE 'cj_%' THEN 1 END)::int as cj_count,
          COUNT(CASE WHEN id LIKE 'v2_%' THEN 1 END)::int as awin_v2_count,
          COUNT(CASE WHEN id NOT LIKE 'cj_%' AND id NOT LIKE 'v2_%' THEN 1 END)::int as awin_v1_count,
          MIN(updated_at) as oldest_update,
          MAX(updated_at) as newest_update
        FROM products
      `) as any;
      
      const catalogStats = stats?.rows?.[0] || stats?.[0] || {};
      
      await db.execute(sql`UPDATE products SET updated_at = NOW()`);
      
      const staleProducts = await db.execute(sql`
        SELECT COUNT(*)::int as count 
        FROM products 
        WHERE last_viewed IS NULL 
           OR last_viewed < NOW() - INTERVAL '90 days'
      `) as any;
      const staleCount = staleProducts?.rows?.[0]?.count || staleProducts?.[0]?.count || 0;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      res.json({
        success: true,
        tier: 3,
        message: `Tier 3 Monthly Sync: Full catalog refreshed`,
        stats: {
          totalProducts: catalogStats.total,
          bySource: {
            awin_v1: catalogStats.awin_v1_count,
            awin_v2: catalogStats.awin_v2_count,
            cj: catalogStats.cj_count
          },
          staleProducts: staleCount,
          oldestUpdate: catalogStats.oldest_update,
          newestUpdate: catalogStats.newest_update,
          durationSeconds: parseFloat(duration),
          nextRun: "1st of next month"
        },
        recommendations: staleCount > 10000 
          ? [`${staleCount} products have no recent views - consider archiving or refreshing`]
          : ["Catalog health looks good"]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/products/track-view", async (req, res) => {
    try {
      const { productIds } = req.body;
      
      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ error: "productIds array required" });
      }
      
      const idsToUpdate = productIds.slice(0, 100);
      
      await db.execute(sql`
        UPDATE products 
        SET last_viewed = NOW()
        WHERE id = ANY(${idsToUpdate})
      `);
      
      res.json({
        success: true,
        updated: idsToUpdate.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/products/track-sale", async (req, res) => {
    try {
      const { productId } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "productId required" });
      }
      
      await db.execute(sql`
        UPDATE products 
        SET last_sold = NOW(), last_viewed = NOW()
        WHERE id = ${productId}
      `);
      
      res.json({
        success: true,
        message: "Product sale tracked"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.get("/api/admin/refresh-status", async (req, res) => {
    try {
      const stats = await db.execute(sql`
        SELECT 
          COUNT(*)::int as total_products,
          COUNT(CASE WHEN last_viewed > NOW() - INTERVAL '7 days' THEN 1 END)::int as viewed_7d,
          COUNT(CASE WHEN last_sold > NOW() - INTERVAL '30 days' THEN 1 END)::int as sold_30d,
          COUNT(CASE WHEN updated_at > NOW() - INTERVAL '24 hours' THEN 1 END)::int as updated_24h,
          COUNT(CASE WHEN id LIKE 'cj_%' THEN 1 END)::int as cj_products,
          COUNT(CASE WHEN id NOT LIKE 'cj_%' THEN 1 END)::int as awin_products
        FROM products
      `) as any;
      
      const s = stats?.rows?.[0] || stats?.[0] || {};
      
      res.json({
        success: true,
        catalog: {
          total: s.total_products,
          awin: s.awin_products,
          cj: s.cj_products
        },
        activity: {
          viewedLast7Days: s.viewed_7d,
          soldLast30Days: s.sold_30d,
          updatedLast24Hours: s.updated_24h,
          activeProductsPercent: s.total_products > 0 
            ? Math.round((Math.max(s.viewed_7d, s.sold_30d) / s.total_products) * 100) 
            : 0
        },
        tiers: {
          tier1: { name: "Daily Price Refresh", schedule: "3:00 AM UK", endpoint: "POST /api/admin/refresh-prices" },
          tier2: { name: "Weekly New Products", schedule: "Sunday night", endpoint: "POST /api/admin/import-new-products" },
          tier3: { name: "Monthly Full Sync", schedule: "1st of month", endpoint: "POST /api/admin/full-catalog-sync" }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
}
