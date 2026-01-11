import { Express } from 'express';

export function registerCJRoutes(app: Express): void {
  app.get("/api/cj/test", async (req, res) => {
    try {
      const { testCJConnection, isCJConfigured } = await import('../services/cj');
      
      if (!isCJConfigured()) {
        return res.json({
          success: false,
          configured: false,
          message: "CJ API not configured. Please set CJ_API_TOKEN and CJ_PUBLISHER_ID secrets."
        });
      }
      
      const result = await testCJConnection();
      res.json({
        ...result,
        configured: true
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  app.post("/api/cj/search", async (req, res) => {
    try {
      const { searchCJProducts, isCJConfigured } = await import('../services/cj');
      const { keywords, limit = 20 } = req.body;
      
      if (!keywords) {
        return res.status(400).json({ error: "keywords parameter required" });
      }
      
      if (!isCJConfigured()) {
        return res.status(400).json({
          success: false,
          error: "CJ API not configured"
        });
      }
      
      const result = await searchCJProducts(keywords, Math.min(limit, 100));
      res.json({
        success: true,
        query: keywords,
        totalCount: result.totalCount,
        count: result.products.length,
        products: result.products
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  app.post("/api/cj/import", async (req, res) => {
    try {
      const { importCJProductsToDatabase, isCJConfigured } = await import('../services/cj');
      const { keywords, limit = 100 } = req.body;
      
      if (!keywords) {
        return res.status(400).json({ error: "keywords parameter required" });
      }
      
      if (!isCJConfigured()) {
        return res.status(400).json({
          success: false,
          error: "CJ API not configured"
        });
      }
      
      console.log(`[CJ Import] Starting import for "${keywords}" (limit: ${limit})`);
      const result = await importCJProductsToDatabase(keywords, Math.min(limit, 500));
      
      res.json({
        success: true,
        query: keywords,
        ...result,
        message: `Imported ${result.imported} products from CJ for "${keywords}"`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  app.post("/api/cj/import-priority-brands", async (req, res) => {
    try {
      const { importPriorityBrands, isCJConfigured, PRIORITY_BRANDS } = await import('../services/cj');
      const { limit = 100 } = req.body;
      
      if (!isCJConfigured()) {
        return res.status(400).json({
          success: false,
          error: "CJ API not configured"
        });
      }
      
      console.log(`[CJ Import] Starting priority brands import (${limit} per brand)...`);
      const result = await importPriorityBrands(Math.min(limit, 500));
      
      res.json({
        success: true,
        message: `Imported ${result.total} products from ${PRIORITY_BRANDS.length} priority brands`,
        ...result,
        brands: PRIORITY_BRANDS
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  app.post("/api/cj/backfill-brands", async (req, res) => {
    try {
      const { backfillCJBrands } = await import('../services/cj');
      
      console.log(`[CJ Backfill] Starting brand backfill for existing CJ products...`);
      const result = await backfillCJBrands();
      
      res.json({
        success: true,
        message: `Updated ${result.updated} CJ products with proper brands`,
        ...result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  app.get("/api/cj/stats", async (req, res) => {
    try {
      const { getCJStats } = await import('../services/cj');
      const stats = await getCJStats();
      
      res.json({
        success: true,
        totalAvailable: stats.totalAvailable,
        currentImported: stats.currentImported,
        advertisers: stats.advertisers,
        message: `${stats.currentImported} imported of ${stats.totalAvailable.toLocaleString()} available`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  app.post("/api/cj/bulk-import", async (req, res) => {
    try {
      const { bulkImportCJProducts, BULK_IMPORT_CATEGORIES } = await import('../services/cj');
      const { limitPerCategory = 5000, categories } = req.body || {};
      
      console.log(`[CJ Bulk] Starting bulk import (${limitPerCategory} per category)`);
      
      res.json({
        success: true,
        status: 'started',
        message: `Bulk import started for ${categories?.length || BULK_IMPORT_CATEGORIES.length} categories`,
        categories: categories || BULK_IMPORT_CATEGORIES,
        limitPerCategory
      });
      
      bulkImportCJProducts(limitPerCategory, categories).then(result => {
        console.log(`[CJ Bulk] Complete: ${result.total} products in ${result.duration}s`);
      }).catch(error => {
        console.error('[CJ Bulk] Error:', error);
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  app.post("/api/cj/bulk-import-sync", async (req, res) => {
    try {
      const { bulkImportCJProducts, BULK_IMPORT_CATEGORIES } = await import('../services/cj');
      const { limitPerCategory = 500, categories } = req.body || {};
      
      console.log(`[CJ Bulk Sync] Starting synchronous bulk import`);
      const result = await bulkImportCJProducts(limitPerCategory, categories);
      
      res.json({
        success: true,
        message: `Imported ${result.total} products in ${result.duration}s`,
        ...result,
        categories: categories || BULK_IMPORT_CATEGORIES
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/cj/mass-import", async (req, res) => {
    try {
      const { massImportCJ } = await import('../services/cj');
      const { targetProducts = 1000000 } = req.body || {};
      
      console.log(`[CJ Mass Import] Starting mass import - target: ${targetProducts}`);
      
      res.json({
        success: true,
        status: 'started',
        message: `Mass import started - targeting ${targetProducts} products`,
        targetProducts
      });
      
      massImportCJ(targetProducts).then(result => {
        console.log(`[CJ Mass Import] Complete: ${result.total} products imported`);
      }).catch(err => {
        console.error(`[CJ Mass Import] Failed:`, err);
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/cj/import-chunk", async (req, res) => {
    try {
      const { importCJChunk } = await import('../services/cj');
      const { maxCalls = 20 } = req.body || {};
      
      const result = await importCJChunk(maxCalls);
      
      res.json({
        success: true,
        ...result,
        message: result.done 
          ? `Import complete! ${result.totalImported} total products`
          : `Chunk imported: +${result.imported}, total: ${result.totalImported}, next: ${result.keyword}@${result.offset}`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.get("/api/cj/import-status", async (req, res) => {
    try {
      const { getCJImportStatus } = await import('../services/cj');
      const status = await getCJImportStatus();
      
      res.json({
        success: true,
        status: status || { keyword: 'not started', offset: 0, totalImported: 0 }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post("/api/cj/import-reset", async (req, res) => {
    try {
      const { resetCJImportState } = await import('../services/cj');
      await resetCJImportState();
      
      res.json({
        success: true,
        message: 'Import state reset. Ready to start fresh.'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
}
