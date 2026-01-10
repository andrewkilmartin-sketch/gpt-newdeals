# CRITICAL FIXES NEEDED - Sunny Search is Broken

## Summary

Our 91% pass rate is fake. "PASS" just means "returned something" - not "returned something relevant". Analysis shows:

- ~30% of "PASS" results are completely irrelevant
- Adult/inappropriate content appearing on a FAMILY platform (ED pills, STI testing)
- Keyword matching is broken ("book tokens" → car rental, "party bags" → River Island fashion bags)
- "Best toys" returns "Toys from 1p" - cheapest, not best
- Same generic results for wildly different queries

**Real pass rate is closer to 50%, not 91%.**

---

## FIX 1: Delete Non-Family Products from Database

These affiliate products should NEVER appear on a family platform. Delete from database entirely:

```sql
-- Delete adult/health products inappropriate for family platform
DELETE FROM products WHERE 
  title ILIKE '%bedroom confidence%' OR
  title ILIKE '%erectile%' OR
  title ILIKE '%viagra%' OR
  title ILIKE '%sexual health%' OR
  title ILIKE '%reproductive health%' OR
  title ILIKE '%your status%' OR  -- STI testing
  title ILIKE '%sti test%' OR
  title ILIKE '%std test%' OR
  title ILIKE '%reclaim your%confidence%' OR
  title ILIKE '%regain%confidence%bedroom%' OR
  title ILIKE '%take control%reproductive%' OR
  title ILIKE '%know your status%' OR
  description ILIKE '%erectile dysfunction%' OR
  description ILIKE '%sexual performance%' OR
  description ILIKE '%std testing%' OR
  description ILIKE '%sti testing%';
```

Also consider deleting/filtering:
- Dating site ads
- Alcohol promotions
- Gambling promotions
- Weight loss pills
- Any prescription medication ads

---

## FIX 2: Update Audit Script - Capture ALL Results, Not Just First

Current audit only shows `firstResult`. We need ALL results to properly evaluate quality.

Change the audit output to include all returned results:

```javascript
// In audit script, change the results capture:
const auditRow = {
  query: query,
  verdict: verdict,
  dbCount: dbCount,
  searchCount: results.length,
  relevancePercent: relevanceScore,
  imagePercent: imagePercent,
  timeMs: responseTime,
  // CHANGE: Capture all results, not just first
  result1: results[0]?.title || "",
  result2: results[1]?.title || "",
  result3: results[2]?.title || "",
  result4: results[3]?.title || "",
  result5: results[4]?.title || "",
  result6: results[5]?.title || "",
  result7: results[6]?.title || "",
  result8: results[7]?.title || "",
  result1_merchant: results[0]?.merchant || "",
  result2_merchant: results[1]?.merchant || "",
  result3_merchant: results[2]?.merchant || "",
  result4_merchant: results[3]?.merchant || "",
  category: category,
  fixAction: fixAction
};
```

New CSV headers:
```
query,verdict,dbCount,searchCount,relevancePercent,imagePercent,timeMs,result1,result2,result3,result4,result5,result6,result7,result8,result1_merchant,result2_merchant,result3_merchant,result4_merchant,category,fixAction
```

---

## FIX 3: Complete Audit Test Code Replacement

Replace your entire audit verdict logic with this:

