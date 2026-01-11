# REPLIT FIX INSTRUCTIONS

> **AI ASSISTANT**: Read this file at the start of EVERY session along with CRITICAL_FIXES.md and STOP_BLAMING_INVENTORY.md.

---

## Before ANY fix:

1. **Read CRITICAL_FIXES.md** - check if this issue was already fixed
2. **Read STOP_BLAMING_INVENTORY.md** - don't blame inventory without SQL proof
3. **Check the fix number** - we're at Fix #64+

---

## When implementing fixes:

1. **Log EVERY fix to CRITICAL_FIXES.md with:**
   - Fix number
   - Problem description
   - Root cause
   - Solution (file + line numbers)
   - How to verify it worked

2. **Test on 1,701 queries, not small samples**
3. **Never say "90% pass rate" from a 10 query test**

---

## After fixes:

1. Update CRITICAL_FIXES.md
2. Update SUNNY_CONTEXT.md with new pass rate
3. Push to GitHub

---

## Known patterns to check:

| Pattern | Example | Description |
|---------|---------|-------------|
| WORD_BOUNDARY | train→trainer, case→bookcase | Substring matching in ILIKE |
| CLOTHING_LEAK | toys returning pyjamas | Missing category filter |
| BLOCKED_PRODUCT | Trimits Toy Eyes, NosiBotanical | Blocklist incorrectly filtering |
| TIMEOUT | Generic queries taking 50+ seconds | ILIKE on 1.1M rows without index |
| NULL_BRAND | GPT returning "null" string | String "null" not actual null |
| SEARCH_VECTOR_MISSING | 0 results, 0ms | tsvector column missing in prod |

---

## Server Stability Checks (Fix #61+)

When server is crashing:

1. **DATABASE CONNECTION POOL** - Are connections being released after queries? Connections must return to the pool after use.

2. **UNHANDLED ERRORS** - One bad query shouldn't crash the whole server. Requires global error handler:
```javascript
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error' });
});
```

3. **TIMEOUT PROTECTION** - No query should run 50+ seconds. Add 5 second timeout to ALL database queries.

4. **MEMORY LEAKS** - Check if any arrays or objects grow without being cleared.

5. **RAILWAY LOGS** - Go to Railway dashboard, find the crash logs. What error appears right before crash?

---

## Debugging Checklist

Before blaming deployment/cache/external issues:

1. **Check server health FIRST:**
```bash
curl -s http://localhost:5000/healthz | jq
```

2. **Check workflow logs** - Use refresh_all_logs tool

3. **Check database connection:**
```sql
SELECT COUNT(*) FROM products_v2 LIMIT 1;
```

4. **Only AFTER confirming server is running**, investigate other causes.

---

## File Locations

| Component | File | Key Lines |
|-----------|------|-----------|
| Database connection | server/db.ts | Pool config |
| Main routes | server/routes.ts | All endpoints |
| Error handlers | server/routes.ts | Near end of file |
| Awin service | server/services/awin.ts | Promotions |
| Schema | shared/schema.ts | Data models |

---

## Current Status

- **Fix Count:** 63+ (Fix #57 = Brand tsvector, Fix #58-60 = Category promotions, Fix #61-63 = Server stability)
- **Pass Rate:** 83% (500-query audit)
- **Target:** 90% pass rate, <500ms response times
- **Products:** 1.18M+ in database
