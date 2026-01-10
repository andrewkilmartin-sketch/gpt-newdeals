# REPLIT CRITICAL INSTRUCTION - READ FIRST

---

## ⚠️ STOP BLAMING INVENTORY

**We have 1.5 MILLION products. We do NOT have an inventory problem.**

When you search and find "0 results", the problem is your SEARCH LOGIC, not missing inventory.

**Example of the loop you keep doing:**

1. You search for "marvel hulk" → 0 results
2. You say "inventory gap - no Hulk products"
3. We tell you to look again
4. You find Hulk products
5. Next query, you repeat the same mistake

**The real problem:** Your search query is too restrictive, or using wrong terms, or wrong filters.

**Before saying "inventory gap":**
1. Search the database manually with just the brand: `SELECT * FROM products WHERE name ILIKE '%hulk%' LIMIT 10`
2. If products exist, your search logic is broken - FIX IT
3. Only say "inventory gap" if the raw SQL returns 0 results

---

## KNOWN PRODUCTS THAT EXIST (Stop saying they don't)

We have confirmed these exist in the database:
- Marvel products (Hulk, Spiderman, etc.)
- Paw Patrol products
- Peppa Pig products  
- Frozen products
- LEGO products
- Disney products
- Books (children's books DO exist)

If your search returns 0 for these, YOUR SEARCH IS BROKEN.

---

## BEFORE MAKING ANY CHANGES

1. **Read CRITICAL_FIXES.md** - tell me what fixes are logged
2. **Read REPLIT_FIX_INSTRUCTIONS.md** - understand the rules
3. **Run regression tests** - tell me pass/fail count
4. **Do NOT undo previous fixes**

---

## AFTER EVERY FIX

**Update CRITICAL_FIXES.md with:**
- Fix number and date
- Problem (what was broken)
- Root cause (WHY it was broken - not "inventory gap")
- Solution (what you changed)
- File and line numbers
- Test query to verify

**Run regression tests.** Don't commit if tests fail.

---

## THE REAL CAUSES OF "0 RESULTS" (Not inventory)

| You Say | Real Cause |
|---------|------------|
| "No Hulk products" | Search requires exact brand match but brand field says "Marvel" not "Hulk" |
| "No books in inventory" | Search looking in wrong category or too restrictive filters |
| "No Paw Patrol toys" | Character not injected into searchTerms, only in post-filter |
| "No results for X" | searchTerms are generic ["toys","games"] not ["X"] |

---

## DEBUG STEPS BEFORE CLAIMING INVENTORY GAP

```sql
-- Step 1: Does the product exist at all?
SELECT COUNT(*) FROM products WHERE name ILIKE '%peppa%';

-- Step 2: What does the product look like?
SELECT name, brand, category FROM products WHERE name ILIKE '%peppa%' LIMIT 5;

-- Step 3: Why didn't search find it?
-- Check: Is brand filter excluding it?
-- Check: Is category filter excluding it?
-- Check: Is searchTerms missing the keyword?
```

If Step 1 returns >0 but search returns 0, the bug is in YOUR CODE.

---

## CURRENT OPEN ISSUES

### Issue: Books queries not finding books

**Wrong diagnosis:** "Inventory gap - no children's books"

**Correct diagnosis:** Search logic issue. Books exist. Find why search isn't returning them.

**Debug:**
```sql
SELECT name, category FROM products 
WHERE name ILIKE '%peppa%' AND name ILIKE '%book%' 
LIMIT 10;
```

If results exist, fix the search. If truly 0 results, THEN it's inventory.

---

## REGRESSION TEST REQUIREMENTS

These must ALL pass before any commit:

- [ ] "spiderman toys" → Returns Marvel Spiderman products
- [ ] "paw patrol toys" → Returns Paw Patrol products
- [ ] "lol dolls" → Returns LOL Surprise, NOT lolly products
- [ ] "bike helmet" → Returns helmets, NOT t-shirts
- [ ] "witch costume" → Returns costumes, NOT sweatshirts
- [ ] "toys for 5 year old" → Returns age-appropriate toys
- [ ] Price filters working
- [ ] All queries < 3 seconds (except complex searches)

---

## SUMMARY

1. We have 1.5M products - inventory is NOT the problem
2. When search returns 0, debug your search logic FIRST
3. Read CRITICAL_FIXES.md before every session
4. Update CRITICAL_FIXES.md after every fix
5. Run regression tests before committing

---

## 📋 AGENT MISTAKE LOG - "Inventory Gap" Claims That Were WRONG

This section logs every time the agent claimed "inventory gap" but the products actually existed. This is a learning tool to prevent repeating the same mistakes.

### 2026-01-10: Peppa Pig Books

**What I said:** "Peppa Pig books not found - inventory gap"

**What actually existed:**
```sql
SELECT name FROM products WHERE name ILIKE '%peppa%' AND name ILIKE '%book%';
-- Result: "Personalised Peppa Pig First Year Record Book" (EXISTS!)
```

**Real problem:** My filters were excluding it because:
1. Category "Gifts" wasn't in BOOKS_NEGATIVE_CATEGORIES exception list
2. Wellington boots and T-shirts were being returned instead because "Shoes" category wasn't blocked

**Lesson:** The book existed. My filter logic was broken. I should have run the SQL query FIRST before claiming inventory gap.

---

### 2026-01-10: Vampire Costume

**What I said:** "No vampire costumes in database"

**What actually existed:**
```sql
SELECT COUNT(*) FROM products WHERE name ILIKE '%costume%' AND category ILIKE '%dress up%';
-- Result: 30+ actual costume products
```

**Real problem:** My costume filter was letting through:
- Barbie costume dolls (not wearable)
- Baby buntings (clothing, not costume)
- Italian swimwear "copricostume" (foreign language)

**Lesson:** Costumes existed. My filter wasn't blocking non-wearable items. SQL check would have shown products existed.

---

### 2026-01-10: LEGO Query Returning Clothing

**What I said:** "Nike x LEGO is valid LEGO inventory"

**What actually existed:**
```sql
SELECT COUNT(*) FROM products WHERE brand ILIKE 'lego' AND category NOT ILIKE '%clothing%';
-- Result: 10,000+ actual LEGO toys
```

**Real problem:** My search was returning Nike x LEGO clothing collab instead of actual LEGO sets because the toy context filter wasn't excluding clothing categories.

**Lesson:** LEGO toys existed in abundance. I was just returning the wrong products.

---

### Pattern of Mistakes

| Date | Query | I Said | Reality | Root Cause |
|------|-------|--------|---------|------------|
| 2026-01-10 | peppa pig books | Inventory gap | Book exists | Filter excluded "Gifts" category |
| 2026-01-10 | vampire costume | No costumes | 30+ costumes | Filter didn't block dolls/buntings |
| 2026-01-10 | lego | Nike collab is fine | 10K+ LEGO toys | Didn't filter clothing |
| 2026-01-10 | dinosaur figures | Sleepsuits are figures | 100+ actual figures | Didn't block "Baby Clothes" category |

---

### Checklist Before Saying "Inventory Gap"

- [ ] Did I run `SELECT COUNT(*) FROM products WHERE name ILIKE '%term%'`?
- [ ] If count > 0, the problem is MY CODE, not inventory
- [ ] Did I check what categories/brands the products have?
- [ ] Did I verify my filters aren't excluding valid products?
- [ ] Only claim inventory gap if raw SQL returns 0 results

---

## ✅ SUCCESSES - When I Did It Right

### 2026-01-10: Calico Critters → Sylvanian Families

**Initial claim:** "Calico critters not found - might be inventory gap"

**What I did right:**
```sql
SELECT name, brand FROM products WHERE brand ILIKE '%sylvanian%' LIMIT 10;
-- Result: 10+ Sylvanian Families products!
```

**The actual problem:** "Calico Critters" is the US name, UK uses "Sylvanian Families"

**The fix:** Added PHRASE_SYNONYMS mapping to translate US → UK brand names automatically

**Result:** "calico critters" now returns Sylvanian Families products

**Lesson:** When products seem missing, check if the BRAND NAME differs by region. SQL first, assumptions never.

---

## ⚠️ GENUINE INVENTORY GAPS (Confirmed with SQL)

These are the ONLY confirmed genuine inventory gaps - verified with raw SQL returning 0 results:

| Product | Query | SQL Verification | Status |
|---------|-------|------------------|--------|
| LOL Surprise Dolls | "lol dolls" | `SELECT name FROM products WHERE name ILIKE '%lol surprise%'` = **6 products exist but are all merchandise (games, puzzles, shoes) - NO actual doll/figure toys** | MISSING PRODUCT TYPE (search works, inventory lacks actual dolls) |
| Vampire Costumes | "vampire costume" | `SELECT COUNT(*) FROM products WHERE name ILIKE '%vampire%' AND name ILIKE '%costume%'` = **0** | NO INVENTORY |

**Before adding to this list:**
1. Run the exact SQL query against the database
2. Confirm 0 results (or <10 for "low inventory")
3. Document the query used for verification

**This list should be SHORT.** If it's growing, we have a data sourcing problem. If search keeps "failing" for products not on this list, the bug is in our code.
