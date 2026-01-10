# SUNNY: DYNAMIC AFFILIATE URL ROUTING
## Enterprise Implementation Guide v1.0
### Author: Technical Architecture Review
### Risk Level: HIGH - Core Revenue Infrastructure
### Estimated Effort: 3-5 days

---

# EXECUTIVE SUMMARY

## What We're Building
A click-time affiliate URL routing system that dynamically selects the best affiliate network (Awin, CJ, or future networks) based on current promotions, replacing static baked-in URLs.

## Why This Matters
- **Revenue Impact**: Ensures every click uses the best available commission/promotion
- **User Trust**: Users always get advertised discounts
- **Scalability**: Add new networks without updating 1.5M product records
- **Analytics**: Full click tracking and conversion attribution

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| Breaking existing links | Parallel running - keep old URLs working |
| Speed regression | Redis caching, sub-50ms target |
| Revenue loss during transition | A/B test with 5% traffic first |
| Database migration issues | Non-destructive - adds tables, doesn't modify products |

---

# PHASE 0: PREPARATION (Do First, Break Nothing)

## 0.1 Create New Tables (Non-Destructive)

```sql
-- Merchant mapping between networks
-- This does NOT touch existing products table
CREATE TABLE merchant_networks (
  id SERIAL PRIMARY KEY,
  merchant_name VARCHAR(255) NOT NULL,
  merchant_slug VARCHAR(100) UNIQUE NOT NULL, -- normalised: "nike-uk"
  
  -- Awin details
  awin_merchant_id VARCHAR(50),
  awin_program_id VARCHAR(50),
  awin_base_url TEXT, -- "https://www.awin1.com/cread.php?awinmid=XXXX&awinaffid=YYYY"
  awin_active BOOLEAN DEFAULT true,
  awin_commission_rate DECIMAL(5,2), -- 5.00 = 5%
  
  -- CJ details  
  cj_advertiser_id VARCHAR(50),
  cj_website_id VARCHAR(50),
  cj_base_url TEXT, -- "https://www.anrdoezrs.net/links/XXXX/type/dlg/"
  cj_active BOOLEAN DEFAULT true,
  cj_commission_rate DECIMAL(5,2),
  
  -- Future networks (Amazon, Rakuten, etc)
  amazon_tag VARCHAR(50),
  rakuten_mid VARCHAR(50),
  
  -- Current winner
  preferred_network VARCHAR(20) DEFAULT 'awin',
  preferred_reason TEXT, -- "CJ has 10% off until 2026-01-31"
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_merchant_networks_slug ON merchant_networks(merchant_slug);
CREATE INDEX idx_merchant_networks_awin ON merchant_networks(awin_merchant_id);
CREATE INDEX idx_merchant_networks_cj ON merchant_networks(cj_advertiser_id);

-- Click tracking (essential for analytics)
CREATE TABLE click_events (
  id SERIAL PRIMARY KEY,
  
  -- What was clicked
  product_id VARCHAR(100),
  merchant_slug VARCHAR(100),
  
  -- Which network won
  network_used VARCHAR(20) NOT NULL, -- 'awin', 'cj', 'amazon'
  promotion_id INTEGER, -- FK to promotions if promo was active
  
  -- User context
  session_id VARCHAR(100),
  user_query TEXT, -- what they searched for
  
  -- Technical
  redirect_url TEXT,
  response_time_ms INTEGER,
  
  -- Timestamp
  clicked_at TIMESTAMP DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX idx_clicks_merchant ON click_events(merchant_slug, clicked_at);
CREATE INDEX idx_clicks_network ON click_events(network_used, clicked_at);
CREATE INDEX idx_clicks_date ON click_events(clicked_at);

-- Promotion to network mapping
-- Links your existing promotions table to networks
CREATE TABLE promotion_network_map (
  id SERIAL PRIMARY KEY,
  promotion_id INTEGER NOT NULL, -- FK to your existing promotions table
  merchant_slug VARCHAR(100) NOT NULL,
  network VARCHAR(20) NOT NULL,
  discount_value DECIMAL(5,2), -- 10.00 = 10% or £10
  discount_type VARCHAR(20), -- 'percentage', 'fixed', 'free_shipping'
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_promo_network_merchant ON promotion_network_map(merchant_slug, valid_until);
```

