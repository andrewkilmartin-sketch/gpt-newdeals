/**
 * Search Filters
 * 
 * Contains all filtering functions for search results including:
 * - Inappropriate content filtering
 * - Word boundary collision filtering
 * - Context-specific filters (toy, costume, book, media, etc.)
 * 
 * See CRITICAL_FIXES.md - Fixes #10, #11, #12, #31, #36, #39, #47, #64, #69
 */

import { 
  KNOWN_TOY_BRANDS, 
  MAKEUP_COSMETICS_TERMS,
  CRAFT_SUPPLY_PATTERNS,
  TRAVEL_MERCHANTS,
  GENDER_EXCLUSION_MAP,
  DISCOUNT_MERCHANTS,
  isToyQuery,
  isCraftSupply
} from './brands';

export const INAPPROPRIATE_TERMS = [
  'condom', 'lubricant', 'erectile', 'viagra', 'cialis', 'sex toy', 
  'adult toy', 'bondage', 'stripper', 'lingerie', 'sti test', 'std test',
  'hiv test', 'chlamydia', 'gonorrhea', 'herpes', 'syphilis',
  'vape', 'vaping', 'e-cigarette', 'nicotine', 'tobacco', 'smoking',
  'betting', 'gambling', 'casino', 'slots', 'poker', 'blackjack',
  'wine', 'whisky', 'whiskey', 'vodka', 'rum', 'gin', 'beer', 'lager',
  'champagne', 'prosecco', 'alcohol', 'spirits', 'liquor', 'booze',
  'weight loss', 'fat burner', 'slimming pills', 'diet pills',
  'cbd oil', 'cannabis', 'hemp extract', 'thc'
];

export const BLOCKED_MERCHANTS = [
  'naked wines', 'majestic wine', 'virgin wines', 'laithwaites',
  'the bottle club', 'whisky exchange', 'master of malt', 'drink supermarket',
  'slimming world', 'holland & barrett diet', 'myprotein',
  'paddy power', 'bet365', 'william hill', 'ladbrokes', 'coral',
  'betfair', 'unibet', 'betfred', 'skybet', '888sport', 'bwin',
  'betway', 'mansion bet', 'genting', 'virgin bet', 'spreadex',
  'healthspan', 'vitabiotics direct'
];

export const KNOWN_FALLBACKS = [
  'universal stroller', 'stroller liner', 'pushchair', 'buggy',
  'car seat', 'booster seat', 'isofix', 'travel system',
  '30 off honor', 'free 5 top up credit', 'vitamin planet rewards',
  'nosibotanical nulla vest', 'nosibotanical', 'nulla vest',
  'cotton-blend nosibotanical',
  'trimits toy eyes', 'trimits stick on wobbly toy eyes',
  'trimits safety wobbly toy eyes', 'craft factory toy eyes',
  'craft factory toy safety eyes', 'wobbly toy eyes', 'stick on eyes',
  'safety eyes', 'toy eyes black', 'toy eyes amber', 'toy eyes blue',
  'toy eyes yellow', 'toy eyes red', 'toy eyes brown', 'toy safety eyes'
];

export const WORD_BOUNDARY_COLLISIONS: { [key: string]: string[] } = {
  'train': ['trainer', 'trainers', 'training', 'trainee', 'retrain', 'constraint'],
  'case': ['bookcase', 'bookcases', 'staircase', 'suitcase', 'pillowcase', 'showcase', 'briefcase'],
  'set': ['sunset', 'offset', 'reset', 'upset', 'setback', 'subset'],
  'gun': ['gunmetal', 'begun', 'shotgun'],
  'water': ['waterproof', 'waterfall', 'underwater', 'watering', 'watercolor', 'freshwater'],
  'soaker': ['soakers']
};

export const NON_PRODUCT_EXCLUSIONS = [
  'book', 'notebook', 'pocket book', 'diary', 'journal', 'calendar', 'annual', 'storybook',
  'dvd', 'blu-ray', 'bluray', '4k ultra', 'ultra hd', 'includes blu',
  'poster', 'print', 'wall art', 'sticker', 'decal', 'canvas',
  'costume', 'fancy dress', 'pyjama', 'pajama', 't-shirt', 'tshirt', 'hoodie', 'sweatshirt'
];

