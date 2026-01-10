# SUNNY SEARCH FIX INSTRUCTIONS FOR REPLIT
## READ THIS ENTIRE DOCUMENT BEFORE MAKING ANY CHANGES

---

## HOW THE SYSTEM WORKS (For Context)

```
User Query (e.g., "lol dolls")
    ↓
OpenAI interprets intent
    ↓
Search queries our 1.4M product database
    ↓
Returns closest matching products
```

**Our job:** Make the search return the BEST matches from what we have.
**Not our job (for now):** Adding products we don't have (inventory gaps).

---

## ⚠️ CRITICAL: PREVENTING THE FIX LOOP

We keep fixing things that break other things. To stop this:

### RULE 1: Create/Update FIXES.md
After EVERY fix, log it in `/FIXES.md`:
```markdown
## Fix #[number] - [date]
**Problem:** [what was broken]
**Cause:** [why it was broken]
**Solution:** [what you changed]
**File:** [filename and line numbers]
**Test:** [how to verify it works]
```

### RULE 2: Run Regression Tests
Before committing ANY change, verify these still work:
- [ ] Speed: Queries complete in <3 seconds
- [ ] "paw patrol toys" returns Paw Patrol products
- [ ] "lego" returns LEGO products
- [ ] "toys for 5 year old" returns age-appropriate toys

### RULE 3: Don't Touch Working Code
If something is working, don't refactor it while fixing something else.

---

## THE BUGS TO FIX (Priority Order)

### 🔴 P0 - CRITICAL: Fix Today

---

#### BUG 1: Substring Matching (Not Word Boundary)

**Problem:** Search matches partial words inside other words.

| Query | Returns | Why It's Wrong |
|-------|---------|----------------|
| lol dolls | Ice **Lolly** Mug | "lol" inside "lolly" |
| train set | Nike **Training** Shoes | "train" inside "training" |
| kids slide | Nike **Slides** footwear | "slide" inside "slides" |
| swing set | Maxi **Swing** Dress | "swing" in clothing name |
| baby doll | Baby**doll** Corset Dress | "doll" inside "babydoll" |

**Fix Required:**
```javascript
// BEFORE (matches substrings - BAD)
if (productTitle.toLowerCase().includes(searchTerm)) 

// AFTER (matches whole words only - GOOD)
const wordBoundaryRegex = new RegExp(`\\b${searchTerm}\\b`, 'i');
if (wordBoundaryRegex.test(productTitle))
```

**Test After Fix:**
- "lol dolls" should NOT return "lolly" products
- "train set" should NOT return "training" products

---

#### BUG 2: Clothing/Apparel Returned for Toy Queries

**Problem:** Products with characters PRINTED on clothing match toy searches.

| Query | Returns | Why It's Wrong |
|-------|---------|----------------|
| bike helmet | Ant-Man Helmet T-Shirt | Helmet is on the shirt graphic |
| crayons | "Crayons" Sweatshirt | Word "crayons" printed on shirt |
| dinosaur figures | Dinosaur Sweatshirt | Dinosaur graphic on clothing |
| super soaker | Cotton Vest | Unknown match |
| climbing frame | Climbing Club Sweatshirt | "Climbing" in clothing name |

**Fix Required:**
When query intent is "toy" or "equipment", filter out clothing categories:
```javascript
// If user wants toys/equipment, exclude apparel
const clothingIndicators = [
  't-shirt', 'sweatshirt', 'hoodie', 'dress', 'shirt', 
  'shorts', 'trousers', 'vest', 'jacket', 'coat',
  'trainers', 'shoes', 'slides', 'sandals'
];

function isClothing(product) {
  const title = product.title.toLowerCase();
  return clothingIndicators.some(term => title.includes(term));
}

// In search function, when query is for toys:
if (queryCategory === 'toys') {
  results = results.filter(product => !isClothing(product));
}
```

**Test After Fix:**
- "bike helmet" should return actual helmets, not t-shirts
- "dinosaur figures" should return figures, not sweatshirts

---

#### BUG 3: Wrong Brand/Character Returned

**Problem:** Search returns competitor or wrong brands.

| Query | Expected | Got |
|-------|----------|-----|
| pokemon cards | Pokemon | Lorcana cards |
| superman toys | Superman | Iron Man |
| batman mask | Batman | Spidey backpack |
| luigi toy | Luigi | Mario |
| hot wheels | Hot Wheels | Dinosaur |

**Fix Required:**
When query contains a specific brand/character, prioritise exact matches:
```javascript
const knownBrands = [
  'pokemon', 'paw patrol', 'peppa pig', 'bluey', 'frozen',
  'spiderman', 'batman', 'superman', 'mario', 'luigi',
  'sonic', 'hot wheels', 'nerf', 'barbie', 'lol surprise',
  'lego', 'duplo', 'disney', 'marvel', 'star wars'
];

function extractBrand(query) {
  return knownBrands.find(brand => query.toLowerCase().includes(brand));
}

// In search:
const queryBrand = extractBrand(userQuery);
if (queryBrand) {
  // First, try to find products with exact brand match
  const brandMatches = results.filter(p => 
    p.title.toLowerCase().includes(queryBrand)
  );
  // If we have brand matches, use those; otherwise fall back to all results
  if (brandMatches.length > 0) {
    results = brandMatches;
  }
}
```

**Test After Fix:**
- "pokemon cards" should return Pokemon products only
- "batman mask" should return Batman products only

---

### 🟡 P1 - HIGH: Fix This Week

---