## 0.2 Add Column to Products (Non-Breaking)

```sql
-- Add merchant_slug to products WITHOUT removing existing URLs
-- This is additive - old URLs still work
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS merchant_slug VARCHAR(100);

-- Index for fast joins
CREATE INDEX IF NOT EXISTS idx_products_merchant_slug ON products(merchant_slug);
```

## 0.3 Populate Merchant Slugs (Background Job)

```javascript
// Run this ONCE to populate merchant_slug from existing data
// Does NOT change any URLs or break anything

async function populateMerchantSlugs() {
  // Get distinct merchants from products
  const merchants = await db.query(`
    SELECT DISTINCT merchant, COUNT(*) as product_count
    FROM products 
    WHERE merchant IS NOT NULL
    GROUP BY merchant
    ORDER BY product_count DESC
  `);
  
  for (const m of merchants) {
    const slug = slugify(m.merchant); // "Nike UK" → "nike-uk"
    
    // Create merchant_networks entry
    await db.query(`
      INSERT INTO merchant_networks (merchant_name, merchant_slug)
      VALUES ($1, $2)
      ON CONFLICT (merchant_slug) DO NOTHING
    `, [m.merchant, slug]);
    
    // Update products with slug
    await db.query(`
      UPDATE products 
      SET merchant_slug = $1
      WHERE merchant = $2 AND merchant_slug IS NULL
    `, [slug, m.merchant]);
    
    console.log(`Updated ${m.product_count} products for ${m.merchant}`);
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

---

# PHASE 1: BUILD REDIRECT SYSTEM (New Code, No Changes to Existing)

## 1.1 The Redirect Endpoint

```javascript
// /server/routes/redirect.js
// This is a NEW file - doesn't touch existing code

import { Router } from 'express';
import { db } from '../db';
import { redis } from '../cache'; // Optional but recommended

const router = Router();

// GET /go/:productId
// The magic happens here
router.get('/go/:productId', async (req, res) => {
  const startTime = Date.now();
  const { productId } = req.params;
  
  try {
    // 1. Get product and merchant info
    const product = await getProductWithMerchant(productId);
    
    if (!product) {
      // Fallback: redirect to homepage or search
      return res.redirect(302, '/shop');
    }
    
    // 2. Determine best network (with caching)
    const bestNetwork = await getBestNetwork(product.merchant_slug);
    
    // 3. Build the affiliate URL
    const affiliateUrl = buildAffiliateUrl(product, bestNetwork);
    
    // 4. Log the click (async - don't wait)
    logClick({
      productId,
      merchantSlug: product.merchant_slug,
      networkUsed: bestNetwork.network,
      promotionId: bestNetwork.promotionId,
      sessionId: req.cookies?.sessionId || req.ip,
      userQuery: req.query.q || null,
      redirectUrl: affiliateUrl,
      responseTimeMs: Date.now() - startTime
    }).catch(console.error); // Don't fail redirect if logging fails
    
    // 5. Redirect
    res.redirect(302, affiliateUrl);
    
  } catch (error) {
    console.error('Redirect error:', error);
    // Fallback: use original product URL if we have it
    const fallback = await getOriginalUrl(productId);
    res.redirect(302, fallback || '/shop');
  }
});

// Also support /go/merchant/productRef format
// Useful when you don't have internal product ID
router.get('/go/:merchantSlug/:productRef', async (req, res) => {
  const { merchantSlug, productRef } = req.params;
  // Similar logic but lookup by merchant + ref
  // ...
});

export default router;
```

## 1.2 Core Functions

```javascript
// /server/services/affiliate-router.js

import { db } from '../db';
import { redis } from '../cache';

// Cache TTL: 5 minutes for network decisions
const CACHE_TTL = 300;

