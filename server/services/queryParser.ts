/**
 * Query Parser - Extracts structured data from natural language queries
 * 
 * Solves the critical issue where "toys for 3 year old" and "toys for teenager"
 * return identical results by extracting age, gender, character, and other
 * context that MUST be used as filters.
 */

export interface ParsedQuery {
  ageMin: number | null;
  ageMax: number | null;
  gender: 'boy' | 'girl' | null;
  character: string | null;
  brand: string | null;
  priceMax: number | null;
  productType: string | null;
  occasion: string | null;
  keywords: string[];
  originalQuery: string;
}

// Character/franchise list - these MUST be matched exactly
// CTO-approved expanded list covering all major franchises
const CHARACTERS = [
  // Kids TV
  'paw patrol', 'peppa pig', 'bluey', 'cocomelon', 'hey duggee', 'bing', 'teletubbies',
  'thomas the tank', 'thomas and friends', 'thomas train', 'postman pat', 'fireman sam', 'bob the builder',
  'in the night garden', 'mr tumble', 'baby shark', 'bing bunny',
  'pj masks', 'chase', 'marshall', 'skye', 'rubble',
  
  // Disney
  'disney', 'mickey mouse', 'minnie mouse', 'frozen', 'elsa', 'anna', 'olaf',
  'moana', 'ariel', 'belle', 'cinderella', 'rapunzel', 'snow white', 'jasmine',
  'tiana', 'mulan', 'pocahontas', 'aurora', 'merida', 'encanto', 'mirabel',
  'lilo and stitch', 'stitch', 'lion king', 'simba', 'toy story', 'woody', 'buzz lightyear',
  'cars', 'lightning mcqueen', 'finding nemo', 'finding dory', 'monsters inc', 'tangled',
  
  // Marvel
  'marvel', 'avengers', 'spiderman', 'spider-man', 'spider man', 'hulk', 'iron man',
  'thor', 'captain america', 'black panther', 'black widow', 'hawkeye',
  'ant-man', 'antman', 'deadpool', 'wolverine', 'x-men', 'guardians of the galaxy',
  
  // DC
  'dc', 'batman', 'superman', 'wonder woman', 'flash', 'aquaman', 'justice league',
  
  // Gaming
  'mario', 'super mario', 'luigi', 'princess peach', 'yoshi', 'donkey kong',
  'sonic', 'sonic the hedgehog', 'pokemon', 'pikachu', 'minecraft', 'roblox',
  'fortnite', 'zelda', 'link', 'kirby', 'animal crossing',
  
  // Toys/Brands (treated as characters for matching)
  'lego', 'duplo', 'playmobil', 'barbie', 'hot wheels', 'nerf', 'play-doh', 'playdoh',
  'sylvanian', 'sylvanian families', 'lol surprise', 'lol dolls', 'hatchimals', 'funko', 'funko pop',
  'calico critters', 'my little pony', 'mlp', 'rainbow high', 'monster high',
  'gabby dollhouse', 'gabby\'s dollhouse',
  
  // Harry Potter / Franchises
  'harry potter', 'hogwarts', 'star wars', 'mandalorian', 'baby yoda', 'grogu',
  'jurassic', 'jurassic world', 'jurassic park', 'transformers', 'power rangers',
  'teenage mutant ninja turtles', 'tmnt',
  
  // Other Popular
  'paddington', 'peter rabbit', 'winnie the pooh', 'gruffalo', 'hungry caterpillar',
  'eric carle', 'roald dahl', 'david walliams', 'julia donaldson',
  'unicorn', 'dinosaur', 'dinosaurs', 'dino', 'dragon', 'mermaid', 'pirate', 'princess', 'superhero'
];

// Brand-specific queries should skip diversity penalty (exported for routes.ts)
export const BRAND_CHARACTERS = [
  'lego', 'duplo', 'nerf', 'barbie', 'hot wheels', 'playmobil', 
  'sylvanian', 'sylvanian families', 'funko', 'funko pop', 'playdoh', 'play-doh'
];

