# SUNNY SEARCH - CRITICAL FIX PLAN
## The Problem: Search is Matching Words, Ignoring Context

---

## THE EVIDENCE

### Problem 1: Age is Completely Ignored

**14 different age queries return IDENTICAL results:**
```
"toys for 3 year old"  → LEGO Speed Champions Mini Cooper
"toys for 4 year old"  → LEGO Speed Champions Mini Cooper
"toys for 5 year old"  → LEGO Speed Champions Mini Cooper
...
"toys for newborn"     → LEGO Speed Champions Mini Cooper
"toys for teenager"    → LEGO Speed Champions Mini Cooper
```

A NEWBORN and a TEENAGER get the same LEGO car recommended. This is broken.

### Problem 2: Gender is Completely Ignored

**8 different gender+age queries return IDENTICAL results:**
```
"gifts for 3 year old boy"   → "The Last Gifts of the Universe" (a book!)
"gifts for 3 year old girl"  → "The Last Gifts of the Universe"
"gifts for 10 year old boy"  → "The Last Gifts of the Universe"
"gifts for 10 year old girl" → "The Last Gifts of the Universe"
```

Boys and girls, ages 3-10, all get the same sci-fi novel.

### Problem 3: Birthday Age is Ignored

```
"birthday present 4 year old"  → "21st Birthday"
"birthday present 6 year old"  → "21st Birthday"
"birthday present 8 year old"  → "21st Birthday"
```

4 year olds getting 21st birthday products.

### Problem 4: Character Queries Are Weak

```
"paw patrol toys"   → "Dog Diaries: Mission Impawsible" (wrong!)
"paw patrol tower"  → "Dog Diaries: Mission Impawsible" (wrong!)
"bluey toys"        → "M&S Bluey Pyjamas" (ok but not toys)
"bluey house"       → "M&S Bluey Pyjamas" (wrong - they want the house!)
"pokemon cards"     → "Disney Pokemon LED Watch" (wrong!)
```

---

## ROOT CAUSE ANALYSIS

The search is doing **simple keyword matching** on 1.4M products:

1. "toys for 3 year old" → matches products containing "toys" → returns first match
2. "gifts for boy" → matches products containing "gifts" → returns "Last Gifts of Universe"
3. "birthday 4 year old" → matches "birthday" → returns "21st Birthday"

**The search is ignoring:**
- Age qualifiers (3 year old, newborn, teenager)
- Gender qualifiers (boy, girl)
- Specific product types (tower, house, cards)
- Price qualifiers (under £20, under £50)

---

## THE FIX: QUERY DECOMPOSITION + INTELLIGENT FILTERING

### Step 1: Parse the Query into Components

Before searching, extract structured data:

```javascript
function parseQuery(query) {
  const result = {
    ageMin: null,
    ageMax: null,
    gender: null,
    priceMax: null,
    productType: null,
    brand: null,
    character: null,
    occasion: null,
    keywords: []
  };

  const q = query.toLowerCase();

  // AGE EXTRACTION
  const ageMatch = q.match(/(\d+)\s*year\s*old/);
  if (ageMatch) {
    result.ageMin = parseInt(ageMatch[1]) - 1;
    result.ageMax = parseInt(ageMatch[1]) + 1;
  }
  if (q.includes('newborn') || q.includes('baby')) {
    result.ageMin = 0; result.ageMax = 1;
  }
  if (q.includes('toddler')) {
    result.ageMin = 1; result.ageMax = 3;
  }
  if (q.includes('teenager') || q.includes('teen')) {
    result.ageMin = 13; result.ageMax = 19;
  }

  // GENDER EXTRACTION
  if (q.includes('boy') || q.includes('son') || q.includes('nephew')) {
    result.gender = 'boy';
  }
  if (q.includes('girl') || q.includes('daughter') || q.includes('niece')) {
    result.gender = 'girl';
  }

  // PRICE EXTRACTION
  const priceMatch = q.match(/under\s*£?(\d+)/);
  if (priceMatch) {
    result.priceMax = parseInt(priceMatch[1]);
  }

  // CHARACTER EXTRACTION
  const characters = ['paw patrol', 'peppa pig', 'bluey', 'frozen', 'spiderman', 
    'batman', 'mario', 'sonic', 'pokemon', 'minecraft', 'fortnite', 'roblox',
    'disney', 'marvel', 'star wars', 'harry potter', 'lego', 'barbie'];
  for (const char of characters) {
    if (q.includes(char)) {
      result.character = char;
      break;
    }
  }

  // PRODUCT TYPE EXTRACTION
  const productTypes = {
    'tower': 'playset',
    'house': 'playset',
    'cards': 'trading cards',
    'costume': 'costume',
    'dress': 'costume',
    'figure': 'action figure',
    'plush': 'soft toy',
    'soft toy': 'soft toy'
  };
  for (const [keyword, type] of Object.entries(productTypes)) {
    if (q.includes(keyword)) {
      result.productType = type;
      break;
    }
  }

  return result;
}
```

