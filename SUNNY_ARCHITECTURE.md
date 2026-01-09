# Sunny Architecture

## Overview
Production-grade product search API for UK family shopping platform ("Sunny VS01"). Backend for a ChatGPT GPT integration serving 1.18M+ products with voice assistant capabilities.

---

## Database (Neon PostgreSQL)

### Core Tables
| Table | Rows | Purpose |
|-------|------|---------|
| `products` | 1.18M+ | Main product catalog (Awin + CJ sources) |
| `movies` | ~500 | TMDB movie cache for cinema/nightin |
| `attractions` | 3,194 | UK attractions with Kids Pass integration |
| `activities` | 500 | Family activity suggestions |
| `cinema_movies` | 20 | Now playing cinema listings |
| `nightin_movies` | 500 | Night-in movie recommendations |
| `upsell_mappings` | - | Genre-to-product keyword mappings |
| `upsell_clicks` | - | Tracking for product recommendations |

### Critical Index
```sql
-- GIN trigram index for fast ILIKE search (reduces 16s to <500ms)
CREATE INDEX idx_products_name_gin ON products USING gin (name gin_trgm_ops);
```

---

## API Endpoints

### Product Search
| Endpoint | Purpose | Speed Target |
|----------|---------|--------------|
| `/api/shop/search?query=X` | Main semantic search | <2s simple, <7s complex |
| `/api/shop/deals?merchant=X` | Deals-only for merchant | <1s |
| `/api/products/count` | Product stats | <100ms |

### Movies & Cinema
| Endpoint | Purpose |
|----------|---------|
| `/api/movies/cinema` | Now playing (TMDB) |
| `/api/mixed/movies` | 6 movies + 2 upsell tiles |

### Diagnostics
| Endpoint | Purpose |
|----------|---------|
| `/api/diagnostic/batch` | Run 33-query test suite |
| `/api/debug/promotions-stats` | Awin + CJ promo counts |
| `/api/debug/cj-promotions` | Test CJ promotions API |
| `/api/debug/search-explain?query=X` | Search timing breakdown |

---

## How Search Works

### Fast Path (30-200ms)
1. Brand-only queries (lego, barbie, disney) bypass GPT entirely
2. Known brand whitelist skips database validation
3. Direct GIN trigram search on `name` column

### Semantic Path (2-7s)
1. GPT-4o-mini interprets query into keywords
2. Multi-word brand filtering (keeps "Paw Patrol", filters generic words)
3. Parallel search across keyword groups
4. GPT reranker selects best matches (uses 60-char descriptions)

### Fallback Behavior
- If OpenAI fails, falls back to basic keyword search
- If no products found, checks for deals-only (promotions without products)

---

## Promotions System (UNIFIED)

### Sources
| Network | API | Secret Required |
|---------|-----|-----------------|
| Awin | REST `/publisher/{id}/promotions` | `AWIN_API_KEY`, `AWIN_PUBLISHER_ID` |
| CJ | REST `/v2/link-search` | `CJ_API_TOKEN`, `CJ_WEBSITE_ID` |

### How It Works
1. Both Awin and CJ promotions cached 30 minutes
2. Indexed by normalized merchant name
3. Attached to products during search
4. Products with promotions sorted higher
5. Deals-only: Show promotions even without products

### Key Functions
```typescript
getPromotionsForMerchant(name)  // Returns Awin + CJ combined
getAllActivePromotions()        // All promos indexed by merchant
```

---

## Product Import

### CSV Requirements
| Column | Required | Notes |
|--------|----------|-------|
| `name` | Yes | Product title |
| `price` | Yes | Numeric |
| `imageUrl` | Yes | Product image |
| `affiliateLink` | Yes | Tracking URL |
| `merchant` | Yes | Retailer name |
| `source` | Recommended | 'awin' or 'cj' |
| `brand` | Recommended | For search filtering |

### ID Strategy
- Awin products: Use original ID
- CJ products: Prefix with `cj_` + advertiser hash + link hash

### Import Scripts
- `/server/scripts/cj-bulk-import.ts` - Bulk CJ import
- `/server/scripts/importBrandAlley.ts` - BrandAlley CSV

---

## Environment Variables

### Required
| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection |
| `OPENAI_API_KEY` | GPT-4o-mini for search interpretation |
| `SESSION_SECRET` | Express session encryption |

### Affiliate Networks
| Secret | Purpose |
|--------|---------|
| `AWIN_API_KEY` | Awin API access |
| `AWIN_PUBLISHER_ID` | Awin publisher account |
| `CJ_API_TOKEN` | CJ API access |
| `CJ_PUBLISHER_ID` | CJ product search |
| `CJ_WEBSITE_ID` | CJ promotions (Link-Search API) |

### Optional
| Secret | Purpose |
|--------|---------|
| `TMDB_API_KEY` | Movie data |

---

## Performance Optimizations

### Database
- GIN trigram index on `products.name`
- Query only indexed columns in search
- Batch product lookups

### Search Speed
| Optimization | Savings |
|--------------|---------|
| Fast-path brand detection | ~7s |
| Known brand whitelist | 2-5s |
| Skip GPT reranker for simple queries | 5-8s |
| Simplified SQL (name-only ILIKE) | 2-3s |

### Caching
- Awin promotions: 30 min
- CJ promotions: 30 min
- TMDB movies: varies

---

## Voice Assistant (VS01)

### Capabilities
- OpenAI TTS (shimmer voice)
- OpenAI STT (Whisper)
- 6-state machine: IDLE, GREETING, LISTENING, PROCESSING, CLARIFYING, SEARCHING

### Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/api/voice/tts` | Text to speech |
| `/api/voice/stt` | Speech to text |
| `/api/voice/parse-intent` | GPT intent parsing |

---

## File Structure

```
server/
  routes.ts          # All API endpoints
  storage.ts         # Database CRUD operations
  db.ts              # Drizzle connection
  services/
    awin.ts          # Awin products + promotions
    cj.ts            # CJ products + promotions
    tmdb.ts          # Movie data
    upsell.ts        # Product recommendations
    embeddings.ts    # Semantic search
  boot/
    productBootstrap.ts  # Startup data loading
  scripts/
    cj-bulk-import.ts    # Import scripts

client/
  src/pages/
    home.tsx         # API documentation
    SunnyChat.tsx    # Chat UI
    test.tsx         # Diagnostic testing

shared/
  schema.ts          # Drizzle schema (products, movies, etc.)
```

---

## Common Issues

### Slow Searches (>10s)
1. Check if query hits fast-path
2. Verify GIN index exists
3. Check GPT reranker usage

### No CJ Promotions
- Ensure `CJ_WEBSITE_ID` is set (different from `CJ_PUBLISHER_ID`)
- Check `/api/debug/cj-promotions` for errors

### Products Not Found
- Run diagnostic: `/api/diagnostic/batch`
- Check if brand/product exists in DB
- Verify search terms aren't over-filtering

---

## Deployment
- GitHub push triggers Railway deployment
- Validate on production with diagnostic endpoints
- Target: <2s response for brand queries