// Product types that indicate what the user is looking for
const PRODUCT_TYPES: Record<string, string[]> = {
  'playset': ['tower', 'house', 'castle', 'headquarters', 'hq', 'base', 'treehouse', 'mansion', 'den'],
  'trading cards': ['cards', 'card pack', 'card game', 'trading card'],
  'costume': ['costume', 'dress up', 'outfit', 'fancy dress', 'cosplay'],
  'soft toy': ['plush', 'soft toy', 'cuddly', 'teddy', 'stuffed'],
  'action figure': ['figure', 'action figure', 'figurine'],
  'vehicle': ['car', 'truck', 'vehicle', 'train', 'plane', 'helicopter'],
  'puzzle': ['puzzle', 'jigsaw'],
  'board game': ['board game', 'game'],
  'book': ['book', 'story', 'reading'],
  'duplo': ['duplo'],
  'lego set': ['lego set', 'lego']
};

// Age category mappings
const AGE_KEYWORDS: Record<string, { min: number; max: number }> = {
  'newborn': { min: 0, max: 0 },
  'baby': { min: 0, max: 1 },
  'infant': { min: 0, max: 1 },
  'toddler': { min: 1, max: 3 },
  'preschool': { min: 3, max: 5 },
  'preschooler': { min: 3, max: 5 },
  'teenager': { min: 13, max: 19 },
  'teen': { min: 13, max: 19 },
  'tween': { min: 10, max: 12 },
  'child': { min: 3, max: 12 },
  'kid': { min: 3, max: 12 },
  'kids': { min: 3, max: 12 }
};

// Gender keywords
const GENDER_KEYWORDS: Record<string, 'boy' | 'girl'> = {
  'boy': 'boy',
  'boys': 'boy',
  'son': 'boy',
  'nephew': 'boy',
  'grandson': 'boy',
  'him': 'boy',
  'he': 'boy',
  'his': 'boy',
  'girl': 'girl',
  'girls': 'girl',
  'daughter': 'girl',
  'niece': 'girl',
  'granddaughter': 'girl',
  'her': 'girl',
  'she': 'girl'
};

// Occasion keywords
const OCCASIONS = ['birthday', 'christmas', 'easter', 'valentines', 'halloween'];

/**
 * Parse a natural language query into structured components
 */