### Step 2: Use Parsed Data in Search

```javascript
async function smartSearch(query) {
  const parsed = parseQuery(query);
  
  // Build search with REQUIRED filters
  let searchQuery = query;
  let filters = {};

  // If character specified, MUST match character
  if (parsed.character) {
    filters.mustContain = parsed.character;
  }

  // If price specified, MUST be under price
  if (parsed.priceMax) {
    filters.maxPrice = parsed.priceMax;
  }

  // Get candidates
  let results = await db.search(searchQuery, filters);

  // POST-FILTER by age appropriateness
  if (parsed.ageMin !== null || parsed.ageMax !== null) {
    results = filterByAge(results, parsed.ageMin, parsed.ageMax);
  }

  // POST-FILTER by gender if specified
  if (parsed.gender) {
    results = boostByGender(results, parsed.gender);
  }

  return results;
}
```

### Step 3: Age Filtering Logic

```javascript
function filterByAge(products, ageMin, ageMax) {
  return products.filter(p => {
    // Check product's age suitability
    const productAge = extractAgeFromProduct(p);
    
    if (productAge.min !== null && ageMax !== null) {
      if (productAge.min > ageMax) return false; // Too old for them
    }
    if (productAge.max !== null && ageMin !== null) {
      if (productAge.max < ageMin) return false; // Too young for them
    }
    
    return true;
  });
}

function extractAgeFromProduct(product) {
  const text = (product.title + ' ' + product.description).toLowerCase();
  
  // Look for age indicators
  const ageMatch = text.match(/(\d+)\+/) || text.match(/ages?\s*(\d+)/);
  if (ageMatch) {
    return { min: parseInt(ageMatch[1]), max: null };
  }
  
  // Category-based defaults
  if (text.includes('duplo') || text.includes('toddler')) {
    return { min: 1, max: 4 };
  }
  if (text.includes('baby') || text.includes('infant')) {
    return { min: 0, max: 2 };
  }
  if (text.includes('teen') || text.includes('adult')) {
    return { min: 13, max: null };
  }
  
  return { min: null, max: null };
}
```

### Step 4: Diversity in Results

**Problem:** Same product appearing in position 1 for 34 different queries.

```javascript
function diversifyResults(results, query) {
  const seen = new Set();
  const diverse = [];
  
  for (const product of results) {
    // Don't show same product twice
    if (seen.has(product.id)) continue;
    
    // Don't show same brand more than 3 times
    const brandCount = diverse.filter(p => p.brand === product.brand).length;
    if (brandCount >= 3) continue;
    
    // Don't show same category more than 4 times
    const catCount = diverse.filter(p => p.category === product.category).length;
    if (catCount >= 4) continue;
    
    seen.add(product.id);
    diverse.push(product);
    
    if (diverse.length >= 10) break;
  }
  
  return diverse;
}
```

---

## IMPLEMENTATION PRIORITY

### PHASE 1: Quick Wins (Do Today)

1. **Add age extraction to query parsing**
   - Extract "X year old", "newborn", "toddler", "teen"
   - Filter results by age appropriateness

2. **Add character/brand as REQUIRED match**
   - "paw patrol toys" MUST return Paw Patrol products
   - "pokemon cards" MUST return Pokemon products