export const PRODUCT_INTENT_WORDS = ['set', 'sets', 'toy', 'toys', 'kit', 'kits', 'playset', 'figure', 'figures'];

export const CLOTHING_INDICATORS = [
  't-shirt', 'tshirt', 'sweatshirt', 'hoodie', 'dress', 'shirt', 
  'shorts', 'trousers', 'vest', 'jacket', 'coat', 'jumper', 'sweater',
  'trainers', 'shoes', 'slides', 'sandals', 'socks', 'pyjamas', 'pajamas',
  'leggings', 'joggers', 'jeans', 'skirt', 'cardigan', 'polo', 'blouse',
  'bodysuit', 'romper', 'dungarees', 'onesie', 'nightwear', 'underwear',
  'snowsuit', 'swimsuit', 'swimming costume', 'bikini', 'trunks',
  'wellingtons', 'wellington', 'boots', 'wellies', 'slippers', 'crocs',
  'birthday card', 'photo card', 'greeting card', 'handbell', 'bell',
  'sticker pack', 'lunch bag', 'storage closet', 'wall decor', 'storage bin'
];

export const TOY_QUERY_WORDS = [
  'toys', 'toy', 'figures', 'figure', 'playset', 'playsets', 'action figure',
  'helmet', 'bike helmet', 'scooter', 'slide', 'swing', 'trampoline',
  'climbing frame', 'paddling pool', 'ball', 'doll', 'dolls', 'teddy',
  'puzzle', 'puzzles', 'game', 'games', 'lego', 'duplo', 'blocks',
  'craft', 'crayons', 'paint', 'playdough', 'play-doh', 'stickers'
];

export const MEDIA_EXCLUSIONS = [
  'dvd', 'blu-ray', 'bluray', '4k ultra', 'ultra hd', 'includes blu',
  '(blu-ray)', '(dvd)', 'movie disc', 'disc set'
];

export const MEDIA_QUERY_TRIGGERS = ['toy', 'toys', 'gift', 'gifts', 'present', 'presents', 'figure', 'figures', 'doll', 'dolls'];

export const WATER_GUN_QUERY_WORDS = ['water gun', 'water guns', 'water pistol', 'water pistols', 'water blaster', 'water blasters'];

export const WATER_GUN_EXCLUDE_TERMS = [
  'bouncy castle', 'bounce house', 'bouncer', 'inflatable castle',
  'climbing wall', 'trampoline', 'slide pool', 'play structure'
];

export const COSTUME_QUERY_WORDS = ['costume', 'costumes', 'fancy dress', 'dress up', 'dressing up'];

export const COSTUME_CLOTHING_INDICATORS = [
  't-shirt', 'tshirt', 'sweatshirt', 'hoodie', 'hoody', 'jumper', 'sweater',
  'polo', 'vest', 'jacket', 'coat', 'cardigan', 'shorts', 'trousers', 'joggers',
  'leggings', 'jeans', 'skirt', 'pyjamas', 'pajamas', 'nightwear', 'onesie',
  'swimsuit', 'bikini', 'trunks', 'swimming costume',
  'copricostume', 'cover-up', 'coverup', 'maillot', 'badeanzug',
  'bunting', 'swaddle', 'sleep sack', 'sleep bag', 'babywear', 'layette',
  'romper', 'bodysuit', 'sleeper', 'grow bag', 'growbag'
];

export const COSTUME_NON_WEARABLE_TERMS = [
  'doll', 'figure', 'playset', 'toy', 'figurine', 'action figure',
  'storage', 'closet', 'hanger', 'organizer', 'wardrobe', 'rack',
  'barbie', 'bratz', 'monster high', 'skating barbie', 'ice skating'
];

