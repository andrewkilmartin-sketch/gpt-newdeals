import { ShoppingDeal } from "@shared/schema";
import { indexPromotions, semanticSearch, isEmbeddingsReady, getEmbeddingCount } from "./embeddings";
import { loadProductFeed, searchProducts, isProductFeedLoaded, getProductCount } from "./product-feed";
import { storage } from "../storage";

const AWIN_API_KEY = process.env.AWIN_API_KEY;
const AWIN_PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

interface AwinProgram {
  id: number;
  name: string;
  description: string;
  displayUrl: string;
  logoUrl: string;
  clickThroughUrl: string;
  currencyCode: string;
  primaryRegion: { name: string; countryCode: string };
  status: string;
  primarySector: string;
}

interface AwinEnhancedProduct {
  meta?: { advertiser_id: number; advertiser_name: string };
  id?: string;
  title?: string;
  description?: string;
  link?: string;
  image_link?: string;
  additional_image_link?: string[];
  price?: string;
  sale_price?: string;
  brand?: string;
  google_product_category?: string;
  product_type?: string;
  availability?: string;
  condition?: string;
  gtin?: string;
  mpn?: string;
  color?: string;
  size?: string;
  gender?: string;
  age_group?: string;
}

interface AwinPromotion {
  promotionId: number;
  type: string;
  advertiser: { id: number; name: string; joined: boolean };
  title: string;
  description: string;
  terms?: string;
  startDate: string;
  endDate: string;
  status: string;
  url: string;
  urlTracking: string;
  dateAdded: string;
  campaign?: string;
  regions: { all: boolean; list?: { id: number; name: string; countryCode: string }[] };
  categories?: string[];
  voucher?: { code: string; exclusive: boolean; attributable: boolean };
}

// Cache for programs
let programsCache: AwinProgram[] | null = null;
let programsCacheTime: number = 0;
const PROGRAMS_CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Cache for products from Enhanced Feeds
let enhancedProductsCache: AwinEnhancedProduct[] = [];
let enhancedProductsCacheTime: number = 0;
const PRODUCTS_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

// Cache for promotions
let promotionsCache: AwinPromotion[] | null = null;
let promotionsCacheTime: number = 0;
const PROMOTIONS_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

// Known advertisers with Enhanced Feeds (discovered through API testing)
const ENHANCED_FEED_ADVERTISERS = [
  899,   // Fitness Options (confirmed working)
  2642,  // (confirmed working)
];