/**
 * Get product with merchant info
 * Uses caching for hot products
 */
export async function getProductWithMerchant(productId) {
  // Try cache first
  const cacheKey = `product:${productId}`;
  const cached = await redis?.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Query database
  const result = await db.query(`
    SELECT 
      p.id,
      p.name,
      p.merchant_slug,
      p.affiliate_link as original_url,
      p.aw_deep_link,
      p.aw_product_id,
      mn.awin_merchant_id,
      mn.awin_base_url,
      mn.cj_advertiser_id,
      mn.cj_base_url,
      mn.preferred_network
    FROM products p
    LEFT JOIN merchant_networks mn ON p.merchant_slug = mn.merchant_slug
    WHERE p.id = $1
  `, [productId]);
  
  const product = result.rows[0];
  
  // Cache for 5 minutes
  if (product && redis) {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(product));
  }
  
  return product;
}

/**
 * Determine best network for a merchant RIGHT NOW
 * Checks active promotions and commission rates
 */
export async function getBestNetwork(merchantSlug) {
  // Try cache first
  const cacheKey = `best-network:${merchantSlug}`;
  const cached = await redis?.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Get merchant network config
  const merchant = await db.query(`
    SELECT * FROM merchant_networks WHERE merchant_slug = $1
  `, [merchantSlug]);
  
  if (!merchant.rows[0]) {
    return { network: 'awin', promotionId: null, reason: 'default' };
  }
  
  const mn = merchant.rows[0];
  
  // Check for active promotions on each network
  const promos = await db.query(`
    SELECT 
      network,
      promotion_id,
      discount_value,
      discount_type
    FROM promotion_network_map
    WHERE merchant_slug = $1
      AND valid_from <= NOW()
      AND valid_until >= NOW()
    ORDER BY discount_value DESC
  `, [merchantSlug]);
  
  let bestNetwork = {
    network: mn.preferred_network || 'awin',
    promotionId: null,
    reason: 'default preference'
  };
  
  // If there's an active promo, that network wins
  if (promos.rows.length > 0) {
    const bestPromo = promos.rows[0]; // Highest discount
    bestNetwork = {
      network: bestPromo.network,
      promotionId: bestPromo.promotion_id,
      reason: `${bestPromo.discount_value}${bestPromo.discount_type === 'percentage' ? '%' : '£'} off`
    };
  }
  
  // Only use network if it's configured and active
  if (bestNetwork.network === 'cj' && (!mn.cj_advertiser_id || !mn.cj_active)) {
    bestNetwork = { network: 'awin', promotionId: null, reason: 'cj not configured' };
  }
  if (bestNetwork.network === 'awin' && (!mn.awin_merchant_id || !mn.awin_active)) {
    bestNetwork = { network: 'cj', promotionId: null, reason: 'awin not configured' };
  }
  
  // Cache decision for 5 minutes
  if (redis) {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(bestNetwork));
  }
  
  return bestNetwork;
}

/**
 * Build the actual affiliate URL
 */
export function buildAffiliateUrl(product, networkDecision) {
  const { network } = networkDecision;
  
  // Get the destination URL (the retailer's product page)
  const destinationUrl = product.original_url || product.aw_deep_link;
  
  if (network === 'awin' && product.awin_base_url) {
    // Awin format: base URL + encoded destination
    return `${product.awin_base_url}&ued=${encodeURIComponent(destinationUrl)}`;
  }
  
  if (network === 'cj' && product.cj_base_url) {
    // CJ format: base URL + destination
    return `${product.cj_base_url}${encodeURIComponent(destinationUrl)}`;
  }
  
  // Fallback: return original URL (still works, just not optimised)
  return destinationUrl;
}

/**
 * Log click event (fire and forget)
 */
