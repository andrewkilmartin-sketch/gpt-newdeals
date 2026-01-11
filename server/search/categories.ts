import type { ProductCategory, FilterSchema, FilterDefinition, FilterOption } from './types';

export const CATEGORY_INFERENCE_MAP: Record<string, string[]> = {
  'toys': ['toys', 'games', 'puzzles', 'play', 'lego', 'barbie', 'action', 'doll', 'figure', 'playset'],
  'sylvanian families': ['toys'],
  'calico critters': ['toys'],
  'playmobil': ['toys'],
  'lego': ['toys'],
  'barbie': ['toys', 'dolls'],
  'action figures': ['toys'],
  'board games': ['toys', 'games'],
  'clothing': ['dress', 'shirt', 'top', 'trousers', 'jeans', 'jacket', 'coat', 'jumper', 'sweater'],
  'dresses': ['women', 'dress', 'clothing'],
  'shirts': ['shirt', 'top', 'clothing'],
  'shoes': ['shoes', 'trainers', 'sneakers', 'boots', 'sandals', 'footwear'],
  'trainers': ['shoes', 'footwear'],
  'boots': ['shoes', 'footwear'],
  'electronics': ['headphones', 'speaker', 'phone', 'tablet', 'laptop', 'camera', 'tv'],
  'headphones': ['electronics', 'audio'],
  'home': ['furniture', 'decor', 'kitchen', 'bedding', 'garden'],
  'furniture': ['home', 'decor'],
  'kids': ['children', 'kids', 'boys', 'girls', 'toddler', 'baby'],
  'baby': ['baby', 'infant', 'toddler', 'nursery'],
};

export const BRAND_CATEGORY_MAP: Record<string, string> = {
  'sylvanian': 'toys', 'calico': 'toys', 'playmobil': 'toys', 'lego': 'toys',
  'barbie': 'toys', 'mattel': 'toys', 'hasbro': 'toys', 'fisher-price': 'toys',
  'disney': 'toys', 'marvel': 'toys', 'star wars': 'toys', 'pokemon': 'toys',
  'paw patrol': 'toys', 'peppa pig': 'toys', 'bluey': 'toys', 'cocomelon': 'toys',
  'fingerlings': 'toys', 'hatchimals': 'toys', 'furby': 'toys', 'tamagotchi': 'toys',
  'transformers': 'toys', 'nerf': 'toys', 'hot wheels': 'toys', 'beyblade': 'toys',
  'nike': 'shoes', 'adidas': 'shoes', 'puma': 'shoes', 'reebok': 'shoes',
  'clarks': 'shoes', 'converse': 'shoes', 'vans': 'shoes', 'jordan': 'shoes',
  'apple': 'electronics', 'samsung': 'electronics', 'sony': 'electronics',
  'ikea': 'home', 'john lewis': 'home',
};

export function inferCategoryFromQuery(query: string): { category: string; keywords: string[] } | null {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);
  
  for (const [brand, category] of Object.entries(BRAND_CATEGORY_MAP)) {
    if (q.includes(brand)) {
      return { category, keywords: [category] };
    }
  }
  
  for (const [key, keywords] of Object.entries(CATEGORY_INFERENCE_MAP)) {
    if (q.includes(key) || words.some(w => key.includes(w))) {
      return { category: key, keywords };
    }
  }
  
  if (/\b(\d+)\s*(year|yr)s?\s*old\b/.test(q) || /\b(boy|girl|kid|child|toddler|baby)\b/.test(q)) {
    return { category: 'kids', keywords: ['children', 'kids'] };
  }
  
  return null;
}

export async function searchFallbackByCategory(
  category: string, 
  keywords: string[], 
  storage: any,
  limit: number = 10,
  maxPrice?: number
): Promise<{ products: any[]; fallbackCategory: string }> {
  try {
    const fallbackQuery = keywords[0] || category;
    console.log(`[Fallback Search] Searching category "${category}" with keyword "${fallbackQuery}"${maxPrice ? `, maxPrice: £${maxPrice}` : ''}`);
    
    const results = await storage.searchProducts(fallbackQuery, limit, 0, maxPrice);
    
    let filteredProducts = results.products;
    if (maxPrice) {
      filteredProducts = filteredProducts.filter((p: any) => p.price <= maxPrice);
    }
    
    if (filteredProducts.length > 0) {
      return { products: filteredProducts, fallbackCategory: category };
    }
    
    const broadResults = await storage.searchProducts(category, limit, 0, maxPrice);
    let broadFiltered = broadResults.products;
    if (maxPrice) {
      broadFiltered = broadFiltered.filter((p: any) => p.price <= maxPrice);
    }
    return { products: broadFiltered, fallbackCategory: category };
  } catch (error) {
    console.error('[Fallback Search] Error:', error);
    return { products: [], fallbackCategory: category };
  }
}