```javascript
// ============================================
// CONFIGURATION - Blocklists and Detection
// ============================================

const INAPPROPRIATE_TERMS = [
  'bedroom confidence', 'erectile', 'viagra', 'sexual health',
  'reproductive health', 'your status', 'sti test', 'std test',
  'reclaim your confidence', 'regain confidence', 'dating site',
  'singles near', 'gambling', 'casino', 'betting', 'weight loss pill',
  'diet pill', 'slimming tablet', 'beer delivery', 'wine subscription',
  'alcohol delivery', 'cigarette', 'vape juice', 'cbd oil'
];

const KNOWN_FALLBACKS = [
  'gifting at clarks',
  '10% off organic baby & kidswear',
  'toys from 1p at poundfun',
  'free delivery',
  'clearance',
  'save up to'
];

const QUALITY_INTENT_WORDS = [
  'best', 'top', 'quality', 'premium', 'timeless', 'heirloom', 
  'investment', 'luxury', 'high end', 'well made', 'durable'
];

const DISCOUNT_MERCHANTS = [
  'poundfun', 'poundland', 'poundshop', 'everything5pounds'
];

// ============================================
// DETECTION FUNCTIONS
// ============================================

function checkForInappropriateContent(results) {
  for (const result of results) {
    const text = ((result.title || '') + ' ' + (result.description || '')).toLowerCase();
    for (const term of INAPPROPRIATE_TERMS) {
      if (text.includes(term)) {
        return { found: true, term: term, result: result.title };
      }
    }
  }
  return { found: false };
}

function checkForFallbackResults(results, query) {
  if (results.length === 0) return { found: false };
  
  const firstResult = (results[0].title || '').toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/);
  
  for (const fallback of KNOWN_FALLBACKS) {
    if (firstResult.includes(fallback)) {
      // Check if query has ANY semantic connection to the result
      const resultWords = fallback.split(/\s+/);
      const hasOverlap = queryWords.some(qw => 
        resultWords.some(rw => qw.length > 3 && rw.includes(qw))
      );
      
      if (!hasOverlap) {
        return { found: true, fallback: results[0].title };
      }
    }
  }
  return { found: false };
}

function checkForKeywordMismatch(results, query) {
  const q = query.toLowerCase();
  const firstResult = (results[0]?.title || '').toLowerCase();
  
  // "book" context - should be reading books, not booking.com
  const bookContextWords = ['token', 'voucher', 'dentist', 'doctor', 'hospital', 
    'baby', 'sibling', 'families', 'for kids', 'children', 'about'];
  if (q.includes('book') && bookContextWords.some(w => q.includes(w))) {
    if (firstResult.includes('car rental') || firstResult.includes('holiday') || 
        firstResult.includes('hotel') || firstResult.includes('booking.com')) {
      return { found: true, type: 'book_vs_booking', result: results[0].title };
    }
  }
  
  // "bag" context - party bags vs fashion bags
  if (q.includes('party bag') || q.includes('goody bag') || q.includes('bag filler')) {
    if (firstResult.includes('river island') || firstResult.includes("women's bag") ||
        firstResult.includes('handbag') || firstResult.includes('fashion')) {
      return { found: true, type: 'party_bag_vs_fashion', result: results[0].title };
    }
  }
  
  // Age patterns - "5 year old" vs "5-year warranty"
  const ageMatch = q.match(/(\d+)\s*(year|yr)s?\s*(old)?/i);
  if (ageMatch && (q.includes('old') || q.includes('child') || q.includes('kid'))) {
    if (firstResult.includes('year plan') || firstResult.includes('year warranty') ||
        firstResult.includes('year care') || firstResult.includes('year guarantee')) {
      return { found: true, type: 'age_vs_warranty', result: results[0].title };
    }
  }
  
  return { found: false };
}

function checkForQualityMismatch(results, query) {
  const q = query.toLowerCase();
  const hasQualityIntent = QUALITY_INTENT_WORDS.some(w => q.includes(w));
  
  if (hasQualityIntent && results.length > 0) {
    const firstMerchant = (results[0].merchant || '').toLowerCase();
    const firstTitle = (results[0].title || '').toLowerCase();
    
    // Check if leading with discount/pound shop results
    const isDiscountResult = DISCOUNT_MERCHANTS.some(m => firstMerchant.includes(m)) ||
                            firstTitle.includes('1p') || 
                            firstTitle.includes('from 1p') ||
                            firstTitle.includes('pound');
    
    if (isDiscountResult) {
      return { found: true, result: results[0].title };
    }
  }
  return { found: false };
}

// ============================================
// MAIN VERDICT FUNCTION
// ============================================

function determineVerdict(query, results, dbCount) {
  // First: Check for search bugs (DB has products but none returned)
  if (results.length === 0 && dbCount > 0) {
    return { 
      verdict: 'SEARCH_BUG', 
      fixAction: 'Debug search algorithm - DB has products but none returned' 
    };
  }
  
  // Second: Check for inventory gaps (nothing in DB)
  if (results.length === 0 && dbCount === 0) {
    return { 
      verdict: 'INVENTORY_GAP', 
      fixAction: 'Import products for this brand/category' 
    };
  }
  
  // Third: Check for inappropriate content (CRITICAL for family platform)
  const inappropriate = checkForInappropriateContent(results);
  if (inappropriate.found) {
    return { 
      verdict: 'INAPPROPRIATE', 
      fixAction: `Remove inappropriate content: "${inappropriate.term}" in "${inappropriate.result}"` 
    };
  }
  
  // Fourth: Check for keyword context mismatches
  const keywordMismatch = checkForKeywordMismatch(results, query);
  if (keywordMismatch.found) {
    return { 
      verdict: 'KEYWORD_MISMATCH', 
      fixAction: `Wrong context for keyword: ${keywordMismatch.type} - got "${keywordMismatch.result}"` 
    };
  }
  
  // Fifth: Check for quality/intent mismatch
  const qualityMismatch = checkForQualityMismatch(results, query);
  if (qualityMismatch.found) {
    return { 
      verdict: 'QUALITY_MISMATCH', 
      fixAction: `Quality query returned discount result: "${qualityMismatch.result}"` 
    };
  }
  
  // Sixth: Check for generic fallback results
  const fallback = checkForFallbackResults(results, query);
  if (fallback.found) {
    return { 
      verdict: 'FALLBACK_RESULT', 
      fixAction: `Generic fallback instead of relevant match: "${fallback.fallback}"` 
    };
  }
  
  // If we made it here, it's a real pass
  return { verdict: 'PASS', fixAction: '' };
}

// ============================================
// AUDIT ROW GENERATION (with all 8 results)
// ============================================

function generateAuditRow(query, results, dbCount, responseTime, category) {
  const { verdict, fixAction } = determineVerdict(query, results, dbCount);
  
  // Calculate relevance (placeholder - you may have existing logic)
  const relevancePercent = results.length > 0 ? 100 : 0;
  
  // Calculate image coverage
  const withImages = results.filter(r => r.image_url).length;
  const imagePercent = results.length > 0 ? Math.round((withImages / results.length) * 100) : 0;
  
  return {
    query: query,
    verdict: verdict,
    dbCount: dbCount,
    searchCount: results.length,
    relevancePercent: relevancePercent,
    imagePercent: imagePercent,
    timeMs: responseTime,
    result1: results[0]?.title || '',
    result2: results[1]?.title || '',
    result3: results[2]?.title || '',
    result4: results[3]?.title || '',
    result5: results[4]?.title || '',
    result6: results[5]?.title || '',
    result7: results[6]?.title || '',
    result8: results[7]?.title || '',
    merchant1: results[0]?.merchant || '',
    merchant2: results[1]?.merchant || '',
    merchant3: results[2]?.merchant || '',
    merchant4: results[3]?.merchant || '',
    category: category || '',
    fixAction: fixAction
  };
}

// ============================================
// CSV HEADERS (update your CSV export)
// ============================================

const CSV_HEADERS = [
  'query', 'verdict', 'dbCount', 'searchCount', 'relevancePercent', 'imagePercent', 'timeMs',
  'result1', 'result2', 'result3', 'result4', 'result5', 'result6', 'result7', 'result8',
  'merchant1', 'merchant2', 'merchant3', 'merchant4', 'category', 'fixAction'
].join(',');
```

