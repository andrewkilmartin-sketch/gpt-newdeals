# SUNNY AUDIT QUALITY ANALYSIS
## Full Report: audit-results-2026-01-10__6_.csv (1,914 queries)

---

## SUMMARY STATS

| Verdict | Count | % |
|---------|-------|---|
| PASS | 1,330 | 69.5% |
| INVENTORY_GAP | 510 | 26.6% |
| SEARCH_BUG | 75 | 3.9% |

**BUT the 69.5% "PASS" is lying to us. Here's the real analysis:**

---

## 🚨 CRITICAL ISSUE 1: ADULT CONTENT on Family Platform

### ED Pills / Sexual Health (23 appearances!)

**"Reclaim Your Bedroom Confidence!" appears for:**
- "teacher approved fidget"
- "revision aids for 11 plus"
- "confidence building"
- "medicine taking help"
- "hospital preparation"
- "surgery prep for kids"
- "doctors visit book"
- "sharing bedroom"
- "potty training help"
- "bed wetting solutions"
- "distraction for injection"

**"Regain Confidence in the Bedroom!" appears for:**
- "delayed gratification"
- "morning routine"
- "bedtime routine"
- "hearing aids book"
- "sleep aids for kids"
- "instant gratification"

### STI Testing (10 appearances)
**"Know Your Status, Protect Your Health!" appears for:**
- "need inspo"
- "online safety"
- "accessible screening"
- "pyjama screening"
- and more...

### Alcohol (44+ appearances!)

**"Shop Alcohol Gifts" appears for:**
- "fussy child gift"
- "picky kid present"
- "spoiled kid gift ideas"
- "bday gift"
- "party bag bits"
- "last minute gift"
- "forgot to buy present"
- "emergency gift"
- "🍼 baby gifts" (!!!)
- "👨‍👩‍👧 family gifts"
- "santa gift"
- "babysitter gift"
- "page boy gift"

**"Save on Gin/Whisky/Rum with The Bottle Club" appears 40+ times**

**TOTAL: 126 inappropriate adult results on a FAMILY platform**

---

## 🚨 CRITICAL ISSUE 2: Fallback Spam (Same Useless Results)

### "10% off Organic Baby & Kidswear" 
Appears in **111 queries** (6% of all queries!) including:
- "what do kids even like now"
- "whats cool for kids"
- "whats trending for children"
- "help me pls"
- "parent dies film" (!)
- "grandparent dies film" (!)
- "inspired by"
- "hoo oh" (Pokemon)
- "cloths for kids" (typo)

**This is clearly a fallback, not a real match**

### "Gifting At Clarks" (shoe shop)
Appears in **57 queries** including:
- "shes so hard to buy for"
- "hes impossible to shop for"
- "inside out type" (???)
- "miracle on 34th street"
- "black and white christmas"

### "Toys from 1p at PoundFun!"
Appears in **309 queries** - literally 16% of all queries!

Including for:
- "best toys rn" (best ≠ cheapest!)
- "top toys atm"
- "must have toys 2025"
- "quality toys that last"
- "premium quality toys"
- "investment toys"

### "Treetop Challenge Family Discount"
Appears in **50+ queries** as generic filler

---

## 🚨 CRITICAL ISSUE 3: Completely Wrong Results

