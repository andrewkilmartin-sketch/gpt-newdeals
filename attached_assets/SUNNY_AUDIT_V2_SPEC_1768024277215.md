# SUNNY AUDIT V2 - IMPROVED TEST SPEC
## Get Better Data, Fix Faster

---

## CURRENT PROBLEMS WITH AUDIT

### 1. No Relevance Scoring
- aiScore columns are empty
- relevancePercent shows 100% when results are garbage
- "toys for newborn" → LEGO Speed Champions = PASS ???

### 2. Missing Critical Data
- No prices captured → can't verify price filters
- No age data → can't verify age filtering  
- No brand/character → can't verify character matching
- No merchant/category → can't check diversity

### 3. PASS/FAIL is Meaningless
- Everything passes because we're only checking "did we get results"
- Not checking "are these results CORRECT for this query"

---

## NEW AUDIT COLUMNS NEEDED

### Per-Query Metadata (Extract from Query)
```
queryAge         - extracted age (e.g., "3" from "toys for 3 year old")
queryGender      - extracted gender (e.g., "boy" from "gifts for boy")
queryPriceMax    - extracted price limit (e.g., "20" from "under £20")
queryCharacter   - extracted character (e.g., "paw patrol")
queryProductType - extracted type (e.g., "tower", "cards", "costume")
```

### Per-Result Data (Capture from Each Product)
```
product1_price    - actual price
product1_ageMin   - minimum age (from title/description)
product1_brand    - merchant/brand name
product1_hasImage - true/false
product1_matchesCharacter - does it contain the character name?
product1_matchesType - does it match requested product type?
```

### Calculated Scores
```
ageMatchScore     - what % of results are age-appropriate?
characterMatchScore - what % of results match character?
priceMatchScore   - what % of results are under price limit?
diversityScore    - how many unique brands in top 10?
duplicateCount    - how many duplicate products?
relevanceScore    - overall calculated relevance (0-100)
```

---

## NEW VERDICT LOGIC

### Current (Broken):
```javascript
verdict = results.length > 0 ? "PASS" : "FAIL"
```

### Improved:
```javascript
function calculateVerdict(query, results) {
  const parsed = parseQuery(query);
  let score = 0;
  let maxScore = 0;

  // 1. CHARACTER MATCH (Critical)
  if (parsed.character) {
    maxScore += 40;
    const matches = results.filter(r => 
      r.title.toLowerCase().includes(parsed.character)
    );
    score += (matches.length / results.length) * 40;
  }

  // 2. AGE APPROPRIATENESS (Critical)  
  if (parsed.age !== null) {
    maxScore += 30;
    const appropriate = results.filter(r => isAgeAppropriate(r, parsed.age));
    score += (appropriate.length / results.length) * 30;
  }

  // 3. PRICE COMPLIANCE (Important)
  if (parsed.priceMax) {
    maxScore += 20;
    const underBudget = results.filter(r => r.price <= parsed.priceMax);
    score += (underBudget.length / results.length) * 20;
  }

  // 4. DIVERSITY (Quality)
  maxScore += 10;
  const uniqueBrands = new Set(results.map(r => r.brand)).size;
  score += (uniqueBrands / 10) * 10; // Max 10 points for 10 unique brands

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 100;

  return {
    verdict: percentage >= 70 ? "PASS" : percentage >= 40 ? "PARTIAL" : "FAIL",
    score: Math.round(percentage),
    breakdown: {
      characterMatch: parsed.character ? `${matches.length}/${results.length}` : "N/A",
      ageMatch: parsed.age ? `${appropriate.length}/${results.length}` : "N/A",
      priceMatch: parsed.priceMax ? `${underBudget.length}/${results.length}` : "N/A",
      diversity: `${uniqueBrands}/10 brands`
    }
  };
}
```

---

## NEW CSV OUTPUT FORMAT

```csv
query,verdict,score,queryAge,queryGender,queryCharacter,queryPriceMax,characterMatchPct,ageMatchPct,priceMatchPct,diversityScore,duplicateCount,timeMs,p1_title,p1_price,p1_brand,p1_matchChar,p1_matchAge,p2_title,p2_price,p2_brand,p2_matchChar,p2_matchAge,...
```