export function parseQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    ageMin: null,
    ageMax: null,
    gender: null,
    character: null,
    brand: null,
    priceMax: null,
    productType: null,
    occasion: null,
    keywords: [],
    originalQuery: query
  };

  const q = query.toLowerCase().trim();
  let remainingQuery = q;

  // 1. EXTRACT AGE - "X year old" pattern
  const agePatterns = [
    /(\d+)\s*year\s*old/i,
    /(\d+)\s*yr\s*old/i,
    /(\d+)\s*yo\b/i,
    /age\s*(\d+)/i,
    /ages?\s*(\d+)\s*-\s*(\d+)/i,
    /(\d+)\s*-\s*(\d+)\s*years?/i
  ];
  
  for (const pattern of agePatterns) {
    const match = q.match(pattern);
    if (match) {
      if (match[2]) {
        // Range like "ages 3-5"
        result.ageMin = parseInt(match[1]);
        result.ageMax = parseInt(match[2]);
      } else {
        // Single age - allow ±1 year flexibility
        const age = parseInt(match[1]);
        result.ageMin = Math.max(0, age - 1);
        result.ageMax = age + 2;
      }
      remainingQuery = remainingQuery.replace(match[0], ' ');
      break;
    }
  }

  // 2. EXTRACT AGE KEYWORDS (newborn, toddler, teen, etc.)
  if (result.ageMin === null) {
    for (const [keyword, ages] of Object.entries(AGE_KEYWORDS)) {
      const keywordPattern = new RegExp(`\\b${keyword}\\b`, 'i');
      if (keywordPattern.test(q)) {
        result.ageMin = ages.min;
        result.ageMax = ages.max;
        remainingQuery = remainingQuery.replace(keywordPattern, ' ');
        break;
      }
    }
  }

  // 3. EXTRACT GENDER
  for (const [keyword, gender] of Object.entries(GENDER_KEYWORDS)) {
    const genderPattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (genderPattern.test(q)) {
      result.gender = gender;
      remainingQuery = remainingQuery.replace(genderPattern, ' ');
      break;
    }
  }

  // 4. EXTRACT CHARACTER/FRANCHISE - CRITICAL: must be exact word match
  // FIX: Use word boundary matching to prevent "legoland" matching "lego"
  for (const character of CHARACTERS) {
    // Escape regex special chars and use word boundaries
    const escaped = character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const charPattern = new RegExp(`\\b${escaped}\\b`, 'i');
    if (charPattern.test(q)) {
      result.character = character;
      // Don't remove from remaining query - we want to search for this
      break;
    }
  }

  // 5. EXTRACT PRICE
  // FIX #74: Added patterns for "under 10 pounds", "under 1 pound", "up to £5"
  const pricePatterns = [
    /under\s*[£$]?\s*(\d+)\s*(?:pounds?|quid)?/i,
    /less\s*than\s*[£$]?\s*(\d+)\s*(?:pounds?|quid)?/i,
    /max\s*[£$]?\s*(\d+)\s*(?:pounds?|quid)?/i,
    /budget\s*[£$]?\s*(\d+)\s*(?:pounds?|quid)?/i,
    /[£$]\s*(\d+)\s*or\s*less/i,
    /up\s*to\s*[£$]?\s*(\d+)\s*(?:pounds?|quid)?/i,
    /(\d+)\s*(?:pounds?|quid)\s*or\s*(?:less|under)/i
  ];
  
  for (const pattern of pricePatterns) {
    const match = q.match(pattern);
    if (match) {
      result.priceMax = parseInt(match[1]);
      remainingQuery = remainingQuery.replace(match[0], ' ');
      break;
    }
  }

  // 6. EXTRACT PRODUCT TYPE
  for (const [type, keywords] of Object.entries(PRODUCT_TYPES)) {
    for (const keyword of keywords) {
      if (q.includes(keyword)) {
        result.productType = type;
        break;
      }
    }
    if (result.productType) break;
  }

  // 7. EXTRACT OCCASION
  for (const occasion of OCCASIONS) {
    if (q.includes(occasion)) {
      result.occasion = occasion;
      break;
    }
  }

  // 8. EXTRACT REMAINING KEYWORDS
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    'for', 'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on',
    'is', 'it', 'my', 'me', 'we', 'our', 'what', 'which', 'that',
    'good', 'best', 'great', 'nice', 'cool', 'awesome', 'perfect',
    'buy', 'get', 'want', 'need', 'looking', 'find', 'search',
    'present', 'presents', 'gift', 'gifts', 'idea', 'ideas',
    'year', 'years', 'old', 'age', 'aged'
  ]);
  
  const words = remainingQuery
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
  
  result.keywords = Array.from(new Set(words));

  return result;
}

/**
 * Generate search terms from parsed query
 * Returns terms that MUST be present in results
 */
export function getRequiredSearchTerms(parsed: ParsedQuery): string[] {
  const terms: string[] = [];
  
  // Character is REQUIRED if specified
  if (parsed.character) {
    terms.push(parsed.character);
  }
  
  // Product type can help narrow
  if (parsed.productType && parsed.productType !== 'lego set') {
    // Add product type as a search term for specific items
    const typeKeywords = PRODUCT_TYPES[parsed.productType];
    if (typeKeywords && typeKeywords.length > 0) {
      terms.push(typeKeywords[0]);
    }
  }
  
  // Add remaining keywords
  terms.push(...parsed.keywords);
  
  return Array.from(new Set(terms));
}

/**
 * Check if a product is age-appropriate based on parsed age range
 */
