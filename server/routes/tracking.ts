import { Express } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { clickLogs, clickEvents } from '@shared/schema';
import crypto from 'crypto';

// In-memory caches for fast routing decisions
const networkDecisionCache = new Map<string, { network: string; url: string; reason: string; merchantSlug: string; expiry: number }>();
const NETWORK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// PRE-WARMED: Merchant slug → network preference (loaded at startup)
const merchantNetworkCache = new Map<string, { network: string; reason: string; promotionId?: string }>();
let merchantCacheExpiry = 0;
const MERCHANT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// PRE-WARMED: Merchant → alternative network products (top merchants only)
const merchantAlternativesCache = new Map<string, { network: string; affiliateLink: string }[]>();

// Slugify merchant name for routing
function slugifyMerchant(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Pre-warm merchant network preferences (called at startup and every 30 min)
async function warmMerchantNetworkCache(): Promise<void> {
  try {
    const promos = await db.execute(sql.raw(`
      SELECT merchant_slug, network, discount_value, discount_type, promotion_id
      FROM promotion_network_map
      WHERE valid_from <= NOW() AND valid_until >= NOW()
      ORDER BY discount_value DESC
    `)) as any[];
    
    const prefs = await db.execute(sql.raw(`
      SELECT merchant_slug, preferred_network, preferred_reason
      FROM merchant_networks
      WHERE preferred_network IS NOT NULL
    `)) as any[];
    
    merchantNetworkCache.clear();
    
    for (const p of promos) {
      if (!merchantNetworkCache.has(p.merchant_slug)) {
        merchantNetworkCache.set(p.merchant_slug, {
          network: p.network,
          reason: `${p.discount_value}${p.discount_type === 'percentage' ? '%' : '£'} off`,
          promotionId: p.promotion_id
        });
      }
    }
    
    for (const pref of prefs) {
      if (!merchantNetworkCache.has(pref.merchant_slug)) {
        merchantNetworkCache.set(pref.merchant_slug, {
          network: pref.preferred_network,
          reason: pref.preferred_reason || 'preferred'
        });
      }
    }
    
    merchantCacheExpiry = Date.now() + MERCHANT_CACHE_TTL;
    console.log(`[Routing] Pre-warmed ${merchantNetworkCache.size} merchant network preferences`);
  } catch (error) {
    console.error('[Routing] Warm cache error:', error);
  }
}

// Pre-warm alternatives for dual-network merchants
async function warmMerchantAlternatives(): Promise<void> {
  try {
    const dualMerchants = await db.execute(sql.raw(`
      SELECT DISTINCT merchant FROM products
      WHERE source IN ('awin', 'cj')
      GROUP BY merchant
      HAVING COUNT(DISTINCT source) > 1
      LIMIT 50
    `)) as any[];
    
    merchantAlternativesCache.clear();
    
    for (const m of dualMerchants) {
      const alts = await db.execute(sql.raw(`
        SELECT DISTINCT ON (source) source as network, affiliate_link
        FROM products
        WHERE merchant = '${m.merchant.replace(/'/g, "''")}'
        ORDER BY source, id
      `)) as any[];
      
      if (alts.length > 0) {
        merchantAlternativesCache.set(m.merchant, alts.map((a: any) => ({
          network: a.network,
          affiliateLink: a.affiliate_link
        })));
      }
    }
    
    console.log(`[Routing] Pre-warmed alternatives for ${merchantAlternativesCache.size} dual-network merchants`);
  } catch (error) {
    console.error('[Routing] Warm alternatives error:', error);
  }
}

// Get best network for a merchant (instant - uses pre-warmed cache)
function getBestNetworkForMerchant(merchantSlug: string, productSource: string): { network: string; reason: string; promotionId?: string } {
  const cached = merchantNetworkCache.get(merchantSlug);
  if (cached) {
    return cached;
  }
  return { network: productSource, reason: 'default (no preference)' };
}

// Get alternative link from cache (0ms if cached)
function getCachedAlternative(merchant: string, targetNetwork: string): string | null {
  const alts = merchantAlternativesCache.get(merchant);
  if (alts) {
    const alt = alts.find(a => a.network === targetNetwork);
    if (alt) return alt.affiliateLink;
  }
  return null;
}

// A/B Test Configuration
const AB_TEST_PERCENTAGE = 0.10;

function getAbTestVariant(sessionId: string, productId: string): 'new' | 'control' {
  const hash = crypto.createHash('md5')
    .update(sessionId + productId + 'sunny-ab-v1')
    .digest('hex');
  const bucket = parseInt(hash.substring(0, 2), 16);
  return bucket < 26 ? 'new' : 'control';
}

export function registerTrackingRoutes(app: Express): void {
  // Initialize caches on startup
  warmMerchantNetworkCache().catch(err => console.error('[Routing] Initial cache error:', err));

  // API: Get affiliate link with A/B test assignment
  app.get('/api/routing/link/:productId', async (req, res) => {
    const { productId } = req.params;
    const forceNew = req.query.force === 'new';
    const sessionId = (req as any).cookies?.sessionId || req.ip || 'unknown';
    
    try {
      const product = await db.execute(sql.raw(`
        SELECT id, affiliate_link FROM products 
        WHERE id = '${productId.replace(/'/g, "''")}'
        LIMIT 1
      `)) as any[];
      
      if (!product || product.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      const variant = forceNew ? 'new' : getAbTestVariant(sessionId, productId);
      
      if (variant === 'new') {
        res.json({
          link: `/go/${productId}`,
          variant: 'new',
          sessionBucket: sessionId.substring(0, 8),
          description: 'Dynamic routing (A/B test)'
        });
      } else {
        res.json({
          link: product[0].affiliate_link,
          variant: 'control',
          sessionBucket: sessionId.substring(0, 8),
          description: 'Direct affiliate link'
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // /go/:productId - Dynamic affiliate redirect
  app.get('/go/:productId', async (req, res) => {
    const startTime = Date.now();
    const { productId } = req.params;
    const sessionId = (req as any).cookies?.sessionId || req.ip || 'unknown';
    const userQuery = req.query.q as string || null;
    
    try {
      const cacheKey = productId;
      const cached = networkDecisionCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        console.log(`[Routing] CACHE HIT for ${productId}: ${cached.network}`);
        
        db.insert(clickEvents).values({
          productId,
          merchantSlug: cached.merchantSlug || null,
          networkUsed: cached.network,
          sessionId,
          userQuery,
          redirectUrl: cached.url,
          responseTimeMs: Date.now() - startTime
        }).catch(err => console.error('[Routing] Click log error:', err));
        
        return res.redirect(302, cached.url);
      }
      
      const product = await db.execute(sql.raw(`
        SELECT id, name, merchant, affiliate_link, source, merchant_slug
        FROM products 
        WHERE id = '${productId.replace(/'/g, "''")}'
        LIMIT 1
      `)) as any[];
      
      if (!product || product.length === 0) {
        console.log(`[Routing] Product not found: ${productId}`);
        return res.redirect(302, '/shop');
      }
      
      const prod = product[0];
      const merchantSlug = prod.merchant_slug || slugifyMerchant(prod.merchant);
      
      const networkDecision = getBestNetworkForMerchant(merchantSlug, prod.source);
      
      let redirectUrl = prod.affiliate_link;
      let actualNetwork = prod.source;
      
      if (networkDecision.network !== prod.source) {
        const cachedAlt = getCachedAlternative(prod.merchant, networkDecision.network);
        
        if (cachedAlt) {
          redirectUrl = cachedAlt;
          actualNetwork = networkDecision.network;
          console.log(`[Routing] SWITCHED ${prod.source} → ${networkDecision.network} for ${prod.merchant} (cached)`);
        } else {
          try {
            const altProduct = await db.execute(sql.raw(`
              SELECT affiliate_link FROM products 
              WHERE merchant = '${prod.merchant.replace(/'/g, "''")}'
                AND source = '${networkDecision.network}'
              LIMIT 1
            `)) as any[];
            
            if (altProduct && altProduct.length > 0) {
              redirectUrl = altProduct[0].affiliate_link;
              actualNetwork = networkDecision.network;
              console.log(`[Routing] SWITCHED ${prod.source} → ${networkDecision.network} for ${prod.merchant} (db)`);
            } else {
              console.log(`[Routing] No ${networkDecision.network} alt for ${prod.merchant}`);
            }
          } catch (altErr) {
            console.error('[Routing] Alt lookup error:', altErr);
          }
        }
      } else {
        actualNetwork = prod.source;
      }
      
      networkDecisionCache.set(cacheKey, {
        network: actualNetwork,
        merchantSlug,
        url: redirectUrl,
        reason: networkDecision.reason + (actualNetwork !== networkDecision.network ? ' (no alt)' : ''),
        expiry: Date.now() + NETWORK_CACHE_TTL
      });
      
      if (networkDecisionCache.size > 5000) {
        const now = Date.now();
        Array.from(networkDecisionCache.entries()).forEach(([key, value]) => {
          if (value.expiry < now) networkDecisionCache.delete(key);
        });
      }
      
      const responseTime = Date.now() - startTime;
      console.log(`[Routing] ${productId} → ${actualNetwork} (${responseTime}ms): ${networkDecision.reason}`);
      
      db.insert(clickEvents).values({
        productId,
        merchantSlug,
        networkUsed: actualNetwork,
        promotionId: networkDecision.promotionId || null,
        sessionId,
        userQuery,
        redirectUrl,
        responseTimeMs: responseTime
      }).catch(err => console.error('[Routing] Click log error:', err));
      
      res.redirect(302, redirectUrl);
      
    } catch (error: any) {
      console.error('[Routing] Error:', error);
      
      try {
        const fallback = await db.execute(sql.raw(`
          SELECT affiliate_link FROM products WHERE id = '${productId.replace(/'/g, "''")}'
        `)) as any[];
        
        if (fallback && fallback.length > 0) {
          return res.redirect(302, fallback[0].affiliate_link);
        }
      } catch (e) {
        console.error('[Routing] Fallback error:', e);
      }
      
      res.redirect(302, '/shop');
    }
  });
  
  // Routing stats endpoint
  app.get('/api/routing/stats', async (req, res) => {
    try {
      const stats = await db.execute(sql.raw(`
        SELECT 
          network_used,
          COUNT(*) as clicks,
          AVG(response_time_ms) as avg_response_ms,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM click_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY network_used
        ORDER BY clicks DESC
      `));
      
      const total = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT session_id) as unique_sessions,
          AVG(response_time_ms) as avg_response_ms
        FROM click_events
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `));
      
      res.json({
        last24h: (total as any[])[0] || {},
        byNetwork: stats,
        cacheSize: networkDecisionCache.size,
        merchantPreferences: merchantNetworkCache.size,
        alternativesWarmed: merchantAlternativesCache.size
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Debug endpoint for routing decisions
  app.get('/api/routing/debug/:merchantSlug', async (req, res) => {
    const { merchantSlug } = req.params;
    
    const networkPref = merchantNetworkCache.get(merchantSlug);
    const alternatives = merchantAlternativesCache.get(merchantSlug);
    
    res.json({
      merchantSlug,
      hasCachedPreference: !!networkPref,
      preference: networkPref || 'none (will use product source)',
      hasAlternatives: !!alternatives,
      alternatives: alternatives || []
    });
  });
  
  // Admin: Force cache refresh
  app.post('/api/routing/refresh-cache', async (req, res) => {
    try {
      await warmMerchantNetworkCache();
      await warmMerchantAlternatives();
      
      res.json({
        success: true,
        merchantPreferences: merchantNetworkCache.size,
        alternativesWarmed: merchantAlternativesCache.size,
        cacheExpiry: new Date(merchantCacheExpiry).toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: View dual-network merchants
  app.get('/api/routing/dual-merchants', async (req, res) => {
    try {
      const dualMerchants = await db.execute(sql.raw(`
        SELECT 
          merchant,
          COUNT(*) FILTER (WHERE source = 'awin') as awin_count,
          COUNT(*) FILTER (WHERE source = 'cj') as cj_count
        FROM products
        WHERE source IN ('awin', 'cj')
        GROUP BY merchant
        HAVING COUNT(DISTINCT source) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 20
      `));
      
      const samples: any[] = [];
      for (const m of (dualMerchants as any[]).slice(0, 5)) {
        const prods = await db.execute(sql.raw(`
          SELECT id, name, source, price, affiliate_link
          FROM products 
          WHERE merchant = '${m.merchant.replace(/'/g, "''")}'
          LIMIT 2
        `));
        samples.push({
          merchant: m.merchant,
          awinCount: m.awin_count,
          cjCount: m.cj_count,
          products: prods
        });
      }
      
      res.json({
        success: true,
        dualNetworkMerchants: dualMerchants,
        sampleProducts: samples
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Click tracking endpoint
  app.post('/api/track/click', async (req, res) => {
    try {
      const {
        session_id,
        query,
        product_id,
        product_name,
        product_price,
        product_merchant,
        position,
        products_shown_count,
        products_shown_ids,
        time_on_page_ms,
        destination_url,
        device_type
      } = req.body;

      await db.insert(clickLogs).values({
        sessionId: session_id || 'anonymous',
        query: query || '',
        productId: product_id || '',
        productName: product_name || '',
        productPrice: product_price?.toString() || '0',
        productMerchant: product_merchant || '',
        position: position || 0,
        productsShownCount: products_shown_count || 0,
        productsShownIds: JSON.stringify(products_shown_ids || []),
        timeOnPageMs: time_on_page_ms || 0,
        destinationUrl: destination_url || '',
        deviceType: device_type || 'unknown'
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Click Tracking] Error:', error.message);
      res.json({ success: false, error: error.message });
    }
  });

  app.get('/api/track/analysis', async (req, res) => {
    try {
      const rankingIssues = await db.execute(sql.raw(`
        SELECT query, ROUND(AVG(position)::numeric, 1) as avg_click_position, COUNT(*) as click_count
        FROM click_logs
        WHERE position > 2
        GROUP BY query
        HAVING COUNT(*) > 5
        ORDER BY AVG(position) DESC
        LIMIT 50
      `));

      const topChoices = await db.execute(sql.raw(`
        SELECT query, product_name, COUNT(*) as clicks
        FROM click_logs
        GROUP BY query, product_name
        ORDER BY clicks DESC
        LIMIT 100
      `));

      const neverClicked = await db.execute(sql.raw(`
        WITH shown_products AS (
          SELECT query, product_name, COUNT(*) as times_shown
          FROM click_logs
          GROUP BY query, product_name
        ),
        clicked_products AS (
          SELECT DISTINCT query, product_name
          FROM click_logs
          WHERE position IS NOT NULL AND position > 0
        )
        SELECT s.query, s.product_name, s.times_shown
        FROM shown_products s
        LEFT JOIN clicked_products c ON s.query = c.query AND s.product_name = c.product_name
        WHERE c.product_name IS NULL AND s.times_shown >= 5
        ORDER BY s.times_shown DESC
        LIMIT 50
      `));

      const stats = await db.execute(sql.raw(`
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT query) as unique_queries,
          COUNT(DISTINCT session_id) as unique_sessions,
          ROUND(AVG(position)::numeric, 2) as avg_click_position
        FROM click_logs
      `));

      res.json({
        stats: (stats as any[])[0] || {},
        ranking_issues: rankingIssues,
        top_choices: topChoices,
        never_clicked: neverClicked
      });
    } catch (error: any) {
      console.error('[Click Analysis] Error:', error.message);
      res.status(500).json({ error: 'Analysis failed', details: error.message });
    }
  });
}