### Example Row (Current - Bad):
```csv
"toys for 3 year old",PASS,173,10,100,0,,107,"LEGO Speed Champions",,
```

### Example Row (Improved - Good):
```csv
"toys for 3 year old",FAIL,35,3,null,null,null,0,20,100,3,2,107,"LEGO Speed Champions",49.99,"LEGO",false,false,"LEGO Batman",89.99,"LEGO",false,false,...
```

Now we can SEE:
- Score is 35% (not 100%)
- Age match is only 20% (most results wrong age)
- Diversity is 3 (too much LEGO)
- 2 duplicates found
- Character match is 0% (no character in query, N/A)

---

## SPECIFIC TESTS TO ADD

### Test 1: Age Differentiation
Run these 5 queries, results MUST be different:
```
toys for 1 year old
toys for 3 year old  
toys for 6 year old
toys for 10 year old
toys for 14 year old
```
**Metric:** uniqueResultsAcrossAges (should be >80% different)

### Test 2: Character Accuracy
```
paw patrol toys     → 100% must contain "paw patrol"
peppa pig toys      → 100% must contain "peppa pig"
pokemon cards       → 100% must contain "pokemon"
bluey toys          → 100% must contain "bluey"
```
**Metric:** characterMatchRate (should be 100%)

### Test 3: Price Filtering
```
toys under £10      → 100% must be ≤£10
toys under £20      → 100% must be ≤£20
lego under £30      → 100% must be ≤£30
```
**Metric:** priceComplianceRate (should be 100%)

### Test 4: Gender Variation
```
gifts for 5 year old boy
gifts for 5 year old girl
```
**Metric:** resultOverlapRate (should be <50% overlap)

### Test 5: Specificity
```
paw patrol tower    → must return playsets/towers, not random toys
pokemon cards       → must return trading cards, not watches
bluey house         → must return playsets, not pyjamas
```
**Metric:** productTypeMatchRate

### Test 6: Diversity
```
Any query → max 3 results from same brand
Any query → max 4 results from same category  
Any query → 0 duplicate products
```
**Metric:** diversityScore

---

## IMPLEMENTATION FOR REPLIT

### Step 1: Add Query Parser
```javascript
// utils/queryParser.js
export function parseQuery(query) {
  const q = query.toLowerCase();
  
  return {
    age: extractAge(q),
    gender: extractGender(q),
    priceMax: extractPrice(q),
    character: extractCharacter(q),
    productType: extractProductType(q)
  };
}

function extractAge(q) {
  const match = q.match(/(\d+)\s*year/);
  if (match) return parseInt(match[1]);
  if (q.includes('newborn') || q.includes('baby')) return 0;
  if (q.includes('toddler')) return 2;
  if (q.includes('teen')) return 14;
  return null;
}

function extractGender(q) {
  if (/\b(boy|son|nephew|his|him)\b/.test(q)) return 'boy';
  if (/\b(girl|daughter|niece|her|she)\b/.test(q)) return 'girl';
  return null;
}

function extractPrice(q) {
  const match = q.match(/under\s*£?(\d+)/);
  return match ? parseInt(match[1]) : null;
}

function extractCharacter(q) {
  const chars = ['paw patrol', 'peppa pig', 'bluey', 'frozen', 'spiderman', 
    'batman', 'mario', 'sonic', 'pokemon', 'minecraft', 'fortnite', 
    'disney', 'marvel', 'star wars', 'harry potter', 'barbie', 'lego'];
  return chars.find(c => q.includes(c)) || null;
}

function extractProductType(q) {
  const types = {
    'tower': 'playset', 'house': 'playset', 'castle': 'playset',
    'cards': 'trading cards', 'card': 'trading cards',
    'costume': 'costume', 'dress up': 'costume', 'outfit': 'costume',
    'figure': 'action figure', 'figures': 'action figure',
    'plush': 'soft toy', 'soft toy': 'soft toy', 'teddy': 'soft toy',
    'book': 'book', 'books': 'book',
    'game': 'game', 'games': 'game'
  };
  for (const [keyword, type] of Object.entries(types)) {
    if (q.includes(keyword)) return type;
  }
  return null;
}
```

