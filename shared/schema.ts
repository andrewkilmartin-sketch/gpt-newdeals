import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, integer, boolean, real, jsonb, timestamp, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Custom types for PostgreSQL-specific columns
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
});

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// CJ Import State - tracks resumable import progress
export const cjImportState = pgTable("cj_import_state", {
  id: varchar("id", { length: 50 }).primaryKey().default("current"),
  keyword: text("keyword").notNull().default("gift"),
  offset: integer("offset").notNull().default(0),
  totalImported: integer("total_imported").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export type CJImportState = typeof cjImportState.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============ DATABASE TABLES ============

// Attractions table
export const attractions = pgTable("attractions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  address: text("address").notNull(),
  openingHours: text("opening_hours").notNull(),
  ticketPrice: real("ticket_price"),
  familyFriendly: boolean("family_friendly").notNull(),
  rating: real("rating").notNull(),
  website: text("website"),
  highlights: text("highlights").array().notNull(),
  source: text("source").default("daysout"),
  priceAdult: real("price_adult"),
  priceChild: real("price_child"),
  priceFamily: real("price_family"),
  lat: real("lat"),
  lon: real("lon"),
  phone: text("phone"),
  dealTypes: text("deal_types"),
  dealDescription: text("deal_description"),
  postcode: text("postcode"),
  county: text("county"),
});

export const insertAttractionSchema = createInsertSchema(attractions);
export type InsertAttraction = z.infer<typeof insertAttractionSchema>;
export type Attraction = typeof attractions.$inferSelect;

// Free Attractions table (for attractions with no pricing or explicitly free)
export const attractionsFree = pgTable("attractions_free", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  address: text("address").notNull(),
  openingHours: text("opening_hours").notNull(),
  ticketPrice: real("ticket_price"),
  familyFriendly: boolean("family_friendly").notNull(),
  rating: real("rating").notNull(),
  website: text("website"),
  highlights: text("highlights").array().notNull(),
  source: text("source").default("daysout"),
  priceAdult: real("price_adult"),
  priceChild: real("price_child"),
  priceFamily: real("price_family"),
  lat: real("lat"),
  lon: real("lon"),
  phone: text("phone"),
  dealTypes: text("deal_types"),
  dealDescription: text("deal_description"),
  postcode: text("postcode"),
  county: text("county"),
});

export const insertAttractionFreeSchema = createInsertSchema(attractionsFree);
export type InsertAttractionFree = z.infer<typeof insertAttractionFreeSchema>;
export type AttractionFree = typeof attractionsFree.$inferSelect;

// Cinema movies table
export const cinemaMovies = pgTable("cinema_movies", {
  id: varchar("id", { length: 100 }).primaryKey(),
  title: text("title").notNull(),
  synopsis: text("synopsis").notNull(),
  poster: text("poster"),
  backdrop: text("backdrop"),
  releaseDate: text("release_date").notNull(),
  rating: real("rating").notNull(),
  bbfcRating: text("bbfc_rating").notNull(),
  genres: text("genres").array().notNull(),
  runtime: integer("runtime").notNull(),
  cast: text("cast_members").array().notNull(),
  director: text("director").notNull(),
  tagline: text("tagline"),
  status: text("status").notNull(),
  trailerUrl: text("trailer_url"),
});

export const insertCinemaMovieSchema = createInsertSchema(cinemaMovies);
export type InsertCinemaMovie = z.infer<typeof insertCinemaMovieSchema>;
export type CinemaMovie = typeof cinemaMovies.$inferSelect;

// Night-in movies table
export const nightinMovies = pgTable("nightin_movies", {
  id: varchar("id", { length: 100 }).primaryKey(),
  title: text("title").notNull(),
  year: integer("year").notNull(),
  synopsis: text("synopsis").notNull(),
  genres: text("genres").array().notNull(),
  rating: text("rating").notNull(),
  imdbScore: real("imdb_score").notNull(),
  runtime: integer("runtime").notNull(),
  streamingServices: text("streaming_services").array().notNull(),
  mood: text("mood").array().notNull(),
  cast: text("cast_members").array().notNull(),
  director: text("director").notNull(),
  familyFriendly: boolean("family_friendly").notNull(),
  poster: text("poster"),
});

