import OpenAI from 'openai';
import type { QueryInterpretation, ProductAttributes } from './types';
import { getCachedInterpretation, setCachedInterpretation, getDbCachedInterpretation } from './cache';

export const SIMPLE_PATTERNS: Record<string, { category: string; keywords: string[]; mustMatch?: string[] }> = {
  'shoes': { category: 'Shoes', keywords: ['shoes', 'footwear'] },
  'school shoes': { category: 'Shoes', keywords: ['school shoes', 'school footwear'], mustMatch: ['school'] },
  'running shoes': { category: 'Shoes', keywords: ['running shoes', 'running trainers'], mustMatch: ['running'] },
  'football boots': { category: 'Shoes', keywords: ['football boots', 'football shoes'], mustMatch: ['football'] },
  'trainers': { category: 'Shoes', keywords: ['trainers', 'sneakers', 'shoes'] },
  'sneakers': { category: 'Shoes', keywords: ['sneakers', 'trainers', 'shoes'] },
  'boots': { category: 'Shoes', keywords: ['boots', 'footwear'] },
  'wellies': { category: 'Shoes', keywords: ['wellies', 'wellington boots', 'rain boots'] },
  'sandals': { category: 'Shoes', keywords: ['sandals', 'flip flops', 'footwear'] },
  'slippers': { category: 'Shoes', keywords: ['slippers', 'indoor shoes'] },
  'headphones': { category: 'Headphones', keywords: ['headphones', 'earphones', 'audio'] },
  'earbuds': { category: 'Headphones', keywords: ['earbuds', 'wireless earphones', 'headphones'] },
  'toys': { category: 'Toys', keywords: ['toys', 'games', 'playset'] },
  'toy': { category: 'Toys', keywords: ['toy', 'toys', 'playset'] },
  'dolls': { category: 'Toys', keywords: ['dolls', 'doll', 'toys', 'figure'] },
  'doll': { category: 'Toys', keywords: ['doll', 'dolls', 'toy', 'figure'] },
  'lego': { category: 'Toys', keywords: ['lego', 'building blocks'] },
  'figure': { category: 'Toys', keywords: ['figure', 'action figure', 'toy'] },
  'figures': { category: 'Toys', keywords: ['figures', 'action figures', 'toys'] },
  'playset': { category: 'Toys', keywords: ['playset', 'play set', 'toys'] },
  'playsets': { category: 'Toys', keywords: ['playsets', 'play sets', 'toys'] },
  'plush': { category: 'Toys', keywords: ['plush', 'soft toy', 'stuffed animal'] },
  'game': { category: 'Toys', keywords: ['game', 'games', 'toy'] },
  'games': { category: 'Toys', keywords: ['games', 'game', 'toys'] },
  'puzzle': { category: 'Toys', keywords: ['puzzle', 'puzzles', 'jigsaw'] },
  'puzzles': { category: 'Toys', keywords: ['puzzles', 'puzzle', 'jigsaws'] },
  'backpack': { category: 'Toys', keywords: ['backpack', 'bag', 'rucksack'] },
  'bag': { category: 'Toys', keywords: ['bag', 'backpack', 'rucksack'] },
  'pyjamas': { category: 'Clothing', keywords: ['pyjamas', 'pajamas', 'pjs', 'nightwear'] },
  'costume': { category: 'Clothing', keywords: ['costume', 'dress up', 'outfit'] },
  'dress': { category: 'Clothing', keywords: ['dress', 'outfit', 'clothing'] },
};

export const KNOWN_BRANDS = [
  'nike', 'adidas', 'puma', 'reebok', 'new balance', 'vans', 'converse', 'skechers',
  'clarks', 'start rite', 'geox', 'lelli kelly', 'kickers',
  'dr martens', 'timberland', 'ugg', 'hunter',
  'joules', 'north face', 'columbia', 'crocs', 'birkenstock', 'havaianas',
  'sony', 'bose', 'apple', 'samsung', 'jbl',
  'lego', 'playmobil', 'barbie', 'hot wheels', 'sylvanian families', 'fisher price', 'vtech', 'hasbro', 'mattel', 'leapfrog', 'melissa and doug',
  'orchard toys', 'ravensburger', 'galt', 'tomy', 'little tikes', 'mega bloks', 'duplo', 'brio', 'hape', 'djeco', 'janod', 'early learning centre',
  'sophie giraffe', 'sophie la girafe', 'snuzpod', 'sleepyhead', 'dockatot', 'grobag', 'ergo', 'tula',
  'tommee tippee', 'mam', 'chicco', 'baby bjorn', 'silver cross', 'bugaboo', 'joie', 'maxi cosi',
  'paw patrol', 'peppa pig', 'bluey', 'hey duggee', 'cocomelon', 'baby shark',
  'disney', 'frozen', 'disney princess', 'spiderman', 'batman', 'marvel', 'avengers',
  'pokemon', 'minecraft', 'fortnite', 'roblox', 'mario', 'sonic',
  'harry potter', 'star wars', 'thomas', 'paddington', 'gruffalo',
  'pj masks', 'ben and holly', 'numberblocks', 'octonauts', 'gabby', 'encanto', 'lol surprise', 'moana'
];