export const COSTUME_POSITIVE_CATEGORIES = [
  'fancy dress', 'costumes', 'dress up', 'halloween', 'party', 'role play',
  'other toys', 'toys', 'general clothing', 'character'
];

export interface FilterResult {
  items: any[];
  inventoryGap: boolean;
  gapReason?: string;
}

export function filterInappropriateContent(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.description || '')).toLowerCase();
    const merchant = (r.merchant || '').toLowerCase();
    
    const hasBadTerm = INAPPROPRIATE_TERMS.some(term => text.includes(term));
    if (hasBadTerm) {
      console.log(`[Content Filter] BLOCKED inappropriate term: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    
    const isBannedMerchant = BLOCKED_MERCHANTS.some(m => merchant.includes(m));
    if (isBannedMerchant) {
      console.log(`[Content Filter] BLOCKED merchant: ${r.merchant} - "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    
    return true;
  });
}

export function filterWordBoundaryCollisions(results: any[], query: string): any[] {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const collisionChecks: { word: string; collisions: string[] }[] = [];
  
  for (const word of words) {
    if (WORD_BOUNDARY_COLLISIONS[word]) {
      collisionChecks.push({ word, collisions: WORD_BOUNDARY_COLLISIONS[word] });
    }
  }
  
  if (collisionChecks.length === 0) return results;
  
  return results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    const text = name + ' ' + desc;
    
    for (const check of collisionChecks) {
      for (const collision of check.collisions) {
        if (text.includes(collision)) {
          const wordBoundaryRegex = new RegExp(`\\b${check.word}\\b`, 'i');
          if (!wordBoundaryRegex.test(text)) {
            console.log(`[Word Boundary] Excluded "${r.name?.substring(0, 50)}..." - "${check.word}" only matched as "${collision}"`);
            return false;
          }
        }
      }
    }
    return true;
  });
}

export function filterCraftSuppliesFromToyQueries(results: any[], query: string): any[] {
  const q = query.toLowerCase();
  const isToyGiftQuery = q.includes('toy') || q.includes('gift') || q.includes('present') ||
    q.includes('for kids') || q.includes('year old') || q.includes('stocking filler') ||
    q.includes('party bag');
  
  if (!isToyGiftQuery) return results;
  
  return results.filter(r => {
    const name = r.name || '';
    if (isCraftSupply(name)) {
      console.log(`[Fix #47] Excluded craft supply from toy/gift query: "${name.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
}

export function filterMakeupFromToyQueries(results: any[], query: string): any[] {
  if (!isToyQuery(query)) return results;
  
  return results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const brand = (r.brand || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    const text = name + ' ' + brand + ' ' + desc;
    
    for (const term of MAKEUP_COSMETICS_TERMS) {
      if (text.includes(term)) {
        console.log(`[Fix #39] Excluded makeup/cosmetics from toy query: "${r.name?.substring(0, 50)}..." (matched: ${term})`);
        return false;
      }
    }
    return true;
  });
}

export function filterFallbackSpam(results: any[], query: string): any[] {
  const q = query.toLowerCase();
  const normalize = (text: string) => text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return results.filter(r => {
    const normalizedName = normalize(r.name || '');
    
    for (const fallback of KNOWN_FALLBACKS) {
      if (normalizedName.includes(fallback)) {
        const queryWords = normalize(q).split(/\s+/).filter(w => w.length > 2);
        const hasConnection = queryWords.some(qw => normalizedName.includes(qw));
        
        if (!hasConnection) {
          console.log(`[Fallback Filter] Removed spam: "${r.name?.substring(0, 50)}..."`);
          return false;
        }
      }
    }
    return true;
  });
}

export function hasProductIntent(query: string): boolean {
  const q = query.toLowerCase();
  return PRODUCT_INTENT_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(q);
  });
}

