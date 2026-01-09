import { 
  type User, 
  type InsertUser, 
  type ShoppingDeal,
  type CinemaListing,
  type Attraction,
  type AttractionFree,
  type NightInIdea,
  type HintAndTip,
  type SearchQuery,
  type CinemaMovie,
  type NightinMovie,
  type Activity,
  type Product,
  type ChatLog,
  type InsertChatLog,
  type Recommendation,
  type Event,
  type Restaurant,
  type GroupedProduct,
  type ProductVariant,
  type SearchIntent,
  attractions as attractionsTable,
  attractionsFree as attractionsFreeTable,
  cinemaMovies as cinemaMoviesTable,
  nightinMovies as nightinMoviesTable,
  activities as activitiesTable,
  products as productsTable,
  users as usersTable,
  chatLogs as chatLogsTable,
  recommendations as recommendationsTable,
  events as eventsTable,
  restaurants as restaurantsTable
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, sql, and, desc, lte } from "drizzle-orm";
import { randomUUID } from "crypto";
import { assertDatabaseResult, logDataSourceFailure } from "./boot/dataIntegrity";
import OpenAI from "openai";
import { extractIntent, calculateRelevanceScore } from "./services/taxonomy";

// Lazy-initialize OpenAI client only when needed and API key exists
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Get embedding for a query (used for semantic search)
async function getQueryEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  if (!client) return [];
  
  try {
    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("[Semantic Search] Failed to get embedding:", error);
    return [];
  }
}

// Extract size/variant info from product name - IMPROVED for UK shoe sizes
function extractSizeFromName(name: string): { baseName: string; size: string } {
  const sizePatterns = [
    // UK shoe sizes: "UK 12", "Size 12", "(12 Younger)", "(3 Older)"
    /\s*-?\s*\(?\s*(?:UK\s*)?(\d{1,2}(?:\.\d)?)\s*(?:Younger|Older|Infant|Junior|Toddler)?\s*\)?\s*$/i,
    // Age ranges in clothing: "13 Small - 7 Large", "0-3 Months"
    /\s*\(?\s*(\d+\s*(?:Small|Large)?\s*-\s*\d+\s*(?:Small|Large|Months?|Years?)?)\s*\)?\s*$/i,
    // Standard sizes with units
    /\s*-\s*((?:Size\s*)?\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?(?:\s*(?:cm|mm|inch|Years?|Months?|Pack|Large|Small|Medium|XS|S|M|L|XL|XXL|XXXL))?)\s*$/i,
    /\s*\((?:Size\s*)?(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?(?:\s*(?:cm|mm|inch|Years?|Months?|UK|EU|US))?)\)\s*$/i,
    // Letter sizes
    /\s*-\s*(XS|S|M|L|XL|XXL|XXXL|One Size|Small|Medium|Large|Extra Large)\s*$/i,
    /\s*,\s*((?:Size\s*)?\d+(?:\.\d+)?)\s*$/i,
    /\s+(\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)?(?:mm|cm|inch)?)\s*$/i,
  ];
  
  for (const pattern of sizePatterns) {
    const match = name.match(pattern);
    if (match) {
      const baseName = name.slice(0, match.index).trim();
      const size = match[1].trim();
      if (baseName.length > 10) {
        return { baseName, size };
      }
    }
  }
  
  return { baseName: name, size: '' };
}

// Categories that should be grouped by size (clothing, footwear)
const GROUPABLE_CATEGORIES = [
  'clothing', 'clothes', 'footwear', 'shoes', 'trainers', 'boots',
  'baby clothes', "children's footwear", "women's clothing", "men's clothing",
  'sportswear', 'underwear', 'nightwear', 'outerwear', 'accessories'
];

// Check if a category should have size grouping
function isGroupableCategory(category: string): boolean {
  const catLower = (category || '').toLowerCase();
  return GROUPABLE_CATEGORIES.some(gc => catLower.includes(gc));
}