// Get joined UK programs
async function getJoinedPrograms(): Promise<AwinProgram[]> {
  if (!AWIN_API_KEY || !AWIN_PUBLISHER_ID) return [];

  if (programsCache && Date.now() - programsCacheTime < PROGRAMS_CACHE_DURATION) {
    return programsCache;
  }

  try {
    const url = `https://api.awin.com/publishers/${AWIN_PUBLISHER_ID}/programmes?relationship=joined&countryCode=GB`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AWIN_API_KEY}` }
    });

    if (!response.ok) {
      console.log(`Programs API returned ${response.status}`);
      return programsCache || [];
    }

    const programs = await response.json() as AwinProgram[];
    programsCache = programs;
    programsCacheTime = Date.now();
    console.log(`Cached ${programs.length} joined UK programs`);
    return programs;
  } catch (error) {
    console.error("Error fetching programs:", error);
    return programsCache || [];
  }
}

// Fetch products from Enhanced Feed API for a specific advertiser
async function fetchEnhancedFeed(advertiserId: number): Promise<AwinEnhancedProduct[]> {
  if (!AWIN_API_KEY || !AWIN_PUBLISHER_ID) return [];

  try {
    const url = `https://api.awin.com/publishers/${AWIN_PUBLISHER_ID}/awinfeeds/download/${advertiserId}-retail-en_GB.jsonl`;
    console.log(`Trying Enhanced Feed for advertiser ${advertiserId}...`);
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${AWIN_API_KEY}` }
    });

    if (!response.ok) {
      console.log(`Enhanced Feed ${advertiserId}: HTTP ${response.status}`);
      return [];
    }

    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim());
    const products: AwinEnhancedProduct[] = [];

    for (const line of lines.slice(0, 500)) { // Limit per advertiser
      try {
        const product = JSON.parse(line) as AwinEnhancedProduct;
        if (product && product.title && !product.meta) {
          products.push(product);
        }
      } catch {
        // Skip invalid lines
      }
    }

    return products;
  } catch (error) {
    return [];
  }
}

// Fetch all products from Enhanced Feeds
async function fetchAllEnhancedProducts(): Promise<AwinEnhancedProduct[]> {
  if (enhancedProductsCache.length > 0 && Date.now() - enhancedProductsCacheTime < PRODUCTS_CACHE_DURATION) {
    console.log(`Returning ${enhancedProductsCache.length} cached enhanced products`);
    return enhancedProductsCache;
  }

  console.log("Fetching products from Enhanced Feeds...");
  const allProducts: AwinEnhancedProduct[] = [];

  // Try known advertisers with Enhanced Feeds
  for (const advertiserId of ENHANCED_FEED_ADVERTISERS) {
    try {
      const products = await fetchEnhancedFeed(advertiserId);
      if (products.length > 0) {
        console.log(`Got ${products.length} products from advertiser ${advertiserId}`);
        allProducts.push(...products);
      }
    } catch (err) {
      // Continue to next advertiser
    }
  }

  // Also try some from joined programs
  const programs = await getJoinedPrograms();
  const additionalIds = programs
    .filter(p => !ENHANCED_FEED_ADVERTISERS.includes(p.id))
    .slice(0, 50) // Try more advertisers to find working feeds
    .map(p => p.id);

  console.log(`Trying ${additionalIds.length} additional advertisers for Enhanced Feeds...`);
  let feedsFound = 0;
  
  for (const advertiserId of additionalIds) {
    if (allProducts.length > 5000) break; // Limit total products
    try {
      const products = await fetchEnhancedFeed(advertiserId);
      if (products.length > 0) {
        feedsFound++;
        console.log(`Got ${products.length} products from advertiser ${advertiserId}`);
        allProducts.push(...products);
      }
    } catch (err) {
      // Continue
    }
  }
  
  console.log(`Enhanced Feeds: found ${feedsFound} advertisers with products, ${allProducts.length} total products`);

  if (allProducts.length > 0) {
    enhancedProductsCache = allProducts;
    enhancedProductsCacheTime = Date.now();
    console.log(`Cached ${allProducts.length} total enhanced products`);
  }

  return allProducts;
}

// Fetch promotions (vouchers/deals)
async function fetchPromotions(): Promise<AwinPromotion[]> {
  if (!AWIN_API_KEY || !AWIN_PUBLISHER_ID) return [];

  if (promotionsCache && Date.now() - promotionsCacheTime < PROMOTIONS_CACHE_DURATION) {
    return promotionsCache;
  }

  try {
    console.log("Fetching Awin promotions...");
    const allPromotions: AwinPromotion[] = [];
    let page = 1;
    const pageSize = 200;
    let totalPages = 1;

    while (page <= totalPages && page <= 20) {
      const url = `https://api.awin.com/publisher/${AWIN_PUBLISHER_ID}/promotions?accessToken=${AWIN_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AWIN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters: { membership: "joined", status: "active", regionCodes: ["GB"] },
          pagination: { page, pageSize }
        })
      });

      if (!response.ok) break;

      const data = await response.json();
      if (!data.data || !Array.isArray(data.data)) break;

      allPromotions.push(...data.data);

      // Use totalPages directly if available, otherwise calculate from totalResults
      if (data.pagination?.totalPages) {
        totalPages = data.pagination.totalPages;
      } else if (data.pagination?.totalResults) {
        totalPages = Math.ceil(data.pagination.totalResults / pageSize);
      } else if (data.pagination?.total) {
        totalPages = Math.ceil(data.pagination.total / pageSize);
      }
      
      console.log(`Fetched page ${page}/${totalPages}, got ${data.data.length} promotions (total so far: ${allPromotions.length})`);
      page++;

      if (page <= totalPages) {
        await new Promise(r => setTimeout(r, 100)); // Rate limiting
      }
    }

    promotionsCache = allPromotions;
    promotionsCacheTime = Date.now();
    console.log(`Cached ${allPromotions.length} promotions`);
    
    // Index promotions with semantic embeddings (async, non-blocking)
    indexPromotions(allPromotions).catch(err => {
      console.error('Failed to index promotions:', err);
    });
    
    return allPromotions;
  } catch (error) {
    console.error("Error fetching promotions:", error);
    return promotionsCache || [];
  }
}

