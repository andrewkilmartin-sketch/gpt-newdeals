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
