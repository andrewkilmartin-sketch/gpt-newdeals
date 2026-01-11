/**
 * Promotion Matching for Search Results
 * 
 * Contains logic for matching promotions to products in search results.
 * This includes merchant-based, brand-based, and category-based matching.
 * 
 * See CRITICAL_FIXES.md - Fix #58-60
 */

export interface ProductPromotion {
  title: string;
  expiresAt?: string;
  type?: string;
  couponCode?: string;
}

const CATEGORY_KEYWORDS: { [key: string]: string[] } = {
  school: ['school', 'student', 'uniform', 'classroom', 'education', 'back to school'],
  shoes: ['shoe', 'shoes', 'footwear', 'boots', 'trainers', 'sneakers', 'sandals'],
  clothing: ['clothing', 'clothes', 'apparel', 'fashion', 'wear', 'outfit'],
  toys: ['toy', 'toys', 'game', 'games', 'play', 'lego', 'doll', 'dolls'],
  books: ['book', 'books', 'reading', 'story', 'stories', 'literature'],
  baby: ['baby', 'babies', 'infant', 'toddler', 'newborn', 'nursery'],
  outdoor: ['outdoor', 'garden', 'camping', 'hiking', 'sports', 'adventure'],
  sports: ['sport', 'sports', 'fitness', 'gym', 'exercise', 'training'],
  electronics: ['electronic', 'electronics', 'tech', 'technology', 'gadget', 'device'],
  home: ['home', 'house', 'furniture', 'decor', 'kitchen', 'bedroom']
};

/**
 * Check if a promotion is relevant to the search query and product
 */
export function isPromotionRelevant(
  promoTitle: string, 
  searchQuery: string, 
  productCategory: string
): boolean {
  const title = promoTitle.toLowerCase();
  const query = searchQuery.toLowerCase();
  const category = productCategory.toLowerCase();
  
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const queryMatchesCategory = keywords.some(kw => query.includes(kw));
    const promoMatchesCategory = keywords.some(kw => title.includes(kw));
    
    if (queryMatchesCategory && promoMatchesCategory) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get category keywords that match a search query
 */
export function getCategoryKeywordsForQuery(query: string): string[] {
  const q = query.toLowerCase();
  const matchedCategories: string[] = [];
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) {
      matchedCategories.push(category);
    }
  }
  
  return matchedCategories;
}

/**
 * Find the best promotion for a product based on merchant, brand, or category
 */
export function findBestPromotion(
  product: any,
  merchantPromotions: Map<string, ProductPromotion[]>,
  brandPromotions: Map<string, ProductPromotion[]>,
  categoryPromotions: Map<string, ProductPromotion[]>,
  searchQuery: string
): ProductPromotion | null {
  const merchantKey = (product.merchant || '').toLowerCase().trim();
  const brandKey = (product.brand || '').toLowerCase().trim();
  const productName = (product.name || '').toLowerCase();
  const productCategory = (product.category || '').toLowerCase();
  
  if (merchantPromotions.has(merchantKey)) {
    const promos = merchantPromotions.get(merchantKey);
    if (promos && promos.length > 0) {
      return promos[0];
    }
  }
  
  if (brandPromotions.has(brandKey)) {
    const promos = brandPromotions.get(brandKey);
    if (promos && promos.length > 0) {
      return promos[0];
    }
  }
  
  for (const [brand, promos] of brandPromotions) {
    if (productName.includes(brand) && promos.length > 0) {
      return promos[0];
    }
  }
  
  const queryCategories = getCategoryKeywordsForQuery(searchQuery);
  for (const cat of queryCategories) {
    if (categoryPromotions.has(cat)) {
      const promos = categoryPromotions.get(cat);
      if (promos && promos.length > 0) {
        return promos[0];
      }
    }
  }
  
  return null;
}

/**
 * Attach promotions to search results
 */
export async function attachPromotionsToResults(
  results: any[],
  searchQuery: string,
  getMerchantPromotions: () => Promise<Map<string, ProductPromotion[]>>,
  getBrandPromotions: () => Promise<Map<string, ProductPromotion[]>>,
  getCategoryPromotions: () => Promise<Map<string, ProductPromotion[]>>
): Promise<any[]> {
  try {
    const [merchantPromos, brandPromos, categoryPromos] = await Promise.all([
      getMerchantPromotions(),
      getBrandPromotions(),
      getCategoryPromotions()
    ]);
    
    return results.map(product => {
      const promo = findBestPromotion(
        product,
        merchantPromos,
        brandPromos,
        categoryPromos,
        searchQuery
      );
      
      return {
        ...product,
        promotion: promo ? {
          title: promo.title,
          expiresAt: promo.expiresAt,
          type: promo.type || 'promotion',
          couponCode: promo.couponCode
        } : null
      };
    });
  } catch (error) {
    console.error('[Promotions] Error attaching promotions:', error);
    return results;
  }
}