// Comprehensive synonym mapping for smarter search
const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Kids/Family terms - EXPANDED
  'kids': ['kid', 'children', 'child', 'toddler', 'baby', 'junior', 'youth', 'boys', 'girls', 'infant', 'kidswear', 'school', 'family', 'nursery', 'newborn', 'maternity', 'parent', 'mum', 'dad', 'little', 'young'],
  'children': ['child', 'kids', 'kid', 'toddler', 'baby', 'junior', 'youth', 'boys', 'girls', 'infant', 'family', 'school'],
  'baby': ['babies', 'infant', 'newborn', 'toddler', 'nursery', 'maternity', 'kids', 'children', 'nappy', 'pushchair', 'pram'],
  'family': ['families', 'kids', 'children', 'parent', 'mum', 'dad', 'baby', 'home'],
  
  // Clothing terms - EXPANDED  
  'clothes': ['clothing', 'fashion', 'apparel', 'wear', 'outfit', 'dress', 'shirt', 'trousers', 'jeans', 'jacket', 'coat', 't-shirt', 'polo', 'jumper', 'hoodie', 'top', 'bottoms', 'skirt', 'suit'],
  'clothing': ['clothes', 'fashion', 'apparel', 'wear', 'outfit', 'dress', 'shirt', 'trousers', 'jeans', 'jacket', 'coat', 'garment', 'wardrobe'],
  'fashion': ['clothing', 'clothes', 'apparel', 'wear', 'outfit', 'dress', 'shoes', 'footwear', 'accessories', 'style', 'designer', 'boutique', 'brand'],
  
  // Footwear - EXPANDED with UK and US terms
  'shoes': ['shoe', 'footwear', 'trainers', 'boots', 'sneakers', 'sandals', 'pumps', 'loafers', 'heels', 'slippers', 'sports shoes', 'running', 'walking', 'athletic'],
  'trainers': ['trainer', 'sneakers', 'sneaker', 'shoes', 'shoe', 'footwear', 'sports', 'running', 'gym', 'athletic', 'kicks', 'sports shoes', 'running shoes'],
  'running': ['run', 'running shoes', 'trainers', 'sneakers', 'athletic', 'jogging', 'sports shoes', 'footwear'],
  'sneakers': ['sneaker', 'trainers', 'trainer', 'shoes', 'footwear', 'kicks', 'athletic'],
  
  // Toys/Entertainment - EXPANDED
  'toys': ['toy', 'games', 'lego', 'playmobil', 'dolls', 'action figures', 'play', 'gaming', 'puzzle', 'board game', 'teddy', 'plush', 'fun'],
  'games': ['game', 'gaming', 'toys', 'play', 'puzzle', 'board', 'video', 'console', 'playstation', 'xbox', 'nintendo'],
  
  // Electronics - EXPANDED
  'electronics': ['electronic', 'tech', 'gadget', 'gadgets', 'phone', 'laptop', 'tv', 'computer', 'tablet', 'gaming', 'smart', 'device', 'appliance', 'electrical'],
  'phone': ['phones', 'mobile', 'smartphone', 'iphone', 'samsung', 'sim', 'contract'],
  'laptop': ['laptops', 'computer', 'pc', 'macbook', 'chromebook', 'notebook'],
  
  // Home - EXPANDED
  'home': ['house', 'furniture', 'decor', 'garden', 'kitchen', 'bedroom', 'living', 'homeware', 'interior', 'household', 'diy', 'storage', 'bedding', 'curtains', 'lighting'],
  'furniture': ['sofa', 'bed', 'table', 'chair', 'desk', 'wardrobe', 'storage', 'home'],
  'garden': ['outdoor', 'patio', 'plants', 'lawn', 'bbq', 'shed', 'furniture'],
  
  // Beauty/Health - EXPANDED
  'beauty': ['cosmetics', 'makeup', 'skincare', 'perfume', 'fragrance', 'hair', 'salon', 'spa', 'grooming', 'nail', 'lipstick', 'foundation', 'serum'],
  'health': ['healthcare', 'pharmacy', 'medicine', 'vitamin', 'supplement', 'wellness', 'fitness', 'diet'],
  
  // Fitness/Sports - EXPANDED
  'fitness': ['gym', 'exercise', 'workout', 'sports', 'training', 'health', 'wellness', 'running', 'yoga', 'weights'],
  'sports': ['sport', 'fitness', 'gym', 'football', 'golf', 'tennis', 'cycling', 'running', 'swimming', 'outdoor'],
  
  // Food/Drink - EXPANDED
  'food': ['grocery', 'groceries', 'supermarket', 'restaurant', 'dining', 'meal', 'snacks', 'drink', 'chocolate', 'coffee', 'tea', 'wine', 'beer', 'delivery'],
  'restaurant': ['restaurants', 'dining', 'food', 'eat', 'takeaway', 'delivery', 'pizza', 'curry'],
  
  // Travel - EXPANDED
  'travel': ['holiday', 'holidays', 'vacation', 'hotel', 'hotels', 'flight', 'flights', 'trip', 'luggage', 'booking', 'resort', 'beach', 'cruise', 'airport', 'car hire'],
  'holiday': ['holidays', 'vacation', 'travel', 'trip', 'break', 'getaway', 'resort', 'beach'],
  
  // Gifts/Occasions - EXPANDED
  'gifts': ['gift', 'present', 'presents', 'hamper', 'flowers', 'cards', 'occasions', 'birthday', 'christmas', 'wedding', 'anniversary', 'valentine'],
  'christmas': ['xmas', 'festive', 'holiday', 'gift', 'gifts', 'present', 'winter', 'santa'],
  
  // Shopping terms
  'sale': ['sales', 'discount', 'discounts', 'offer', 'offers', 'deal', 'deals', 'clearance', 'outlet', 'bargain', 'save', 'saving', 'off', 'reduced', 'cheap'],
  'discount': ['discounts', 'sale', 'offer', 'voucher', 'code', 'coupon', 'promo', 'deal', 'save', 'saving', 'off', 'percent'],
  'voucher': ['vouchers', 'code', 'codes', 'coupon', 'promo', 'discount', 'offer'],
  
  // Retail categories
  'shopping': ['shop', 'store', 'retail', 'buy', 'purchase', 'order', 'online'],
  'online': ['internet', 'web', 'digital', 'ecommerce', 'shop', 'order'],
};

