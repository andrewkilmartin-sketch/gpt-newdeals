import { db } from "./db";
import { attractions } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

interface CSVAttraction {
  id: string;
  name: string;
  category: string;
  address_street: string;
  address_city: string;
  address_postcode: string;
  address_county: string;
  lat: string;
  lon: string;
  website: string;
  phone: string;
  deal_types: string;
  deal_description: string;
  price_adult: string;
  price_child: string;
  price_family: string;
  under_free: string;
  valid_days: string;
  deal_times: string;
  expiry_date: string;
  is_free: string;
  quality_score: string;
  url_status: string;
  quality_tier: string;
  quality_signals: string;
  quality_issues: string;
  last_validated: string;
  description: string;
  opening_hours: string;
  facilities: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseFloat(val: string): number | null {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null;
  const parsed = Number.parseFloat(val);
  return Number.isNaN(parsed) ? null : parsed;
}

async function seedCSVAttractions() {
  console.log("Starting CSV attractions import...");
  
  const csvPath = path.join(process.cwd(), "attached_assets", "attractions_1767567945571.csv");
  
  if (!fs.existsSync(csvPath)) {
    console.error("CSV file not found at:", csvPath);
    process.exit(1);
  }
  
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n");
  
  console.log(`Found ${lines.length} lines in CSV`);
  
  const headers = parseCSVLine(lines[0]);
  console.log("Headers:", headers.slice(0, 10), "...");
  
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => headerIndex[h] = i);
  
  let insertedCount = 0;
  let errorCount = 0;
  let batch: any[] = [];
  const BATCH_SIZE = 100;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVLine(line);
      
      const csvId = values[headerIndex['id']] || '';
      const name = values[headerIndex['name']] || '';
      const category = values[headerIndex['category']] || 'Other';
      const city = values[headerIndex['address_city']] || '';
      const county = values[headerIndex['address_county']] || '';
      const postcode = values[headerIndex['address_postcode']] || '';
      const street = values[headerIndex['address_street']] || '';
      const description = values[headerIndex['description']] || `${name} - a family attraction in ${city || county || 'the UK'}`;
      const website = values[headerIndex['website']] || '';
      const openingHours = values[headerIndex['opening_hours']] || 'Check website';
      const phone = values[headerIndex['phone']] || '';
      const dealTypes = values[headerIndex['deal_types']] || '';
      const dealDescription = values[headerIndex['deal_description']] || '';
      const qualityScore = parseFloat(values[headerIndex['quality_score']]) || 50;
      const lat = parseFloat(values[headerIndex['lat']]);
      const lon = parseFloat(values[headerIndex['lon']]);
      const priceAdult = parseFloat(values[headerIndex['price_adult']]);
      const priceChild = parseFloat(values[headerIndex['price_child']]);
      const priceFamily = parseFloat(values[headerIndex['price_family']]);
      const isFree = values[headerIndex['is_free']]?.toLowerCase() === 'true';
      
      if (!name) {
        errorCount++;
        continue;
      }
      
      const location = city || county || 'UK';
      const address = [street, city, postcode].filter(Boolean).join(', ') || location;
      
      const ticketPrice = priceAdult || priceChild || 0;
      
      const attractionId = `DIRECT_${csvId}`;
      
      batch.push({
        id: attractionId,
        name: name,
        description: description.substring(0, 1000),
        category: category,
        location: location,
        address: address,
        openingHours: openingHours,
        ticketPrice: isFree ? 0 : ticketPrice,
        familyFriendly: true,
        rating: Math.min(5, Math.max(1, qualityScore / 20)),
        website: website || null,
        highlights: [`Family day out`, category, location].filter(Boolean),
        source: 'direct',
        priceAdult: priceAdult,
        priceChild: priceChild,
        priceFamily: priceFamily,
        lat: lat,
        lon: lon,
        phone: phone || null,
        dealTypes: dealTypes || null,
        dealDescription: dealDescription || null,
        postcode: postcode || null,
        county: county || null,
      });
      
      if (batch.length >= BATCH_SIZE) {
        try {
          await db.insert(attractions).values(batch).onConflictDoNothing();
          insertedCount += batch.length;
          console.log(`Inserted batch: ${insertedCount} total`);
        } catch (err) {
          console.error(`Batch insert error at row ${i}:`, err);
          errorCount += batch.length;
        }
        batch = [];
      }
      
    } catch (err) {
      console.error(`Error parsing row ${i}:`, err);
      errorCount++;
    }
  }
  
  if (batch.length > 0) {
    try {
      await db.insert(attractions).values(batch).onConflictDoNothing();
      insertedCount += batch.length;
      console.log(`Inserted final batch: ${insertedCount} total`);
    } catch (err) {
      console.error("Final batch insert error:", err);
      errorCount += batch.length;
    }
  }
  
  console.log("\n========== IMPORT COMPLETE ==========");
  console.log(`Inserted: ${insertedCount}`);
  console.log(`Errors: ${errorCount}`);
  
  const result = await db.select().from(attractions);
  console.log(`Total attractions in database: ${result.length}`);
  
  const sources = await db.execute<{ source: string; count: number }>(
    `SELECT source, COUNT(*) as count FROM attractions GROUP BY source`
  );
  console.log("By source:", sources.rows);
  
  process.exit(0);
}

seedCSVAttractions().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
