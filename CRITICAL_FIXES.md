# CRITICAL FIXES - READ BEFORE ANY CHANGES

> **AI ASSISTANT**: Read this file at the start of EVERY session. These are hard-won fixes that took hours to debug. Do NOT revert or change these without explicit user approval.

---

## DATABASE INDEXES - DO NOT REMOVE

These indexes reduce query times from 10-22 seconds to under 500ms.

| Index Name | Table | Purpose | Removal Impact |
|------------|-------|---------|----------------|
| `idx_products_name_trgm` | products_v2 | Fast text search on product names | 22s queries |
| `idx_products_brand_trgm` | products_v2 | Fast brand validation | 5-10s delay |
| `idx_products_category_trgm` | products_v2 | Age-based toy queries | 10x slowdown |

**Creation SQL (run on production if missing):**
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products_v2 USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_brand_trgm ON products_v2 USING gin (lower(brand) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_category_trgm ON products_v2 USING gin (lower(category) gin_trgm_ops);
```

---

## SOLVED BUGS - DO NOT REINTRODUCE

### 1. Substring Matching Disaster (2026-01-10)
| Aspect | Details |
|--------|---------|
| **Problem** | "bike" matched "biker coat", "book" matched "booking.com" |
| **Wrong Approach** | `ILIKE '%word%'` - matches substrings |
| **Correct Fix** | PostgreSQL regex with word boundaries: `~* '\yword\y'` |
| **File** | `server/routes.ts` ~line 2800 (keyword search) |
| **Test Query** | `bike for kids` should NOT return biker jackets |

### 2. Age Query Timeout (2026-01-10)
| Aspect | Details |
|--------|---------|
| **Problem** | "toys for 3 year old" took 10-22 seconds |
| **Wrong Approach** | GPT interpretation + complex OR chains + ORDER BY RANDOM() |
| **Correct Fix** | ULTRA FAST PATH - bypass GPT, simple indexed category filter |
| **File** | `server/routes.ts` ~line 3620-3750 |
| **Test Query** | `toys for 1 year old` should return in <500ms |

### 3. Brand Validation Slowdown (2026-01-09)
| Aspect | Details |
|--------|---------|
| **Problem** | Every brand query hit the database for validation |
| **Wrong Approach** | `SELECT DISTINCT brand FROM products WHERE brand ILIKE...` |
| **Correct Fix** | 300+ known brands in KNOWN_BRANDS array, skip DB validation |
| **File** | `server/routes.ts` KNOWN_BRANDS array ~line 280 |
| **Impact** | Saves 2-5 seconds per query |

### 4. ORDER BY RANDOM() Full Table Scan (2026-01-10)
| Aspect | Details |
|--------|---------|
| **Problem** | Adding variety with ORDER BY RANDOM() caused 13s full table sorts |
| **Wrong Approach** | `ORDER BY RANDOM() LIMIT 50` on 1.1M rows |
| **Correct Fix** | Remove ORDER BY RANDOM(), use deterministic scoring instead |
| **File** | Multiple places in `server/routes.ts` |
| **Never Do** | `ORDER BY RANDOM()` on products table |

### 5. Character Names in Product Names (2026-01-08)
| Aspect | Details |
|--------|---------|
| **Problem** | "Hulk", "Moana", "Encanto" returned 0 results |
| **Wrong Approach** | Only checking `products.brand` column |
| **Correct Fix** | Check BOTH `products.brand` AND `products.name` with `or()` |
| **File** | `server/routes.ts` brand validation logic |
| **Test Query** | `hulk toys` should return 30+ products |

### 6. Age Stopwords Causing 0 Results (2026-01-09)
| Aspect | Details |
|--------|---------|
| **Problem** | "toys for 3 year old" sometimes returned 0 results |
| **Wrong Approach** | Adding "boys", "year", "old" to mustHaveAll filter |
| **Correct Fix** | ageStopWords set skips age/numeric terms in mustHaveAll |
| **File** | `server/routes.ts` ~line 3100 |
| **Pattern** | Skip: year, years, old, age, month, toddler, baby, infant, kid, boy, girl |

### 7. Character Query Returns Wrong Products (2026-01-10)
| Aspect | Details |
|--------|---------|
| **Problem** | "spiderman toys" returned "DOG TOYS SPIDERMAN" (pet product) |
| **Root Cause** | GPT cache had searchTerms: ['toys','games'] but NOT the character |
| **Wrong Approach** | Only adding character to mustHaveAll (post-filter) |
| **Correct Fix** | INJECT character variants into searchTerms for SQL candidate query |
| **File** | `server/routes.ts` ~line 3812-3841 |
| **Test Query** | `spiderman toys` should return Marvel/Disney products |

### 8. Price Filter Ignored in Fallback (2026-01-10)
| Aspect | Details |
|--------|---------|
| **Problem** | "party bag toys under 2" returned £44-66 products |
| **Root Cause** | searchFallbackByCategory didn't pass maxPrice to storage |
| **Wrong Approach** | Passing filters object as 5th argument (ignored) |
| **Correct Fix** | Pass maxPrice as 4th argument to storage.searchProducts |
| **File** | `server/routes.ts` ~line 1367-1380 |
| **Test Query** | `toys under 10` should return products ≤£10 |

### 9. Character Brand Filter Blocks Results (2026-01-10)
| Aspect | Details |
|--------|---------|
| **Problem** | Character queries only matched products with brand="Spiderman" |
| **Root Cause** | GPT sets brand="Spiderman" but real products have brand="Marvel" |
| **Wrong Approach** | Using brand filter for character queries |
| **Correct Fix** | Skip brand filter when brand matches detected character |
| **File** | `server/routes.ts` ~line 4039-4051 |
| **Test Query** | `frozen toys` should return Disney products |

---

## BLOCKED CONTENT - DO NOT UNBLOCK

### Blocked Merchants (Family Platform)
These merchants are permanently blocked for inappropriate content:
```
Bottle Club, Naked Wines, Virgin Wines, Majestic Wine, Beer Hawk,
Laithwaites Wine, The Whisky Exchange, Master of Malt, Drinks Supermarket
```
**File**: `server/routes.ts` BLOCKED_MERCHANTS array

### Blocked Terms
Alcohol, ED pills, STI testing content filtered via INAPPROPRIATE_TERMS array.
**File**: `server/routes.ts` ~line 200

---

## PERFORMANCE TARGETS

| Query Type | Target | Current |
|------------|--------|---------|
| Simple brand query (lego, barbie) | <500ms | 30-200ms |
| Age-based toy query | <500ms | 170-450ms |
| Complex semantic query | <7s | 2-5s |

---

## SESSION START CHECKLIST

Before making changes:
1. Read this file completely
2. Check if proposed change conflicts with any fix above
3. If unsure, ask user before proceeding
4. After fixing any new bug, ADD IT TO THIS FILE

---

*Last updated: 2026-01-10*
