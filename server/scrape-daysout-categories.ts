import { db } from "./db";
import { attractions } from "@shared/schema";
import { eq, ilike } from "drizzle-orm";

const CATEGORY_URLS = [
  "https://daysout.co.uk/categories/theme-parks",
  "https://daysout.co.uk/categories/zoos-and-safari-parks",
  "https://daysout.co.uk/categories/aquariums",
  "https://daysout.co.uk/categories/tourist-attractions",
  "https://daysout.co.uk/categories/interactive-experiences",
  "https://daysout.co.uk/categories/historical-attractions",
  "https://daysout.co.uk/categories/days-out-for-adults",
  "https://daysout.co.uk/categories/action-and-adventure",
  "https://daysout.co.uk/categories/romantic-couples-days-out",
  "https://daysout.co.uk/categories/family-days-out",
  "https://daysout.co.uk/categories/royal-palaces-castles",
  "https://daysout.co.uk/categories/stadium-tours",
  "https://daysout.co.uk/categories/museums-galleries",
];

interface PriceData {
  name: string;
  price: number;
  url: string;
}

async function fetchCategoryPrices(url: string): Promise<PriceData[]> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SunnyBot/1.0)' }
    });
    if (!response.ok) return [];
    
    const html = await response.text();
    const results: PriceData[] = [];
    
    const attractionPattern = /## ([^\n]+)\n.*?From £(\d+(?:\.\d{2})?) p\/p\n.*?\[Learn more\]\((https:\/\/daysout\.co\.uk\/attractions\/[^)]+)\)/gs;
    
    let match;
    while ((match = attractionPattern.exec(html)) !== null) {
      results.push({
        name: match[1].trim(),
        price: parseFloat(match[2]),
        url: match[3]
      });
    }
    
    const pricePattern = /\[Learn more\]\((https:\/\/daysout\.co\.uk\/attractions\/([^)]+))\).*?From £(\d+(?:\.\d{2})?)/gs;
    while ((match = pricePattern.exec(html)) !== null) {
      if (!results.find(r => r.url === match[1])) {
        results.push({
          name: match[2].replace(/-/g, ' '),
          price: parseFloat(match[3]),
          url: match[1]
        });
      }
    }
    
    return results;
  } catch (error) {
    console.log(`Error fetching ${url}: ${error}`);
    return [];
  }
}

async function main() {
  console.log("=== Daysout.co.uk Category Price Scraper ===\n");
  console.log("Fetching REAL prices from category pages\n");
  
  const allPrices: PriceData[] = [];
  
  for (const url of CATEGORY_URLS) {
    console.log(`Fetching ${url}...`);
    const prices = await fetchCategoryPrices(url);
    console.log(`  Found ${prices.length} attractions with prices`);
    allPrices.push(...prices);
    await new Promise(r => setTimeout(r, 300));
  }
  
  const uniquePrices = new Map<string, PriceData>();
  for (const p of allPrices) {
    if (!uniquePrices.has(p.url)) {
      uniquePrices.set(p.url, p);
    }
  }
  
  console.log(`\nTotal unique attractions with prices: ${uniquePrices.size}`);
  
  let updated = 0;
  let notFound = 0;
  
  for (const [url, data] of uniquePrices) {
    const result = await db
      .select({ id: attractions.id })
      .from(attractions)
      .where(eq(attractions.website, url))
      .limit(1);
    
    if (result.length > 0) {
      await db.update(attractions)
        .set({ 
          ticketPrice: data.price,
          priceAdult: data.price 
        })
        .where(eq(attractions.id, result[0].id));
      console.log(`[UPDATED] ${data.name}: £${data.price}`);
      updated++;
    } else {
      console.log(`[NOT FOUND] ${data.name} (${url})`);
      notFound++;
    }
  }
  
  console.log("\n=== RESULTS ===");
  console.log(`Updated: ${updated}`);
  console.log(`Not found in DB: ${notFound}`);
  
  const stats = await db
    .select({ 
      total: attractions.id,
    })
    .from(attractions)
    .where(eq(attractions.source, "daysout"));
  
  const withPrices = await db.execute(`SELECT COUNT(*) as count FROM attractions WHERE source = 'daysout' AND ticket_price IS NOT NULL`);
  
  console.log(`\nDaysout attractions with prices: ${(withPrices.rows[0] as any).count} of ${stats.length}`);
}

main().catch(console.error);