### Verdict Types Summary:

| Verdict | Meaning | Action Required |
|---------|---------|-----------------|
| `PASS` | Relevant results returned | None |
| `SEARCH_BUG` | DB has products, search returned none | Fix search algorithm |
| `INVENTORY_GAP` | No products in DB | Import products |
| `INAPPROPRIATE` | Adult/non-family content | Delete from DB + filter |
| `KEYWORD_MISMATCH` | Wrong "book", "bag", etc. | Fix context detection |
| `QUALITY_MISMATCH` | "Best" returned cheapest | Fix ranking |
| `FALLBACK_RESULT` | Generic result, not relevant | Improve search relevance |

---

## FIX 4: Keyword Context Awareness

### Problem: "book" matches booking.com

```javascript
// These should return children's books about the topic, not car rentals:
"going to dentist book"  → "Book your next car rental" ❌
"doctors visit book"     → "Book Your 2026 Beach Holiday" ❌
"two homes book"         → "Book your next car rental" ❌
"book tokens"            → "Book your next car rental" ❌
```

**Fix:** When query contains "book" + (tokens|voucher|gift|about|for kids|children), exclude booking/travel results:

```javascript
function processQuery(query) {
  const words = query.toLowerCase().split(' ');
  
  // "book" context detection
  if (words.includes('book')) {
    const bookContextWords = ['tokens', 'voucher', 'gift', 'about', 'for', 'children', 'kids', 'dentist', 'doctor', 'hospital', 'new', 'baby', 'sibling'];
    const hasBookContext = bookContextWords.some(w => words.includes(w));
    
    if (hasBookContext) {
      // Exclude travel/booking merchants
      excludeMerchants(['booking.com', 'hotels.com', 'expedia']);
      // Boost actual book merchants
      boostMerchants(['waterstones', 'whsmith', 'amazon books']);
    }
  }
}
```