export function filterNonProducts(results: any[], query: string): any[] {
  if (!hasProductIntent(query)) {
    return results;
  }
  
  return results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    
    const isNonProduct = NON_PRODUCT_EXCLUSIONS.some(exclusion => {
      const regex = new RegExp(`\\b${exclusion}\\b`, 'i');
      return regex.test(name) || regex.test(category);
    });
    
    if (isNonProduct) {
      console.log(`[Fix #69 Non-Product] Excluded: "${r.name?.substring(0, 50)}..." (category: ${category})`);
      return false;
    }
    
    return true;
  });
}

export function hasToyContext(query: string): boolean {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 2);
  
  const hasToyWord = TOY_QUERY_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(q);
  });
  if (hasToyWord) return true;
  
  const hasToyBrand = KNOWN_TOY_BRANDS.some(brand => q.includes(brand));
  if (hasToyBrand) {
    const toyIntentWords = ['toy', 'toys', 'gift', 'gifts', 'for kids', 'for children', 'figure', 'figures', 'doll', 'dolls', 'plush', 'lego'];
    const hasToyIntent = toyIntentWords.some(tw => q.includes(tw));
    
    if (words.length <= 1 && !hasToyIntent) {
      console.log(`[Toy Context] Skipping filter for single-word franchise "${query}" (no explicit toy intent)`);
      return false;
    }
    
    console.log(`[Toy Context] Detected toy brand in query: "${query}"`);
    return true;
  }
  
  return false;
}

