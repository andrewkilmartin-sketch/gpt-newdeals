import { db } from "./db";
import { recommendations, events, restaurants } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

function parseCSV(content: string): any[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    
    const row: any = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    rows.push(row);
  }
  
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseBoolean(val: string): boolean | null {
  if (!val || val === '') return null;
  return val.toLowerCase() === 'true';
}

function parseFloat(val: string): number | null {
  if (!val || val === '') return null;
  const num = Number.parseFloat(val);
  return isNaN(num) ? null : num;
}

function parseInt(val: string): number | null {
  if (!val || val === '') return null;
  const num = Number.parseInt(val, 10);
  return isNaN(num) ? null : num;
}

async function importRecommendations() {
  const csvPath = path.join(process.cwd(), 'attached_assets', 'recommendations_1767576047772.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`[RECOMMENDATIONS] Parsed ${rows.length} rows from CSV`);
  
  for (const row of rows) {
    try {
      await db.insert(recommendations).values({
        id: parseInt(row.id) || 0,
        venueName: row.venue_name || '',
        venueNameNormalised: row.venue_name_normalised || null,
        category: row.category || null,
        city: row.city || null,
        region: row.region || null,
        postcode: row.postcode || null,
        website: row.website || null,
        mentionCount: parseInt(row.mention_count),
        positiveMentions: parseInt(row.positive_mentions),
        negativeMentions: parseInt(row.negative_mentions),
        recommendationScore: parseFloat(row.recommendation_score),
        ageBaby: parseBoolean(row.age_baby),
        ageToddler: parseBoolean(row.age_toddler),
        agePreschool: parseBoolean(row.age_preschool),
        agePrimary: parseBoolean(row.age_primary),
        ageTeen: parseBoolean(row.age_teen),
        mentionedParking: parseBoolean(row.mentioned_parking),
        mentionedCafe: parseBoolean(row.mentioned_cafe),
        mentionedBuggyFriendly: parseBoolean(row.mentioned_buggy_friendly),
        mentionedDogFriendly: parseBoolean(row.mentioned_dog_friendly),
        mentionedFreeEntry: parseBoolean(row.mentioned_free_entry),
        firstSeen: row.first_seen || null,
        lastMentioned: row.last_mentioned || null,
        createdAt: row.created_at || null,
      }).onConflictDoNothing();
    } catch (e) {
      console.error(`[RECOMMENDATIONS] Error inserting ${row.venue_name}:`, e);
    }
  }
  
  const count = await db.select().from(recommendations);
  console.log(`[RECOMMENDATIONS] Total in database: ${count.length}`);
}

async function importEvents() {
  const csvPath = path.join(process.cwd(), 'attached_assets', 'events_1767576047773.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`[EVENTS] Parsed ${rows.length} rows from CSV`);
  
  for (const row of rows) {
    try {
      await db.insert(events).values({
        id: parseInt(row.id) || 0,
        name: row.name || '',
        description: row.description || null,
        category: row.category || null,
        tags: row.tags || null,
        startDate: row.start_date || null,
        endDate: row.end_date || null,
        doorTime: row.door_time || null,
        startTime: row.start_time || null,
        endTime: row.end_time || null,
        multipleDates: parseBoolean(row.multiple_dates),
        venueName: row.venue_name || null,
        address: row.address || null,
        city: row.city || null,
        postcode: row.postcode || null,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        parkingInfo: row.parking_info || null,
        priceFrom: parseFloat(row.price_from),
        priceTo: parseFloat(row.price_to),
        adultPrice: parseFloat(row.adult_price),
        childPrice: parseFloat(row.child_price),
        familyTicketPrice: parseFloat(row.family_ticket_price),
        familyTicketInfo: row.family_ticket_info || null,
        underFreeAge: parseInt(row.under_free_age),
        bookingUrl: row.booking_url || null,
        ageRangeMin: parseInt(row.age_range_min),
        ageRangeMax: parseInt(row.age_range_max),
        durationHours: parseFloat(row.duration_hours),
        buggyFriendly: parseBoolean(row.buggy_friendly),
        accessibilityInfo: row.accessibility_info || null,
        foodAvailable: parseBoolean(row.food_available),
        whatToExpect: row.what_to_expect || null,
        sourceUrl: row.source_url || null,
        sourceType: row.source_type || null,
        imageUrl: row.image_url || null,
        lastUpdated: row.last_updated || null,
      }).onConflictDoNothing();
    } catch (e) {
      console.error(`[EVENTS] Error inserting ${row.name}:`, e);
    }
  }
  
  const count = await db.select().from(events);
  console.log(`[EVENTS] Total in database: ${count.length}`);
}

async function importRestaurants() {
  const csvPath = path.join(process.cwd(), 'attached_assets', 'restaurants_1767576047773.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  
  console.log(`[RESTAURANTS] Parsed ${rows.length} rows from CSV`);
  
  for (const row of rows) {
    try {
      await db.insert(restaurants).values({
        id: parseInt(row.id) || 0,
        fhrsId: row.fhrs_id || null,
        name: row.name || '',
        businessType: row.business_type || null,
        addressLine1: row.address_line1 || null,
        addressLine2: row.address_line2 || null,
        city: row.city || null,
        postcode: row.postcode || null,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        localAuthority: row.local_authority || null,
        hygieneRating: parseInt(row.hygiene_rating),
        hygieneDate: row.hygiene_date || null,
        isChain: parseBoolean(row.is_chain),
        chainName: row.chain_name || null,
        chainCategory: row.chain_category || null,
        website: row.website || null,
        phone: row.phone || null,
        hasKidsMenu: parseBoolean(row.has_kids_menu),
        hasHighchairs: parseBoolean(row.has_highchairs),
        hasBabyChanging: parseBoolean(row.has_baby_changing),
        hasKidsPlayArea: parseBoolean(row.has_kids_play_area),
        hasOutdoorSeating: parseBoolean(row.has_outdoor_seating),
        hasParking: parseBoolean(row.has_parking),
        kidsEatFreeDay: row.kids_eat_free_day || null,
        kidsEatFreeTerms: row.kids_eat_free_terms || null,
        whyFamilyFriendly: row.why_family_friendly || null,
        familyTips: row.family_tips || null,
        priceLevel: row.price_level || null,
        source: row.source || null,
        lastUpdated: row.last_updated || null,
        dataProvenance: row.data_provenance || null,
        verificationSource: row.verification_source || null,
        lastVerified: row.last_verified || null,
        blogMentions: parseInt(row.blog_mentions),
        blogPositive: parseInt(row.blog_positive),
        hasBlogRecommendation: parseBoolean(row.has_blog_recommendation),
      }).onConflictDoNothing();
    } catch (e) {
      console.error(`[RESTAURANTS] Error inserting ${row.name}:`, e);
    }
  }
  
  const count = await db.select().from(restaurants);
  console.log(`[RESTAURANTS] Total in database: ${count.length}`);
}

async function main() {
  console.log("=== IMPORTING NEW TABLES ===");
  console.log("All data from real CSV files - NO FABRICATION");
  
  await importRecommendations();
  await importEvents();
  await importRestaurants();
  
  console.log("=== IMPORT COMPLETE ===");
  process.exit(0);
}

main().catch(console.error);