export function isAgeAppropriate(product: any, parsed: ParsedQuery): boolean {
  if (parsed.ageMin === null && parsed.ageMax === null) {
    return true; // No age filter
  }

  const productText = `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
  
  // Extract age from product
  let productAgeMin: number | null = null;
  let productAgeMax: number | null = null;
  
  // Look for "X+" age pattern (e.g., "8+", "Ages 6+")
  const agePlusMatch = productText.match(/(\d+)\s*\+/);
  if (agePlusMatch) {
    productAgeMin = parseInt(agePlusMatch[1]);
  }
  
  // Look for age range (e.g., "3-6 years", "Ages 4-8")
  const ageRangeMatch = productText.match(/(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?|ages?)?/i);
  if (ageRangeMatch) {
    productAgeMin = parseInt(ageRangeMatch[1]);
    productAgeMax = parseInt(ageRangeMatch[2]);
  }

  // Category-based age inference
  // FIX #41: Skip "adult" keyword ONLY for sport equipment (rackets, nets, clubs) - NOT apparel/shoes
  // Must have actual equipment keyword, not just sport activity name
  const SPORT_EQUIPMENT_WORDS = ['racket', 'racquet', 'shuttlecock', 'net set', 'badminton net', 'tennis net', 'golf club', 'golf bag', 'cricket bat', 'hockey stick'];
  const APPAREL_WORDS = ['shoe', 'trainer', 'hoodie', 'jacket', 'shorts', 'shirt', 't-shirt', 'legging', 'sock', 'clothing', 'wear', 'outfit'];
  const hasEquipmentWord = SPORT_EQUIPMENT_WORDS.some(w => productText.includes(w));
  const hasApparelWord = APPAREL_WORDS.some(w => productText.includes(w));
  const isSportEquipment = hasEquipmentWord && !hasApparelWord;
  
  if (productText.includes('duplo')) {
    productAgeMin = 1;
    productAgeMax = 5;
  } else if (productText.includes('baby') || productText.includes('infant')) {
    productAgeMin = 0;
    productAgeMax = 2;
  } else if (productText.includes('toddler')) {
    productAgeMin = 1;
    productAgeMax = 3;
  } else if (productText.includes('teen') || (productText.includes('adult') && !isSportEquipment)) {
    // For sport equipment, "adult" refers to sizing, not age restriction
    productAgeMin = 13;
    productAgeMax = null;
  }

  // Check compatibility
  if (parsed.ageMax !== null && productAgeMin !== null) {
    // Product requires older age than user's max
    if (productAgeMin > parsed.ageMax + 1) {
      return false;
    }
  }
  
  if (parsed.ageMin !== null && productAgeMax !== null) {
    // Product is for younger kids than user's min
    if (productAgeMax < parsed.ageMin - 1) {
      return false;
    }
  }

  return true;
}

/**
 * Score a product for gender relevance
 * Returns 1 for match, 0 for neutral, -1 for opposite gender
 */
export function getGenderScore(product: any, parsed: ParsedQuery): number {
  if (!parsed.gender) return 0;

  const productText = `${product.name || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
  
  const boyKeywords = ['boys', 'boy', 'superhero', 'dinosaur', 'truck', 'car', 'action', 'ninja', 'robot', 'monster'];
  const girlKeywords = ['girls', 'girl', 'princess', 'unicorn', 'fairy', 'doll', 'ballet', 'pink', 'glitter', 'jewellery'];

  const hasBoyKeyword = boyKeywords.some(k => productText.includes(k));
  const hasGirlKeyword = girlKeywords.some(k => productText.includes(k));

  if (parsed.gender === 'boy') {
    if (hasBoyKeyword) return 1;
    if (hasGirlKeyword && !hasBoyKeyword) return -1;
  } else if (parsed.gender === 'girl') {
    if (hasGirlKeyword) return 1;
    if (hasBoyKeyword && !hasGirlKeyword) return -1;
  }

  return 0;
}

/**
 * Check if product matches required character/franchise
 */
export function matchesCharacter(product: any, parsed: ParsedQuery): boolean {
  if (!parsed.character) return true;

  const productText = `${product.name || ''} ${product.brand || ''} ${product.description || ''}`.toLowerCase();
  
  // Must contain the character name
  return productText.includes(parsed.character);
}

/**
 * Check if product matches price constraint
 */
export function matchesPriceConstraint(product: any, parsed: ParsedQuery): boolean {
  if (!parsed.priceMax) return true;
  
  const price = parseFloat(product.price);
  if (isNaN(price)) return true; // Can't filter without price
  
  return price <= parsed.priceMax;
}

/**
 * Apply diversity constraints to results
 * Max N per brand (with progressive relaxation), max 6 per category, no duplicates
 * FIX #41: Progressive brand limit relaxation for limited-brand categories (sport equipment)
 */
export function applyDiversityConstraints(products: any[]): any[] {
  const TARGET_MIN = 8;
  
  // Try with progressively higher brand limits: 3 → 5 → unlimited
  for (const maxBrand of [3, 5, 999]) {
    const seen = new Set<string>();
    const brandCount = new Map<string, number>();
    const categoryCount = new Map<string, number>();
    const result: any[] = [];

    for (const product of products) {
      const id = product.id?.toString() || product.name;
      
      // Skip duplicates
      if (seen.has(id)) continue;
      
      const brand = (product.brand || product.merchant || 'unknown').toLowerCase();
      const category = (product.category || 'unknown').toLowerCase().split('>')[0].trim();
      
      // Max N per brand (progressively relaxed)
      const currentBrandCount = brandCount.get(brand) || 0;
      if (currentBrandCount >= maxBrand) continue;
      
      // Max 6 per category (relaxed from 4)
      const currentCatCount = categoryCount.get(category) || 0;
      if (currentCatCount >= 6) continue;
      
      seen.add(id);
      brandCount.set(brand, currentBrandCount + 1);
      categoryCount.set(category, currentCatCount + 1);
      result.push(product);
    }
    
    // If we have enough results, return them
    if (result.length >= TARGET_MIN || maxBrand >= 999) {
      return result;
    }
  }
  
  // Fallback (shouldn't reach here)
  return products;
}

/**
 * Full post-filter pipeline for search results
 */
export function applyQueryFilters(products: any[], parsed: ParsedQuery): any[] {
  let filtered = products;

  // 1. REQUIRED: Character match if specified
  if (parsed.character) {
    const characterFiltered = filtered.filter(p => matchesCharacter(p, parsed));
    // Only apply if we get results, otherwise fall back
    if (characterFiltered.length > 0) {
      filtered = characterFiltered;
    }
  }

  // 2. REQUIRED: Price constraint
  if (parsed.priceMax) {
    const priceFiltered = filtered.filter(p => matchesPriceConstraint(p, parsed));
    if (priceFiltered.length > 0) {
      filtered = priceFiltered;
    }
  }

  // 3. SOFT: Age appropriateness - filter but keep fallbacks
  if (parsed.ageMin !== null || parsed.ageMax !== null) {
    const ageFiltered = filtered.filter(p => isAgeAppropriate(p, parsed));
    if (ageFiltered.length >= 3) {
      filtered = ageFiltered;
    }
  }

  // 4. SOFT: Gender preference - sort by preference, don't exclude
  if (parsed.gender) {
    filtered.sort((a, b) => {
      const scoreA = getGenderScore(a, parsed);
      const scoreB = getGenderScore(b, parsed);
      return scoreB - scoreA; // Higher score first
    });
    
    // Remove opposite-gender products if we have enough neutral/matching
    const nonOpposite = filtered.filter(p => getGenderScore(p, parsed) >= 0);
    if (nonOpposite.length >= 5) {
      filtered = nonOpposite;
    }
  }

  // 5. Apply diversity constraints
  filtered = applyDiversityConstraints(filtered);

  return filtered;
}

/**
 * Get age-appropriate search terms to add to query
 */
export function getAgeSearchHints(parsed: ParsedQuery): string[] {
  if (parsed.ageMin === null && parsed.ageMax === null) return [];
  
  const hints: string[] = [];
  
  // Baby/infant (0-1)
  if (parsed.ageMax !== null && parsed.ageMax <= 1) {
    hints.push('baby', 'infant', 'newborn', 'sensory');
  }
  // Toddler (1-3)
  else if (parsed.ageMax !== null && parsed.ageMax <= 3) {
    hints.push('toddler', 'duplo', 'baby');
  }
  // Preschool (3-5)
  else if (parsed.ageMin !== null && parsed.ageMin >= 3 && parsed.ageMax !== null && parsed.ageMax <= 6) {
    hints.push('preschool');
  }
  // Teen (13+)
  else if (parsed.ageMin !== null && parsed.ageMin >= 13) {
    hints.push('teen', 'teenager');
  }
  
  return hints;
}
