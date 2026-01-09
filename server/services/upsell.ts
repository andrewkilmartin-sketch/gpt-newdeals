import { db } from "../db";
import { upsellMappings, upsellClicks, products, type InsertUpsellClick } from "../../shared/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { TMDB_GENRES } from "./tmdb";

interface UpsellProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  affiliateLink: string;
  merchant: string;
  upsellReason: string;
}

interface ContentContext {
  contentId: string;
  contentType: "movie" | "attraction" | "activity";
  genreIds?: number[];
  title?: string;
  category?: string;
}

function getIntentCategoryFromGenres(genreIds: number[]): string[] {
  const categories: string[] = [];
  
  for (const id of genreIds) {
    const genre = TMDB_GENRES[id];
    if (genre) {
      categories.push(genre.toLowerCase());
    }
  }
  
  if (genreIds.includes(10751)) categories.push("kids");
  if (genreIds.includes(16)) categories.push("kids");
  if (genreIds.includes(28) || genreIds.includes(12)) categories.push("adventure");
  if (genreIds.includes(27) || genreIds.includes(53)) categories.push("scary");
  
  return Array.from(new Set(categories));
}

const DEFAULT_UPSELL_KEYWORDS: Record<string, string[]> = {
  "family": ["popcorn", "snacks", "blanket", "family game", "board game"],
  "kids": ["kids toys", "children books", "kids snacks", "activity book"],
  "action": ["gaming", "headphones", "snacks", "energy drinks"],
  "adventure": ["outdoor gear", "camping", "hiking", "backpack"],
  "animation": ["plush toy", "collectible", "poster", "art book"],
  "comedy": ["party supplies", "games", "snacks", "drinks"],
  "horror": ["candles", "blankets", "snacks", "costume"],
  "romance": ["chocolates", "wine glasses", "candles", "flowers"],
  "science fiction": ["gadgets", "tech accessories", "poster", "collectibles"],
  "drama": ["tissues", "wine", "chocolates", "book"],
  "thriller": ["snacks", "drinks", "blanket", "candles"],
  "documentary": ["book", "coffee", "notebook", "educational"],
  "default": ["popcorn", "snacks", "drinks", "blanket"],
};

export async function getUpsellProducts(context: ContentContext, limit = 2): Promise<UpsellProduct[]> {
  let intentCategories: string[] = [];
  
  if (context.genreIds && context.genreIds.length > 0) {
    intentCategories = getIntentCategoryFromGenres(context.genreIds);
  } else if (context.category) {
    intentCategories = [context.category.toLowerCase()];
  }
  
  const mappings = await db.select()
    .from(upsellMappings)
    .where(
      and(
        eq(upsellMappings.contentType, context.contentType),
        eq(upsellMappings.isActive, true),
        intentCategories.length > 0 
          ? inArray(upsellMappings.intentCategory, intentCategories)
          : sql`TRUE`
      )
    )
    .orderBy(sql`priority DESC`)
    .limit(3);
  
  let searchKeywords: string[] = [];
  
  if (mappings.length > 0) {
    searchKeywords = mappings.flatMap(m => m.productKeywords);
  } else {
    const primaryCategory = intentCategories[0] || "default";
    searchKeywords = DEFAULT_UPSELL_KEYWORDS[primaryCategory] || DEFAULT_UPSELL_KEYWORDS["default"];
  }
  
  const results: UpsellProduct[] = [];
  const seenIds = new Set<string>();
  
  const keywordsToTry = searchKeywords.slice(0, limit * 2);
  const keywordConditions = keywordsToTry.map(k => `name ILIKE '%${k.replace(/'/g, "''")}%'`).join(' OR ');
  
  if (keywordConditions) {
    const matchingProducts = await db.select({
      id: products.id,
      name: products.name,
      price: products.price,
      imageUrl: products.imageUrl,
      affiliateLink: products.affiliateLink,
      merchant: products.merchant,
    })
    .from(products)
    .where(sql.raw(`(${keywordConditions})`))
    .limit(limit * 3);
    
    const shuffled = matchingProducts.sort(() => Math.random() - 0.5);
    
    for (const product of shuffled) {
      if (results.length >= limit) break;
      if (!seenIds.has(product.id)) {
        seenIds.add(product.id);
        results.push({
          ...product,
          upsellReason: `Perfect for your ${context.contentType === "movie" ? "movie night" : "day out"}`,
        });
      }
    }
  }
  
  return results.slice(0, limit);
}

export async function trackUpsellClick(
  contentId: string,
  contentType: string,
  productId: string,
  intentCategory?: string,
  sessionId?: string
): Promise<void> {
  const clickData: InsertUpsellClick = {
    contentId,
    contentType,
    productId,
    intentCategory,
    sessionId,
  };
  
  await db.insert(upsellClicks).values(clickData);
}

export async function seedDefaultMappings(): Promise<number> {
  const existingCount = await db.select({ count: sql<number>`count(*)` })
    .from(upsellMappings);
  
  if (existingCount[0].count > 0) {
    console.log("[Upsell] Mappings already seeded");
    return 0;
  }
  
  const defaultMappings = [
    { contentType: "movie", intentCategory: "family", productKeywords: ["popcorn", "family snacks", "blanket", "board game"], priority: 10 },
    { contentType: "movie", intentCategory: "kids", productKeywords: ["kids snacks", "activity book", "plush toy", "puzzle"], priority: 10 },
    { contentType: "movie", intentCategory: "action", productKeywords: ["gaming headset", "energy drinks", "snacks", "poster"], priority: 8 },
    { contentType: "movie", intentCategory: "animation", productKeywords: ["plush toy", "art supplies", "poster", "collectible"], priority: 9 },
    { contentType: "movie", intentCategory: "horror", productKeywords: ["candles", "blanket", "snacks", "costume"], priority: 7 },
    { contentType: "movie", intentCategory: "romance", productKeywords: ["chocolates", "wine glasses", "candles", "flowers"], priority: 8 },
    { contentType: "movie", intentCategory: "comedy", productKeywords: ["party snacks", "games", "drinks", "gummy"], priority: 8 },
    { contentType: "movie", intentCategory: "drama", productKeywords: ["tissues", "chocolate", "tea", "book"], priority: 7 },
    { contentType: "movie", intentCategory: "science fiction", productKeywords: ["gadget", "poster", "collectible", "book"], priority: 7 },
    { contentType: "attraction", intentCategory: "theme_park", productKeywords: ["sunscreen", "water bottle", "backpack", "snacks"], priority: 10 },
    { contentType: "attraction", intentCategory: "zoo", productKeywords: ["binoculars", "camera", "water bottle", "animal book"], priority: 9 },
    { contentType: "attraction", intentCategory: "museum", productKeywords: ["notebook", "camera", "book", "educational toy"], priority: 8 },
    { contentType: "activity", intentCategory: "outdoor", productKeywords: ["sunscreen", "water bottle", "outdoor toy", "picnic"], priority: 9 },
    { contentType: "activity", intentCategory: "craft", productKeywords: ["art supplies", "glue", "paint", "craft kit"], priority: 9 },
    { contentType: "activity", intentCategory: "game", productKeywords: ["board game", "card game", "puzzle", "toy"], priority: 8 },
  ];
  
  for (const mapping of defaultMappings) {
    await db.insert(upsellMappings).values({
      ...mapping,
      isActive: true,
    });
  }
  
  console.log(`[Upsell] Seeded ${defaultMappings.length} default mappings`);
  return defaultMappings.length;
}