export async function logClick(data) {
  await db.query(`
    INSERT INTO click_events (
      product_id, merchant_slug, network_used, promotion_id,
      session_id, user_query, redirect_url, response_time_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    data.productId,
    data.merchantSlug,
    data.networkUsed,
    data.promotionId,
    data.sessionId,
    data.userQuery,
    data.redirectUrl,
    data.responseTimeMs
  ]);
}
```

## 1.3 Performance: Add Redis Caching

```javascript
// /server/cache.js
import Redis from 'ioredis';

let redis = null;

// Only use Redis if available (graceful degradation)
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  redis.on('error', (err) => {
    console.warn('Redis error (falling back to no cache):', err.message);
    redis = null;
  });
} catch (e) {
  console.warn('Redis not available, running without cache');
}

export { redis };
```

---

# PHASE 2: GRADUAL ROLLOUT (Safe Transition)

## 2.1 A/B Test with Feature Flag

```javascript
// In your product card / buy button component
function getBuyUrl(product, userId) {
  // Feature flag: only 5% of users get new system initially
  const useNewRedirect = isFeatureEnabled('dynamic-affiliate-urls', userId, 0.05);
  
  if (useNewRedirect && product.id) {
    return `/go/${product.id}`;
  }
  
  // Old behaviour: direct affiliate URL
  return product.affiliate_link;
}

// Simple feature flag based on user ID hash
function isFeatureEnabled(feature, userId, percentage) {
  const hash = simpleHash(feature + userId);
  return (hash % 100) < (percentage * 100);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

## 2.2 Monitor and Compare

```sql
-- Compare conversion rates between old and new system
-- Run this after 1 week of A/B testing

-- New system clicks
SELECT 
  DATE(clicked_at) as date,
  COUNT(*) as clicks,
  network_used,
  AVG(response_time_ms) as avg_response_ms
FROM click_events
WHERE clicked_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(clicked_at), network_used
ORDER BY date;

-- Compare with your Awin/CJ dashboards for conversion rates
```

## 2.3 Gradual Rollout Schedule

| Day | Traffic % | What to Monitor |
|-----|-----------|-----------------|
| 1-3 | 5% | Response times, error rates |
| 4-7 | 25% | Conversion rates vs control |
| 8-14 | 50% | Revenue comparison |
| 15+ | 100% | Full rollout if metrics good |

---

# PHASE 3: DAILY PROMOTION SYNC

## 3.1 Scheduled Job to Update Network Preferences

```javascript
// /server/jobs/sync-network-promotions.js
// Run daily at 6am via cron

export async function syncNetworkPromotions() {
  console.log('Starting network promotion sync...');
  
  // Get all merchants with multiple networks configured
  const merchants = await db.query(`
    SELECT * FROM merchant_networks
    WHERE (awin_merchant_id IS NOT NULL AND cj_advertiser_id IS NOT NULL)
  `);
  
  for (const merchant of merchants.rows) {
    // Get best active promotion for this merchant
    const bestPromo = await db.query(`
      SELECT network, MAX(discount_value) as best_discount
      FROM promotion_network_map
      WHERE merchant_slug = $1
        AND valid_from <= NOW()
        AND valid_until >= NOW()
      GROUP BY network
      ORDER BY best_discount DESC
      LIMIT 1
    `, [merchant.merchant_slug]);
    
    if (bestPromo.rows.length > 0) {
      // Update preferred network
      await db.query(`
        UPDATE merchant_networks
        SET 
          preferred_network = $1,
          preferred_reason = $2,
          updated_at = NOW()
        WHERE merchant_slug = $3
      `, [
        bestPromo.rows[0].network,
        `Best promo: ${bestPromo.rows[0].best_discount}% off`,
        merchant.merchant_slug
      ]);
      
      console.log(`${merchant.merchant_name}: switched to ${bestPromo.rows[0].network}`);
    }
  }
  
  // Clear cache so new preferences take effect
  await redis?.del('best-network:*');
  
  console.log('Network promotion sync complete');
}
```

## 3.2 Cron Setup

```javascript
// In your main server file or separate worker
import cron from 'node-cron';
import { syncNetworkPromotions } from './jobs/sync-network-promotions';

// Run at 6am every day
cron.schedule('0 6 * * *', () => {
  syncNetworkPromotions().catch(console.error);
});
```

---

# PHASE 4: FRONTEND CHANGES

## 4.1 Update Buy Button (Simple Change)

```javascript
// BEFORE (old way)
<a href={product.affiliate_link} target="_blank">
  Buy Now
</a>

// AFTER (new way)
<a href={`/go/${product.id}`} target="_blank">
  Buy Now
</a>
```

## 4.2 Add Click Tracking Context (Optional Enhancement)

```javascript
// Pass search query for analytics
<a href={`/go/${product.id}?q=${encodeURIComponent(searchQuery)}`} target="_blank">
  Buy Now
</a>
```

---

# TESTING CHECKLIST

## Before Going Live

```bash
# 1. Test redirect speed (must be < 100ms)
curl -w "%{time_total}s" -o /dev/null -s "https://sunny.app/go/TEST_PRODUCT_ID"

# 2. Test fallback when product not found
curl -I "https://sunny.app/go/INVALID_ID"
# Should redirect to /shop, not error

# 3. Test with each network
# Manually set preferred_network for a test merchant, verify correct URL

# 4. Load test
ab -n 1000 -c 50 "https://sunny.app/go/TEST_PRODUCT_ID"
# Should handle 50 concurrent requests without degradation
```

## SQL Verification Queries

```sql
-- Check merchant_networks populated
SELECT COUNT(*), preferred_network FROM merchant_networks GROUP BY preferred_network;

-- Check products have merchant_slug
SELECT COUNT(*) as total, COUNT(merchant_slug) as with_slug FROM products;

-- Check click tracking working
SELECT COUNT(*), DATE(clicked_at) FROM click_events GROUP BY DATE(clicked_at);

-- Check promotion mapping
SELECT COUNT(*) FROM promotion_network_map WHERE valid_until > NOW();
```

---

# ROLLBACK PLAN

If anything goes wrong:

## Instant Rollback (< 1 minute)
```javascript
// In getBuyUrl function, just return old URL
function getBuyUrl(product, userId) {
  // EMERGENCY ROLLBACK - uncomment this line:
  // return product.affiliate_link;
  
  return `/go/${product.id}`;
}
```

## Database Rollback (if needed)
```sql
-- Tables are additive, so just stop using them
-- No need to drop anything
-- Old affiliate_link column still has all original URLs
```

---

# SUCCESS METRICS

After 30 days, measure:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Redirect latency | < 50ms p95 | click_events.response_time_ms |
| Error rate | < 0.1% | Monitor /go/* 5xx responses |
| Click-through rate | No decrease | Compare to previous month |
| Conversion rate | Increase | Awin/CJ dashboards |
| Revenue per click | Increase | Track by network_used |
| Best network switches | N/A | Count preferred_network changes |

---

# FUTURE ENHANCEMENTS

Once stable, consider:

1. **Amazon Integration** - Add Amazon affiliate links for products available there
2. **Real-time Commission Bidding** - Choose network based on current commission rate
3. **User Preference Learning** - Track which networks convert better per user segment
4. **Geographic Routing** - Different networks for UK vs EU users
5. **Conversion Tracking** - Webhook from Awin/CJ to track actual conversions back to clicks

---

# SUMMARY

## What This Does
- Every "Buy Now" click goes through /go/:productId
- System checks which network has best promotion RIGHT NOW
- Builds optimal affiliate URL at click time
- Logs everything for analytics
- Falls back gracefully if anything fails

## What This Doesn't Do
- Doesn't break existing functionality
- Doesn't require updating 1.5M products
- Doesn't slow down the site (< 50ms)
- Doesn't require immediate full rollout

## Implementation Order
1. Create new tables (0 risk)
2. Populate merchant_slug (background, 0 risk)
3. Build /go endpoint (new code, 0 risk)
4. A/B test with 5% traffic
5. Monitor for 1 week
6. Gradual rollout to 100%
7. Add daily promotion sync
8. Enjoy optimised revenue

---

**This is how the big affiliate sites do it. Built properly, it will serve you for years.**