export function detectBrand(query: string): { brand: string | undefined; cleanedQuery: string } {
  const lower = query.toLowerCase().trim();
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand)) {
      const detectedBrand = brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const cleanedQuery = lower.replace(brand, '').trim();
      return { brand: detectedBrand, cleanedQuery };
    }
  }
  return { brand: undefined, cleanedQuery: lower };
}

export function expandQueryFallback(query: string): QueryInterpretation {
  const lower = query.toLowerCase();
  const searchTerms: string[][] = [];
  let mustHaveAny: string[] = [];
  let rerankerContext = '';
  const context: QueryInterpretation['context'] = {};

  if (lower.includes('dad') || lower.includes('father') || lower.includes('him') || lower.includes('men')) {
    mustHaveAny = ['gift', 'present', 'hamper', 'for him', 'fathers day'];
    searchTerms.push(['mens'], ['gadget'], ['grooming'], ['watch']);
    rerankerContext = 'Products suitable as gifts for adult men';
    context.recipient = 'adult male';
  }
  else if (lower.includes('mum') || lower.includes('mother') || lower.includes('her') || lower.includes('women')) {
    mustHaveAny = ['gift', 'present', 'hamper', 'for her', 'mothers day'];
    searchTerms.push(['womens'], ['jewellery'], ['pamper'], ['beauty']);
    rerankerContext = 'Products suitable as gifts for adult women';
    context.recipient = 'adult female';
  }
  else if (lower.includes('kid') || lower.includes('child') || lower.includes('boy') || lower.includes('girl')) {
    mustHaveAny = ['toy', 'gift', 'playset', 'game'];
    searchTerms.push(['kids'], ['lego'], ['craft'], ['outdoor']);
    rerankerContext = 'Products suitable for children';
    context.recipient = 'child';
  }
  else if (lower.includes('toddler') || lower.includes('baby') || /\b[1-3]\s*year/.test(lower)) {
    mustHaveAny = ['toy', 'gift', 'playset'];
    searchTerms.push(['toddler'], ['peppa pig'], ['duplo'], ['paw patrol']);
    rerankerContext = 'Age-appropriate products for toddlers (1-3 years)';
    context.recipient = 'toddler';
    context.ageRange = '1-3';
  }
  else if (lower.includes('rainy') || lower.includes('indoor')) {
    mustHaveAny = ['activity', 'craft kit', 'game', 'playset'];
    searchTerms.push(['indoor'], ['puzzle'], ['board game'], ['activity book']);
    rerankerContext = 'Indoor activities for entertaining children';
    context.occasion = 'indoor activity';
  }
  else if (lower.includes('birthday')) {
    mustHaveAny = ['gift', 'present', 'toy', 'birthday'];
    searchTerms.push(['birthday'], ['lego'], ['game'], ['craft']);
    rerankerContext = 'Products suitable as birthday gifts';
    context.occasion = 'birthday';
  }
  else if (lower.includes('gift') || lower.includes('present')) {
    mustHaveAny = ['gift', 'present', 'hamper'];
    searchTerms.push(['gift set'], ['toy'], ['game'], ['craft']);
    rerankerContext = 'Products that make good gifts';
    context.occasion = 'gift';
  }
  else {
    searchTerms.push([query]);
  }

  return {
    isSemanticQuery: searchTerms.length > 1 || searchTerms[0]?.[0] !== query,
    originalQuery: query,
    expandedKeywords: searchTerms.flat(),
    searchTerms,
    mustHaveAny,
    context,
    rerankerContext
  };
}