#### BUG 4: Age Not Considered

**Problem:** Baby toys returned for teenagers, complex toys for toddlers.

| Query | Returns | Why It's Wrong |
|-------|---------|----------------|
| toys for teenager | Pull Along Toy Mr Dino | Baby toy for teen |
| toys for 9 year old | Pull Along Toy Mrs Rabbit | Toddler toy for 9yo |

**Fix Required:**
Parse age from query and factor into ranking:
```javascript
function extractAge(query) {
  const match = query.match(/(\d+)\s*year\s*old/);
  if (match) return parseInt(match[1]);
  if (query.includes('baby') || query.includes('newborn')) return 0;
  if (query.includes('toddler')) return 2;
  if (query.includes('teenager') || query.includes('teen')) return 14;
  return null;
}

// Boost/penalize based on age appropriateness
// - "Pull along" toys are for ages 1-3
// - "LEGO Technic" is for ages 10+
// - etc.
```

---

#### BUG 5: Price Filter Broken

**Problem:** "under X pounds" queries return nothing.

| Query | Returns |
|-------|---------|
| stocking fillers under 5 pounds | Nothing |
| party bag toys under 1 pound | Nothing |

**Fix Required:**
Parse price from query and filter results:
```javascript
function extractMaxPrice(query) {
  const match = query.match(/under\s*£?(\d+)\s*(pounds?|£)?/i);
  return match ? parseInt(match[1]) : null;
}

// In search:
const maxPrice = extractMaxPrice(userQuery);
if (maxPrice) {
  results = results.filter(p => p.price <= maxPrice);
}
```

---

#### BUG 6: Paw Patrol Character Names Return Nothing

**Problem:** Specific character searches fail.

| Query | Returns |
|-------|---------|
| paw patrol marshall | Nothing |
| paw patrol chase | Nothing |
| paw patrol skye | Nothing |
| paw patrol rubble | Nothing |

**Fix Required:**
Map character names to parent brand:
```javascript
const characterToBrand = {
  'marshall': 'paw patrol',
  'chase': 'paw patrol', 
  'skye': 'paw patrol',
  'rubble': 'paw patrol',
  'elsa': 'frozen',
  'anna': 'frozen',
  'pikachu': 'pokemon',
  // etc.
};

// If character found, also search for brand
const character = Object.keys(characterToBrand).find(c => query.includes(c));
if (character) {
  const brand = characterToBrand[character];
  // Search for both character AND brand products
}
```

---

### 🟢 P2 - MEDIUM: Next Sprint

---

#### BUG 7: Low Result Diversity (LEGO Dominates)

Most toy queries return 80%+ LEGO. Need variety.

**Fix:** Limit same brand to max 3 results, then fill with other brands.

---

#### BUG 8: Costume vs Swimming Costume

"Spiderman costume" returns "swimming costume".

**Fix:** When query is "costume" (dress-up intent), exclude swimwear.

---

## NOT BUGS - INVENTORY GAPS (Separate Task)

These return nothing because **we don't have these products in our database**:

### Missing Toy Brands:
- Roblox (toys, figures, gift cards)
- Sylvanian Families (all products)
- Nerf (all products)
- Hot Wheels / Matchbox
- Play-Doh (branded)

### Missing Craft/STEM:
- Aquabeads
- Hama Beads / Perler Beads
- Magnatiles
- Gravitrax
- Snap Circuits
- Pottery kits

### Missing Outdoor:
- Paddling pools
- Frisbees

**Action:** These need to be added to product feed from Awin/CJ - NOT a code fix.

---

## TESTING CHECKLIST

After ALL fixes, run these tests:

### Substring Fix Tests:
- [ ] "lol dolls" → NOT "lolly" products
- [ ] "train set" → NOT "training" products  
- [ ] "kids slide" → NOT footwear
- [ ] "swing set" → NOT dresses

### Clothing Filter Tests:
- [ ] "bike helmet" → Actual helmets, NOT t-shirts
- [ ] "dinosaur figures" → Figures, NOT sweatshirts
- [ ] "crayons" → Art supplies, NOT clothing

### Brand Match Tests:
- [ ] "pokemon cards" → Pokemon products
- [ ] "batman mask" → Batman products
- [ ] "paw patrol toys" → Paw Patrol products

### Speed Tests:
- [ ] All queries complete in <3 seconds

---

## SUMMARY: WHAT TO DO

1. **First:** Read this whole document
2. **Second:** Create FIXES.md if it doesn't exist
3. **Fix in order:** Bug 1 → Bug 2 → Bug 3 (P0 first)
4. **After each fix:** 
   - Log in FIXES.md
   - Run test checklist
   - Commit only if tests pass
5. **Don't touch:** Working code, speed optimizations, database indexes

---

## TEMPLATE FOR FIXES.md

```markdown
# SUNNY FIXES LOG
## Do not undo these fixes!

---

### Fix #1 - 2026-01-10
**Problem:** "lol dolls" returned "Ice Lolly Mug"
**Cause:** Substring matching - "lol" found inside "lolly"
**Solution:** Changed to word boundary regex matching
**File:** /server/search.js lines 45-52
**Test:** Search "lol dolls" - should not return lolly products
**Status:** ✅ Fixed

---

### Fix #2 - 2026-01-10
**Problem:** Queries taking 22 seconds
**Cause:** Missing database index
**Solution:** Added index on products.title
**File:** /server/db.js line 23
**Test:** All queries < 3 seconds
**Status:** ✅ Fixed - DO NOT REMOVE INDEX

---
```