export function detectProductCategory(query: string, attributes: any, matchedCategories: string[]): ProductCategory {
  const q = query.toLowerCase();
  const cats = matchedCategories.map(c => c.toLowerCase()).join(' ');
  
  if (/\b(toys?|lego|barbie|action figure|board game|playset|doll|puzzle|nerf|hot wheels|legos?)\b/.test(q) ||
      /\b(year old|age \d|for kids|children|kid's)\b/.test(q) ||
      /\b(toys?|games?\s+puzzles?)\b/.test(cats)) {
    return 'toys';
  }
  
  if (/\b(headphones?|earbuds?|earphones?|speaker|camera|tv|television|laptop|tablet|phone|bluetooth|wireless audio)\b/.test(q) ||
      /\b(headphones?|electronics?|computing|audio)\b/.test(cats)) {
    return 'electronics';
  }
  
  if (/\b(shoes?|trainers?|sneakers?|boots?|sandals?|heels?|loafers?|pumps?|footwear)\b/.test(q) ||
      /\b(footwear|shoes)\b/.test(cats) ||
      (attributes?.model && /\b(air force|air max|jordan|yeezy|converse|vans)\b/i.test(attributes.model))) {
    return 'footwear';
  }
  
  if (/\b(makeup|skincare|perfume|fragrance|cosmetic|lipstick|mascara|cream|serum|beauty)\b/.test(q) ||
      /\b(beauty|cosmetics|skincare)\b/.test(cats)) {
    return 'beauty';
  }
  
  if (/\b(furniture|sofa|table|chair|lamp|bed|mattress|garden|outdoor|kitchen|bathroom|decor)\b/.test(q) ||
      /\b(home|garden|furniture|decor)\b/.test(cats)) {
    return 'home';
  }
  
  if (/\b(shirt|dress|jeans|trousers|pants|jacket|coat|hoodie|sweater|t-shirt|blouse|skirt|clothing)\b/.test(q) ||
      /\b(clothing|apparel|fashion)\b/.test(cats)) {
    return 'clothing';
  }
  
  if (attributes?.size && (attributes?.color || attributes?.gender)) {
    return 'clothing';
  }
  
  return 'general';
}

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  'clothing': 'Clothing',
  'footwear': 'Footwear',
  'toys': 'Toys & Games',
  'electronics': 'Electronics',
  'home': 'Home & Garden',
  'beauty': 'Beauty',
  'general': 'All Products'
};

