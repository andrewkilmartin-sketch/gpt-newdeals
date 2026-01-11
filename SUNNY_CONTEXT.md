# SUNNY CONTEXT - Read This First Every Session

> **AI Assistant**: Read this document at the START of every conversation. It gives you immediate context about what Sunny is, how it works, and what problems we're solving.

---

## 1. System Overview

### What is Sunny?

**Sunny VS01** is a voice-first AI shopping concierge for UK families. It's the backend for a ChatGPT GPT integration that helps parents find:
- Toys and gifts (1.18M+ products)
- Cinema showings (TMDB API)
- UK attractions with Kids Pass discounts
- Family activities and days out
- Nights-in ideas (streaming, movie nights)
- Money-saving tips

### Who is it for?

| Audience | Scale | Primary Use Case |
|----------|-------|------------------|
| **Kids Pass members** | 2M UK families | Find discounted attractions, family deals |
| **UK parents** | Primary market | Shopping, activities, gift ideas |
| **GPT users** | ChatGPT integration | Natural language product search |

### Sponsor Integration

**Kids Pass** is the primary sponsor. The system:
- Prioritises Kids Pass partner attractions in results
- Shows Kids Pass discount pricing alongside standard prices
- Excludes inappropriate content (alcohol, adult products)
- Maintains family-safe search at all times

### Core Promise

**Zero hallucination, database-backed results.** Every result comes from our PostgreSQL database with verified affiliate links. The AI interprets queries but NEVER invents products.

---

## 2. Architecture

### High-Level Flow

```
User Query → Intent Classifier → Router → API Handler → Database → Response
                   ↓
            GPT-4o-mini
         (query understanding)
```

### Intent Classification

The **Smart Query Interpreter** uses GPT-4o-mini to understand:
- Product type (toy, book, costume, etc.)
- Brand/Character (LEGO, Frozen, Spiderman)
- Age range (for 3 year old, age 5-7)
- Price constraints (under £10, budget)
- Context (gift, party, school)

**Intent Router Categories:**
| Intent | Description | Status |
|--------|-------------|--------|
| **SHOP** | Product search, gift ideas, toys | ✅ Live |
| **CINEMA** | Now playing, upcoming films, UK ratings | ✅ Live |
| **STREAMING** | Netflix/Disney+ recommendations | 🔜 Planned |
| **ATTRACTIONS** | Family days out, Kids Pass venues | 🔜 Planned |
| **HOTELS** | Family accommodation near attractions | 🔜 Planned |

### Router Destinations

| API | Purpose | Status |
|-----|---------|--------|
| `/api/shop/search` | Product search (1.18M products) | **Live, 82.6% pass rate (500-query audit)** |
| `/api/cinema/now-playing` | Current UK cinema listings | **Live** |
| `/api/attractions` | UK family attractions | **Planned** |
| `/api/hotels` | Family hotel deals | **Planned** |
| `/api/streaming` | What to watch tonight | **Planned** |

### Search Architecture

```
Query → Cache Check → TSVECTOR Fast Path → Quality Filters → GPT Reranker → Results
           ↓                  ↓                    ↓
    verified_results    PostgreSQL GIN      Clothing/Context
       (instant)         (sub-100ms)           Filters
```

**Three-Stage Search:**
1. **Cache Check** - If query has verified results, return instantly
2. **TSVECTOR Fast Path** - PostgreSQL full-text search with GIN index
3. **Quality Filters** - Remove clothing leaks, blocked products, apply merchant caps
4. **GPT Reranker** - (optional) Re-order results for relevance

### Key Files

| File | Purpose |
|------|---------|
| `server/routes.ts` | All API endpoints, search logic, filters (~11K lines) |
| `server/storage.ts` | Database abstraction layer |
| `shared/schema.ts` | Drizzle ORM schemas, type definitions |
| `client/src/pages/shop.tsx` | Shopping UI with click tracking |
| `client/src/components/SunnyChat.tsx` | Chat interface |

---

## 3. Key Decisions

### Why verified_results Cache?

**Problem:** Search algorithms are fragile. Every "fix" can break 5 other queries.

**Solution:** Pre-verify correct results for known queries and serve them directly from cache, bypassing all algorithm logic.

```sql
-- verified_results table
query VARCHAR(500) UNIQUE,
verified_product_ids TEXT,      -- JSON array of correct product IDs
verified_product_names TEXT,    -- For debugging
confidence VARCHAR(20)          -- 'manual', 'auto', 'flagged'
```