const GPT_SYSTEM_PROMPT = `You are a UK shopping search assistant. Extract structured info from queries.

CRITICAL RULES:
1. PRESERVE QUALIFIERS: If query has a specific qualifier, it MUST go in mustMatch.
   Qualifiers include: school, running, wedding, party, outdoor, baby, kids, children, toddler, infant, newborn, boys, girls, mens, womens
   - "school shoes" → mustMatch: ["school"] because user wants SCHOOL shoes
   - "running shoes" → mustMatch: ["running"] because user wants RUNNING shoes  
   - "sleeping bag baby" → mustMatch: ["baby"] because user wants BABY sleeping bags
   - "headphones kids" → mustMatch: ["kids"] because user wants KIDS headphones
   - "pyjamas toddler" → mustMatch: ["toddler"] because user wants TODDLER pyjamas

2. BRANDS MUST GO IN mustMatch: If user mentions a brand, it MUST appear in results.
   - "clarks school shoes" → mustMatch: ["clarks", "school"]
   - "nike air force" → mustMatch: ["nike", "air force"]
   
3. CHARACTER/LICENSE NAMES = BRANDS: Treat characters the same as brands - they MUST appear in results.
   - "paw patrol backpack" → mustMatch: ["paw patrol"]
   - "peppa pig toys" → mustMatch: ["peppa pig"]
   - "minecraft duvet" → mustMatch: ["minecraft"]
   - "frozen costume" → mustMatch: ["frozen", "costume"]

4. PRODUCT TYPE WORDS MUST ALWAYS GO IN mustMatch: The main product word MUST be in mustMatch to filter results.
   ALWAYS include the product noun in mustMatch:
   - "baby monitor video" → mustMatch: ["baby", "monitor"] - user wants BABY MONITORS specifically
   - "plate suction baby" → mustMatch: ["suction", "plate", "baby"] - user wants BABY SUCTION PLATES
   - "door bouncer baby" → mustMatch: ["bouncer", "baby"] - user wants BABY BOUNCERS
   - "posting box" → mustMatch: ["posting", "box"] - user wants POSTING BOXES
   - "tunnel play" → mustMatch: ["tunnel"] - user wants play TUNNELS
   - "teepee kids" → mustMatch: ["teepee", "kids"] - user wants KIDS TEEPEES (MUST have teepee!)
   - "climbing frame garden" → mustMatch: ["climbing", "frame"] - user wants CLIMBING FRAMES
   - "trampoline 8ft" → mustMatch: ["trampoline", "8ft"] - user wants 8FT trampolines specifically
   - "white noise machine" → mustMatch: ["white noise"] OR mustMatch: ["sound machine"] - specific product
   
   EVENT + PRODUCT TYPE QUERIES: For events/occasions, require the product type:
   - "world book day costume" → mustMatch: ["costume"] + searchKeywords: ["costume", "dress up", "book character"]
   - "halloween costume" → mustMatch: ["costume"] + searchKeywords: ["costume", "scary", "witch", "zombie"]
   - "christmas jumper" → mustMatch: ["jumper"] + searchKeywords: ["jumper", "sweater", "festive"]

5. PRICE EXTRACTION:
   - minPrice = from "over £20", "at least £30", "from £25", "more than £15"
   - maxPrice = from "under £50", "up to £40", "max £30", "cheap" (£50), "budget" (£40)
   - "between £25 and £50" → {minPrice: 25, maxPrice: 50}
   - "toys £15 to £30" → {minPrice: 15, maxPrice: 30}

6. NEVER put in mustMatch/searchKeywords: best, cheap, budget, good, quality, top, affordable

BRAND RECOGNITION - These are all brands that MUST go in mustMatch:
- Sportswear: nike, adidas, puma, reebok, new balance, vans, converse, skechers
- Kids shoes: clarks, start rite, geox, lelli kelly, kickers
- Boots: dr martens, timberland, ugg, hunter
- Outdoor: joules, north face, columbia, crocs, birkenstock, havaianas
- Toys: lego, playmobil, barbie, hot wheels, sylvanian families, fisher price, vtech
- Baby: tommee tippee, mam, chicco, baby bjorn, silver cross, bugaboo

CHARACTER RECOGNITION - These are licenses that MUST go in mustMatch:
- paw patrol, peppa pig, bluey, hey duggee, cocomelon, baby shark
- frozen, disney princess, spiderman, batman, marvel, avengers
- pokemon, minecraft, fortnite, roblox, mario, sonic
- harry potter, star wars, thomas, paddington, gruffalo
- pj masks, ben and holly, numberblocks, octonauts, gabby, encanto

Extract:
- productType: What product? (shoes, trainers, backpack, costume, etc.)
- categoryFilter: Shoes/Clothing/Electronics/Toys/Headphones or null
- brand: Brand name or null
- character: Character/license name or null (paw patrol, frozen, etc.)
- size: M, L, XL, 6, 10 or null
- color: grey, black, red, pink or null  
- gender: mens, womens, kids, boys, girls, unisex or null
- ageRange: toddler, 3-5, 5-7, 8-10, teen or null
- minPrice: number or null (from "over", "at least", "from", "more than")
- maxPrice: number or null (from "under", "up to", "max", "cheap", "budget")
- searchKeywords: product synonyms to broaden search
- mustMatch: ALL brands + characters + qualifiers + product types that MUST appear in results

Output JSON only:
{
  "productType": "string",
  "categoryFilter": "Shoes|Clothing|Electronics|Toys|Headphones or null",
  "brand": "string or null",
  "character": "string or null",
  "size": "string or null",
  "color": "string or null",
  "gender": "mens|womens|kids|boys|girls|unisex or null",
  "ageRange": "toddler|3-5|5-7|8-10|teen or null",
  "minPrice": "number or null",
  "maxPrice": "number or null",
  "searchKeywords": ["array of product synonyms"],
  "mustMatch": ["ALL brands + characters + qualifiers that MUST appear"],
  "rerankerHint": "Brief context for selecting best products"
}`;