### Problem: "bag" matches fashion bags

```javascript
"party bag bits"      → "River Island Bags" ❌
"goody bag stuff"     → "70% off women's bags" ❌
"party bags"          → fashion handbags ❌
```

**Fix:** "party bag" or "goody bag" should search party supplies:

```javascript
if (query.includes('party bag') || query.includes('goody bag')) {
  // Rewrite query to be explicit
  searchQuery = query.replace('party bag', 'party bag fillers supplies');
  // Exclude fashion
  excludeCategories(['fashion', 'handbags', 'accessories']);
}
```

### Problem: "5 year old" matches "5-Year Warranty"

```javascript
"essentials for 5 year old" → "5-Year Bed Care Plan" ❌
```

**Fix:** Age patterns should not match warranty/plan durations:

```javascript
// Detect age queries
const agePattern = /(\d+)\s*(year|yr)s?\s*(old)?/i;
if (agePattern.test(query)) {
  // Exclude warranty/plan products
  excludeTerms(['year plan', 'year warranty', 'year care', 'year guarantee']);
  // Add kids context
  boostCategories(['toys', 'kids', 'children', 'baby']);
}
```

---

## FIX 5: "Best" Should Not Return "Cheapest"

```javascript
"best toys rn"        → "Toys from 1p at PoundFun!" ❌
"top toys atm"        → "Toys from 1p at PoundFun!" ❌
"quality toys"        → "Toys from 1p at PoundFun!" ❌
"timeless toys"       → "Toys from 1p at PoundFun!" ❌
```

**Fix:** Quality-intent queries should not lead with discount/pound shop results:

```javascript
const qualityIntent = ['best', 'top', 'quality', 'premium', 'timeless', 'heirloom', 'investment'];
const hasQualityIntent = qualityIntent.some(w => query.toLowerCase().includes(w));

if (hasQualityIntent) {
  // Don't lead with pound shop / extreme discount
  deprioritizeMerchants(['poundfun', 'poundland', 'pound shop']);
  // Or at minimum, don't let them be result #1
}
```

---

## FIX 6: Detect Generic Fallback Results

If wildly different queries return the same result, that's a failed search:

```javascript
// These all returned "Gifting At Clarks" - a shoe shop:
"pass the parcel prizes cheap"
"bits and bobs for party"
"shes so hard to buy for"
"hes impossible to shop for"
```

**Fix:** Track "fallback detection":