export function buildBespokeFilters(category: ProductCategory, products: any[], attributes: any): FilterSchema {
  const filters: FilterDefinition[] = [];
  
  const brandCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();
  
  for (const p of products) {
    if (p.brand) {
      brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
    }
    const colorMatch = (p.name || '').match(/\b(black|white|red|blue|green|grey|gray|pink|purple|orange|yellow|brown|beige|navy|cream)\b/i);
    if (colorMatch) {
      const color = colorMatch[1].toLowerCase();
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }
  }
  
  if (brandCounts.size > 1) {
    filters.push({
      id: 'brand',
      label: 'Brand',
      type: 'multi',
      options: Array.from(brandCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, label: value, count }))
    });
  }
  
  if (category === 'footwear' || category === 'clothing') {
    const sizeCounts = new Map<string, number>();
    for (const p of products) {
      const sizeMatch = (p.name || '').match(/(?:size[:\s]*)?(\d+(?:\.\d+)?)\s*(?:\((?:EU|UK)\s*\d+\))?/i);
      if (sizeMatch) {
        sizeCounts.set(sizeMatch[1], (sizeCounts.get(sizeMatch[1]) || 0) + 1);
      }
    }
    if (sizeCounts.size > 0) {
      filters.push({
        id: 'size',
        label: 'Size',
        type: 'multi',
        options: Array.from(sizeCounts.entries())
          .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
          .map(([value, count]) => ({ value, label: `UK ${value}`, count }))
      });
    }
    
    if (colorCounts.size > 0) {
      filters.push({
        id: 'color',
        label: 'Colour',
        type: 'multi',
        options: Array.from(colorCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([value, count]) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1), count }))
      });
    }
    
    const genderCounts = new Map<string, number>();
    for (const p of products) {
      const cat = (p.category || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      if (cat.includes("men's") || cat.includes('mens') || name.includes("men's")) {
        genderCounts.set('mens', (genderCounts.get('mens') || 0) + 1);
      }
      if (cat.includes("women's") || cat.includes('womens') || name.includes("women's")) {
        genderCounts.set('womens', (genderCounts.get('womens') || 0) + 1);
      }
      if (cat.includes('children') || cat.includes('kids') || cat.includes('youth')) {
        genderCounts.set('kids', (genderCounts.get('kids') || 0) + 1);
      }
    }
    if (genderCounts.size > 0) {
      filters.push({
        id: 'gender',
        label: 'For',
        type: 'single',
        options: [
          genderCounts.has('mens') ? { value: 'mens', label: "Men's", count: genderCounts.get('mens')! } : null,
          genderCounts.has('womens') ? { value: 'womens', label: "Women's", count: genderCounts.get('womens')! } : null,
          genderCounts.has('kids') ? { value: 'kids', label: 'Kids', count: genderCounts.get('kids')! } : null,
        ].filter(Boolean) as FilterOption[]
      });
    }
  }
  
  if (category === 'toys') {
    const ageCounts = new Map<string, number>();
    for (const p of products) {
      const desc = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
      if (/\b(0-2|baby|infant|toddler)\b/.test(desc)) ageCounts.set('0-2', (ageCounts.get('0-2') || 0) + 1);
      if (/\b(3-5|preschool)\b/.test(desc)) ageCounts.set('3-5', (ageCounts.get('3-5') || 0) + 1);
      if (/\b(6-8|school age)\b/.test(desc)) ageCounts.set('6-8', (ageCounts.get('6-8') || 0) + 1);
      if (/\b(9-12|tween)\b/.test(desc)) ageCounts.set('9-12', (ageCounts.get('9-12') || 0) + 1);
      if (/\b(13\+|teen|adult)\b/.test(desc)) ageCounts.set('13+', (ageCounts.get('13+') || 0) + 1);
    }
    if (ageCounts.size > 0) {
      filters.push({
        id: 'ageRange',
        label: 'Age Range',
        type: 'single',
        options: ['0-2', '3-5', '6-8', '9-12', '13+']
          .filter(age => ageCounts.has(age))
          .map(age => ({ value: age, label: `${age} years`, count: ageCounts.get(age)! }))
      });
    }
    
    const franchises = new Map<string, number>();
    const franchisePatterns = [
      { pattern: /\blego\b/i, name: 'LEGO' },
      { pattern: /\bbarbie\b/i, name: 'Barbie' },
      { pattern: /\bmarvel|avengers|spider-?man\b/i, name: 'Marvel' },
      { pattern: /\bstar wars\b/i, name: 'Star Wars' },
      { pattern: /\bdisney|frozen|princess\b/i, name: 'Disney' },
      { pattern: /\bpaw patrol\b/i, name: 'Paw Patrol' },
      { pattern: /\bpokemon|pikachu\b/i, name: 'Pokemon' },
      { pattern: /\bnerf\b/i, name: 'Nerf' },
      { pattern: /\bhot wheels\b/i, name: 'Hot Wheels' },
    ];
    for (const p of products) {
      const text = ((p.name || '') + ' ' + (p.brand || '')).toLowerCase();
      for (const { pattern, name } of franchisePatterns) {
        if (pattern.test(text)) {
          franchises.set(name, (franchises.get(name) || 0) + 1);
        }
      }
    }
    if (franchises.size > 0) {
      filters.push({
        id: 'franchise',
        label: 'Character/Franchise',
        type: 'multi',
        options: Array.from(franchises.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([value, count]) => ({ value, label: value, count }))
      });
    }
  }
  
  if (category === 'electronics') {
    const connCounts = new Map<string, number>();
    for (const p of products) {
      const text = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
      if (/\bbluetooth\b/.test(text)) connCounts.set('bluetooth', (connCounts.get('bluetooth') || 0) + 1);
      if (/\bwi-?fi\b/.test(text)) connCounts.set('wifi', (connCounts.get('wifi') || 0) + 1);
      if (/\busb-?c\b/.test(text)) connCounts.set('usbc', (connCounts.get('usbc') || 0) + 1);
      if (/\bwireless\b/.test(text)) connCounts.set('wireless', (connCounts.get('wireless') || 0) + 1);
    }
    if (connCounts.size > 0) {
      filters.push({
        id: 'connectivity',
        label: 'Connectivity',
        type: 'multi',
        options: Array.from(connCounts.entries())
          .map(([value, count]) => ({ 
            value, 
            label: value === 'bluetooth' ? 'Bluetooth' : value === 'wifi' ? 'Wi-Fi' : value === 'usbc' ? 'USB-C' : 'Wireless',
            count 
          }))
      });
    }
  }
  
  return {
    category,
    categoryLabel: CATEGORY_LABELS[category],
    filters
  };
}