export const insertNightinMovieSchema = createInsertSchema(nightinMovies);
export type InsertNightinMovie = z.infer<typeof insertNightinMovieSchema>;
export type NightinMovie = typeof nightinMovies.$inferSelect;

// Activities table
export const activities = pgTable("activities", {
  id: varchar("id", { length: 100 }).primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  tags: text("tags").array().notNull(),
  ageBands: text("age_bands").array().notNull(),
  supervisionLevel: text("supervision_level").notNull(),
  noiseLevel: text("noise_level").notNull(),
  steps: text("steps").array().notNull(),
  variations: text("variations").array().notNull(),
});

export const insertActivitySchema = createInsertSchema(activities);
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// Products table
export const products = pgTable("products", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  merchant: text("merchant").notNull(),
  merchantId: integer("merchant_id"),
  category: text("category"),
  brand: text("brand"),
  price: real("price").notNull(),
  affiliateLink: text("affiliate_link").notNull(),
  imageUrl: text("image_url"),
  imageStatus: varchar("image_status", { length: 20 }).default("unknown"),
  inStock: boolean("in_stock").default(true),
  embedding: vector("embedding"),
  canonicalCategory: text("canonical_category"),
  canonicalFranchises: text("canonical_franchises").array(),
  source: varchar("source", { length: 20 }).default("awin"),
  merchantSlug: varchar("merchant_slug", { length: 100 }), // Normalized merchant name for routing
  lastViewed: timestamp("last_viewed"),
  lastSold: timestamp("last_sold"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products);
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Products V2 table - enhanced schema with richer data from new Awin feed
export const productsV2 = pgTable("products_v2", {
  id: varchar("id", { length: 100 }).primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  shortDescription: text("short_description"),
  merchant: text("merchant").notNull(),
  merchantId: integer("merchant_id"),
  category: text("category"),
  merchantCategory: text("merchant_category"),
  brand: text("brand"),
  price: real("price").notNull(),
  rrpPrice: real("rrp_price"),
  savingsPercent: real("savings_percent"),
  affiliateLink: text("affiliate_link").notNull(),
  imageUrl: text("image_url"),
  largeImageUrl: text("large_image_url"),
  inStock: boolean("in_stock").default(true),
  numberAvailable: integer("number_available"),
  keywords: text("keywords"),
  promotionalText: text("promotional_text"),
  averageRating: real("average_rating"),
  reviewCount: integer("review_count"),
  currency: text("currency").default("GBP"),
  lastUpdated: text("last_updated"),
  searchVector: tsvector("search_vector"),
});

export const insertProductV2Schema = createInsertSchema(productsV2);
export type InsertProductV2 = z.infer<typeof insertProductV2Schema>;
export type ProductV2 = typeof productsV2.$inferSelect;

export interface ProductVariant {
  id: string;
  size: string;
  price: number;
  affiliateLink: string;
  inStock: boolean | null;
}

export interface GroupedProduct {
  id: string;
  name: string;
  description: string | null;
  merchant: string;
  category: string | null;
  brand: string | null;
  imageUrl: string | null;
  minPrice: number;
  maxPrice: number;
  variants: ProductVariant[];
  hasMultipleSizes: boolean;
}

// Recommendations table - venue recommendations from community
export const recommendations = pgTable("recommendations", {
  id: integer("id").primaryKey(),
  venueName: text("venue_name").notNull(),
  venueNameNormalised: text("venue_name_normalised"),
  category: text("category"),
  city: text("city"),
  region: text("region"),
  postcode: text("postcode"),
  website: text("website"),
  mentionCount: integer("mention_count"),
  positiveMentions: integer("positive_mentions"),
  negativeMentions: integer("negative_mentions"),
  recommendationScore: real("recommendation_score"),
  ageBaby: boolean("age_baby"),
  ageToddler: boolean("age_toddler"),
  agePreschool: boolean("age_preschool"),
  agePrimary: boolean("age_primary"),
  ageTeen: boolean("age_teen"),
  mentionedParking: boolean("mentioned_parking"),
  mentionedCafe: boolean("mentioned_cafe"),
  mentionedBuggyFriendly: boolean("mentioned_buggy_friendly"),
  mentionedDogFriendly: boolean("mentioned_dog_friendly"),
  mentionedFreeEntry: boolean("mentioned_free_entry"),
  firstSeen: text("first_seen"),
  lastMentioned: text("last_mentioned"),
  createdAt: text("created_at"),
});

export const insertRecommendationSchema = createInsertSchema(recommendations);
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendations.$inferSelect;

// Events table - family events and activities
export const events = pgTable("events", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  tags: text("tags"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  doorTime: text("door_time"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  multipleDates: boolean("multiple_dates"),
  venueName: text("venue_name"),
  address: text("address"),
  city: text("city"),
  postcode: text("postcode"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  parkingInfo: text("parking_info"),
  priceFrom: real("price_from"),
  priceTo: real("price_to"),
  adultPrice: real("adult_price"),
  childPrice: real("child_price"),
  familyTicketPrice: real("family_ticket_price"),
  familyTicketInfo: text("family_ticket_info"),
  underFreeAge: integer("under_free_age"),
  bookingUrl: text("booking_url"),
  ageRangeMin: integer("age_range_min"),
  ageRangeMax: integer("age_range_max"),
  durationHours: real("duration_hours"),
  buggyFriendly: boolean("buggy_friendly"),
  accessibilityInfo: text("accessibility_info"),
  foodAvailable: boolean("food_available"),
  whatToExpect: text("what_to_expect"),
  sourceUrl: text("source_url"),
  sourceType: text("source_type"),
  imageUrl: text("image_url"),
  lastUpdated: text("last_updated"),
});

export const insertEventSchema = createInsertSchema(events);
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Restaurants table - family-friendly restaurants
export const restaurants = pgTable("restaurants", {
  id: integer("id").primaryKey(),
  fhrsId: text("fhrs_id"),
  name: text("name").notNull(),
  businessType: text("business_type"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  localAuthority: text("local_authority"),
  hygieneRating: integer("hygiene_rating"),
  hygieneDate: text("hygiene_date"),
  isChain: boolean("is_chain"),
  chainName: text("chain_name"),
  chainCategory: text("chain_category"),
  website: text("website"),
  phone: text("phone"),
  hasKidsMenu: boolean("has_kids_menu"),
  hasHighchairs: boolean("has_highchairs"),
  hasBabyChanging: boolean("has_baby_changing"),
  hasKidsPlayArea: boolean("has_kids_play_area"),
  hasOutdoorSeating: boolean("has_outdoor_seating"),
  hasParking: boolean("has_parking"),
  kidsEatFreeDay: text("kids_eat_free_day"),
  kidsEatFreeTerms: text("kids_eat_free_terms"),
  whyFamilyFriendly: text("why_family_friendly"),
  familyTips: text("family_tips"),
  priceLevel: text("price_level"),
  source: text("source"),
  lastUpdated: text("last_updated"),
  dataProvenance: text("data_provenance"),
  verificationSource: text("verification_source"),
  lastVerified: text("last_verified"),
  blogMentions: integer("blog_mentions"),
  blogPositive: integer("blog_positive"),
  hasBlogRecommendation: boolean("has_blog_recommendation"),
});

export const insertRestaurantSchema = createInsertSchema(restaurants);
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Restaurant = typeof restaurants.$inferSelect;

// Chat logs table - stores all Sunny conversations
export const chatLogs = pgTable("chat_logs", {
  id: varchar("id", { length: 100 }).primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  userMessage: text("user_message").notNull(),
  sunnyResponse: text("sunny_response").notNull(),
  toolsUsed: jsonb("tools_used").notNull(),
  rawResults: jsonb("raw_results"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatLogSchema = createInsertSchema(chatLogs).omit({ id: true, createdAt: true });
export type InsertChatLog = z.infer<typeof insertChatLogSchema>;
export type ChatLog = typeof chatLogs.$inferSelect;

// ============ LEGACY INTERFACES (for backwards compatibility during migration) ============

export interface ShoppingDeal {
  id: string;
  title: string;
  description: string;
  merchant: string;
  originalPrice: number;
  salePrice: number;
  discount: string;
  category: string;
  affiliateLink: string;
  imageUrl?: string;
  validUntil?: string;
  code?: string;
}

export interface CinemaListing {
  id: string;
  movieTitle: string;
  genre: string;
  rating: string;
  duration: string;
  synopsis: string;
  showtimes: string[];
  cinema: string;
  location: string;
  ticketPrice: number;
  dealInfo?: string;
  bookingLink?: string;
}

export interface NightInIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  duration: string;
  ingredients?: string[];
  streamingPlatform?: string;
  activityType: string;
  mood: string;
  tips: string[];
}

export interface HintAndTip {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  difficulty: string;
  savingsEstimate?: string;
  source?: string;
}

export interface FamilyActivity {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  age_bands: string[];
  constraints: {
    supervision: string;
    noise: string;
  };
  steps: string[];
  variations: string[];
}

export const searchQuerySchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  age: z.string().optional(),
  energy: z.string().optional(),
  setting: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

// ============ KNOWLEDGE MARKETING TABLE (AI-OPTIMIZED) ============
// Schema designed for AI retrieval with semantic categories, Q&A pairs, and structured content

// Taxonomy table - keyword to category mapping for search intent
export const taxonomy = pgTable("taxonomy", {
  id: integer("id").primaryKey(),
  keyword: varchar("keyword", { length: 100 }).notNull().unique(),
  category: varchar("category", { length: 50 }).notNull(),
  subcategory: varchar("subcategory", { length: 50 }),
  weight: real("weight").default(1.0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaxonomySchema = createInsertSchema(taxonomy).omit({ id: true, createdAt: true });
export type InsertTaxonomy = z.infer<typeof insertTaxonomySchema>;
export type Taxonomy = typeof taxonomy.$inferSelect;

// Search Intent interface for taxonomy-driven search
export interface SearchIntent {
  rawQuery: string;
  keywords: string[];
  categories: string[];
  franchises: string[];
  ageGroup: string | null;
  intentType: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  weights: Record<string, number>;
}

export const knowledgeMarketing = pgTable("knowledge_marketing", {
  id: varchar("id", { length: 100 }).primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  seoTitle: text("seo_title"),
  summary: text("summary").notNull(),
  
  // Categorization for AI filtering
  primaryCategory: text("primary_category").notNull(),
  subCategory: text("sub_category"),
  tags: text("tags").array().notNull(),
  keywords: text("keywords").array().notNull(),
  
  // Audience targeting
  audience: text("audience").notNull(), // beginner, intermediate, advanced
  difficulty: integer("difficulty").notNull(), // 1-5 scale
  
  // Structured content sections (AI-friendly)
  contentSections: jsonb("content_sections").notNull(), // Array of {heading, type, body, bulletPoints, stats}
  
  // Quick AI extraction fields
  keyTakeaways: text("key_takeaways").array().notNull(),
  actionSteps: text("action_steps").array().notNull(),
  
  // Q&A pairs for direct AI responses
  qaPairs: jsonb("qa_pairs").notNull(), // Array of {question, answer, intent}
  
  // Related content for context
  relatedTopics: text("related_topics").array(),
  
  // Source and verification
  citations: jsonb("citations"), // Array of {source, url, quote}
  author: text("author"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  
  // Metrics
  readTimeMinutes: integer("read_time_minutes"),
  wordCount: integer("word_count"),
});

export const insertKnowledgeMarketingSchema = createInsertSchema(knowledgeMarketing).omit({ lastUpdated: true });
export type InsertKnowledgeMarketing = z.infer<typeof insertKnowledgeMarketingSchema>;
export type KnowledgeMarketing = typeof knowledgeMarketing.$inferSelect;

// ============ TMDB MOVIES TABLE ============
// Unified movies table for cinema, streaming, and coming soon content
export const movies = pgTable("movies", {
  id: integer("id").primaryKey(), // TMDB ID
  title: text("title").notNull(),
  overview: text("overview"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  releaseDate: text("release_date"),
  voteAverage: real("vote_average"),
  voteCount: integer("vote_count"),
  popularity: real("popularity"),
  genreIds: integer("genre_ids").array(),
  adult: boolean("adult").default(false),
  originalLanguage: text("original_language"),
  runtime: integer("runtime"),
  status: text("status"), // "Released", "Upcoming", "Now Playing"
  contentType: text("content_type").notNull(), // "cinema", "streaming", "coming_soon"
  streamingProviders: text("streaming_providers").array(), // Netflix, Prime, etc.
  ukCertification: text("uk_certification"), // BBFC rating
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertMovieSchema = createInsertSchema(movies).omit({ lastUpdated: true });
export type InsertMovie = z.infer<typeof insertMovieSchema>;
export type Movie = typeof movies.$inferSelect;

// ============ UPSELL MAPPINGS TABLE ============
// Maps content categories to relevant product search keywords for smart upsells
export const upsellMappings = pgTable("upsell_mappings", {
  id: varchar("id", { length: 100 }).primaryKey().default(sql`gen_random_uuid()`),
  contentType: text("content_type").notNull(), // "movie", "attraction", "activity"
  intentCategory: text("intent_category").notNull(), // "action", "family", "horror", "romance", etc.
  productKeywords: text("product_keywords").array().notNull(), // Search terms for products
  productCategories: text("product_categories").array(), // Filter categories
  priority: integer("priority").default(1), // Higher = more likely to show
  isActive: boolean("is_active").default(true),
});

export const insertUpsellMappingSchema = createInsertSchema(upsellMappings).omit({ id: true });
export type InsertUpsellMapping = z.infer<typeof insertUpsellMappingSchema>;
export type UpsellMapping = typeof upsellMappings.$inferSelect;

// ============ UPSELL CLICKS TRACKING ============
// Track which upsells get clicked for optimization
export const upsellClicks = pgTable("upsell_clicks", {
  id: varchar("id", { length: 100 }).primaryKey().default(sql`gen_random_uuid()`),
  contentId: text("content_id").notNull(), // Movie/attraction ID that generated the upsell
  contentType: text("content_type").notNull(), // "movie", "attraction", etc.
  productId: text("product_id").notNull(), // Product that was clicked
  intentCategory: text("intent_category"), // Category used for mapping
  clickedAt: timestamp("clicked_at").defaultNow(),
  sessionId: text("session_id"), // Optional session tracking
});

export const insertUpsellClickSchema = createInsertSchema(upsellClicks).omit({ id: true, clickedAt: true });
export type InsertUpsellClick = z.infer<typeof insertUpsellClickSchema>;
export type UpsellClick = typeof upsellClicks.$inferSelect;

// ============ QUERY INTERPRETATION CACHE ============
// Persistent cache for GPT query interpretations to save costs
export const queryCache = pgTable("query_cache", {
  id: varchar("id", { length: 100 }).primaryKey().default(sql`gen_random_uuid()`),
  queryHash: varchar("query_hash", { length: 64 }).notNull().unique(), // MD5 of normalized query
  originalQuery: text("original_query").notNull(),
  normalizedQuery: text("normalized_query").notNull(),
  interpretation: jsonb("interpretation").notNull(), // Full QueryInterpretation object
  cacheVersion: integer("cache_version").default(1), // Increment when interpretation format changes
  createdAt: timestamp("created_at").defaultNow(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // TTL for automatic cleanup
  hitCount: integer("hit_count").default(1),
});

export const insertQueryCacheSchema = createInsertSchema(queryCache).omit({ id: true, createdAt: true, lastAccessedAt: true, hitCount: true });
export type InsertQueryCache = z.infer<typeof insertQueryCacheSchema>;
export type QueryCacheEntry = typeof queryCache.$inferSelect;

// ============ DYNAMIC AFFILIATE ROUTING - PHASE 0 ============
// Merchant mapping between networks for intelligent routing

export const merchantNetworks = pgTable("merchant_networks", {
  id: varchar("id", { length: 100 }).primaryKey().default(sql`gen_random_uuid()`),
  merchantName: text("merchant_name").notNull(),
  merchantSlug: varchar("merchant_slug", { length: 100 }).notNull().unique(), // Normalized: "nike-uk"
  
  // Awin details
  awinMerchantId: varchar("awin_merchant_id", { length: 50 }),
  awinProgramId: varchar("awin_program_id", { length: 50 }),
  awinBaseUrl: text("awin_base_url"),
  awinActive: boolean("awin_active").default(true),
  awinCommissionRate: real("awin_commission_rate"), // 5.00 = 5%
  
  // CJ details
  cjAdvertiserId: varchar("cj_advertiser_id", { length: 50 }),
  cjWebsiteId: varchar("cj_website_id", { length: 50 }),
  cjBaseUrl: text("cj_base_url"),
  cjActive: boolean("cj_active").default(true),
  cjCommissionRate: real("cj_commission_rate"),
  
  // Current winner
  preferredNetwork: varchar("preferred_network", { length: 20 }).default("awin"),
  preferredReason: text("preferred_reason"), // "CJ has 10% off until 2026-01-31"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMerchantNetworkSchema = createInsertSchema(merchantNetworks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMerchantNetwork = z.infer<typeof insertMerchantNetworkSchema>;
export type MerchantNetwork = typeof merchantNetworks.$inferSelect;

// Click tracking for analytics
export const clickEvents = pgTable("click_events", {
  id: varchar("id", { length: 100 }).primaryKey().default(sql`gen_random_uuid()`),
  
  // What was clicked
  productId: varchar("product_id", { length: 100 }),
  merchantSlug: varchar("merchant_slug", { length: 100 }),
  
  // Which network won
  networkUsed: varchar("network_used", { length: 20 }).notNull(), // 'awin', 'cj', 'amazon'
  promotionId: varchar("promotion_id", { length: 100 }), // If promo was active
  
  // User context
  sessionId: varchar("session_id", { length: 100 }),
  userQuery: text("user_query"), // What they searched for
  
  // Technical
  redirectUrl: text("redirect_url"),
  responseTimeMs: integer("response_time_ms"),
  
  clickedAt: timestamp("clicked_at").defaultNow(),
});

export const insertClickEventSchema = createInsertSchema(clickEvents).omit({ id: true, clickedAt: true });
export type InsertClickEvent = z.infer<typeof insertClickEventSchema>;
export type ClickEvent = typeof clickEvents.$inferSelect;

// Promotion to network mapping
export const promotionNetworkMap = pgTable("promotion_network_map", {
  id: varchar("id", { length: 100 }).primaryKey().default(sql`gen_random_uuid()`),
  promotionId: varchar("promotion_id", { length: 100 }).notNull(),
  merchantSlug: varchar("merchant_slug", { length: 100 }).notNull(),
  network: varchar("network", { length: 20 }).notNull(),
  discountValue: real("discount_value"), // 10.00 = 10% or £10
  discountType: varchar("discount_type", { length: 20 }), // 'percentage', 'fixed', 'free_shipping'
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPromotionNetworkMapSchema = createInsertSchema(promotionNetworkMap).omit({ id: true, createdAt: true });
export type InsertPromotionNetworkMap = z.infer<typeof insertPromotionNetworkMapSchema>;
export type PromotionNetworkMap = typeof promotionNetworkMap.$inferSelect;