```javascript
const KNOWN_FALLBACKS = [
  'Gifting At Clarks',
  '10% off Organic Baby & Kidswear',
  'Toys from 1p at PoundFun'
];

function isFallbackResult(result, query) {
  // If result is a known fallback AND query has no obvious connection
  if (KNOWN_FALLBACKS.includes(result.title)) {
    const queryWords = query.toLowerCase().split(' ');
    const hasConnection = checkSemanticConnection(queryWords, result);
    if (!hasConnection) {
      return true; // This is a fallback, not a real match
    }
  }
  return false;
}
```

---

## FIX 7: Add Inappropriate Content Blocklist

For search results filtering (not just DB deletion):

```javascript
const INAPPROPRIATE_TERMS = [
  'bedroom confidence',
  'erectile',
  'viagra', 
  'sexual',
  'reproductive health',
  'sti test',
  'std test',
  'your status protect',
  'dating',
  'singles',
  'alcohol delivery',
  'beer delivery',
  'wine subscription',
  'betting',
  'gambling',
  'casino',
  'weight loss pills',
  'diet pills',
  'slimming tablets'
];

function filterResults(results) {
  return results.filter(r => {
    const text = (r.title + ' ' + r.description).toLowerCase();
    return !INAPPROPRIATE_TERMS.some(term => text.includes(term));
  });
}
```

---

## FIX 8: Film Query Pattern (from previous audit)

Still broken - 39 SEARCH_BUGs from film queries:

```javascript
"animated films"  (49 in DB)  → 0 results
"pixar films"     (119 in DB) → 0 results
"dinosaur film"   (417 in DB) → 0 results
"unicorn film"    (390 in DB) → 0 results
"ballet film"     (1441 in DB) → 0 results
```

**Fix:** Strip trailing film/movie words:

```javascript
const filmWords = ['film', 'films', 'movie', 'movies', 'flick', 'flicks'];
let searchTerms = query.toLowerCase().split(' ');

// Remove trailing film word: "dinosaur film" → "dinosaur"
if (filmWords.includes(searchTerms[searchTerms.length - 1])) {
  searchTerms = searchTerms.slice(0, -1);
}

// Also try: "animated films" → search "animation" OR "animated"
```

---

## Testing Priority After Fixes

Re-run audit on these specific problem queries:

### Must Return Appropriate Content:
```
impulse control
delayed gratification
hospital preparation
medicine taking help
need inspo
```

### Must Return Books, Not Travel:
```
book tokens
going to dentist book
doctors visit book
two homes book
new baby book
```

### Must Return Party Supplies, Not Fashion:
```
party bag bits
goody bag stuff
cheap tat for party bags
party bag fillers
```

### Must Return Quality, Not Cheapest:
```
best toys rn
top toys atm
quality toys uk
timeless toys
heirloom toys
```

### Must Return Results (SEARCH_BUG fixes):
```
animated films
dinosaur film
unicorn film
pixar films
ballet film
```

---

## New Verdict Categories for Audit

```
PASS                  - Relevant results returned
SEARCH_BUG            - DB has products but search returned none
INVENTORY_GAP         - No products in DB for this query
INAPPROPRIATE_CONTENT - Adult/non-family content returned
IRRELEVANT_RESULTS    - Results don't match query intent
FALLBACK_RESULTS      - Generic fallback instead of real match
KEYWORD_MISMATCH      - Wrong type of "book", "bag", etc.
```

---

## Summary of Actions

1. ✅ Delete inappropriate products from database (ED pills, STI tests, etc.)
2. ✅ Update audit CSV to capture all 8 results, not just first
3. ✅ Add new verdict types for quality assessment
4. ✅ Fix "book" context (books vs booking)
5. ✅ Fix "bag" context (party bags vs fashion bags)
6. ✅ Fix age patterns (5 year old vs 5-year warranty)
7. ✅ Deprioritize pound shop for "best/quality" queries
8. ✅ Detect and flag fallback/generic results
9. ✅ Add inappropriate content filter to search results
10. ✅ Fix film query pattern (strip trailing film/movie)

Then re-run all 5000+ test queries and get REAL pass rate.