export function buildPriceRanges(prices: number[]): { range: string; min: number; max: number; count: number }[] {
  const validPrices = prices.filter(p => p > 0);
  if (validPrices.length === 0) return [];
  
  const max = Math.max(...validPrices);
  
  const ranges: { range: string; min: number; max: number; count: number }[] = [];
  
  if (max <= 25) {
    ranges.push({ range: 'Under £10', min: 0, max: 10, count: 0 });
    ranges.push({ range: '£10-£25', min: 10, max: 25, count: 0 });
  } else if (max <= 100) {
    ranges.push({ range: 'Under £25', min: 0, max: 25, count: 0 });
    ranges.push({ range: '£25-£50', min: 25, max: 50, count: 0 });
    ranges.push({ range: '£50-£100', min: 50, max: 100, count: 0 });
  } else if (max <= 500) {
    ranges.push({ range: 'Under £50', min: 0, max: 50, count: 0 });
    ranges.push({ range: '£50-£100', min: 50, max: 100, count: 0 });
    ranges.push({ range: '£100-£200', min: 100, max: 200, count: 0 });
    ranges.push({ range: '£200-£500', min: 200, max: 500, count: 0 });
  } else {
    ranges.push({ range: 'Under £100', min: 0, max: 100, count: 0 });
    ranges.push({ range: '£100-£250', min: 100, max: 250, count: 0 });
    ranges.push({ range: '£250-£500', min: 250, max: 500, count: 0 });
    ranges.push({ range: '£500+', min: 500, max: 999999, count: 0 });
  }
  
  for (const price of validPrices) {
    for (const r of ranges) {
      if (price >= r.min && price < r.max) {
        r.count++;
        break;
      }
    }
  }
  
  return ranges.filter(r => r.count > 0);
}

export function buildMerchantComparison(products: any[]): { product: string; options: { merchant: string; price: number; link: string; inStock: boolean }[] }[] {
  const groups = new Map<string, any[]>();
  
  for (const p of products) {
    const name = (p.name || '').toLowerCase()
      .replace(/\s+(size|uk|eu|colour|color)\s*[\d\w]+/gi, '')
      .replace(/[^\w\s]/g, '')
      .trim();
    const key = name.slice(0, 50);
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(p);
  }
  
  const comparisons: { product: string; options: { merchant: string; price: number; link: string; inStock: boolean }[] }[] = [];
  
  for (const [, items] of Array.from(groups)) {
    const uniqueMerchants = new Set(items.map((i: any) => i.merchant));
    if (uniqueMerchants.size > 1) {
      const merchantBest: Map<string, any> = new Map();
      for (const item of items.sort((a: any, b: any) => (parseFloat(a.price) || 999999) - (parseFloat(b.price) || 999999))) {
        if (!merchantBest.has(item.merchant)) {
          merchantBest.set(item.merchant, item);
        }
      }
      
      comparisons.push({
        product: items[0].name.slice(0, 80),
        options: Array.from(merchantBest.values()).map((i: any) => ({
          merchant: i.merchant,
          price: parseFloat(i.price) || 0,
          link: i.affiliate_link || i.affiliateLink,
          inStock: i.in_stock ?? i.inStock ?? true
        })).sort((a, b) => a.price - b.price)
      });
    }
  }
  
  return comparisons.slice(0, 5);
}