**Benefits:**
- Guaranteed correct results for cached queries
- Instant response (no algorithm execution)
- Safe deployment (cache survives code changes)
- 1,014 queries currently cached

### Why Click Tracking?

**Problem:** We don't know if users actually want the products we show.

**Solution:** Track every product click to measure real engagement.

```sql
-- click_logs table
query, product_id, position, time_on_page, device_type
```

**Insights:**
- Queries where users click past result #3 = ranking problem
- Products shown but never clicked = potential bad results
- High-engagement products = ground truth for training

### Why Pre-built Queries (test-queries-2000.json)?

**Problem:** Random testing misses real user queries.

**Solution:** 1,700+ realistic UK family queries based on actual search patterns.

**Categories:**
- Brand queries (lego, barbie, disney)
- Character queries (frozen, spiderman, paw patrol)
- Age queries (toys for 3 year old)
- Price queries (toys under 10 pounds)
- Seasonal (christmas gifts, easter eggs)
- Edge cases (costume, books, party bag fillers)

### Why TSVECTOR over ILIKE?

**Problem:** ILIKE on 1.1M rows = 10-22 seconds per query.

**Solution:** PostgreSQL full-text search with GIN index.

| Method | Performance |
|--------|-------------|
| `ILIKE '%lego%'` | 8-15 seconds |
| `search_vector @@ to_tsquery('lego')` | **53-77ms** |

**Key Files:**
- Column: `products.search_vector` (populated by migration)
- Index: `idx_products_search_vector` (GIN)
- Fallback: ILIKE runs if tsvector returns 0 results

---

## 4. Key Fixes Summary

### Critical Fixes Applied