function expandSearchTerms(query: string): string[] {
  const terms = [query.toLowerCase()];
  const words = query.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    terms.push(word);
    for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
      if (word.includes(key) || key.includes(word)) {
        terms.push(...synonyms);
      }
      if (synonyms.some(s => word.includes(s) || s.includes(word))) {
        terms.push(key, ...synonyms);
      }
    }
  }
  
  return Array.from(new Set(terms));
}

// Brand-specific retailers for relevance boosting
const BRAND_RETAILERS: Record<string, string[]> = {
  'nike': ['jd sports', 'footasylum', 'sports direct', 'nike', 'schuh', 'offspring', 'size?', 'foot locker'],
  'adidas': ['jd sports', 'footasylum', 'sports direct', 'adidas', 'schuh', 'offspring', 'foot locker'],
  'puma': ['jd sports', 'sports direct', 'puma', 'schuh'],
  'trainers': ['jd sports', 'footasylum', 'sports direct', 'schuh', 'offspring', 'foot locker', 'nike', 'adidas'],
  'shoes': ['jd sports', 'footasylum', 'sports direct', 'schuh', 'clarks', 'office', 'dune', 'kurt geiger'],
  'toys': ['hamleys', 'the entertainer', 'smyths', 'argos', 'amazon'],
  'baby': ['natural baby shower', 'jojo maman bebe', 'mamas & papas', 'mothercare', 'boots'],
  'kids': ['jd sports', 'next', 'h&m', 'primark', 'matalan', 'george', 'tu'],
  'fashion': ['next', 'marks & spencer', 'm&s', 'asos', 'boohoo', 'prettylittlething', 'very', 'river island'],
  'electronics': ['currys', 'argos', 'ao.com', 'john lewis', 'amazon', 'apple'],
  'home': ['dunelm', 'ikea', 'wayfair', 'the range', 'homesense', 'john lewis', 'next home'],
  'beauty': ['boots', 'superdrug', 'lookfantastic', 'feel unique', 'cult beauty', 'the body shop', 'space nk'],
  'health': ['boots', 'superdrug', 'holland & barrett', 'lloyds pharmacy'],
  'sports': ['jd sports', 'sports direct', 'decathlon', 'pro:direct', 'lovell rugby', 'kitbag'],
  'gaming': ['game', 'currys', 'argos', 'amazon', 'smyths'],
  'travel': ['lastminute', 'expedia', 'booking.com', 'tui', 'jet2', 'easyjet', 'ryanair'],
  'gifts': ['prezzybox', 'find me a gift', 'getting personal', 'moonpig', 'funky pigeon'],
};

// Generic merchants to penalize for non-matching searches
const GENERIC_BEAUTY_MERCHANTS = ['boots', 'lookfantastic', 'superdrug', 'feel unique', 'cult beauty'];

// Service/membership merchants that don't sell physical products
const SERVICE_MERCHANTS = ['kids pass', 'kidspass', 'tastecard', 'meerkat meals', 'topcashback', 'quidco'];

// Clothing keywords to detect clothing intent and boost relevant results
const CLOTHING_KEYWORDS = [
  'clothes', 'clothing', 'fashion', 'apparel', 'wear', 'outfit', 'dress', 'dresses',
  'shirt', 'shirts', 't-shirt', 'tshirt', 'top', 'tops', 'blouse', 'jumper', 'jumpers',
  'trousers', 'pants', 'jeans', 'shorts', 'skirt', 'skirts', 'leggings',
  'jacket', 'jackets', 'coat', 'coats', 'hoodie', 'hoodies', 'cardigan',
  'suit', 'suits', 'blazer', 'uniform', 'school uniform', 'kidswear', 'childrenswear',
  'babywear', 'sleepwear', 'pyjamas', 'swimwear', 'sportswear', 'activewear',
  'underwear', 'socks', 'tights', 'accessories', 'scarf', 'hat', 'gloves'
];