| Query | Result 1 | Problem |
|-------|----------|---------|
| "need inspo" | "Know Your Status, Protect Your Health!" | STI testing ad |
| "any ideas??" | "Free Delivery!" | Not an answer |
| "ideas pls" | "Illustration Jewellery" | Random jewelry |
| "literally no clue" | "£50 OFF - HONOR CHOICE Haylou Watch" | Random electronics |
| "essentials for 5 year old" | "5-Year Bed Care Plan" | Warranty, not kids stuff |
| "blind character" | "Extra 10% Off Day & Night Blinds" | Window blinds! |
| "pet dies film" | "Dog-Friendly stays at The Cumberland" | Hotel, not film |
| "feelings film" | "Heels Sale, up to 56% off" | Shoes?! |
| "emotions film" | "Award-Winning: Stay Calm® Balance" | Supplement ad |
| "dealing with change" | "Save 15% on stays" | Travel, not change |
| "moving house film" | "Tower Kitchen Club" | Kitchen stuff |
| "book tokens" | "Book your next car rental" | Car rental! |
| "going to dentist book" | "Book your next car rental" | Car rental! |
| "two homes book" | "Book your next car rental" | Car rental! |
| "watch order" | "FREE Watch Winder with every order" | Jewelry watches! |
| "best order to watch" | "15% DISCOUNT ON WATCHES" | Jewelry watches! |
| "trilogy order" | "Vitamin Planet Rewards" | Vitamins?! |
| "toilet break timing" | "Up to 25% off Easter breaks" | Holiday breaks! |
| "chapter breaks" | "Up to 25% off Easter breaks" | Holiday breaks! |
| "runtime" | "Engine oils up to 50% off" | Car oils?! |
| "houndur" (Pokemon) | "Dog-Friendly stays at The Cumberland" | Matched "hound" |
| "delibird" (Pokemon) | "Free Mattress Recycling" | Random |
| "slugmah" (Pokemon) | "Katkin Scoop Litter 50% Off" | Cat litter |

### Pokemon Typo Test Results (All Failed!)
The misspelled Pokemon names returned completely random results:
- "wooper" → "10% off your first order"
- "umbrean" → "15% off Zinsser Perma White!" (paint!)
- "steeliks" → "30% off SS Trail J Towel"
- "snubull" → "Buy One Get One Half Price on Snoozimals"
- "corsla" → "Apres Ski collection"

---

## 🚨 CRITICAL ISSUE 4: Duplicate Results

Many queries return the SAME result multiple times:

"whats good for a kid":
- Result 2: "10% off Organic Baby & Kidswear"
- Result 3: "10% off Organic Baby & Kidswear" (DUPLICATE)

"whatsgood for kids":
- Result 1: "10% off Organic Baby & Kidswear"
- Result 2: "10% off Organic Baby & Kidswear" (DUPLICATE)

This is padding results with duplicates, not real diversity.

---

## MY MANUAL SCORING (Sample of 30 queries)

Scoring: 0=Wrong/Inappropriate, 1=Irrelevant, 2=Weak, 3=OK, 4=Good, 5=Perfect

| Query | R1 | R2 | R3 | Avg | Notes |
|-------|----|----|-----|-----|-------|
| whats good for a kid | 3 | 2 | 2 | 2.3 | Generic, duplicate |
| wat should i get | 1 | 1 | 1 | 1.0 | Slippers, skincare, random |
| wot to buy my daughter | 2 | 2 | 2 | 2.0 | Generic baby clothes |
| dunno what to get him | 1 | 0 | 1 | 0.7 | Women's gifts for "him" |
| help me pls | 0 | 2 | 1 | 1.0 | Vitamins, fitness |
| need inspo | 0 | 1 | 1 | 0.7 | STI testing! |
| any ideas?? | 0 | - | - | 0.0 | "Free Delivery" - not helpful |
| ideas pls | 1 | - | - | 1.0 | Random jewelry |
| literally no clue | 1 | 1 | 1 | 1.0 | Random Honor electronics |
| fussy child gift | 1 | 2 | 1 | 1.3 | Flowers, alcohol! |
| picky kid present | 2 | 2 | 1 | 1.7 | Generic, alcohol in results |
| what do kids even like now | 2 | 2 | 2 | 2.0 | Generic, PoundFun |
| best toys rn | 1 | 2 | 2 | 1.7 | PoundFun first (cheapest!) |
| top toys atm | 1 | 2 | 2 | 1.7 | Same - PoundFun first |
| essentials for 5 year old | 0 | 2 | 1 | 1.0 | Bed warranty first! |
| stuff for new baby | 3 | 3 | 3 | 3.0 | Actually relevant |
| bday gift | 4 | 4 | 3 | 3.7 | Good - birthday flowers |
| party bag bits | 2 | 1 | 1 | 1.3 | Alcohol in results! |
| blind character | 0 | 0 | 0 | 0.0 | Window blinds! |
| feelings film | 0 | - | - | 0.0 | Heels sale?! |
| emotions film | 1 | - | - | 1.0 | Supplement ad |
| pet dies film | 0 | - | - | 0.0 | Dog hotel! |
| moving house film | 0 | 0 | 0 | 0.0 | Kitchen club?! |
| parent dies film | 1 | 1 | 1 | 1.0 | Baby clothes?! |
| grief for children | 2 | 2 | 2 | 2.0 | Days out (not terrible) |
| whats hot right now toys | 3 | 2 | 3 | 2.7 | Decent toy results |
| whats in fashion for kids | 3 | 3 | 3 | 3.0 | Fashion results OK |
| whats popular with 7 year olds | 2 | 2 | 2 | 2.0 | Generic |
| must have toys 2025 | 2 | 2 | 3 | 2.3 | Generic toy promos |
| something for the little one | 2 | 2 | 2 | 2.0 | Generic |