3. **Add price filtering**
   - "under £20" MUST filter to products under £20

### PHASE 2: Quality Improvements (This Week)

4. **Add diversity constraints**
   - Max 3 products from same brand
   - Max 4 products from same category
   - No duplicate products

5. **Add product type specificity**
   - "paw patrol tower" → search for "paw patrol" AND "tower/playset"
   - "bluey house" → search for "bluey" AND "house/playset"

6. **Add gender boosting**
   - "gifts for boy" → boost action figures, vehicles, sports
   - "gifts for girl" → boost dolls, craft, jewellery
   - (but don't exclude - just reorder)

### PHASE 3: Intelligence (Next Sprint)

7. **Add relevance scoring**
   - Exact character match = +100 points
   - Age appropriate = +50 points
   - Price in range = +30 points
   - Has image = +20 points
   - Popular brand = +10 points

8. **Add search term weighting**
   - "paw patrol tower" → "paw patrol" weight 2x, "tower" weight 1x
   - Don't just match ANY word

---

## QUICK TEST CASES

After fixes, these should return DIFFERENT results:

| Query | Expected Difference |
|-------|---------------------|
| toys for 1 year old | Baby toys, soft toys, Duplo |
| toys for 5 year old | Lego, action figures, games |
| toys for 12 year old | Complex Lego, electronics, teen games |
| gifts for 3 year old boy | Vehicles, dinosaurs, superheros |
| gifts for 3 year old girl | Dolls, unicorns, craft |
| paw patrol toys | ANY Paw Patrol product |
| paw patrol tower | Paw Patrol Lookout Tower specifically |
| lego under £20 | ONLY Lego sets under £20 |
| birthday present 4 year old | Age 4 appropriate, NOT 21st birthday |

---

## WHAT'S HAPPENING NOW VS WHAT SHOULD HAPPEN

### Current (Broken):
```
User: "toys for newborn"
Search: SELECT * FROM products WHERE title LIKE '%toys%' LIMIT 10
Result: LEGO Speed Champions (ages 8+) ❌
```

### Fixed:
```
User: "toys for newborn"
Parse: { ageMin: 0, ageMax: 1, keywords: ['toys'] }
Search: SELECT * FROM products 
        WHERE title LIKE '%toys%' 
        AND (age_min IS NULL OR age_min <= 1)
        AND (age_max IS NULL OR age_max >= 0)
        ORDER BY relevance DESC
        LIMIT 10
Result: Baby sensory toys, rattles, soft toys ✅
```

---

## DATABASE ENHANCEMENT (Optional but Powerful)

If you can modify the product data, add these fields:

```sql
ALTER TABLE products ADD COLUMN age_min INT;
ALTER TABLE products ADD COLUMN age_max INT;
ALTER TABLE products ADD COLUMN gender VARCHAR(10); -- 'boy', 'girl', 'unisex'
ALTER TABLE products ADD COLUMN character VARCHAR(50);
ALTER TABLE products ADD COLUMN product_type VARCHAR(50);
```

Then populate with AI:
```javascript
// One-time enrichment script
for (const product of products) {
  const enriched = await openai.complete(`
    Product: ${product.title}
    
    Extract:
    - age_min (youngest suitable age, number)
    - age_max (oldest suitable age, number or null)
    - gender (boy/girl/unisex)
    - character (e.g. "paw patrol", "frozen", or null)
    - product_type (e.g. "toy", "costume", "book", "game")
    
    Return JSON only.
  `);
  
  await db.update(product.id, JSON.parse(enriched));
}
```

This makes filtering instant instead of parsing at search time.

---

## SUMMARY FOR REPLIT

**The search is matching single words and ignoring context.**

Fix priority:
1. ✅ Parse age from query → filter results by age
2. ✅ Parse character from query → REQUIRE character match
3. ✅ Parse price from query → filter by price
4. ✅ Add diversity (no duplicate products, max 3 per brand)
5. ✅ Parse product type → match specific items (tower, house, cards)

**Expected improvement: 30% relevance → 80%+ relevance**

The underlying product data is good. The search logic is the bottleneck.
