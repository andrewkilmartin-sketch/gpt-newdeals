import { db } from "./db";
import { attractions } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface VerifiedAttraction {
  attraction_name: string;
  displayed_price: string;
}

interface VerifiedData {
  daysout_attractions: VerifiedAttraction[];
}

function parsePrice(displayedPrice: string): number | null {
  if (!displayedPrice) return null;
  const match = displayedPrice.match(/£([\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function main() {
  console.log("=== Importing Verified Daysout Data (CORRECTED PRICES) ===\n");
  console.log("Reading from user-provided JSON file ONLY\n");
  
  const jsonPath = path.join(process.cwd(), "attached_assets/Pasted--daysout-attractions-attraction-name-ABBA-Voyage-displa_1767572631979.txt");
  
  if (!fs.existsSync(jsonPath)) {
    console.error("ERROR: JSON file not found at:", jsonPath);
    process.exit(1);
  }
  
  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const data: VerifiedData = JSON.parse(rawData);
  
  console.log(`Found ${data.daysout_attractions.length} attractions in JSON file\n`);
  
  let imported = 0;
  let skipped = 0;
  
  for (const attr of data.daysout_attractions) {
    const price = parsePrice(attr.displayed_price);
    const slug = generateSlug(attr.attraction_name);
    const id = `daysout-${slug}`;
    const website = `https://daysout.co.uk/attractions/${slug}`;
    
    try {
      await db.insert(attractions).values({
        id: id,
        name: attr.attraction_name,
        description: `${attr.attraction_name} - Book tickets at daysout.co.uk`,
        category: "Attraction",
        location: "UK",
        address: "See website for details",
        openingHours: "See website",
        ticketPrice: price,
        familyFriendly: true,
        rating: 4.0,
        website: website,
        highlights: ["Family day out"],
        source: "daysout",
        priceAdult: price,
      });
      
      console.log(`[IMPORTED] ${attr.attraction_name}: £${price ?? 'N/A'}`);
      imported++;
    } catch (error: any) {
      if (error.message?.includes("duplicate key")) {
        console.log(`[SKIP] Duplicate: ${attr.attraction_name}`);
        skipped++;
      } else {
        console.log(`[ERROR] ${attr.attraction_name}: ${error.message}`);
        skipped++;
      }
    }
  }
  
  console.log("\n=== IMPORT COMPLETE ===");
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total in JSON: ${data.daysout_attractions.length}`);
  
  const verifyCount = await db.select().from(attractions).where(eq(attractions.source, "daysout"));
  console.log(`\nVerification: ${verifyCount.length} daysout attractions now in database`);
  
  console.log("\n=== KEY PRICE VERIFICATION ===");
  const keyAttractions = ["Alton Towers Resort", "Chessington World of Adventures Resort", "THORPE PARK Resort", "ABBA Voyage", "London Zoo"];
  
  for (const name of keyAttractions) {
    const found = verifyCount.find(a => a.name === name);
    if (found) {
      console.log(`${found.name}: £${found.ticketPrice}`);
    }
  }
}

main().catch(console.error);