// Group products by image URL to consolidate size variants
// ONLY groups clothing/footwear categories - toys, LEGO, electronics remain separate
function groupProductsByImage(products: Product[], maxPrice?: number): GroupedProduct[] {
  const groups: Record<string, Product[]> = {};
  
  for (const product of products) {
    // CRITICAL: Only group clothing/footwear by image
    // Toys, LEGO, electronics should NOT be grouped (same image = different products)
    if (isGroupableCategory(product.category || '')) {
      // Use imageUrl + merchant + brand as key to prevent cross-retailer merging
      const key = `${product.imageUrl || product.id}|${product.merchant}|${product.brand}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(product);
    } else {
      // Non-groupable categories: each product stays separate
      const uniqueKey = `unique_${product.id}`;
      groups[uniqueKey] = [product];
    }
  }
  
  const grouped: GroupedProduct[] = [];
  
  for (const key of Object.keys(groups)) {
    let items = groups[key];
    if (items.length === 0) continue;
    
    // Filter variants by maxPrice if specified (fix price filter leaking)
    if (maxPrice && maxPrice > 0) {
      items = items.filter(p => p.price <= maxPrice);
      if (items.length === 0) continue;
    }
    
    const first = items[0];
    const prices = items.map((p: Product) => p.price);
    const minPriceVal = Math.min(...prices);
    const maxPriceVal = Math.max(...prices);
    
    const variants: ProductVariant[] = items.map((p: Product) => {
      const { size } = extractSizeFromName(p.name);
      return {
        id: p.id,
        size: size || `£${p.price.toFixed(0)}`,
        price: p.price,
        affiliateLink: p.affiliateLink,
        inStock: p.inStock
      };
    }).sort((a: ProductVariant, b: ProductVariant) => a.price - b.price);
    
    const { baseName } = extractSizeFromName(first.name);
    
    // Show variant selector only for clothing/footwear with multiple sizes
    const shouldShowVariants = items.length > 1 && isGroupableCategory(first.category || '');
    
    grouped.push({
      id: first.id,
      name: shouldShowVariants ? baseName : first.name,
      description: first.description,
      merchant: first.merchant,
      category: first.category,
      brand: first.brand,
      imageUrl: first.imageUrl,
      minPrice: minPriceVal,
      maxPrice: maxPriceVal,
      variants,
      hasMultipleSizes: shouldShowVariants
    });
  }
  
  return grouped;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getShoppingDeals(query: SearchQuery): Promise<ShoppingDeal[]>;
  getCinemaListings(query: SearchQuery): Promise<CinemaListing[]>;
  getAttractions(query: SearchQuery): Promise<Attraction[]>;
  getNightInIdeas(query: SearchQuery): Promise<NightInIdea[]>;
  getHintsAndTips(query: SearchQuery): Promise<HintAndTip[]>;
  
  searchAttractions(query: string, location?: string, limit?: number): Promise<Attraction[]>;
  searchFreeAttractions(query: string, location?: string, category?: string, limit?: number): Promise<AttractionFree[]>;
  searchCinemaMovies(query?: string, familyOnly?: boolean, limit?: number): Promise<CinemaMovie[]>;
  searchNightinMovies(query?: string, service?: string, mood?: string, familyOnly?: boolean, limit?: number): Promise<NightinMovie[]>;
  searchActivities(query?: string, age?: string, limit?: number): Promise<Activity[]>;
  searchProducts(query: string, limit?: number, offset?: number, maxPrice?: number): Promise<{ products: Product[], totalCount: number }>;
  searchProductsGrouped(query: string, limit?: number, offset?: number, maxPrice?: number): Promise<{ products: GroupedProduct[], totalCount: number }>;
  
  saveChatLog(log: InsertChatLog): Promise<ChatLog>;
  getChatLogs(sessionId?: string, limit?: number): Promise<ChatLog[]>;
  
  searchRecommendations(query?: string, category?: string, limit?: number): Promise<Recommendation[]>;
  searchEvents(query?: string, city?: string, category?: string, limit?: number, family?: boolean): Promise<Event[]>;
  searchRestaurants(query?: string, city?: string, chain?: string, limit?: number): Promise<Restaurant[]>;
}

export class DatabaseStorage implements IStorage {
  private attractionSynonyms: Record<string, string[]> = {
    'safari': ['safari', 'safari park', 'wildlife', 'zoo', 'animal', 'nature', 'drive-through'],
    'theme park': ['theme park', 'amusement', 'rides', 'roller coaster', 'entertainment'],
    'zoo': ['zoo', 'wildlife', 'animal', 'safari', 'aquarium'],
    'museum': ['museum', 'gallery', 'exhibition', 'historical', 'heritage'],
    'castle': ['castle', 'historical', 'heritage', 'palace', 'manor'],
    'beach': ['beach', 'seaside', 'coast', 'pier'],
    'park': ['park', 'garden', 'nature', 'outdoor'],
    'aquarium': ['aquarium', 'sealife', 'marine', 'ocean', 'sea life'],
    'soft play': ['soft play', 'indoor play', 'play centre', 'play area', 'ball pit'],
    'trampoline': ['trampoline', 'trampoline park', 'bounce', 'jump', 'indoor play'],
    'restaurant': ['restaurant', 'pizza', 'dining', 'eat', 'food', 'cafe'],
    'farm': ['farm', 'farm park', 'animal', 'petting zoo', 'tractor'],
    'go ape': ['go ape', 'treetop', 'zip line', 'high ropes', 'adventure'],
    'zip world': ['zip world', 'zip line', 'zipline', 'adventure', 'caverns'],
    'adventure': ['adventure', 'outdoor', 'climbing', 'zip line', 'treetop']
  };

  private expandAttractionTerms(query: string): string[] {
    const terms = [query.toLowerCase()];
    const queryLower = query.toLowerCase();
    
    for (const [key, synonyms] of Object.entries(this.attractionSynonyms)) {
      if (queryLower.includes(key) || key.includes(queryLower)) {
        terms.push(...synonyms);
      }
    }
    
    return Array.from(new Set(terms));
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const result = await db.insert(usersTable).values({ ...insertUser, id }).returning();
    return result[0];
  }

  async getShoppingDeals(query: SearchQuery): Promise<ShoppingDeal[]> {
    return [];
  }

  async getCinemaListings(query: SearchQuery): Promise<CinemaListing[]> {
    const movies = await this.searchCinemaMovies(query.query, true, query.limit);
    return movies.map(movie => ({
      id: movie.id,
      movieTitle: movie.title,
      genre: movie.genres.join(', '),
      rating: movie.bbfcRating,
      duration: `${movie.runtime} min`,
      synopsis: movie.synopsis,
      showtimes: ['Check local cinema'],
      cinema: 'Various UK Cinemas',
      location: query.location || 'UK',
      ticketPrice: 12.99,
      dealInfo: 'Check Kids Pass for discounts',
      bookingLink: movie.trailerUrl || undefined
    }));
  }

  async getAttractions(query: SearchQuery): Promise<Attraction[]> {
    return this.searchAttractions(query.query || '', query.location, query.limit);
  }

  async getNightInIdeas(query: SearchQuery): Promise<NightInIdea[]> {
    const movies = await this.searchNightinMovies(query.query, undefined, undefined, true, query.limit);
    return movies.map(movie => ({
      id: movie.id,
      title: movie.title,
      description: movie.synopsis,
      category: movie.genres[0] || 'Movie',
      difficulty: 'Easy',
      duration: `${movie.runtime} min`,
      streamingPlatform: movie.streamingServices.join(', '),
      activityType: 'Watching',
      mood: movie.mood[0] || 'Relaxing',
      tips: [`Available on ${movie.streamingServices.join(', ')}`, `IMDB: ${movie.imdbScore}/10`]
    }));
  }

  async getHintsAndTips(query: SearchQuery): Promise<HintAndTip[]> {
    const activities = await this.searchActivities(query.query, undefined, query.limit);
    return activities.map(activity => ({
      id: activity.id,
      title: activity.title,
      content: activity.summary,
      category: activity.tags[0] || 'Family',
      tags: activity.tags,
      difficulty: activity.supervisionLevel,
      savingsEstimate: 'Free activity'
    }));
  }

  async searchAttractions(query: string, location?: string, limit: number = 10): Promise<Attraction[]> {
    let results = await db.select().from(attractionsTable);
    assertDatabaseResult('searchAttractions', results);
    
    if (query) {
      const searchTerms = this.expandAttractionTerms(query);
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      
      const scored = results.map(attraction => {
        const nameLower = attraction.name.toLowerCase();
        const searchableText = `${attraction.name} ${attraction.description} ${attraction.category}`.toLowerCase();
        const categoryLower = attraction.category.toLowerCase();
        let score = 0;
        
        if (nameLower.includes(queryLower)) score += 100;
        if (queryWords.some(word => nameLower.includes(word))) score += 90;
        if (categoryLower.includes(queryLower)) score += 80;
        if (attraction.description.toLowerCase().includes(queryLower)) score += 50;
        if (searchTerms.some(term => categoryLower.includes(term) || term.includes(categoryLower))) score += 70;
        if (searchTerms.some(term => searchableText.includes(term))) score += 10;
        
        return { attraction, score };
      });
      
      results = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(s => s.attraction);
    }
    
    if (location) {
      results = results.filter(a => a.location.toLowerCase().includes(location.toLowerCase()));
    }
    
    // PRICE COMPARISON: Find duplicates and recommend cheaper option
    results = this.deduplicateWithPriceComparison(results);
    
    return results.slice(0, limit);
  }
  
  // Compare prices between daysout (affiliate) and direct sources
  // Returns the cheaper option, adding a note about savings
  private deduplicateWithPriceComparison(attractions: Attraction[]): Attraction[] {
    const nameGroups: Map<string, Attraction[]> = new Map();
    
    // Normalize names and group by similar names
    for (const a of attractions) {
      const normalizedName = this.normalizeAttractionName(a.name);
      const existing = nameGroups.get(normalizedName) || [];
      existing.push(a);
      nameGroups.set(normalizedName, existing);
    }
    
    const deduplicated: Attraction[] = [];
    
    Array.from(nameGroups.entries()).forEach(([name, group]) => {
      if (group.length === 1) {
        deduplicated.push(group[0]);
        return;
      }
      
      // Multiple entries for same attraction - compare prices
      const daysoutEntry = group.find((a: Attraction) => a.source === 'daysout');
      const directEntry = group.find((a: Attraction) => a.source === 'direct');
      
      if (daysoutEntry && directEntry) {
        // Get verified prices from scraped data
        const daysoutPrice = daysoutEntry.ticketPrice ?? daysoutEntry.priceAdult ?? null;
        const directPrice = directEntry.ticketPrice ?? directEntry.priceAdult ?? null;
        
        // Both have verified prices - compare and show cheaper option
        if (daysoutPrice !== null && directPrice !== null) {
          if (daysoutPrice < directPrice) {
            // Affiliate is cheaper - use it with savings note
            const savings = directPrice - daysoutPrice;
            const enhanced = { ...daysoutEntry };
            enhanced.description = `${daysoutEntry.description} | SAVE £${savings.toFixed(0)}: Book via daysout.co.uk for £${daysoutPrice} vs £${directPrice} direct`;
            deduplicated.push(enhanced);
          } else if (directPrice < daysoutPrice) {
            // Direct is cheaper
            const savings = daysoutPrice - directPrice;
            const enhanced = { ...directEntry };
            enhanced.description = `${directEntry.description} | SAVE £${savings.toFixed(0)}: Book direct for £${directPrice} vs £${daysoutPrice} affiliate`;
            deduplicated.push(enhanced);
          } else {
            // Same price - prefer affiliate for tracking
            deduplicated.push(daysoutEntry);
          }
        } else if (daysoutPrice !== null) {
          // Only affiliate has price
          deduplicated.push(daysoutEntry);
        } else if (directPrice !== null) {
          // Only direct has price
          deduplicated.push(directEntry);
        } else {
          // Neither has price - prefer direct
          deduplicated.push(directEntry);
        }
      } else {
        // No comparison possible - take first (highest scored)
        deduplicated.push(group[0]);
      }
    });
    
    return deduplicated;
  }
  
  // Normalize attraction names for comparison
  private normalizeAttractionName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s*-\s*kids pass/i, '')
      .replace(/\s*(resort|theme park|waterpark|zoo|safari|park)$/i, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async searchFreeAttractions(query: string, location?: string, category?: string, limit: number = 10): Promise<AttractionFree[]> {
    let results = await db.select().from(attractionsFreeTable);
    console.log(`[DB AUDIT] searchFreeAttractions: Retrieved ${results.length} rows from PostgreSQL`);
    
    if (query) {
      const searchTerms = this.expandAttractionTerms(query);
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      
      const scored = results.map(attraction => {
        const nameLower = attraction.name.toLowerCase();
        const searchableText = `${attraction.name} ${attraction.description} ${attraction.category}`.toLowerCase();
        const categoryLower = attraction.category.toLowerCase();
        let score = 0;
        
        if (nameLower.includes(queryLower)) score += 100;
        if (queryWords.some(word => nameLower.includes(word))) score += 90;
        if (categoryLower.includes(queryLower)) score += 80;
        if (attraction.description.toLowerCase().includes(queryLower)) score += 50;
        if (searchTerms.some(term => categoryLower.includes(term) || term.includes(categoryLower))) score += 70;
        if (searchTerms.some(term => searchableText.includes(term))) score += 10;
        
        return { attraction, score };
      });
      
      results = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(s => s.attraction);
    }
    
    if (location) {
      results = results.filter(a => a.location.toLowerCase().includes(location.toLowerCase()));
    }
    
    if (category) {
      results = results.filter(a => a.category.toLowerCase().includes(category.toLowerCase()));
    }
    
    return results.slice(0, limit);
  }

  async searchCinemaMovies(query?: string, familyOnly: boolean = false, limit: number = 10): Promise<CinemaMovie[]> {
    let results = await db.select().from(cinemaMoviesTable);
    assertDatabaseResult('searchCinemaMovies', results);
    
    if (familyOnly) {
      results = results.filter(m => ['U', 'PG', '12', '12A'].includes(m.bbfcRating));
    }
    
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(movie => 
        movie.title.toLowerCase().includes(queryLower) ||
        movie.synopsis.toLowerCase().includes(queryLower) ||
        movie.genres.some(g => g.toLowerCase().includes(queryLower)) ||
        movie.director.toLowerCase().includes(queryLower) ||
        movie.cast.some(c => c.toLowerCase().includes(queryLower))
      );
    }
    
    return results.slice(0, limit);
  }

  async searchNightinMovies(query?: string, service?: string, mood?: string, familyOnly: boolean = false, limit: number = 10): Promise<NightinMovie[]> {
    let results = await db.select().from(nightinMoviesTable);
    assertDatabaseResult('searchNightinMovies', results);
    
    if (familyOnly) {
      results = results.filter(m => m.familyFriendly);
    }
    
    if (service) {
      const serviceLower = service.toLowerCase();
      results = results.filter(m => 
        m.streamingServices.some(s => s.toLowerCase().includes(serviceLower))
      );
    }
    
    if (mood) {
      const moodLower = mood.toLowerCase();
      results = results.filter(m => 
        m.mood.some(mo => mo.toLowerCase().includes(moodLower))
      );
    }
    
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(movie => 
        movie.title.toLowerCase().includes(queryLower) ||
        movie.synopsis.toLowerCase().includes(queryLower) ||
        movie.genres.some(g => g.toLowerCase().includes(queryLower)) ||
        movie.director.toLowerCase().includes(queryLower)
      );
    }
    
    return results.slice(0, limit);
  }

  async searchActivities(query?: string, age?: string, limit: number = 10): Promise<Activity[]> {
    let results = await db.select().from(activitiesTable);
    assertDatabaseResult('searchActivities', results);
    
    if (age) {
      const ageNum = parseInt(age);
      if (!isNaN(ageNum)) {
        results = results.filter(a => 
          a.ageBands.some(band => {
            if (band === "A0_2" && ageNum <= 2) return true;
            if (band === "A3_5" && ageNum >= 3 && ageNum <= 5) return true;
            if (band === "A6_8" && ageNum >= 6 && ageNum <= 8) return true;
            if (band === "A9_12" && ageNum >= 9 && ageNum <= 12) return true;
            if (band === "A13_16" && ageNum >= 13 && ageNum <= 16) return true;
            return false;
          })
        );
      }
    }
    
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(activity => 
        activity.title.toLowerCase().includes(queryLower) ||
        activity.summary.toLowerCase().includes(queryLower) ||
        activity.tags.some(t => t.toLowerCase().includes(queryLower))
      );
    }
    
    return results.slice(0, limit);
  }

  async searchProducts(query: string, limit: number = 10, offset: number = 0, maxPrice?: number): Promise<{ products: Product[], totalCount: number }> {
    console.log(`[DB AUDIT] searchProducts: query="${query}", limit=${limit}, offset=${offset}, maxPrice=${maxPrice}`);
    
    // UK to US query expansion for better matching
    const QUERY_EXPANSIONS: Record<string, string[]> = {
      'trainers': ['sneakers', 'athletic shoes', 'running shoes'],
      'wellies': ['wellington boots', 'rain boots'],
      'nappies': ['diapers'],
      'pushchair': ['stroller', 'pram'],
      'pram': ['stroller', 'pushchair'],
      'jumper': ['sweater', 'pullover'],
      'trousers': ['pants'],
      'dummy': ['pacifier'],
      'cot': ['crib'],
      'nappy': ['diaper'],
      'buggy': ['stroller'],
      'toy car': ['remote control car', 'rc car', 'diecast car'],
      'rc car': ['remote control car', 'toy car'],
      'remote control': ['rc', 'radio controlled'],
    };
    
    // Expand query with synonyms
    let expandedQuery = query.toLowerCase();
    const expansionTokens: string[] = [];
    for (const [term, expansions] of Object.entries(QUERY_EXPANSIONS)) {
      if (expandedQuery.includes(term)) {
        expansionTokens.push(...expansions);
      }
    }
    
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const allTokens = [...tokens, ...expansionTokens.flatMap(e => e.split(/\s+/))];
    const queryLower = query.toLowerCase();
    
    // CRITICAL: Brand detection for strict filtering
    const knownBrands = [
      'nike', 'adidas', 'puma', 'reebok', 'new balance', 'vans', 'converse', 'skechers',
      'clarks', 'start rite', 'geox', 'lelli kelly', 'kickers', 'dr martens',
      'timberland', 'ugg', 'hunter', 'joules', 'north face', 'columbia', 
      'crocs', 'birkenstock', 'havaianas', 'lego', 'playmobil', 'barbie', 
      'hot wheels', 'matchbox', 'brio', 'sylvanian', 'vtech', 'leapfrog',
      'micro scooter', 'fisher price', 'little tikes'
    ];
    const knownCharacters = [
      'paw patrol', 'peppa pig', 'bluey', 'hey duggee', 'cocomelon', 'baby shark',
      'frozen', 'disney', 'spiderman', 'spider-man', 'batman', 'pokemon', 'minecraft',
      'fortnite', 'roblox', 'mario', 'sonic', 'harry potter', 'star wars', 'marvel',
      'thomas', 'paddington', 'peter rabbit', 'gruffalo', 'hungry caterpillar',
      'postman pat', 'fireman sam', 'pj masks', 'ben holly', 'teletubbies',
      'numberblocks', 'octonauts', 'gabby', 'encanto', 'moana'
    ];
    
    // Detect if query contains a brand or character - these MUST match in results
    const detectedBrand = knownBrands.find(b => queryLower.includes(b));
    const detectedCharacter = knownCharacters.find(c => queryLower.includes(c));
    const mustMatchTerm = detectedBrand || detectedCharacter;
    
    if (mustMatchTerm) {
      console.log(`[Storage] BRAND/CHARACTER DETECTED: "${mustMatchTerm}" - will post-filter results`);
    }
    
    // PERFORMANCE FIX: mustMatch is now applied as post-filtering, not SQL WHERE
    // SQL LIKE queries on 1.1M rows cause 18+ second sequential scans
    // Post-filtering is much faster when combined with indexed searches
    const mustMatchSqlFilter = null; // Disabled for performance - use post-filtering instead
    
    // Known multi-word phrases to match together (brands, franchises, etc.)
    const knownPhrases = [
      'lego star wars', 'lego harry potter', 'lego marvel', 'lego disney',
      'disney toys', 'disney princess', 'disney frozen', 'frozen toys', 'star wars', 'harry potter', 
      'spider man', 'spiderman', 'iron man', 'captain america', 
      'board games', 'remote control car', 'remote control', 
      'peppa pig', 'paw patrol', 'frozen elsa', 'toy story', 
      'sonic hedgehog', 'super mario', 'pokemon', 'minecraft',
      'kids trainers', 'teddy bear', 'soft toy', 'plush toy',
      'moana', 'encanto', 'lilo stitch', 'little mermaid', 'lion king',
      // Add brand phrases
      'dr martens', 'new balance', 'north face', 'start rite', 'lelli kelly',
      'micro scooter', 'fisher price', 'little tikes', 'hot wheels', 'hey duggee',
      'baby shark', 'hungry caterpillar', 'postman pat', 'fireman sam', 'pj masks',
      'ben holly', 'peter rabbit'
    ];
    
    
    // Try semantic search first (if embeddings exist)
    let semanticResults: any[] = [];
    try {
      // Use expanded query for semantic search
      const semanticQueryText = expansionTokens.length > 0 
        ? `${query} ${expansionTokens.join(' ')}` 
        : query;
      const queryEmbedding = await getQueryEmbedding(semanticQueryText);
      if (queryEmbedding.length > 0) {
        const embeddingStr = `[${queryEmbedding.join(",")}]`;
        const priceFilter = maxPrice && maxPrice > 0 ? `AND price <= ${maxPrice}` : '';
        // CRITICAL: Add mustMatch to semantic query SQL WHERE clause
        const mustMatchFilter = mustMatchSqlFilter ? `AND ${mustMatchSqlFilter}` : '';
        
        // Use pgvector inner product for semantic similarity
        const semanticQuery = `
          SELECT id, name, description, merchant, merchant_id, category, brand, price, 
                 affiliate_link, image_url, image_status, in_stock,
                 canonical_category, canonical_franchises,
                 embedding <#> '${embeddingStr}'::vector AS distance
          FROM products 
          WHERE embedding IS NOT NULL ${priceFilter} ${mustMatchFilter}
          ORDER BY embedding <#> '${embeddingStr}'::vector
          LIMIT ${Math.max(limit * 5, 100)}
        `;
        
        if (mustMatchSqlFilter) {
          console.log(`[Semantic Search] SQL includes mustMatch filter: ${mustMatchFilter}`);
        }
        
        const result = await db.execute(sql.raw(semanticQuery));
        semanticResults = result as any[];
        console.log(`[Semantic Search] Found ${semanticResults.length} results via pgvector for "${semanticQueryText}"`);
      }
    } catch (error) {
      console.log(`[Semantic Search] Fallback to keyword search:`, error);
    }
    
    // KEYWORD SEARCH - Multi-phase: exact phrase first, then multi-token AND, then OR fallback
    const baseConditions: any[] = [];
    if (maxPrice !== undefined && maxPrice > 0) {
      baseConditions.push(lte(productsTable.price, maxPrice));
    }
    
    // PERFORMANCE FIX: mustMatch is now post-filtered, not SQL WHERE
    // The ilike conditions were causing 18+ second sequential scans on 1.1M rows
    // Post-filtering is applied after fast indexed searches complete
    
    let keywordResults: Product[] = [];
    const fetchLimitPerPhase = Math.max(limit * 5, 100);
    
    // PHASE 1: Exact phrase match WITH remaining tokens (highest priority)
    // CRITICAL FIX: If query has extra words beyond the phrase, require them too!
    // e.g., "paw patrol tower playset" must match phrase "paw patrol" AND tokens "tower", "playset"
    const matchedPhrase = knownPhrases.find(p => queryLower.includes(p));
    if (matchedPhrase) {
      const phrasePattern = `%${matchedPhrase}%`;
      const phraseConditions = [
        ilike(productsTable.name, phrasePattern),
        ilike(productsTable.brand, phrasePattern)
      ];
      
      // Get tokens that are NOT part of the matched phrase
      const phraseTokens = matchedPhrase.split(/\s+/);
      const remainingTokens = tokens.filter(t => !phraseTokens.includes(t));
      
      // Build conditions: phrase match AND all remaining tokens must match
      let phase1Conditions = [...baseConditions, or(...phraseConditions)];
      
      if (remainingTokens.length > 0) {
        // CRITICAL: Remaining tokens must ALSO match in name/brand/category
        for (const token of remainingTokens) {
          const tokenPattern = `%${token}%`;
          phase1Conditions.push(or(
            ilike(productsTable.name, tokenPattern),
            ilike(productsTable.brand, tokenPattern),
            ilike(productsTable.category, tokenPattern)
          ));
        }
        console.log(`[Keyword Phase 1] Phrase "${matchedPhrase}" + required tokens: [${remainingTokens.join(', ')}]`);
      }
      
      const phraseWhere = and(...phase1Conditions);
      
      const phraseResults = await db.select().from(productsTable)
        .where(phraseWhere)
        .limit(fetchLimitPerPhase);
      keywordResults.push(...phraseResults);
      console.log(`[Keyword Phase 1] Phrase "${matchedPhrase}" matched ${phraseResults.length} products`);
    }
    
    // PHASE 2: ALL original tokens must match (for multi-word queries)
    if (tokens.length >= 2 && keywordResults.length < fetchLimitPerPhase) {
      const allTokenAndConditions = tokens.map(token => {
        const pattern = `%${token}%`;
        return or(
          ilike(productsTable.name, pattern),
          ilike(productsTable.brand, pattern)
        );
      });
      const allTokenWhere = baseConditions.length > 0
        ? and(...baseConditions, ...allTokenAndConditions)
        : and(...allTokenAndConditions);
      
      const allTokenResults = await db.select().from(productsTable)
        .where(allTokenWhere)
        .limit(fetchLimitPerPhase);
      keywordResults.push(...allTokenResults);
      console.log(`[Keyword Phase 2] All tokens AND matched ${allTokenResults.length} products`);
    }
    
    // PHASE 3: OR fallback - BUT require remaining tokens if no Phase 1/2 results
    // CRITICAL FIX: If Phase 1+2 found nothing, don't fall back to brand-only matches
    // Instead, require at least ONE of the remaining tokens (product type words)
    if (keywordResults.length < fetchLimitPerPhase * 2) {
      // Get non-phrase tokens (product type words like "tower", "playset", "dreamhouse")
      // CRITICAL: Also exclude the mustMatch term - that's the brand, not a product type
      const phraseTokens = matchedPhrase ? matchedPhrase.split(/\s+/) : [];
      const mustMatchTokens = mustMatchTerm ? mustMatchTerm.toLowerCase().split(/\s+/) : [];
      const excludeTokens = new Set([...phraseTokens, ...mustMatchTokens]);
      const productTypeTokens = tokens.filter(t => !excludeTokens.has(t));
      
      // If we have product type tokens and Phase 1+2 returned 0, require at least one
      let phase3Conditions = [...baseConditions];
      
      if (productTypeTokens.length > 0 && keywordResults.length === 0) {
        // STRICT: At least one product type token must match
        const typeConditions = productTypeTokens.flatMap(token => {
          const pattern = `%${token}%`;
          return [
            ilike(productsTable.name, pattern),
            ilike(productsTable.category, pattern)
          ];
        });
        phase3Conditions.push(or(...typeConditions));
        console.log(`[Keyword Phase 3] STRICT: Requiring at least one of [${productTypeTokens.join(', ')}]`);
      } else {
        // Normal OR fallback - any token matches
        const allTokenConditions = allTokens.flatMap(token => {
          const pattern = `%${token}%`;
          return [
            ilike(productsTable.name, pattern),
            ilike(productsTable.brand, pattern),
            ilike(productsTable.category, pattern)
          ];
        });
        phase3Conditions.push(or(...allTokenConditions));
      }
      
      const orWhere = phase3Conditions.length > 1 
        ? and(...phase3Conditions)
        : phase3Conditions[0];
      
      const orResults = await db.select().from(productsTable)
        .where(orWhere)
        .limit(fetchLimitPerPhase * 2)
        .offset(offset);
      keywordResults.push(...orResults);
      console.log(`[Keyword Phase 3] OR fallback matched ${orResults.length} products`);
    }
    
    // Merge and score results (semantic + keyword)
    const productMap = new Map<string, { product: Product, score: number }>();
    
    // IMPROVED: Tighter semantic threshold to reduce category bleed
    const SEMANTIC_DISTANCE_THRESHOLD = 0.5; // Reduced from 0.7 for stricter matching
    
    for (let i = 0; i < semanticResults.length; i++) {
      const row = semanticResults[i];
      const distance = row.distance || 1;
      
      // Skip poor semantic matches (high distance = low similarity)
      if (distance > SEMANTIC_DISTANCE_THRESHOLD) continue;
      
      const product: Product = {
        id: row.id,
        name: row.name,
        description: row.description,
        merchant: row.merchant,
        merchantId: row.merchant_id,
        category: row.category,
        brand: row.brand,
        price: row.price,
        affiliateLink: row.affiliate_link,
        imageUrl: row.image_url,
        inStock: row.in_stock,
        canonicalCategory: row.canonical_category,
        canonicalFranchises: row.canonical_franchises
      };
      
      // pgvector <#> operator returns negative inner product for similar vectors
      // Convert to 0-60 range (reduced from 80 to give keyword more priority)
      const similarity = Math.max(0, -distance);
      const semanticScore = Math.min(60, similarity * 60);
      productMap.set(product.id, { product, score: semanticScore });
    }
    
    console.log(`[Semantic Scoring] ${productMap.size} products passed threshold (distance < ${SEMANTIC_DISTANCE_THRESHOLD})`);
    
    // TAXONOMY-DRIVEN INTENT EXTRACTION - replaces all hardcoded keyword lists
    const intent = await extractIntent(query);
    console.log(`[Taxonomy Intent] categories=${intent.categories.join(',')}, franchises=${intent.franchises.join(',')}, keywords=${intent.keywords.join(',')}`);
    
    // Track products that PASS or FAIL the hard gate
    const hardFailIds = new Set<string>();
    
    // CRITICAL: Apply taxonomy scoring to ALL semantic results (hard gate for wrong categories)
    // This ensures products from semantic search that don't match category are filtered out
    for (const [id, entry] of productMap) {
      const result = calculateRelevanceScore(entry.product, intent);
      if (result.hardFail) {
        hardFailIds.add(id);
        entry.score = result.score; // Keep negative score for sorting
      } else {
        entry.score = entry.score + result.score;
      }
      productMap.set(id, entry);
    }
    
    // CRITICAL FIX: Apply product type token boost to SEMANTIC results too
    // This ensures "Frozen costume" ranks above "Frozen swimsuit" even in semantic results
    // ALSO: Override hardFail for products that match product type tokens!
    const phraseTokensForSemantic = matchedPhrase ? new Set(matchedPhrase.split(/\s+/)) : new Set<string>();
    const mustMatchTokensForSemantic = mustMatchTerm ? new Set(mustMatchTerm.toLowerCase().split(/\s+/)) : new Set<string>();
    const productTypeTokensForSemantic = tokens.filter(t => !phraseTokensForSemantic.has(t) && !mustMatchTokensForSemantic.has(t));
    
    if (productTypeTokensForSemantic.length > 0) {
      for (const [id, entry] of productMap) {
        const nameLower = entry.product.name.toLowerCase();
        const categoryLower = (entry.product.category || '').toLowerCase();
        
        for (const typeToken of productTypeTokensForSemantic) {
          if (nameLower.includes(typeToken)) {
            // CRITICAL: If product matches product type token, override hardFail and boost
            if (hardFailIds.has(id)) {
              hardFailIds.delete(id); // Remove from hardFail set
              entry.score = Math.max(0, entry.score) + 500; // Reset negative score and boost
              console.log(`[Scoring] OVERRIDE hardFail + boost for "${typeToken}" in "${entry.product.name.substring(0, 40)}..."`);
            } else {
              entry.score += 500; // MASSIVE boost for semantic results with product type match
            }
          } else if (categoryLower.includes(typeToken)) {
            entry.score += 250;
          }
        }
        productMap.set(id, entry);
      }
    }
    
    // Add/boost keyword results - apply taxonomy only to NEW products
    for (const product of keywordResults) {
      const existing = productMap.get(product.id);
      
      // If already processed and hard-failed, skip keyword boosts entirely
      if (existing && hardFailIds.has(product.id)) continue;
      
      // Start with existing score (from semantic) or apply taxonomy for new products
      let score = 0;
      let isHardFail = false;
      if (existing) {
        score = existing.score;
      } else {
        const result = calculateRelevanceScore(product, intent);
        score = result.score;
        isHardFail = result.hardFail;
        if (isHardFail) {
          hardFailIds.add(product.id);
          // Skip keyword boosts for hard-failed products
          productMap.set(product.id, { product, score });
          continue;
        }
      }
      
      // If this is a NEW product (not from semantic), score is already set from taxonomy above
      // If it's EXISTING, we skip taxonomy (already applied) and just add keyword boosts
      
      const nameLower = product.name.toLowerCase();
      const brandLower = (product.brand || '').toLowerCase();
      const categoryLower = (product.category || '').toLowerCase();
      
      // PHRASE MATCHING - boost for matching known phrases
      for (const phrase of knownPhrases) {
        if (queryLower.includes(phrase)) {
          if (nameLower.includes(phrase)) score += 100;
          else if (brandLower.includes(phrase)) score += 75;
        }
      }
      
      // CRITICAL FIX: MASSIVE boost for product type tokens (costume, tower, playset, dreamhouse)
      // These are the words that distinguish "frozen elsa costume" from "frozen elsa swimsuit"
      const phraseTokensSet = matchedPhrase ? new Set(matchedPhrase.split(/\s+/)) : new Set<string>();
      const mustMatchTokensSet = mustMatchTerm ? new Set(mustMatchTerm.toLowerCase().split(/\s+/)) : new Set<string>();
      const productTypeTokensForScoring = tokens.filter(t => !phraseTokensSet.has(t) && !mustMatchTokensSet.has(t));
      
      for (const typeToken of productTypeTokensForScoring) {
        if (nameLower.includes(typeToken)) {
          score += 500; // MASSIVE boost - ensures "costume" products rank above "swimsuit"
          console.log(`[Scoring] +500 boost for product type match: "${typeToken}" in "${product.name.substring(0, 40)}..."`);
        } else if (categoryLower.includes(typeToken)) {
          score += 250; // Category match is also good
        }
      }
      
      // Count direct token matches for additional keyword boost
      let nameMatches = 0;
      let brandMatches = 0;
      
      for (const token of allTokens) {
        if (nameLower.includes(token)) nameMatches++;
        if (brandLower.includes(token)) brandMatches++;
      }
      
      // Boost for name/brand matches
      if (nameMatches > 0) score += nameMatches * 30;
      if (brandMatches > 0) score += brandMatches * 20;
      
      // Penalize Blu-Ray/DVD for non-movie searches
      if (intent.categories.length > 0 && !intent.categories.includes('Home')) {
        if (categoryLower.includes('blu-ray') || categoryLower.includes('dvd')) {
          score -= 200;
        }
      }
      
      // Penalize decorations unless explicitly searching for them
      if (categoryLower === 'decorations' && !intent.categories.includes('Home')) {
        score -= 80;
      }
      
      // CRITICAL: Deprioritize products with broken images (from image_status column)
      // Handle all status variations: broken, BROKEN_AT_SOURCE, valid, working, unknown
      const imgStatus = ((product as any).imageStatus || '').toLowerCase();
      if (imgStatus === 'broken' || imgStatus === 'broken_at_source') {
        score -= 1000; // Heavy penalty - push to bottom of results
      } else if (imgStatus === 'valid' || imgStatus === 'working') {
        score += 50; // Small boost for verified working images
      }
      // Products with 'unknown' status get no adjustment (benefit of the doubt)
      
      productMap.set(product.id, { product, score });
    }
    
    // Sort by score and deduplicate - EXCLUDE hardFail products from results
    const allResults = Array.from(productMap.values());
    
    // CRITICAL: If a brand/character was detected, HARD FILTER results that don't contain it
    // NOTE: Only check name and brand - description matching causes false positives
    let filteredResults = allResults;
    if (mustMatchTerm) {
      const termLower = mustMatchTerm.toLowerCase();
      const beforeCount = filteredResults.length;
      filteredResults = filteredResults.filter(r => {
        const nameLower = r.product.name.toLowerCase();
        const brandLower = (r.product.brand || '').toLowerCase();
        return nameLower.includes(termLower) || brandLower.includes(termLower);
      });
      console.log(`[Storage] BRAND/CHARACTER FILTER: "${mustMatchTerm}" - kept ${filteredResults.length}/${beforeCount} products (name/brand only)`);
    }
    
    // Filter out hard-failed products first, then sort by score
    // EXCEPTION: If we detected a brand/character, products containing that term should NOT be filtered out
    // even if taxonomy marked them as hard-fail (taxonomy may be too aggressive for brand queries)
    const passResults = filteredResults.filter(r => {
      // If product is not in hardFailIds, it passes
      if (!hardFailIds.has(r.product.id)) return true;
      
      // If we have a mustMatchTerm and the product contains it in name/brand, override the hardFail
      if (mustMatchTerm) {
        const nameLower = r.product.name.toLowerCase();
        const brandLower = (r.product.brand || '').toLowerCase();
        const termLower = mustMatchTerm.toLowerCase();
        if (nameLower.includes(termLower) || brandLower.includes(termLower)) {
          console.log(`[Storage] OVERRIDE hardFail for brand match: "${r.product.name.substring(0, 50)}..."`);
          return true;
        }
      }
      
      // Otherwise, respect the hardFail
      return false;
    });
    passResults.sort((a, b) => b.score - a.score);
    
    const seen = new Set<string>();
    const dedupedResults: Product[] = [];
    for (const { product } of passResults) {
      const key = `${product.name}|${product.price}`;
      if (!seen.has(key)) {
        seen.add(key);
        dedupedResults.push(product);
      }
    }
    
    const results = dedupedResults.slice(0, limit);
    console.log(`[Taxonomy] HardFail filter: ${hardFailIds.size} products excluded, ${passResults.length} passed`);
    
    // Estimate total count from PASSING products only (not hard-failed ones)
    const estimatedTotalCount = dedupedResults.length;
    
    console.log(`[DB AUDIT] searchProducts: Retrieved ${results.length} unique products for "${query}" (semantic: ${semanticResults.length}, keyword: ${keywordResults.length}, est total: ${estimatedTotalCount})`);
    assertDatabaseResult('searchProducts', results);
    
    return { products: results, totalCount: estimatedTotalCount };
  }

  async searchProductsGrouped(query: string, limit: number = 20, offset: number = 0, maxPrice?: number): Promise<{ products: GroupedProduct[], totalCount: number }> {
    // Get more products than needed to account for grouping
    const expandedLimit = limit * 5;
    const { products, totalCount } = await this.searchProducts(query, expandedLimit, offset, maxPrice);
    
    // Group products by image URL - now respects category (only groups clothing/footwear)
    // Pass maxPrice to filter out variants that exceed price limit
    const grouped = groupProductsByImage(products, maxPrice);
    
    // Take only the requested limit
    const limitedGrouped = grouped.slice(0, limit);
    
    console.log(`[DB AUDIT] searchProductsGrouped: Grouped ${products.length} products into ${grouped.length} groups, returning ${limitedGrouped.length}`);
    
    return { 
      products: limitedGrouped, 
      totalCount: Math.ceil(totalCount / 3) // Estimate grouped total
    };
  }

  async saveChatLog(log: InsertChatLog): Promise<ChatLog> {
    console.log(`[CHAT LOG] Saving conversation for session: ${log.sessionId}`);
    const result = await db.insert(chatLogsTable).values({
      sessionId: log.sessionId,
      userMessage: log.userMessage,
      sunnyResponse: log.sunnyResponse,
      toolsUsed: log.toolsUsed
    }).returning();
    console.log(`[CHAT LOG] Saved to database with ID: ${result[0].id}`);
    return result[0];
  }

  async getChatLogs(sessionId?: string, limit: number = 50): Promise<ChatLog[]> {
    let query = db.select().from(chatLogsTable).orderBy(desc(chatLogsTable.createdAt)).limit(limit);
    
    if (sessionId) {
      const results = await db.select().from(chatLogsTable)
        .where(eq(chatLogsTable.sessionId, sessionId))
        .orderBy(desc(chatLogsTable.createdAt))
        .limit(limit);
      console.log(`[CHAT LOG] Retrieved ${results.length} logs for session: ${sessionId}`);
      return results;
    }
    
    const results = await query;
    console.log(`[CHAT LOG] Retrieved ${results.length} total conversation logs`);
    return results;
  }

  async searchRecommendations(query?: string, category?: string, limit: number = 20): Promise<Recommendation[]> {
    console.log(`[DB QUERY] searchRecommendations - query: "${query}", category: "${category}", limit: ${limit}`);
    let results = await db.select().from(recommendationsTable);
    console.log(`[AUDIT] recommendations table: ${results.length} rows from PostgreSQL`);
    
    if (category) {
      const categoryLower = category.toLowerCase();
      results = results.filter(r => 
        r.category?.toLowerCase().includes(categoryLower)
      );
    }
    
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(r => 
        r.venueName.toLowerCase().includes(queryLower) ||
        r.venueNameNormalised?.toLowerCase().includes(queryLower) ||
        r.category?.toLowerCase().includes(queryLower) ||
        r.city?.toLowerCase().includes(queryLower) ||
        r.region?.toLowerCase().includes(queryLower)
      );
    }
    
    results.sort((a, b) => (b.positiveMentions || 0) - (a.positiveMentions || 0));
    return results.slice(0, limit);
  }

  async searchEvents(query?: string, city?: string, category?: string, limit: number = 20, family?: boolean): Promise<Event[]> {
    console.log(`[DB QUERY] searchEvents - query: "${query}", city: "${city}", category: "${category}", family: ${family}, limit: ${limit}`);
    let results = await db.select().from(eventsTable);
    console.log(`[AUDIT] events table: ${results.length} rows from PostgreSQL`);
    
    // Family-safe filtering: exclude adult-only content when kids are involved
    // Adult detection takes PRECEDENCE - if adult keywords found, event is excluded
    if (family) {
      const adultKeywords = [
        '18+', 'over 18', 'over 18s', 'adult only', 'adults only', 'mature',
        'burlesque', 'cabaret', 'comedy club', 'stand up comedy', 'stand-up comedy',
        'late night', 'late show', 'after dark', 'midnight',
        'adult comedy', 'drag night', 'drag show', 'hen party', 'stag party',
        'strip', 'explicit', 'uncensored', 'raunchy', 'risque',
        'club night', 'nightclub', 'r rated', 'r-rated'
      ];
      
      results = results.filter(e => {
        const nameLower = e.name.toLowerCase();
        const descLower = (e.description || '').toLowerCase();
        const categoryLower = (e.category || '').toLowerCase();
        const tagsLower = (e.tags || '').toLowerCase();
        const allText = `${nameLower} ${descLower} ${categoryLower} ${tagsLower}`;
        
        // ADULT CHECK TAKES PRECEDENCE - if any adult keyword found, EXCLUDE
        const hasAdultContent = adultKeywords.some(keyword => allText.includes(keyword));
        
        if (hasAdultContent) {
          console.log(`[FAMILY FILTER] Excluded adult content: "${e.name}"`);
          return false;
        }
        
        return true;
      });
      console.log(`[FAMILY FILTER] Filtered to ${results.length} family-friendly events`);
    }
    
    if (city) {
      const cityLower = city.toLowerCase().trim();
      // STRICT city matching - same logic as restaurants
      const exactMatches = results.filter(e => 
        e.city?.toLowerCase().trim() === cityLower
      );
      
      if (exactMatches.length > 0) {
        results = exactMatches;
        console.log(`[LOCATION FILTER] Strict match: ${results.length} events in ${city}`);
      } else {
        // Word-boundary match only (not substring match to prevent chester→manchester)
        const wordBoundaryMatches = results.filter(e => {
          const eCity = e.city?.toLowerCase().trim() || '';
          return eCity.startsWith(cityLower + ' ') || 
                 eCity.endsWith(' ' + cityLower) ||
                 eCity === cityLower;
        });
        
        if (wordBoundaryMatches.length > 0) {
          results = wordBoundaryMatches;
          console.log(`[LOCATION FILTER] Word boundary match: ${results.length} events in ${city}`);
        } else {
          // No matches - return empty rather than wrong city
          results = [];
          console.log(`[LOCATION FILTER] No events found in ${city} - returning empty (not wrong city)`);
        }
      }
    }
    
    if (category) {
      const categoryLower = category.toLowerCase();
      results = results.filter(e => 
        e.category?.toLowerCase().includes(categoryLower) ||
        e.tags?.toLowerCase().includes(categoryLower)
      );
    }
    
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(e => 
        e.name.toLowerCase().includes(queryLower) ||
        e.description?.toLowerCase().includes(queryLower) ||
        e.venueName?.toLowerCase().includes(queryLower) ||
        e.category?.toLowerCase().includes(queryLower)
      );
    }
    
    return results.slice(0, limit);
  }

  async searchRestaurants(query?: string, city?: string, chain?: string, limit: number = 20): Promise<Restaurant[]> {
    console.log(`[DB QUERY] searchRestaurants - query: "${query}", city: "${city}", chain: "${chain}", limit: ${limit}`);
    let results = await db.select().from(restaurantsTable);
    console.log(`[AUDIT] restaurants table: ${results.length} rows from PostgreSQL`);
    
    if (city) {
      const cityLower = city.toLowerCase().trim();
      // STRICT city matching - only return restaurants IN that city
      const exactMatches = results.filter(r => 
        r.city?.toLowerCase().trim() === cityLower
      );
      
      if (exactMatches.length > 0) {
        results = exactMatches;
        console.log(`[LOCATION FILTER] Strict match: ${results.length} restaurants in ${city}`);
      } else {
        // Try word-boundary match (city is a complete word, not substring)
        const wordBoundaryMatches = results.filter(r => {
          const rCity = r.city?.toLowerCase().trim() || '';
          // Match if city starts with search term + space, or equals it
          return rCity.startsWith(cityLower + ' ') || 
                 rCity.endsWith(' ' + cityLower) ||
                 rCity === cityLower;
        });
        
        if (wordBoundaryMatches.length > 0) {
          results = wordBoundaryMatches;
          console.log(`[LOCATION FILTER] Word boundary match: ${results.length} restaurants in ${city}`);
        } else {
          // No matches - return empty rather than wrong city
          results = [];
          console.log(`[LOCATION FILTER] No restaurants found in ${city} - returning empty (not wrong city)`);
        }
      }
    }
    
    if (chain) {
      const chainLower = chain.toLowerCase();
      results = results.filter(r => 
        r.chainName?.toLowerCase().includes(chainLower) ||
        r.name.toLowerCase().includes(chainLower)
      );
    }
    
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(r => 
        r.name.toLowerCase().includes(queryLower) ||
        r.chainName?.toLowerCase().includes(queryLower) ||
        r.chainCategory?.toLowerCase().includes(queryLower) ||
        r.whyFamilyFriendly?.toLowerCase().includes(queryLower)
      );
    }
    
    results.sort((a, b) => {
      if (a.hasKidsMenu && !b.hasKidsMenu) return -1;
      if (!a.hasKidsMenu && b.hasKidsMenu) return 1;
      return (b.hygieneRating || 0) - (a.hygieneRating || 0);
    });
    
    return results.slice(0, limit);
  }
}

export const storage = new DatabaseStorage();