export function filterForToyContext(results: any[]): any[] {
  const filtered = results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    
    const isClothing = CLOTHING_INDICATORS.some(term => name.includes(term)) ||
                       category.includes('clothing') || 
                       category.includes('fashion') ||
                       category.includes('apparel') ||
                       category.includes('shoes') ||
                       category.includes('footwear') ||
                       category.includes('gifts') ||
                       category.includes('card') ||
                       category.includes('accessories') ||
                       category.includes('bags') ||
                       category.includes('stationery') ||
                       category.includes('lunch') ||
                       category.includes('decor') ||
                       category.includes('baby clothes') ||
                       category.includes('sleepwear') ||
                       category.includes('nightwear') ||
                       category.includes('mugs');
    
    if (isClothing) {
      console.log(`[Toy Context] Excluded non-toy: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
  
  if (filtered.length === 0 && results.length > 0) {
    console.log(`[Toy Context] INVENTORY GAP: All ${results.length} results were clothing, keeping original`);
    return results;
  }
  
  return filtered;
}

export function hasMediaExclusionContext(query: string): boolean {
  const q = query.toLowerCase();
  return MEDIA_QUERY_TRIGGERS.some(trigger => {
    const regex = new RegExp(`\\b${trigger}\\b`, 'i');
    return regex.test(q);
  });
}

export function filterMediaFromToyQueries(results: any[], query: string): any[] {
  if (!hasMediaExclusionContext(query)) return results;
  
  const filtered = results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    
    const isMedia = MEDIA_EXCLUSIONS.some(term => name.includes(term)) ||
                    category.includes('dvd') ||
                    category.includes('blu-ray') ||
                    category.includes('film') ||
                    category.includes('movies');
    
    if (isMedia) {
      console.log(`[Fix #64] Media exclusion: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
  
  if (filtered.length === 0 && results.length > 0) {
    console.log(`[Fix #64] All results were media, keeping original`);
    return results;
  }
  
  return filtered;
}

export function hasWaterGunContext(query: string): boolean {
  const q = query.toLowerCase();
  return WATER_GUN_QUERY_WORDS.some(term => q.includes(term));
}

export function filterForWaterGunContext(results: any[]): any[] {
  const filtered = results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const desc = (r.description || '').toLowerCase();
    const text = name + ' ' + desc;
    
    const isPlayStructure = WATER_GUN_EXCLUDE_TERMS.some(term => text.includes(term));
    const price = parseFloat(r.price) || 0;
    const isExpensivePlayEquipment = price > 100 && (text.includes('castle') || text.includes('bouncy') || text.includes('trampoline'));
    
    if (isPlayStructure || isExpensivePlayEquipment) {
      console.log(`[Water Gun Context] Excluded play structure: "${r.name?.substring(0, 50)}..." (£${price})`);
      return false;
    }
    return true;
  });
  
  if (filtered.length === 0 && results.length > 0) {
    console.log(`[Water Gun Context] INVENTORY GAP: All ${results.length} results were play structures, keeping original`);
    return results;
  }
  
  return filtered;
}

export function hasCostumeContext(query: string): boolean {
  const q = query.toLowerCase();
  if (q.includes('swimming costume') || q.includes('swim costume')) {
    return false;
  }
  return COSTUME_QUERY_WORDS.some(word => q.includes(word));
}

export function filterForCostumeContext(results: any[]): FilterResult {
  const filtered = results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    
    const isNonWearable = COSTUME_NON_WEARABLE_TERMS.some(term => name.includes(term));
    if (isNonWearable) {
      console.log(`[Costume Context] Excluded non-wearable: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    
    const isInCostumeCategory = COSTUME_POSITIVE_CATEGORIES.some(cat => category.includes(cat));
    if (isInCostumeCategory) {
      return true;
    }
    
    const isClothing = COSTUME_CLOTHING_INDICATORS.some(term => name.includes(term)) ||
                       category.includes('clothing') || 
                       category.includes('fashion') ||
                       category.includes('apparel') ||
                       category.includes('baby') ||
                       category.includes('swimwear') ||
                       category.includes('beachwear');
    
    if (isClothing) {
      console.log(`[Costume Context] Excluded clothing: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
  
  if (filtered.length === 0 && results.length > 0) {
    console.log(`[Costume Context] INVENTORY GAP: All ${results.length} results were clothing - returning empty`);
    return { items: [], inventoryGap: true, gapReason: 'No actual costumes found - only clothing with costume graphics' };
  }
  
  return { items: filtered, inventoryGap: false };
}

export function hasFilmContext(query: string): boolean {
  const q = query.toLowerCase();
  const filmWords = ['film', 'movie', 'watch', 'cinema', 'animated'];
  const contextWords = ['about', 'with', 'for kids', 'children', 'family', 'disney', 'pixar'];
  return filmWords.some(f => q.includes(f)) && contextWords.some(c => q.includes(c));
}

export function filterForFilmContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.category || '')).toLowerCase();
    const isMovieRelated = text.includes('dvd') || text.includes('blu-ray') || 
                           text.includes('movie') || text.includes('film') ||
                           text.includes('cinema') || text.includes('disney') ||
                           text.includes('pixar') || text.includes('dreamworks');
    const isIrrelevantProduct = text.includes('heel') || text.includes('shoe sale') ||
                                 text.includes('handbag') || text.includes('supplement') ||
                                 text.includes('vitamin') || text.includes('skincare');
    if (isIrrelevantProduct && !isMovieRelated) {
      console.log(`[Film Context] Excluded non-film product: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    return true;
  });
}

export function hasBlindContext(query: string): boolean {
  const q = query.toLowerCase();
  return q.includes('blind') && (
    q.includes('character') || q.includes('kid') || q.includes('child') ||
    q.includes('book') || q.includes('story') || q.includes('person') ||
    q.includes('toy') || q.includes('doll') || q.includes('disability')
  );
}

export function filterForBlindContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.description || '') + ' ' + (r.category || '')).toLowerCase();
    const isWindowBlinds = text.includes('window blind') || text.includes('roller blind') ||
                           text.includes('venetian') || text.includes('day & night blind') ||
                           text.includes('blackout blind') || text.includes('blinds.');
    if (isWindowBlinds) {
      console.log(`[Blind Context] Excluded window blinds: "${r.name?.substring(0, 50)}..."`);
    }
    return !isWindowBlinds;
  });
}

export function hasStitchContext(query: string): boolean {
  const q = query.toLowerCase();
  return q.includes('stitch') && (
    q.includes('plush') || q.includes('toy') || q.includes('soft') ||
    q.includes('disney') || q.includes('lilo') || q.includes('figure') ||
    q.includes('gift') || q.includes('kids') || q.includes('child')
  );
}

export function filterForStitchContext(results: any[]): any[] {
  return results.filter(r => {
    const name = (r.name || '').toLowerCase();
    const brand = (r.brand || '').toLowerCase();
    const category = (r.category || '').toLowerCase();
    const description = (r.description || '').toLowerCase();
    
    if (name.includes('stitch') || brand.includes('disney') || brand.includes('stitch')) {
      return true;
    }
    
    if (category.includes('toy')) {
      return true;
    }
    
    const isClothing = category.includes('cloth') || category.includes('fashion') ||
                       category.includes('footwear') || category.includes('shoe') ||
                       category.includes('underwear') || category.includes('apparel');
    const isConstructionTerm = description.includes('stitch-for-stitch') || 
                               description.includes('stitched') ||
                               description.includes('stitching') ||
                               (description.includes('stitch') && description.includes('cotton'));
    
    if (isClothing || isConstructionTerm) {
      console.log(`[Stitch Context] Excluded non-Disney stitch: "${r.name?.substring(0, 50)}..."`);
      return false;
    }
    
    return true;
  });
}

export function filterForGenderContext(results: any[], gender: string): any[] {
  const exclusions = GENDER_EXCLUSION_MAP[gender] || [];
  if (exclusions.length === 0) return results;
  
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.description || '')).toLowerCase();
    const hasWrongGender = exclusions.some(ex => text.includes(ex));
    if (hasWrongGender) {
      console.log(`[Gender Filter] Wrong gender for "${gender}": "${r.name?.substring(0, 50)}..."`);
    }
    return !hasWrongGender;
  });
}

export function hasBookContext(query: string): boolean {
  const q = query.toLowerCase();
  if (!q.includes('book')) return false;
  
  const bookContextWords = [
    'tokens', 'voucher', 'gift', 'about', 'for kids', 'children', 
    'dentist', 'doctor', 'hospital', 'baby', 'sibling', 'families',
    'new baby', 'potty', 'bedtime', 'story', 'read'
  ];
  return bookContextWords.some(w => q.includes(w));
}

export function filterForBookContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.merchant || '')).toLowerCase();
    const isTravel = text.includes('car rental') || text.includes('holiday') || 
                     text.includes('hotel') || text.includes('flight') ||
                     TRAVEL_MERCHANTS.some(m => text.includes(m));
    if (isTravel) {
      console.log(`[Book Context] Excluded travel result: "${r.name?.substring(0, 50)}..."`);
    }
    return !isTravel;
  });
}

export function hasPartyBagContext(query: string): boolean {
  const q = query.toLowerCase();
  return q.includes('party bag') || q.includes('goody bag') || 
         q.includes('bag filler') || q.includes('bag bits');
}

export function filterForPartyBagContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.category || '')).toLowerCase();
    const isObviousFashion = text.includes('river island bag') || 
                             text.includes("women's bag") || 
                             text.includes('handbag');
    if (isObviousFashion) {
      console.log(`[Party Bag Context] Excluded fashion bag: "${r.name?.substring(0, 50)}..."`);
    }
    return !isObviousFashion;
  });
}

export function hasAgeContext(query: string): boolean {
  const q = query.toLowerCase();
  const agePattern = /(\d+)\s*(year|yr)s?\s*(old)?/i;
  if (!agePattern.test(q)) return false;
  
  const kidWords = ['old', 'child', 'kid', 'boy', 'girl', 'son', 'daughter', 'essentials'];
  return kidWords.some(w => q.includes(w));
}

export function filterForAgeContext(results: any[]): any[] {
  return results.filter(r => {
    const text = ((r.name || '') + ' ' + (r.description || '')).toLowerCase();
    const isWarranty = text.includes('year plan') || text.includes('year warranty') ||
                       text.includes('year care') || text.includes('year guarantee') ||
                       text.includes('year protection');
    if (isWarranty) {
      console.log(`[Age Context] Excluded warranty product: "${r.name?.substring(0, 50)}..."`);
    }
    return !isWarranty;
  });
}