// Footwear keywords - include running as intent since "running shoes" is common
const FOOTWEAR_KEYWORDS = [
  'shoes', 'shoe', 'trainers', 'trainer', 'sneakers', 'boots', 'sandals', 'pumps',
  'loafers', 'heels', 'slippers', 'footwear', 'wellies', 'plimsolls', 'running',
  'walking', 'hiking', 'gym shoes', 'sports shoes', 'athletic', 'kicks'
];

// Footwear merchants to boost for footwear queries
const FOOTWEAR_MERCHANTS = [
  'jd sports', 'footasylum', 'sports direct', 'schuh', 'clarks', 'office',
  'size?', 'foot locker', 'nike', 'adidas', 'puma', 'new balance', 'asics',
  'reebok', 'dune', 'kurt geiger', 'jones bootmaker', 'offspring', 'startrite'
];

interface ScoredDeal {
  deal: any;
  score: number;
}

function rankResult(result: any, queryTerms: string[]): number {
  const title = (result.title || '').toLowerCase();
  const merchant = (result.merchant || result.advertiser?.name || '').toLowerCase();
  const desc = (result.description || '').toLowerCase();
  const categories = (result.categories?.join(' ') || '').toLowerCase();
  const allText = `${title} ${desc} ${categories}`;

  let score = 0;

  // Detect search intent
  const isClothingSearch = queryTerms.some(t => CLOTHING_KEYWORDS.includes(t));
  const isFootwearSearch = queryTerms.some(t => FOOTWEAR_KEYWORDS.includes(t));
  const isBeautySearch = queryTerms.some(t => 
    ['beauty', 'cosmetic', 'makeup', 'skincare', 'perfume', 'fragrance', 'hair', 'salon'].includes(t)
  );

  // 1. Base score for keyword hits (reduced merchant name weight)
  for (const term of queryTerms) {
    if (title.includes(term)) score += 6;
    if (merchant.includes(term)) score += 4; // reduced from 8 - merchant name match less important
    if (desc.includes(term)) score += 3;
    if (categories.includes(term)) score += 4;
  }

  // 2. Boost brand-specific retailers
  for (const [brandKey, retailers] of Object.entries(BRAND_RETAILERS)) {
    if (queryTerms.some(t => t.includes(brandKey) || brandKey.includes(t))) {
      for (const shop of retailers) {
        if (merchant.includes(shop)) {
          score += 15; // strong brand bonus
        }
      }
    }
  }

  // 3. CLOTHING INTENT: Boost results that actually mention clothing
  if (isClothingSearch) {
    const hasClothingInContent = CLOTHING_KEYWORDS.some(kw => allText.includes(kw));
    if (hasClothingInContent) {
      score += 20; // strong boost for actual clothing content
    } else {
      score -= 15; // penalize results that don't mention clothing
    }
  }

  // 4. FOOTWEAR INTENT: Boost results that mention footwear or footwear merchants
  if (isFootwearSearch) {
    const hasFootwearInContent = FOOTWEAR_KEYWORDS.some(kw => allText.includes(kw));
    const isFootwearMerchant = FOOTWEAR_MERCHANTS.some(m => merchant.includes(m));
    
    if (hasFootwearInContent) {
      score += 25; // Strong boost for actual footwear content
    }
    if (isFootwearMerchant) {
      score += 30; // Very strong boost for footwear retailers
    }
    // Penalize results that don't mention footwear or aren't footwear merchants
    if (!hasFootwearInContent && !isFootwearMerchant) {
      score -= 20;
    }
  }

  // 5. Penalize service/membership merchants (they don't sell products)
  for (const service of SERVICE_MERCHANTS) {
    if (merchant.includes(service)) {
      score -= 25; // strong penalty for service merchants
    }
  }

  // 6. Penalize generic beauty merchants for non-beauty searches
  if (!isBeautySearch) {
    for (const generic of GENERIC_BEAUTY_MERCHANTS) {
      if (merchant.includes(generic)) {
        score -= 10;
      }
    }
  }

  // 7. Small bonus for voucher codes (more actionable)
  if (result.voucher?.code || result.code) {
    score += 3;
  }

  return score;
}

