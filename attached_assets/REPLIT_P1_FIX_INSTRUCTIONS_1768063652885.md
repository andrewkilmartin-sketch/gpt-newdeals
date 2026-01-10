# REPLIT FIX INSTRUCTIONS - P1 BUGS
## After P0 Bugs 1-3 Are Complete

---

## ⚠️ BEFORE YOU START

**Read CRITICAL_FIXES.md and REPLIT_FIX_INSTRUCTIONS.md first.**

**Tell me what fixes are already logged (list them).**

**Run regression tests and tell me current pass/fail count.**

---

## P1 BUG 4: Costume Category Filter

**Problem:** "witch costume" returns "Incredibles Costume Logo Sweatshirt" - a t-shirt with "costume" in the name, not an actual costume.

16 costume queries return this same wrong product:
- witch costume → Incredibles Costume Logo Sweatshirt
- vampire costume → Incredibles Costume Logo Sweatshirt
- zombie costume → Incredibles Costume Logo Sweatshirt
- skeleton costume → Incredibles Costume Logo Sweatshirt
- animal costume → Incredibles Costume Logo Sweatshirt
- reindeer costume → Incredibles Costume Logo Sweatshirt

**Root Cause:** Product name contains "Costume" so it matches keyword, but it's a t-shirt with "costume" printed on it, not fancy dress.

**Fix Required:** When query is "[X] costume" (and NOT "swimming costume"):
- Prioritise products in Fancy Dress / Costumes category
- Exclude products where "costume" is just in the graphic/print name (t-shirts, hoodies, sweatshirts)
- Exclude swimwear unless query specifically says "swimming"

**Test After Fix:**
- "witch costume" → actual witch costume, NOT t-shirts
- "spiderman costume" → Spiderman dress-up, NOT swimming costume

---

## P1 BUG 5: Books Category Filter

**Problem:** "peppa pig books" returns "Rainbow Stripe Backpack" because "book bag" contains "book".

Examples:
- julia donaldson books → Grey Dino Book Bag
- peppa pig books → Rainbow Stripe Backpack
- paw patrol books → Medium Backpack
- picture books → "Reading A Book" Sweatshirt

**Root Cause:** "book" substring matches "book bag", "bookshop", clothing with book graphics.

**Fix Required:** When query contains "books":
- Prioritise products in Books category
- Exclude bags, backpacks, clothing
- Use word boundary so "book" doesn't match "book bag"

**Test After Fix:**
- "peppa pig books" → Peppa Pig books, NOT bags
- "harry potter books" → Harry Potter books, NOT backpacks

---

## P1 BUG 6: Investigate "NosiBotanical Vest" Spam

**Problem:** One single product "Cotton-Blend 'NosiBotanical Nulla' Vest" appears for 16+ completely unrelated queries:
- super soaker
- football goal
- bike for 7 year old
- david walliams books
- harry potter books
- phonics books
- sewing kit for kids
- magna tiles
- bracelet making kit

**Root Cause:** Unknown. This product has something in its metadata/description/tags that matches extremely broadly.

**Fix Required:** 
1. First investigate: WHY is this product matching so many queries? Check its description, tags, category.
2. Either fix the product metadata, OR
3. Add logic to detect and deprioritise products that match too many unrelated queries

**Test After Fix:**
- "super soaker" → water guns, NOT clothing
- "harry potter books" → books, NOT vests

---

## ⚠️ AFTER EACH FIX

**Update CRITICAL_FIXES.md with:**
- Fix number
- Date
- Problem (what was broken)
- Root Cause (why it was broken)
- Solution (what you changed)
- File and line numbers
- Test query to verify

**Run regression tests.** Don't move to next bug until tests pass.

---

## SPEED BUGS (Separate Investigation)

11 queries taking >10 seconds:

| Query | Time |
|-------|------|
| jewellery making kit | 23,834ms |
| cot bed | 21,591ms |
| swim trunks | 11,308ms |
| beginner readers | 10,954ms |
| toys for 8 year old | 10,602ms |

**Do not fix these yet.** Complete P1 bugs 4-6 first. Then investigate speed issues separately.

---

## NOT CODE FIXES - INVENTORY GAPS

These return nothing because products don't exist. Do not try to fix with code:

- Roblox, Sylvanian Families, Nerf, Hot Wheels, Matchbox
- Jenga, Buckaroo, Hungry Hippos, Cluedo Junior
- Paddling pool, Frisbee, Swingball
- Aquabeads, Hama beads, Play-Doh, Magnatiles
- Roald Dahl books, Dog Man, Captain Underpants

These need adding to product feed from Awin/CJ.

---

## SUMMARY

1. Read CRITICAL_FIXES.md first
2. Run baseline tests
3. Fix Bug 4 (costume filter)
4. Update CRITICAL_FIXES.md
5. Run tests
6. Fix Bug 5 (books filter)
7. Update CRITICAL_FIXES.md
8. Run tests
9. Fix Bug 6 (NosiBotanical investigation)
10. Update CRITICAL_FIXES.md
11. Run tests
12. Report back with all test results