### Step 2: Add Result Scorer
```javascript
// utils/resultScorer.js
export function scoreResult(product, parsedQuery) {
  const scores = {
    characterMatch: null,
    ageMatch: null,
    priceMatch: null,
    hasImage: product.image ? 1 : 0
  };

  const title = product.title.toLowerCase();

  // Character match
  if (parsedQuery.character) {
    scores.characterMatch = title.includes(parsedQuery.character) ? 1 : 0;
  }

  // Age match (estimate from product)
  if (parsedQuery.age !== null) {
    const productAge = estimateProductAge(product);
    if (productAge) {
      const diff = Math.abs(productAge - parsedQuery.age);
      scores.ageMatch = diff <= 2 ? 1 : diff <= 4 ? 0.5 : 0;
    }
  }

  // Price match
  if (parsedQuery.priceMax && product.price) {
    scores.priceMatch = product.price <= parsedQuery.priceMax ? 1 : 0;
  }

  return scores;
}

function estimateProductAge(product) {
  const text = (product.title + ' ' + (product.description || '')).toLowerCase();
  
  const ageMatch = text.match(/(\d+)\+/) || text.match(/ages?\s*(\d+)/);
  if (ageMatch) return parseInt(ageMatch[1]);
  
  if (text.includes('duplo') || text.includes('toddler')) return 2;
  if (text.includes('baby') || text.includes('infant')) return 0;
  if (text.includes('teen')) return 14;
  
  return null;
}
```

### Step 3: Update Audit Runner
```javascript
// In your audit code
import { parseQuery } from './utils/queryParser';
import { scoreResult } from './utils/resultScorer';

async function runAudit(query) {
  const parsed = parseQuery(query);
  const results = await search(query);
  
  // Score each result
  const scoredResults = results.map(r => ({
    ...r,
    scores: scoreResult(r, parsed)
  }));

  // Calculate aggregates
  const characterMatchPct = calculatePct(scoredResults, 'characterMatch');
  const ageMatchPct = calculatePct(scoredResults, 'ageMatch');
  const priceMatchPct = calculatePct(scoredResults, 'priceMatch');
  
  // Diversity
  const brands = new Set(results.map(r => r.merchant || r.brand));
  const diversityScore = brands.size;
  
  // Duplicates
  const titles = results.map(r => r.title);
  const duplicateCount = titles.length - new Set(titles).size;

  // Overall verdict
  let totalScore = 0;
  let maxScore = 0;
  
  if (parsed.character) {
    maxScore += 40;
    totalScore += characterMatchPct * 0.4;
  }
  if (parsed.age !== null) {
    maxScore += 30;
    totalScore += ageMatchPct * 0.3;
  }
  if (parsed.priceMax) {
    maxScore += 20;
    totalScore += priceMatchPct * 0.2;
  }
  maxScore += 10;
  totalScore += (diversityScore / 10) * 10;

  const finalScore = maxScore > 0 ? (totalScore / maxScore) * 100 : 100;
  const verdict = finalScore >= 70 ? "PASS" : finalScore >= 40 ? "PARTIAL" : "FAIL";

  return {
    query,
    verdict,
    score: Math.round(finalScore),
    parsed,
    characterMatchPct,
    ageMatchPct, 
    priceMatchPct,
    diversityScore,
    duplicateCount,
    results: scoredResults
  };
}
```

---

## EXPECTED OUTPUT AFTER IMPROVEMENTS

### Before (Current):
```
Query: "toys for 3 year old"
Verdict: PASS
Score: 100%
Products: LEGO Speed Champions, LEGO Batman, LEGO Speed Champions (duplicate!)...
```

### After (Improved):
```
Query: "toys for 3 year old"
Verdict: FAIL
Score: 28%
Breakdown:
  - Age Match: 20% (only 2/10 are age-appropriate)
  - Diversity: 3/10 (too much LEGO)
  - Duplicates: 2 found
Products: [with individual scores shown]
```

Now you can see EXACTLY what's broken and fix it.

---

## SUMMARY

| Current Audit | Improved Audit |
|---------------|----------------|
| PASS/FAIL only | Score 0-100% |
| No reason why | Breakdown by category |
| Can't see prices | Price compliance % |
| Can't see ages | Age match % |
| Can't spot duplicates | Duplicate count |
| Can't check characters | Character match % |
| 100% relevance (lie) | Real relevance score |

**Better data = Faster fixes = Better Sunny**