function sortResultsByRelevance<T extends { title?: string; merchant?: string; description?: string; advertiser?: { name: string }; categories?: string[]; voucher?: { code: string }; code?: string }>(
  results: T[], 
  queryTerms: string[]
): T[] {
  if (queryTerms.length === 0) return results;
  
  const scored = results.map(item => ({
    item,
    score: rankResult(item, queryTerms)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.map(s => s.item);
}

function parsePrice(priceStr: string | undefined): number {
  if (!priceStr) return 0;
  const match = priceStr.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

// Validate affiliate links - must be proper Awin tracking URLs
function isValidAffiliateLink(url: string | undefined): boolean {
  if (!url) return false;
  // Must be awin1.com tracking URL with cread.php or awclick.php
  return url.includes('awin1.com/cread.php') || 
         url.includes('awin1.com/awclick.php') ||
         url.includes('awin1.com/pclick.php');
}

// Never return these domains - they're not merchant links
function isBlockedDomain(url: string | undefined): boolean {
  if (!url) return true;
  const blocked = ['example.com', 'awin.com/', 'www.awin.com'];
  return blocked.some(domain => url.includes(domain));
}

// Known brand/merchant names that should return promotions, not products
const KNOWN_BRANDS = [
  'hamleys', 'boots', 'nike', 'adidas', 'puma', 'jd sports', 'schuh', 
  'argos', 'currys', 'john lewis', 'marks and spencer', 'm&s', 'next',
  'asos', 'amazon', 'debenhams', 'sports direct', 'superdrug', 'very',
  'ao', 'wayfair', 'dunelm', 'h&m', 'zara', 'primark', 'new look',
  'river island', 'topshop', 'selfridges', 'harrods', 'tesco', 'asda',
  'sainsburys', 'morrisons', 'waitrose', 'aldi', 'lidl', 'iceland',
  'smyths', 'the entertainer', 'entertainer', 'toys r us', 'wilko'
];

// Merchants with broken/blocked promotion links - exclude from results
const BLOCKED_MERCHANTS = [
  'hamleys' // Website blocks Awin redirect URLs with Barracuda security
];

function isBrandQuery(query: string | undefined): boolean {
  if (!query) return false;
  const q = query.toLowerCase().trim();
  return KNOWN_BRANDS.some(brand => 
    q === brand || q.includes(brand) || brand.includes(q)
  );
}

function isBlockedMerchant(merchantName: string): boolean {
  const name = merchantName.toLowerCase();
  return BLOCKED_MERCHANTS.some(blocked => name.includes(blocked));
}

// Known brand/character phrases that should be treated as specific searches
const BRAND_CHARACTER_PHRASES = [
  'paw patrol', 'peppa pig', 'star wars', 'hot wheels', 'barbie', 'frozen', 
  'disney', 'lego', 'marvel', 'dc', 'pokemon', 'minecraft', 'fortnite',
  'sonic', 'mario', 'bluey', 'cocomelon', 'hey duggee', 'thomas', 'bob the builder',
  'orchard toys', 'dr martens', 'clarks', 'nike', 'adidas', 'vans', 'converse',
  'jojo maman', 'fisher price', 'vtech', 'leapfrog', 'playmobil', 'sylvanian'
];

// Detect if query contains a brand or character that should be strictly matched
function detectBrandOrCharacter(query: string): string | null {
  const q = query.toLowerCase();
  for (const phrase of BRAND_CHARACTER_PHRASES) {
    if (q.includes(phrase)) {
      return phrase;
    }
  }
  return null;
}

// Check if a brand/character exists in our product database
async function checkBrandExistsInDB(brand: string): Promise<boolean> {
  try {
    const { db } = await import('../db');
    const { products } = await import('@shared/schema');
    const { or, ilike, sql } = await import('drizzle-orm');
    
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(products)
      .where(or(
        ilike(products.brand, `%${brand}%`),
        ilike(products.name, `%${brand}%`)
      ))
      .limit(1);
    
    const count = Number(result[0]?.count || 0);
    return count > 0;
  } catch (error) {
    console.error(`[checkBrandExistsInDB] Error checking brand "${brand}":`, error);
    return true; // On error, allow search to proceed
  }
}

export async function fetchAwinProducts(query?: string, category?: string, limit: number = 10): Promise<ShoppingDeal[]> {
  const deals: ShoppingDeal[] = [];
  const searchTerms = query ? expandSearchTerms(query) : [];
  const categoryTerms = category ? expandSearchTerms(category) : [];
  
  // Detect if this is a brand/merchant query vs. a product search
  const brandSearch = isBrandQuery(query);
  
  if (brandSearch) {
    console.log(`BRAND QUERY detected: "${query}" - searching promotions/deals`);
  } else {
    console.log(`PRODUCT QUERY detected: "${query}" - searching product datafeed`);
  }

  // NO GARBAGE RESULTS: Check if brand/character exists in database before searching
  // This prevents returning random products when the brand doesn't exist
  if (query && !brandSearch) {
    const detectedBrand = detectBrandOrCharacter(query);
    if (detectedBrand) {
      const brandExists = await checkBrandExistsInDB(detectedBrand);
      if (!brandExists) {
        console.log(`[fetchAwinProducts] INVENTORY GAP: "${detectedBrand}" not in catalog - returning empty`);
        return []; // Return empty instead of garbage
      }
    }
  }

  try {
    // BRAND QUERIES: Go straight to promotions (store deals, vouchers, offers)
    if (brandSearch) {
      const promotions = await fetchPromotions();
      console.log(`Searching ${promotions.length} promotions for brand: "${query}"`);
      
      // Filter promotions for this specific brand/merchant
      const brandPromos = promotions.filter(p => {
        const merchantName = p.advertiser?.name || '';
        const promoText = `${p.title} ${p.description} ${merchantName}`.toLowerCase();
        const queryLower = (query || '').toLowerCase();
        
        // Check if promo matches brand AND is not from a blocked merchant
        const matchesBrand = promoText.includes(queryLower) || merchantName.toLowerCase().includes(queryLower);
        const isBlocked = isBlockedMerchant(merchantName);
        
        if (isBlocked) {
          console.log(`BLOCKED merchant: ${merchantName} (known broken links)`);
        }
        
        return matchesBrand && !isBlocked;
      });
      
      console.log(`Found ${brandPromos.length} promotions for brand "${query}"`);
      
      for (const promo of brandPromos.slice(0, limit)) {
        deals.push({
          id: `awin-promo-${promo.promotionId}`,
          title: promo.title,
          description: promo.description || "Special offer",
          merchant: promo.advertiser?.name || "Retailer",
          originalPrice: 0,
          salePrice: 0,
          discount: promo.voucher?.code ? `Code: ${promo.voucher.code}` : "Special offer",
          category: promo.type === 'voucher' ? 'Voucher' : 'Promotion',
          affiliateLink: promo.urlTracking || promo.url,
          validUntil: promo.endDate?.split('T')[0],
          code: promo.voucher?.code
        });
      }
      
      // For brand queries, filter valid deals first
      const validDeals = deals.filter(deal => {
        if (isBlockedDomain(deal.affiliateLink)) return false;
        if (!isValidAffiliateLink(deal.affiliateLink)) return false;
        return true;
      });
      
      // If we found promotions, return them
      if (validDeals.length > 0) {
        console.log(`Returning ${validDeals.length} brand promotions for "${query}"`);
        return validDeals;
      }
      
      // FALLBACK: No promotions found for brand - search product database instead
      console.log(`No promotions found for brand "${query}" - falling back to product database search`);
      try {
        const { products } = await storage.searchProducts(query || '', limit);
        console.log(`PostgreSQL returned ${products.length} products for brand "${query}"`);
        
        for (const product of products) {
          deals.push({
            id: `awin-product-${product.id}`,
            title: product.name,
            description: product.description || `${product.brand} product from ${product.merchant}`,
            merchant: product.merchant,
            originalPrice: product.price,
            salePrice: product.price,
            discount: "Available now",
            category: product.category || undefined,
            affiliateLink: product.affiliateLink,
            imageUrl: product.imageUrl
          });
        }
        
        console.log(`Returning ${deals.length} products from PostgreSQL for brand "${query}"`);
        return deals;
      } catch (error) {
        console.error('PostgreSQL brand search error:', error);
        return [];
      }
    }
    
    // PRODUCT QUERIES: Search PostgreSQL database (1.1M+ products)
    const searchQuery = [query, category].filter(Boolean).join(' ');
    if (searchQuery) {
      console.log(`Searching PostgreSQL database for: "${searchQuery}"...`);
      
      try {
        const { products } = await storage.searchProducts(searchQuery, limit);
        console.log(`PostgreSQL returned ${products.length} products for "${searchQuery}"`);
        
        for (const product of products) {
          deals.push({
            id: `awin-product-${product.id}`,
            title: product.name,
            description: product.description || `${product.brand} product from ${product.merchant}`,
            merchant: product.merchant,
            originalPrice: product.price,
            salePrice: product.price,
            discount: "Available now",
            category: product.category || undefined,
            affiliateLink: product.affiliateLink,
            imageUrl: product.imageUrl
          });
        }
        
        // Return products from database
        console.log(`Returning ${deals.length} products from PostgreSQL`);
        return deals;
      } catch (error) {
        console.error('PostgreSQL search error:', error);
        // Fall through to promotion fallback
      }
    }

    // FALLBACK: Only if no product datafeed loaded, try promotions
    if (deals.length < limit) {
      const promotions = await fetchPromotions();
      console.log(`Searching ${promotions.length} promotions...`);

      let filteredPromos: AwinPromotion[] = [];
      const fullQuery = [query, category].filter(Boolean).join(' ');
      const allQueryTerms = [...searchTerms, ...categoryTerms];
      
      // TRY SEMANTIC SEARCH FIRST (if embeddings ready)
      if (isEmbeddingsReady() && fullQuery) {
        console.log(`Using SEMANTIC search for: "${fullQuery}" (${getEmbeddingCount()} embeddings ready)`);
        
        try {
          // Get semantically similar promotions
          const semanticResults = await semanticSearch(fullQuery, promotions, 200);
          console.log(`Semantic search found ${semanticResults.length} similar promotions`);
          
          // Filter by similarity threshold and apply hybrid scoring
          const scoredResults = semanticResults
            .filter(r => r.similarity > 0.25) // Minimum similarity threshold
            .map(r => ({
              promo: r.promotion as AwinPromotion,
              // Hybrid score: semantic similarity * 100 + lexical score
              hybridScore: (r.similarity * 100) + rankResult(r.promotion, allQueryTerms)
            }))
            .sort((a, b) => b.hybridScore - a.hybridScore);
          
          filteredPromos = scoredResults.map(r => r.promo);
          console.log(`Hybrid ranking: ${filteredPromos.length} promotions after semantic + lexical scoring`);
          
        } catch (err) {
          console.error('Semantic search failed, falling back to keyword search:', err);
          filteredPromos = [];
        }
      }
      
      // FALLBACK TO KEYWORD SEARCH (if semantic not ready or failed)
      if (filteredPromos.length === 0) {
        console.log(`Using KEYWORD search (embeddings ready: ${isEmbeddingsReady()})`);
        console.log(`Expanded search terms: ${searchTerms.slice(0, 10).join(', ')}${searchTerms.length > 10 ? '...' : ''}`);
        
        filteredPromos = promotions;
        
        if (searchTerms.length > 0) {
          filteredPromos = promotions.filter(p => {
            const text = `${p.title || ''} ${p.description || ''} ${p.advertiser?.name || ''} ${p.categories?.join(' ') || ''} ${p.type || ''}`.toLowerCase();
            return searchTerms.some(term => text.includes(term));
          });
          console.log(`After search filter: ${filteredPromos.length} promotions match`);
        }

        if (categoryTerms.length > 0) {
          filteredPromos = filteredPromos.filter(p => {
            const text = `${p.title || ''} ${p.description || ''} ${p.advertiser?.name || ''} ${p.categories?.join(' ') || ''} ${p.type || ''}`.toLowerCase();
            return categoryTerms.some(term => text.includes(term));
          });
          console.log(`After category filter: ${filteredPromos.length} promotions match`);
        }

        // RANK results by relevance
        filteredPromos = sortResultsByRelevance(filteredPromos, allQueryTerms);
        console.log(`Ranked ${filteredPromos.length} promotions by relevance`);
      }

      const remainingSlots = limit - deals.length;
      for (const promo of filteredPromos.slice(0, remainingSlots)) {
        deals.push({
          id: `awin-promo-${promo.promotionId}`,
          title: promo.title,
          description: promo.description || "Special offer",
          merchant: promo.advertiser?.name || "Retailer",
          originalPrice: 0,
          salePrice: 0,
          discount: promo.voucher?.code ? `Code: ${promo.voucher.code}` : "Special offer",
          category: promo.type === 'voucher' ? 'Voucher' : 'Promotion',
          affiliateLink: promo.urlTracking || promo.url,
          validUntil: promo.endDate?.split('T')[0],
          code: promo.voucher?.code
        });
      }
    }

    // Final validation - only return deals with valid Awin tracking links
    const validDeals = deals.filter(deal => {
      if (isBlockedDomain(deal.affiliateLink)) {
        console.log(`BLOCKED: Invalid domain in link for "${deal.title}"`);
        return false;
      }
      if (!isValidAffiliateLink(deal.affiliateLink)) {
        console.log(`BLOCKED: Invalid tracking URL for "${deal.title}": ${deal.affiliateLink}`);
        return false;
      }
      return true;
    });

    console.log(`Returning ${validDeals.length} valid deals from Awin (filtered from ${deals.length})`);
    return validDeals;

  } catch (error) {
    console.error("Error fetching Awin products:", error);
    return [];
  }
}

export function isAwinConfigured(): boolean {
  return !!(AWIN_API_KEY && AWIN_PUBLISHER_ID);
}

export async function getAvailableFeeds(): Promise<any[]> {
  const programs = await getJoinedPrograms();
  return programs.map(p => ({ id: p.id, name: p.name, sector: p.primarySector }));
}