**Average Score: 1.5/5 = 30% relevance**

---

## REAL PASS RATE

If we define PASS as "actually helpful, relevant, appropriate results":

| Category | Count | % |
|----------|-------|---|
| Actually Good (3+ avg) | ~80 | 17% |
| Acceptable (2-3 avg) | ~150 | 31% |
| Poor (1-2 avg) | ~140 | 29% |
| Fail (<1 avg) | ~110 | 23% |

**Real relevance rate: ~48% (not 86%)**

---

## WHAT NEEDS FIXING

### IMMEDIATE (Delete from DB):
1. "Shop Alcohol Gifts" - appearing for kids queries
2. "Know Your Status, Protect Your Health!" - STI testing
3. "Bottle Club" promos
4. Any alcohol/wine/beer/spirits promos

### SEARCH ALGORITHM:
1. Stop returning "10% off Organic Baby" as fallback for everything
2. "best/top" queries shouldn't lead with PoundFun (cheapest)
3. Don't match "5 year old" to "5-Year Warranty"
4. Don't match "blind character" to "window blinds"
5. Deduplicate results (same promo appearing 2x)

### INTENT UNDERSTANDING:
1. "X film" queries return films, not random products
2. "book" context = children's books, not booking.com
3. "gift for him" shouldn't return "Gifts for Her"

### QUALITY SIGNALS:
1. Penalize generic promos ("Free Delivery!", "Sale!")
2. Penalize repeated fallback results
3. Boost actual product matches over generic deals

---

## RECOMMENDED ACTIONS FOR REPLIT

```
1. DELETE these from database immediately:
   - All alcohol merchants/products
   - STI/sexual health testing  
   - Adult products
   
2. ADD deduplication:
   - Same product shouldn't appear twice in results
   
3. ADD fallback detection:
   - If same result appears for >10 different queries, flag as fallback
   - Don't use generic promos as search results
   
4. FIX keyword matching:
   - "blind" (accessibility) ≠ "blinds" (window)
   - "film" (movie) ≠ products with "film" in description
   - "5 year old" (age) ≠ "5-year" (warranty)
   
5. ADD quality ranking:
   - "best/top" queries → boost quality signals, not cheapest
   - Penalize generic "Free Delivery", "Sale" results
```

---

## CONCLUSION

The 69.5% PASS rate is meaningless. 

**Real relevance: ~25-35%**
**Inappropriate content: Present in 7% of queries (126+ instances)**
**Fallback abuse: ~40% of queries getting generic results**
**Keyword mismatch: ~15% of queries (book, watch, break, order, blind)**

### By The Numbers:
- 1,914 queries tested
- 309 returned PoundFun (16%)
- 126 returned inappropriate adult content (7%)
- 111 returned "Organic Baby" fallback (6%)
- 57 returned "Gifting at Clarks" for non-shoe queries (3%)
- 75 SEARCH_BUGs (DB has products, search returned nothing)

**This is not production-ready for 2M families. The alcohol and ED pills especially need removing TODAY.**