export interface InterpreterDeps {
  db: any;
  queryCacheTable: any;
  eq: any;
}

export async function interpretQuery(
  query: string, 
  openaiKey: string | undefined,
  deps: InterpreterDeps
): Promise<QueryInterpretation> {
  const startTime = Date.now();
  const { db, queryCacheTable, eq } = deps;
  
  const defaultResult: QueryInterpretation = {
    isSemanticQuery: false,
    originalQuery: query,
    expandedKeywords: [],
    searchTerms: [[query]],
    mustHaveTerms: [],
    context: {},
    rerankerContext: ''
  };

  const cached = getCachedInterpretation(query);
  if (cached) {
    console.log(`[Query Interpreter] MEMORY CACHE HIT for "${query}" (0ms)`);
    return cached;
  }
  
  const dbCached = await getDbCachedInterpretation(query, db, queryCacheTable, eq);
  if (dbCached) {
    console.log(`[Query Interpreter] DB CACHE HIT for "${query}" (${Date.now() - startTime}ms)`);
    return dbCached;
  }

  const { brand: detectedBrand, cleanedQuery } = detectBrand(query);
  const lower = query.toLowerCase().trim();
  
  if (detectedBrand && cleanedQuery === '') {
    console.log(`[Query Interpreter] FAST PATH (brand-only): "${query}" → ${detectedBrand} (${Date.now() - startTime}ms)`);
    const brandOnlyResult: QueryInterpretation = {
      isSemanticQuery: false,
      originalQuery: query,
      expandedKeywords: [detectedBrand.toLowerCase()],
      searchTerms: [[detectedBrand.toLowerCase()]],
      mustHaveAll: [detectedBrand.toLowerCase()],
      attributes: { brand: detectedBrand },
      context: {},
      rerankerContext: '',
      skipReranker: true
    };
    setCachedInterpretation(query, brandOnlyResult, db, queryCacheTable);
    return brandOnlyResult;
  }
  
  for (const [pattern, config] of Object.entries(SIMPLE_PATTERNS)) {
    if (cleanedQuery === pattern || cleanedQuery === pattern + 's' || lower === pattern) {
      console.log(`[Query Interpreter] FAST PATH: "${query}" → ${config.category} (${Date.now() - startTime}ms)`);
      const mustHave: string[] = [];
      if (detectedBrand) mustHave.push(detectedBrand.toLowerCase());
      if (config.mustMatch) mustHave.push(...config.mustMatch);
      
      const fastResult: QueryInterpretation = {
        isSemanticQuery: false,
        originalQuery: query,
        expandedKeywords: config.keywords,
        searchTerms: [config.keywords],
        mustHaveAll: mustHave,
        attributes: detectedBrand ? { brand: detectedBrand } : undefined,
        context: { categoryFilter: config.category },
        rerankerContext: detectedBrand ? `Find actual ${config.keywords[0]} from ${detectedBrand}, not accessories` : '',
        skipReranker: !detectedBrand
      };
      setCachedInterpretation(query, fastResult, db, queryCacheTable);
      return fastResult;
    }
  }

  if (!openaiKey) {
    console.log(`[Query Interpreter] No OpenAI key, using fallback (${Date.now() - startTime}ms)`);
    return expandQueryFallback(query);
  }

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    
    console.log(`[Query Interpreter] Using GPT to understand: "${query}"`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 600,
      messages: [
        { role: 'system', content: GPT_SYSTEM_PROMPT },
        { role: 'user', content: `Understand this search query and extract structured attributes: "${query}"` }
      ]
    });

    const content = response.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('[Query Interpreter] No JSON found, using fallback');
      return expandQueryFallback(query);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    const attrs: ProductAttributes = {
      brand: typeof parsed.brand === 'string' ? parsed.brand : undefined,
      character: typeof parsed.character === 'string' ? parsed.character : undefined,
      model: typeof parsed.model === 'string' ? parsed.model : undefined,
      size: typeof parsed.size === 'string' ? parsed.size : undefined,
      color: typeof parsed.color === 'string' ? parsed.color : undefined,
      gender: typeof parsed.gender === 'string' ? parsed.gender : undefined,
      ageRange: typeof parsed.ageRange === 'string' ? parsed.ageRange : undefined,
      material: typeof parsed.material === 'string' ? parsed.material : undefined,
      style: typeof parsed.style === 'string' ? parsed.style : undefined
    };
    
    let searchKeywords: string[];
    if (Array.isArray(parsed.searchKeywords)) {
      searchKeywords = parsed.searchKeywords.filter((k: any) => typeof k === 'string');
    } else if (typeof parsed.searchKeywords === 'string') {
      searchKeywords = [parsed.searchKeywords];
    } else {
      searchKeywords = [query];
    }
    
    let mustMatch: string[];
    if (Array.isArray(parsed.mustMatch)) {
      mustMatch = parsed.mustMatch.filter((k: any) => typeof k === 'string');
    } else if (typeof parsed.mustMatch === 'string') {
      mustMatch = [parsed.mustMatch];
    } else {
      mustMatch = [];
    }
    
    let maxPrice: number | undefined;
    if (typeof parsed.maxPrice === 'number' && parsed.maxPrice > 0) {
      maxPrice = parsed.maxPrice;
    } else if (typeof parsed.maxPrice === 'string') {
      const priceNum = parseFloat(parsed.maxPrice.replace(/[£$,]/g, ''));
      if (!isNaN(priceNum) && priceNum > 0) {
        maxPrice = priceNum;
      }
    }
    
    let minPrice: number | undefined;
    if (typeof parsed.minPrice === 'number' && parsed.minPrice > 0) {
      minPrice = parsed.minPrice;
    } else if (typeof parsed.minPrice === 'string') {
      const priceNum = parseFloat(parsed.minPrice.replace(/[£$,]/g, ''));
      if (!isNaN(priceNum) && priceNum > 0) {
        minPrice = priceNum;
      }
    }
    
    const categoryFilter = typeof parsed.categoryFilter === 'string' ? parsed.categoryFilter : undefined;
    
    console.log(`[Query Interpreter] GPT understood "${query}" → type: ${parsed.productType}, category: ${categoryFilter || 'any'}, brand: ${attrs.brand}, size: ${attrs.size}, color: ${attrs.color}, gender: ${attrs.gender}, priceRange: ${minPrice ? '£' + minPrice : ''}-${maxPrice ? '£' + maxPrice : ''}, keywords: ${JSON.stringify(searchKeywords)}`);

    const interpretation: QueryInterpretation = {
      isSemanticQuery: true,
      originalQuery: query,
      expandedKeywords: searchKeywords,
      searchTerms: [searchKeywords],
      mustHaveAll: mustMatch,
      mustHaveAny: [],
      attributes: attrs,
      context: {
        recipient: parsed.gender === 'mens' ? 'adult male' : parsed.gender === 'womens' ? 'adult female' : undefined,
        occasion: parsed.occasion,
        ageRange: parsed.ageRange,
        priceHint: minPrice && maxPrice ? `£${minPrice}-£${maxPrice}` : minPrice ? `over £${minPrice}` : maxPrice ? `under £${maxPrice}` : parsed.priceRange,
        minPrice: minPrice,
        maxPrice: maxPrice,
        categoryFilter: categoryFilter,
        excludeCategories: undefined
      },
      rerankerContext: parsed.rerankerHint || `Find ${parsed.productType || query}${attrs.brand ? ` from ${attrs.brand}` : ''}${attrs.size ? ` in size ${attrs.size}` : ''}${attrs.color ? ` in ${attrs.color}` : ''}${maxPrice ? ` under £${maxPrice}` : ''}`
    };
    
    setCachedInterpretation(query, interpretation, db, queryCacheTable);
    
    return interpretation;
  } catch (error) {
    console.error('[Query Interpreter] Error:', error);
    return expandQueryFallback(query);
  }
}
