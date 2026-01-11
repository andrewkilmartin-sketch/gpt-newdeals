/**
 * Brand and Character Constants
 * 
 * Contains known toy brands, franchise characters, and brand validation logic.
 * Used by search filters to identify toy queries and validate brand matches.
 * 
 * See CRITICAL_FIXES.md - Fix #32, #38
 */

export const KNOWN_TOY_BRANDS = [
  'hot wheels', 'hotwheels', 'super soaker', 'nerf', 'barbie', 'lego', 'duplo',
  'paw patrol', 'peppa pig', 'bluey', 'frozen', 'disney princess', 'marvel',
  'spider-man', 'spiderman', 'batman', 'avengers', 'transformers', 'pokemon',
  'pokémon', 'pikachu', 'minecraft', 'roblox', 'fortnite', 'sonic', 'mario',
  'playmobil', 'sylvanian', 'lol surprise', 'lol dolls', 'gabby dollhouse',
  'cocomelon', 'hey duggee', 'thomas tank', 'thomas the tank', 'pj masks',
  'jurassic world', 'jurassic park', 't-rex', 'dinosaur', 'unicorn'
];

export const MAKEUP_COSMETICS_TERMS = [
  'nyx', 'makeup', 'cosmetic', 'cosmetics', 'lipstick', 'mascara', 
  'foundation', 'concealer', 'eyeshadow', 'blush', 'bronzer',
  'moisturiser', 'moisturizer', 'serum', 'skincare', 'skin care',
  'nail polish', 'nail varnish', 'perfume', 'fragrance', 'cologne',
  'eye liner', 'eyeliner', 'lip gloss', 'lipgloss', 'primer'
];

export const CRAFT_SUPPLY_PATTERNS = [
  'trimits', 'craft factory', 'wobbly toy eyes', 'safety eyes', 'toy eyes',
  'stick on eyes', 'wobbly eyes', 'toy safety noses', 'craft eyes'
];

export const QUALITY_INTENT_WORDS = [
  'best', 'top', 'quality', 'premium', 'timeless', 'heirloom', 
  'investment', 'luxury', 'high end', 'well made', 'durable',
  'recommended', 'popular', 'trending', 'must have', 'essential'
];

export const DISCOUNT_MERCHANTS = [
  'poundfun', 'poundland', 'poundshop', 'everything5pounds', 'poundworld',
  'poundtoy', 'the works', 'b&m', 'home bargains'
];

export const TRAVEL_MERCHANTS = [
  'booking.com', 'hotels.com', 'expedia', 'lastminute', 'trivago', 
  'travelodge', 'premier inn', 'airbnb', 'jet2', 'easyjet'
];

export const JEWELRY_WATCH_MERCHANTS = [
  'ernest jones', 'h samuel', 'goldsmiths', 'watch shop', 'jura watches',
  'beaverbrooks', 'fraser hart', 'argento', 'pandora'
];

export const HOLIDAY_TRAVEL_MERCHANTS = [
  'jet2', 'tui', 'easyjet', 'ryanair', 'british airways', 'virgin atlantic',
  'expedia', 'booking.com', 'lastminute', 'on the beach', 'love holidays'
];

export const GENDER_EXCLUSION_MAP: { [key: string]: string[] } = {
  'him': ["women's", 'for her', 'gifts for her', "ladies'", 'feminine'],
  'he': ["women's", 'for her', 'gifts for her', "ladies'", 'feminine'],
  'boy': ["women's", 'for her', "ladies'", 'feminine', "girl's dress"],
  'son': ["women's", 'for her', "ladies'", 'feminine'],
  'nephew': ["women's", 'for her', "ladies'", 'feminine'],
  'dad': ["women's", 'for her', "ladies'", 'feminine', 'mum', 'mother'],
  'father': ["women's", 'for her', "ladies'", 'feminine', 'mum', 'mother'],
  'grandad': ["women's", 'for her', "ladies'", 'feminine'],
  'her': ["men's", 'for him', 'gifts for him', "gent's", 'masculine'],
  'she': ["men's", 'for him', 'gifts for him', "gent's", 'masculine'],
  'girl': ["men's", 'for him', "gent's", "boy's shirt", 'tie'],
  'daughter': ["men's", 'for him', "gent's", 'masculine'],
  'niece': ["men's", 'for him', "gent's", 'masculine'],
  'mum': ["men's", 'for him', "gent's", 'dad', 'father'],
  'mother': ["men's", 'for him', "gent's", 'dad', 'father'],
  'grandma': ["men's", 'for him', "gent's", 'masculine']
};

/**
 * Check if GPT brand is valid (not null, "null", undefined, empty)
 * Fix #38
 */
export function isValidBrand(brand: any): boolean {
  if (!brand) return false;
  if (typeof brand !== 'string') return false;
  const normalized = brand.toLowerCase().trim();
  if (normalized === '' || normalized === 'null' || normalized === 'undefined' || normalized === 'none') {
    return false;
  }
  return true;
}

/**
 * Check if query is a toy-related query
 * Fix #39
 */
export function isToyQuery(query: string): boolean {
  const q = query.toLowerCase();
  const toyIndicators = [
    'toy', 'toys', 'doll', 'dolls', 'figure', 'figures', 'playset',
    'lol surprise', 'lol dolls', 'barbie', 'action figure'
  ];
  return toyIndicators.some(t => q.includes(t)) || 
         KNOWN_TOY_BRANDS.some(brand => q.includes(brand));
}

/**
 * Check if product is a craft supply (not a toy)
 * Fix #47
 */
export function isCraftSupply(productName: string): boolean {
  const name = productName.toLowerCase();
  for (const pattern of CRAFT_SUPPLY_PATTERNS) {
    if (name.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if query has quality intent (user wants premium, not cheapest)
 */
export function hasQualityIntent(query: string): boolean {
  const q = query.toLowerCase();
  return QUALITY_INTENT_WORDS.some(w => q.includes(w));
}

/**
 * Check if query has gender context
 */
export function hasGenderContext(query: string): string | null {
  const q = query.toLowerCase();
  for (const gender of Object.keys(GENDER_EXCLUSION_MAP)) {
    const regex = new RegExp(`\\b${gender}\\b`, 'i');
    if (regex.test(q)) {
      return gender;
    }
  }
  return null;
}
