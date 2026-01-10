# REPLIT FIX INSTRUCTIONS - PERFORMANCE & REMAINING BUGS
## Read ALL instruction files first!

---

## ⚠️ BEFORE YOU START - MANDATORY READING

**Read these files and tell me what fixes are already logged:**

1. **CRITICAL_FIXES.md** - List the 15 fixes currently logged
2. **REPLIT_FIX_INSTRUCTIONS.md** - Confirm you understand the rules
3. **STOP_BLAMING_INVENTORY.md** - No inventory excuses without SQL proof

---

## FIX #16: GIN Trigram Index for Brand Query Speed

**Problem:** Brand queries (lego, barbie) taking 2-7 seconds. Target is <500ms.

**Root Cause:** ILIKE scans 1.2M rows without index.

**Fix Required:** Create GIN trigram index on products table.

```sql
-- Enable extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram index on product name
CREATE INDEX CONCURRENTLY idx_products_name_trgm 
ON products USING GIN (name gin_trgm_ops);

-- Create GIN trigram index on brand if exists
CREATE INDEX CONCURRENTLY idx_products_brand_trgm 
ON products USING GIN (brand gin_trgm_ops);
```

**Run this on production database.**

**Test After Fix:**
- "lego" query should complete in <500ms
- "barbie" query should complete in <500ms

**Update CRITICAL_FIXES.md with:**
```markdown
### Fix #16 - [DATE]
**Problem:** Brand queries (lego, barbie) taking 2-7 seconds
**Root Cause:** ILIKE full table scan on 1.2M rows
**Solution:** Added GIN trigram indexes on name and brand columns
**SQL:** CREATE INDEX idx_products_name_trgm USING GIN (name gin_trgm_ops)
**Test:** "lego" query < 500ms
**Status:** ✅ Fixed
```

---

## FIX #17: Add More US/UK Phrase Synonyms

**Problem:** US customers search using American brand names.

**Add to PHRASE_SYNONYMS:**

```javascript
// Add these mappings
'play-doh': ['playdough', 'play doh', 'play-doh'],
'color': ['colour'],
'favorite': ['favourite'],
'gray': ['grey'],
'legos': ['lego'],
'diaper': ['nappy'],
'pacifier': ['dummy'],
'stroller': ['pushchair', 'pram'],
'onesie': ['babygrow'],
'sidewalk chalk': ['pavement chalk'],
```

**Update CRITICAL_FIXES.md after adding.**

---

## FIX #18: Speed Bug Investigation

**3 queries still timing out (>10 seconds):**

| Query | Time |
|-------|------|
| peppa pig school | 10,868ms |
| thomas train set | 10,465ms |
| dump truck toy | 10,666ms |

**Debug steps:**

1. Check if these hit the ULTRA FAST PATH or fall through to slow path
2. Add logging to identify which step is slow
3. These may need specific fast-path patterns

**Update CRITICAL_FIXES.md with findings.**

---

## VERIFY AFTER ALL FIXES

**Run these test queries and confirm results:**

| Query | Expected Result | Expected Time |
|-------|-----------------|---------------|
| lego | LEGO products | <500ms |
| barbie | Barbie products | <500ms |
| lol dolls | LOL Surprise | <3s |
| thomas the tank engine | Thomas products | <3s |
| hot wheels cars | Hot Wheels cars | <3s |
| peppa pig school | Peppa Pig products | <3s |

---

## FILES TO UPDATE AFTER FIXES

1. **CRITICAL_FIXES.md** - Add fixes #16, #17, #18
2. **STOP_BLAMING_INVENTORY.md** - Add any new inventory mistakes if they occur
3. **Run regression tests** - Confirm all 15 previous fixes still working

---

## SUMMARY

| Fix | Task | Priority |
|-----|------|----------|
| #16 | GIN trigram indexes | HIGH - do first |
| #17 | US/UK synonyms | MEDIUM |
| #18 | Speed bug investigation | MEDIUM |

**Do Fix #16 first. It will improve all search performance.**
