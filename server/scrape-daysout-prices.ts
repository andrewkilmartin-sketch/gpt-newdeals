import { db } from "./db";
import { attractions } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

const DELAY_MS = 200;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPrice(url: string): Promise<number | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SunnyBot/1.0)',
        'Accept': 'text/html'
      }
    });
    
    if (!response.ok) {
      console.log(`  [SKIP] HTTP ${response.status} for ${url}`);
      return null;
    }
    
    const html = await response.text();
    
    const pricePatterns = [
      /tickets start from £(\d+(?:\.\d{2})?)/i,
      /from\s*£(\d+(?:\.\d{2})?)/i,
      /From\s*###\s*£(\d+(?:\.\d{2})?)/,
      /£(\d+(?:\.\d{2})?)\s*per person/i,
      /Adult[s]?:?\s*£(\d+(?:\.\d{2})?)/i,
    ];
    
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const price = parseFloat(match[1]);
        if (price > 0 && price < 500) {
          return price;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log(`  [ERROR] Failed to fetch ${url}: ${error}`);
    return null;
  }
}

async function main() {
  console.log("=== Daysout.co.uk Price Scraper ===\n");
  console.log("Fetching REAL prices from live website - NO hardcoding\n");
  
  const daysoutAttractions = await db
    .select({ id: attractions.id, name: attractions.name, website: attractions.website })
    .from(attractions)
    .where(and(eq(attractions.source, "daysout"), isNull(attractions.ticketPrice)));
  
  console.log(`Found ${daysoutAttractions.length} daysout attractions to scrape\n`);
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < daysoutAttractions.length; i++) {
    const attr = daysoutAttractions[i];
    const progress = `[${i + 1}/${daysoutAttractions.length}]`;
    
    if (!attr.website) {
      console.log(`${progress} ${attr.name} - No website URL, skipping`);
      skipped++;
      continue;
    }
    
    console.log(`${progress} Fetching ${attr.name}...`);
    
    const price = await fetchPrice(attr.website);
    
    if (price !== null) {
      await db.update(attractions)
        .set({ 
          ticketPrice: price,
          priceAdult: price 
        })
        .where(eq(attractions.id, attr.id));
      
      console.log(`  [SUCCESS] Price: £${price}`);
      updated++;
    } else {
      console.log(`  [NO PRICE] Could not extract price`);
      failed++;
    }
    
    await sleep(DELAY_MS);
  }
  
  console.log("\n=== SCRAPING COMPLETE ===");
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no URL): ${skipped}`);
  console.log(`Failed (no price found): ${failed}`);
  console.log(`Total: ${daysoutAttractions.length}`);
  
  const verifyResult = await db
    .select({ 
      name: attractions.name, 
      price: attractions.ticketPrice,
      website: attractions.website 
    })
    .from(attractions)
    .where(eq(attractions.source, "daysout"))
    .limit(10);
  
  console.log("\n=== VERIFICATION SAMPLE ===");
  verifyResult.forEach(a => {
    console.log(`${a.name}: £${a.price ?? 'NULL'} (${a.website})`);
  });
}

main().catch(console.error);
