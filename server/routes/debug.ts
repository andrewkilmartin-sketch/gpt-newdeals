import { Express } from 'express';
import { getAllActivePromotions } from '../services/awin';

export function registerDebugRoutes(app: Express): void {
  app.get("/api/debug/openai-check", async (req, res) => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      const hasKey = !!openaiKey;
      const keyPrefix = openaiKey ? openaiKey.substring(0, 10) + '...' : 'NOT SET';
      
      if (!openaiKey) {
        return res.json({
          success: false,
          error: "OPENAI_API_KEY not set",
          hasKey: false,
          environment: process.env.NODE_ENV
        });
      }
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: openaiKey });
      
      const testResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 50,
        messages: [
          { role: 'user', content: 'Reply with exactly: "OpenAI working"' }
        ]
      });
      
      const reply = testResponse.choices[0]?.message?.content || '';
      
      res.json({
        success: true,
        hasKey: hasKey,
        keyPrefix: keyPrefix,
        environment: process.env.NODE_ENV,
        testReply: reply,
        model: 'gpt-4o-mini',
        status: reply.toLowerCase().includes('working') ? 'OPERATIONAL' : 'UNEXPECTED_RESPONSE'
      });
    } catch (error) {
      const err = error as Error;
      res.json({
        success: false,
        error: err.message,
        hasKey: !!process.env.OPENAI_API_KEY,
        environment: process.env.NODE_ENV
      });
    }
  });

  app.get("/api/debug/db-check", async (req, res) => {
    try {
      const hasDbUrl = !!process.env.DATABASE_URL;
      const nodeEnv = process.env.NODE_ENV;
      
      if (!hasDbUrl) {
        return res.json({
          success: false,
          error: "DATABASE_URL not set",
          environment: nodeEnv
        });
      }
      
      const { db } = await import('../db');
      const { products } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const result = await db.select({ count: sql<number>`count(*)` }).from(products);
      const count = Number(result[0]?.count || 0);
      
      res.json({
        success: true,
        productCount: count,
        environment: nodeEnv,
        hasDbUrl: hasDbUrl
      });
    } catch (error) {
      const err = error as Error;
      res.json({
        success: false,
        error: err.message,
        stack: err.stack?.split('\n').slice(0, 5),
        environment: process.env.NODE_ENV
      });
    }
  });

  app.get("/api/debug/promotions-stats", async (req, res) => {
    try {
      const activePromotions = await getAllActivePromotions();
      const { db } = await import('../db');
      const { products } = await import('@shared/schema');
      const { sql, countDistinct } = await import('drizzle-orm');
      
      const merchantCountResult = await db.select({ count: countDistinct(products.merchant) }).from(products);
      const uniqueMerchantCount = Number(merchantCountResult[0]?.count || 0);
      
      const promoMerchants = Array.from(activePromotions.keys());
      const matchingMerchants: string[] = [];
      let productsWithPromos = 0;
      
      for (const promoMerchant of promoMerchants.slice(0, 50)) {
        const countResult = await db.select({ count: sql<number>`count(*)` })
          .from(products)
          .where(sql`LOWER(merchant) LIKE ${`%${promoMerchant}%`}`);
        const cnt = Number(countResult[0]?.count || 0);
        if (cnt > 0) {
          matchingMerchants.push(promoMerchant);
          productsWithPromos += cnt;
        }
      }
      
      const allPromos = Array.from(activePromotions.values()).flat();
      const awinCount = allPromos.filter(p => p.source === 'awin' || !p.source).length;
      const cjCount = allPromos.filter(p => p.source === 'cj').length;
      
      res.json({
        success: true,
        totalPromotions: allPromos.length,
        bySource: {
          awin: awinCount,
          cj: cjCount
        },
        uniqueMerchantsWithPromos: promoMerchants.length,
        uniqueMerchantsInProducts: uniqueMerchantCount,
        matchingMerchants: matchingMerchants.length,
        estimatedProductsWithPromos: productsWithPromos,
        samplePromoMerchants: promoMerchants.slice(0, 15),
        sampleMatchingMerchants: matchingMerchants.slice(0, 10)
      });
    } catch (error) {
      const err = error as Error;
      res.json({ success: false, error: err.message, stack: err.stack?.split('\n').slice(0,3) });
    }
  });
  
  app.get("/api/debug/cj-promotions", async (req, res) => {
    try {
      const { fetchCJPromotions, getAllCJActivePromotions, isCJPromotionsConfigured } = await import('../services/cj');
      
      if (!isCJPromotionsConfigured()) {
        return res.json({
          success: false,
          error: 'CJ Promotions API not configured - requires CJ_API_TOKEN and CJ_WEBSITE_ID secrets',
          note: 'CJ_WEBSITE_ID is different from CJ_PUBLISHER_ID. Find it in CJ Account Manager under your website settings.'
        });
      }
      
      const promotions = await fetchCJPromotions();
      const allActive = await getAllCJActivePromotions();
      
      const withVouchers = promotions.filter(p => p.couponCode);
      
      res.json({
        success: true,
        totalPromotions: promotions.length,
        withVoucherCodes: withVouchers.length,
        uniqueMerchants: allActive.size,
        samplePromotions: promotions.slice(0, 10).map(p => ({
          advertiser: p.advertiserName,
          title: p.linkName,
          type: p.promotionType,
          code: p.couponCode,
          endDate: p.endDate
        })),
        sampleMerchants: Array.from(allActive.keys()).slice(0, 15)
      });
    } catch (error) {
      const err = error as Error;
      res.json({ success: false, error: err.message, stack: err.stack?.split('\n').slice(0,3) });
    }
  });

  app.get("/api/debug/bootstrap-status", async (req, res) => {
    try {
      const { getBootstrapStatus, triggerManualBootstrap } = await import('../boot/productBootstrap');
      const status = getBootstrapStatus();
      
      const { db } = await import('../db');
      const { productsV2 } = await import('@shared/schema');
      const { sql } = await import('drizzle-orm');
      
      const result = await db.select({ count: sql<number>`count(*)::int` }).from(productsV2).limit(1);
      const v2Count = result[0]?.count || 0;
      
      res.json({
        success: true,
        bootstrap: status,
        productsV2Count: v2Count,
        environment: process.env.NODE_ENV
      });
    } catch (error) {
      const err = error as Error;
      res.json({
        success: false,
        error: err.message,
        environment: process.env.NODE_ENV
      });
    }
  });
}