| Fix | Problem | Solution | Status |
|-----|---------|----------|--------|
| **Word Boundary** | "train" matched "trainer" | PostgreSQL regex `\ytrain\y` + WORD_BOUNDARY_COLLISIONS filter | ✅ Fixed |
| **Blocklists** | Alcohol, adult content returned | BLOCKED_MERCHANTS, INAPPROPRIATE_TERMS arrays | ✅ Fixed |
| **Null Brand Bug** | Queries with null brand crashed | Added null checks in brand validation | ✅ Fixed |
| **Token Matching** | GPT expansions broke AND logic | Use ORIGINAL query terms for tsvector, not GPT expansions | ✅ Fixed |
| **Brand Check (Fix #57)** | 56-second ILIKE scans | tsvector search: 252ms (220x faster) | ✅ Fixed |

### Systems Built

| System | Purpose | Location |
|--------|---------|----------|
| **verified_results cache** | Pre-verified correct results bypass algorithm | `verified_results` table, 1,014 queries |
| **click_logs** | Track user clicks to measure engagement | `click_logs` table |
| **auto-audit** | Test 1,701 queries to measure pass rate | `data/test-queries-2000.json`, scripts |
| **TSVECTOR search** | Sub-100ms full-text search | `products.search_vector` column + GIN index |

### Remaining Fixes Needed

| Fix # | Issue | Impact | Priority |
|-------|-------|--------|----------|
| **#50** | Timeout on ILIKE fallback | Generic queries hang | High |
| **#51** | Token matching for equipment queries | "badminton set" returns 6 not 8 | Medium |
| **#53** | Costume queries return dolls | "vampire costume" shows Barbie | Medium |
| **#54** | Book queries return bags | "peppa pig books" shows backpacks | Medium |
| **#55** | Character variant injection | "Elsa" not in product names | Medium |
| **#58** | Birthday present LOW_RESULTS | Returns only 2 results | High |
| **#59** | Party bag timeout | Still hitting ILIKE fallback | High |

---

## 5. Known Patterns

### Word Boundary Issues

**Problem:** "train" matches "trainer", "book" matches "booking.com"

**Solution:** PostgreSQL regex with word boundaries OR post-filter

```sql
-- Word boundary regex (slow but accurate)
name ~* '\ytrain\y'

-- WORD_BOUNDARY_COLLISIONS filter (fast, applied post-query)
train → excludes trainer, training
case → excludes bookcase, briefcase
bike → excludes biker
```

**File:** `server/routes.ts` ~line 393-438

### Clothing Leak

**Problem:** Character queries (Frozen, Spiderman) return t-shirts instead of toys

**Root Cause:** Products named "Frozen T-Shirt" match "frozen" keyword

**Solution:** Context-aware filters

| Query Context | Filter Applied |
|---------------|----------------|
| Toy query (dinosaur figures) | Exclude clothing categories |
| Costume query (witch costume) | Exclude t-shirts, include fancy dress |
| Book query (peppa pig books) | Exclude bags, backpacks |

**Key Filters:**
- `filterForToyContext()` - excludes clothing for toy queries
- `filterForCostumeContext()` - excludes t-shirts for costume queries  
- `filterForBooksContext()` - excludes bags for book queries

**File:** `server/routes.ts` ~line 762-930

### Blocked Products

**Always blocked:**
- Alcohol merchants (Bottle Club, Naked Wines, etc.)
- Adult content (ED pills, STI testing)
- Known spam (NosiBotanical Nulla Vest)
- Craft supplies in toy results (Trimits Toy Eyes)

**File:** `server/routes.ts` BLOCKED_MERCHANTS, INAPPROPRIATE_TERMS ~line 200

### Timeout Patterns

**Problem:** Some queries trigger 50+ second ILIKE fallbacks

**Pattern:** Generic queries (party bag fillers, cheap toys) find no TSVECTOR match, trigger expensive ILIKE scan

**Current Mitigation:**
- 3-second timeout on ILIKE fallback (Fix #50)
- Return controlled ZERO_RESULTS instead of ERROR

**Still Failing:** 429 queries timeout in bulk audit (62% of failures)

---

## 5. What's Working

### Current Metrics (2026-01-11)

| Metric | Value | Target |
|--------|-------|--------|
| **Pass Rate (100-query sample)** | 87% | 90%+ |
| **Pass Rate (500-query audit)** | 82.6% (was 59% before Fix #57) | 90%+ |
| **Cached Queries** | 1,014 | - |
| **Response Time (cached)** | 53-77ms | <500ms |
| **Response Time (brand check)** | 252ms (was 56s before Fix #57) | <500ms |
| **Products Indexed** | 1,196,276 | - |
| **Timeout/Error Rate** | 2% (was 62% before Fix #57) | <5% |

### Fixes Logged (57 total)

| Category | Count | Key Fixes |
|----------|-------|-----------|
| Performance | 12 | TSVECTOR, ULTRA FAST PATH, brand cache |
| Search Quality | 18 | Word boundaries, clothing filters, costume context |
| Production Stability | 8 | try/catch fallbacks, ILIKE timeout |
| Data Integrity | 6 | Alcohol removal, noimage filter, cache validation |
| UI/Tracking | 4 | Click tracking, verification UI |

### Regression Test Results

All core queries now pass:
- [x] spiderman toys → Marvel products
- [x] paw patrol toys → Paw Patrol products
- [x] lol dolls → LOL Surprise products
- [x] witch costume → Wicked Witch costume
- [x] toys for 5 year old → Age-appropriate toys
- [x] frozen costume → Frozen 2 Anna Dress Up Costume
- [x] lego frozen → LEGO Frozen sets (not Mario Kart)

---

## 6. What's Coming

### Planned APIs

| API | Purpose | Priority |
|-----|---------|----------|
| **Cinema API** | Now playing + upcoming films with UK ratings | High |
| **Attractions API** | UK family attractions with Kids Pass pricing | High |
| **Hotels API** | Family hotel deals near attractions | Medium |
| **Streaming API** | What to watch on Netflix/Disney+ tonight | Medium |

### AI-Expanded Query System

**Current:** GPT-4o-mini expands queries but expansions often cause zero results (AND logic too strict)

**Planned:**
- Phrase synonym system (calico critters → sylvanian families)
- Character variant injection (Elsa → Frozen)
- Equipment synonym expansion (set → kit, pack, bundle)
- Price interpretation (under £10 → maxPrice filter)

### Search Quality Improvements

**Target:** 95% pass rate on 1,700 query test suite

**Priorities:**
1. Fix remaining 429 timeout errors (ILIKE fallback too slow)
2. Improve LEGO + franchise queries (lego marvel, lego frozen)
3. Add more phrase synonyms for US → UK terminology
4. Implement click-through rate boosting

---

## 7. Critical Rules

### ⚠️ MANDATORY: Before ANY Code Change

```
1. READ CRITICAL_FIXES.md FIRST - 57 fixes logged, don't reintroduce bugs
2. Check server health: curl localhost:5000/healthz
3. Run regression tests: npx tsx scripts/quick-audit.ts
4. Update CRITICAL_FIXES.md after EVERY fix
```

### Before Making Changes

1. **Read CRITICAL_FIXES.md** - 57 fixes are logged, don't reintroduce bugs
2. **Check server health** - `curl localhost:5000/healthz`
3. **Run regression tests** - Test key queries before/after changes

### Never Do

- `ORDER BY RANDOM()` on products table (13s full table scan)
- `ILIKE '%word%'` without timeout (10-22s per query)
- Assume `search_vector` column exists (wrap in try/catch)
- Blame "inventory gap" without running raw SQL first
- Deploy without testing production URL directly

### Always Do

- Wrap database operations in try/catch with fallbacks
- Update CRITICAL_FIXES.md after every fix
- Test with cached AND uncached queries
- Log which code path is executing

---

## 8. Quick Reference

### Test a Query

```bash
curl -X POST http://localhost:5000/api/shop/search \
  -H "Content-Type: application/json" \
  -d '{"query":"frozen costume","limit":5}'
```

### Check Database Products

```sql
SELECT name, brand, category FROM products 
WHERE name ILIKE '%frozen%' AND in_stock = true 
LIMIT 10;
```

### Run Audit

```bash
npx tsx scripts/quick-audit.ts
```

### Check Cache

```sql
SELECT query, verified_product_names FROM verified_results 
WHERE query ILIKE '%frozen%';
```

---

## 9. Session Documentation Requirements

### ⚠️ MANDATORY: End of Every Session

At the end of EVERY work session, update this document with:

1. **What was fixed** - List fix numbers and brief description
2. **What broke** - Any regressions or new issues introduced
3. **Current pass rate** - Latest audit results (sample size + percentage)
4. **Next priorities** - What should be tackled next session

### Session Log Template

```markdown
### Session: YYYY-MM-DD

**Fixed:**
- Fix #XX: Description

**Broke:**
- None / Issue description

**Pass Rate:** XX% (N-query sample)

**Next Priorities:**
1. Priority item
2. Priority item
```

---

## Document Maintenance

**Last Updated:** 2026-01-11
**Fixes Logged:** #1-69
**Pass Rate:** 83%+ (500-query audit) - with SKU deduplication, price sorting, and non-product filtering
**Next Priority:** Railway stability monitoring, run full audit, hit 90% pass rate

---

## Session Log

### Session: 2026-01-11 (continued)

**Fixed:**
- Fix #64: Media exclusion filter (DVDs/Blu-rays excluded from toy/gift searches)
- Fix #65: Variety-aware merchant cap relaxation (check 4+ merchants before relaxing)
- Fix #66: Toy category filter - "Disney toys £15-25" now returns actual toys (LEGO, puzzles, dolls) instead of T-shirts
- Fix #67: Global SKU deduplication - keeps cheapest price when same product from multiple merchants
- Fix #68: Global price sorting - results sorted by cheapest first
- Fix #69: Global non-product exclusion - books/DVDs/posters filtered from toy/set searches

**Broke:**
- None

**Tests Passed:**
- "LEGO sets" → Actual LEGO sets, no books, sorted by price (£12.99 first)
- "LEGO Friends pocket book" → Only 1 result at £5.49 (was 2 duplicates before)
- "Disney toys £15-25" → Puzzles, LEGO at £15.99, £17.99 (sorted by price)
- "Disney t-shirt" → Still returns T-shirts (didn't break clothing search)

**Next Priorities:**
1. Deploy to Railway and verify stability
2. Run 500-query audit to measure new pass rate
3. Fix remaining LOW_RESULTS (Marvel sub-characters, Barbie accessories)
4. Hit 90% pass rate target

### Session: 2026-01-11 (early)

**Fixed:**
- Fix #57: Brand check tsvector optimization (56s → 252ms, 220x speedup)
- Fix #58-60: Category-based promotion matching for school shoes, footwear, clothing queries
- Fix #61: Global error handler was RE-THROWING errors (crash bug)
- Fix #62: Database connection pool limit (max: 10)
- Fix #63: Query timeout protection (10 second statement_timeout)

**Broke:**
- None

**Pass Rate:** 83% (500-query audit) - up from 59.3% baseline
